"""
linkedin_coach.py — קובי (LinkedIn) ומאיה (פרופיל).

קובי:
  - פוסטים חמים מהשבוע האחרון, מחיפוש ציבורי (בלי התחברות ל-LinkedIn).
  - לכל פוסט שתי הצעות תגובה. אתה מעתיק, פותח את הפוסט ומגיב בעצמך.
  - טיוטת פוסט שבועית על פרויקט מקורות החיים.
מאיה:
  - שיפורים לפרופיל, רק אם העלית PDF של הפרופיל. משווה לקורות החיים ולתפקידים שאתה מחפש.
כל טקסט מוצע עובר בדיקת מקור: שמות באנגלית ומספרים חייבים להופיע בקורות החיים / בפוסט / בפרופיל.
"""
from __future__ import annotations
import hashlib
import json
import re

from agent_core.llm_router import chat
from agent_core.agents.research import search_web

LATIN = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-]{2,}")
NUM = re.compile(r"\d[\d.,%+]*")
COMMON = {"the", "and", "for", "with", "you", "your", "this", "that", "great", "thanks", "thank", "love", "really",
          "post", "team", "congrats", "congratulations", "what", "how", "why", "would", "linkedin", "open", "work"}


def _names(text: str) -> list[str]:
    out = []
    for sent in re.split(r"(?<=[.!?:\n])\s+", text):
        for i, w in enumerate(LATIN.findall(sent)):
            w = w.strip(".-,")
            if w and (any(c.isupper() for c in w[1:]) or any(c in w for c in "+#") or any(c.isdigit() for c in w)
                      or (w[0].isupper() and i > 0 and w.lower() not in COMMON)):
                out.append(w)
    return out


# שמות שכדאי לתפוס אם הומצאו: טכנולוגיות וחברות מוכרות. מילה רגילה באנגלית (Aspiring, Seeking) לא נחסמת.
KNOWN = {w.lower() for w in """Python Java JavaScript TypeScript Go Golang Rust Ruby PHP Kotlin Swift Scala C# C++ SQL NoSQL
React Angular Vue Svelte Next.js Node.js Node Express Django Flask FastAPI Spring .NET GraphQL REST gRPC Kafka RabbitMQ Redis
MongoDB PostgreSQL MySQL Elasticsearch Docker Kubernetes Terraform Ansible Jenkins AWS Azure GCP Linux Git GitHub GitLab
TensorFlow PyTorch Keras OpenCV LangChain LangGraph Pandas NumPy Spark Hadoop Airflow Tableau Figma Selenium Playwright Cypress
Google Microsoft Amazon Meta Apple Intel Nvidia IBM Oracle Salesforce Wix Monday Mobileye Waze Fiverr Check Point CyberArk
Technion Bar-Ilan Ben-Gurion Reichman HIT Afeka Ariel Harvard Stanford MIT 8200 Talpiot Mamram""".split()}


def grounded(text: str, source: str) -> bool:
    """שם מוכר (טכנולוגיה, חברה, מוסד), שם עם אותיות גדולות באמצע (OpenCV) ומספר — חייבים להופיע במקור."""
    s = source.lower()
    for n in _names(text):
        camel = any(any(c.isupper() for c in part[1:]) for part in n.split("-"))  # OpenCV כן, Full-Stack לא
        risky = n.lower() in KNOWN or camel or any(c in n for c in "+#") or any(c.isdigit() for c in n)
        if risky and n.lower() not in s:
            return False
    return all(n.strip(".,") in s for n in NUM.findall(text) if n.strip(".,"))


def _json(raw: str) -> dict:
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        return json.loads(m.group(0)) if m else {}
    except ValueError:
        return {}


# ── קובי: פוסטים חמים ─────────────────────────────────────────────────────────
def find_posts(plan: dict, limit: int = 5) -> list[dict]:
    roles = [t for t in plan.get("titles", [])][:2] or ["software developer"]
    qs = [f'site:linkedin.com/posts hiring junior {r} Israel' for r in roles] + \
         ['site:linkedin.com/posts "we are hiring" junior developer Tel Aviv', 'site:linkedin.com/posts מגייסים ג׳וניור מפתח']
    seen, out = set(), []
    for q in qs:
        try:
            from ddgs import DDGS
            res = DDGS().text(q, region="wt-wt", timelimit="w", max_results=8) or []
        except Exception as e:  # noqa: BLE001
            print(f"[קובי] חיפוש נכשל: {type(e).__name__}"); res = []
        for r in res:
            url = r.get("href", "")
            if "linkedin.com/posts/" not in url or url in seen:
                continue
            seen.add(url)
            title = r.get("title", "")
            author = re.split(r" on LinkedIn| posted on| \| LinkedIn|'s Post", title)[0].strip(" -–:")
            out.append({"id": "p-" + hashlib.sha1(url.encode()).hexdigest()[:10], "url": url, "author": author[:60] or "LinkedIn",
                        "text": (r.get("body") or "").strip()[:600]})
    return out[: limit * 2]


POST_PROMPT = """A job seeker wants to leave a thoughtful public comment on this LinkedIn post. 
POST by {author}:
{text}

CANDIDATE CV:
{cv}

Decide if the post is relevant for a junior/student developer looking for work in Israel (hiring, career advice, tech in Israel).
Write 2 comment options in the SAME language as the post (Hebrew or English), each 1-3 sentences, natural, no hashtags, no "Great post!" openers:
 - "ניסיון אישי": relates one concrete thing from the CV to the post
 - "שאלה": a genuine question that adds to the discussion
Use ONLY facts from the CV. Return JSON only:
{{"relevant": true/false, "why": "short Hebrew: why this post is worth commenting on", "lang": "he"/"en",
  "drafts": [{{"k": "ניסיון אישי", "t": "..."}}, {{"k": "שאלה", "t": "..."}}]}}"""


def hot_posts(plan: dict, cv: str, limit: int = 5) -> list[dict]:
    out = []
    for p in find_posts(plan, limit):
        if len(out) >= limit or len(p["text"]) < 60:
            continue
        d = _json(chat("linkedin", "comment_drafts", [{"role": "user", "content": POST_PROMPT.format(
            author=p["author"], text=p["text"], cv=cv[:3000])}], tier="write", max_tokens=1200))
        if not d.get("relevant"):
            continue
        drafts = [x for x in (d.get("drafts") or [])[:2] if grounded(str(x.get("t", "")), cv + " " + p["text"] + " " + p["author"])]
        if drafts:
            out.append({**p, "why": str(d.get("why", ""))[:90], "lang": "he" if d.get("lang") == "he" else "en",
                        "drafts": [{"k": str(x.get("k", ""))[:20], "t": str(x["t"])[:600]} for x in drafts]})
    return out


# ── קובי: טיוטת פוסט שבועית ───────────────────────────────────────────────────
DRAFT_PROMPT = """Write a short LinkedIn post (60-110 words) in Hebrew for this candidate, "building in public" style,
about ONE project from the CV: what it does, one real challenge, one lesson, and end with a question to readers.
Keep technology names in English. Use ONLY facts written in the CV. No hashtags spam (max 2). Output only the post.

CV:
{cv}"""


def weekly_draft(cv: str) -> str:
    t = chat("linkedin", "weekly_post", [{"role": "user", "content": DRAFT_PROMPT.format(cv=cv[:4000])}], tier="write", max_tokens=600)
    parts = re.split(r"(?<=[.!?])\s+", t.strip())
    return " ".join(p for p in parts if grounded(p, cv)).strip()


# ── מאיה: שיפורי פרופיל מתוך PDF של הפרופיל ───────────────────────────────────
FIX_PROMPT = """You review a candidate's LinkedIn profile (exported PDF text) against their CV and target roles.
Suggest up to 5 concrete improvements, most impactful first. For each: a short Hebrew title, a short Hebrew reason,
and "copy": ready-to-paste English text when relevant (headline, About, skills list), else "".
Use ONLY facts from the CV and the profile. Do not invent achievements or numbers.

TARGET ROLES: {roles}
CV:
{cv}

LINKEDIN PROFILE:
{li}

Return JSON only: {{"fixes": [{{"t": "...", "why": "...", "copy": "..."}}]}}"""


def profile_fixes(cv: str, li_text: str, plan: dict) -> list[dict]:
    if len(li_text.strip()) < 80:
        return []
    prompt = FIX_PROMPT.format(roles=", ".join(plan.get("titles", [])[:3]), cv=cv[:4000], li=li_text[:5000])
    d = _json(chat("coach", "linkedin_profile", [{"role": "user", "content": prompt}], tier="judge", max_tokens=2500))
    if not d.get("fixes"):
        d = _json(chat("coach", "linkedin_profile_retry", [{"role": "user", "content": prompt + "\n\nReturn ONLY the JSON object."}],
                       tier="judge", max_tokens=2500))
    if not d.get("fixes"):
        print("[מאיה] המודל לא החזיר שיפורים בפורמט תקין")
    out = []
    for i, f in enumerate((d.get("fixes") or [])[:5]):
        copy = str(f.get("copy", ""))[:1200]
        if copy and not grounded(copy, cv + " " + li_text + " " + " ".join(plan.get("titles", []))):
            print(f"[מאיה] נזרק שיפור עם פרט שלא מופיע בקורות החיים או בפרופיל: {f.get('t')}")
            continue
        out.append({"id": f"f{i + 1}", "t": str(f.get("t", ""))[:80], "why": str(f.get("why", ""))[:160], "copy": copy})
    return out


def li_hash(li_text: str) -> str:
    return "v2-" + hashlib.sha1((li_text or "").strip().encode()).hexdigest()[:12]  # v2: בדיקת מקור מעודכנת
