"""
growth.py — לסגור את הפער בין מה שהמשרות מבקשות לבין מה שמופיע אצלך.

מאיה (coach):  כרטיס לכל כישור שחסר שוב ושוב במשרות שמתאימות לך — מה זה, איפה ביקשו, איך מכניסים לפרויקט שלך,
               ושני מקורות לימוד חינמיים (קישורים מתוצאות חיפוש אמיתיות בלבד). בנוסף: רעיון לפרויקט אחד שסוגר כמה פערים.
קובי (linkedin): עובר על הריפוזיטוריז הציבוריים שלך ב-GitHub ומוצא מה עשית ולא כתבת בקורות החיים.
               כל הצעה מצביעה על קובץ אמיתי (README, Dockerfile, workflow...). שום דבר לא משתנה בלי אישור שלך.
"""
from __future__ import annotations
import base64
import json
import os
import re

import httpx

from agent_core import activity as act
from agent_core.llm_router import chat
from agent_core.agents.linkedin_coach import grounded, _json

GOOD_DOMAINS = ("docs.", "developer.", "learn.microsoft.com", "freecodecamp.org", "github.com", "docker.com", "kubernetes.io",
                "aws.amazon.com", "cloud.google.com", "roadmap.sh", "w3schools.com", "developer.mozilla.org", "coursera.org",
                "edx.org", "youtube.com", "realpython.com", "fast.ai", "huggingface.co", "kaggle.com", "khanacademy.org",
                "solidworks.com", "autodesk.com", "ansys.com", "mit.edu", "nptel.ac.in")


def _search(q: str, n: int = 8) -> list[dict]:
    try:
        from ddgs import DDGS
        return [{"title": r.get("title", ""), "url": r.get("href", ""), "text": r.get("body", "")} for r in DDGS().text(q, max_results=n) or []]
    except Exception:  # noqa: BLE001
        return []


def resources(skill: str, k: int = 2) -> list[dict]:
    """שני מקורות לימוד חינמיים. רק קישורים שהופיעו בתוצאות חיפוש, ורק מאתרים מוכרים."""
    out, seen = [], set()
    for q in (f"{skill} official getting started tutorial", f"{skill} free course beginners"):
        for r in _search(q):
            dom = re.sub(r"^https?://", "", r["url"]).split("/")[0].lower()
            if r["url"] in seen or not any(d in dom for d in GOOD_DOMAINS):
                continue
            seen.add(r["url"]); out.append({"title": r["title"][:90], "url": r["url"], "site": dom.replace("www.", "")})
            if len(out) >= k:
                return out
    return out


CARD_PROMPT = """You coach a job seeker. A skill keeps appearing as a gap in jobs that fit them.
SKILL: {skill}
JOBS THAT ASKED FOR IT: {jobs}
CANDIDATE CV:
{cv}

Return JSON only: {{"what": "1-2 sentences in Hebrew: what it is and why these jobs ask for it",
 "how": "1-2 sentences in Hebrew: a concrete way to add it to ONE project that is written in the CV (name the project exactly as in the CV). If no project fits, suggest a tiny new exercise.",
 "time": "rough time to learn the basics, in Hebrew, e.g. 'סוף שבוע' or '3-4 ערבים'"}}
Keep technology and project names in English. Never claim the candidate already knows the skill."""

PROJECT_PROMPT = """Suggest ONE small portfolio project (or an upgrade to a project already in the CV) that closes several of these gaps at once: {gaps}.
CANDIDATE CV:
{cv}
Return JSON only: {{"title": "short name", "pitch": "2 sentences in Hebrew", "steps": ["3-5 short steps in Hebrew"], "covers": ["gap names it covers, from the list"]}}
Prefer upgrading an existing CV project (name it exactly as written). Keep tech names in English."""


def skill_cards(gaps: list[dict], cv: str, examples: dict[str, list[str]], k: int = 3) -> dict:
    cards = []
    for g in gaps[:k]:
        sk = g["skill"]
        jobs = examples.get(sk, [])[:3]
        d = _json(chat("coach", "skill_card", [{"role": "user", "content": CARD_PROMPT.format(skill=sk, jobs="; ".join(jobs) or "-", cv=cv[:4000])}],
                       tier="judge", max_tokens=900))
        how = d.get("how", "")
        if how and not grounded(how, cv + " " + sk):   # פרויקט או טכנולוגיה שלא כתובים אצלך — לא מציעים
            how = ""
        cards.append({"skill": sk, "jobs": g["jobs"], "examples": jobs, "what": d.get("what", ""), "how": how,
                      "time": d.get("time", ""), "learn": resources(sk)})
        act.log("coach", f"כרטיס כישור: {sk} (חסר ב-{g['jobs']} משרות). מצאתי {len(cards[-1]['learn'])} מקורות לימוד.")
    project = None
    if len(gaps) >= 2:
        d = _json(chat("coach", "skill_project", [{"role": "user", "content": PROJECT_PROMPT.format(gaps=", ".join(x["skill"] for x in gaps[:5]), cv=cv[:4000])}],
                       tier="judge", max_tokens=900))
        if d.get("title") and grounded(d.get("pitch", "") + " " + " ".join(d.get("steps") or []), cv + " " + " ".join(x["skill"] for x in gaps)):
            project = {"title": d["title"], "pitch": d.get("pitch", ""), "steps": (d.get("steps") or [])[:5],
                       "covers": [c for c in d.get("covers") or [] if any(c.lower() == x["skill"].lower() for x in gaps)]}
            act.log("coach", f"רעיון לפרויקט שסוגר כמה פערים: {project['title']}", to="linkedin")
    return {"cards": cards, "project": project}


# ── קובי: ראיות מ-GitHub ───────────────────────────────────────────────────────
SIGNAL_FILES = ("Dockerfile", "docker-compose.yml", "docker-compose.yaml", "requirements.txt", "package.json", "pyproject.toml",
                "vercel.json", "netlify.toml", "Procfile", "pom.xml", "build.gradle", "CMakeLists.txt", "Makefile")


def github_evidence(user: str, max_repos: int = 6) -> list[dict]:
    """ריפוזיטוריז ציבוריים בלבד, בקריאה. מחזיר לכל אחד: שפות, קבצים מעידים, README."""
    h = {"Accept": "application/vnd.github+json", "User-Agent": "findjob"}
    if os.environ.get("GITHUB_TOKEN"):
        h["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    out = []
    with httpx.Client(timeout=15, headers=h) as cx:
        r = cx.get(f"https://api.github.com/users/{user}/repos", params={"sort": "pushed", "per_page": 30, "type": "owner"})
        if r.status_code != 200:
            return []
        repos = [x for x in r.json() if not x.get("fork") and not x.get("private")][:max_repos]
        for rp in repos:
            name, base = rp["name"], f"https://api.github.com/repos/{user}/{rp['name']}"
            ev = {"repo": name, "url": rp["html_url"], "desc": rp.get("description") or "", "files": [], "langs": [], "readme": "", "workflows": []}
            try:
                ev["langs"] = list((cx.get(base + "/languages").json() or {}).keys())[:6]
                root = cx.get(base + "/contents").json()
                names = [f["name"] for f in root if isinstance(f, dict)]
                ev["files"] = [n for n in names if n in SIGNAL_FILES]
                if ".github" in names:
                    wf = cx.get(base + "/contents/.github/workflows")
                    if wf.status_code == 200:
                        ev["workflows"] = [f["name"] for f in wf.json() if isinstance(f, dict)][:5]
                for fn in ("package.json", "requirements.txt"):
                    if fn in names:
                        c = cx.get(base + f"/contents/{fn}").json()
                        txt = base64.b64decode(c.get("content", "")).decode("utf-8", "ignore")
                        deps = list((json.loads(txt).get("dependencies") or {}).keys()) if fn == "package.json" else \
                            [re.split(r"[=<>~\[ ]", l)[0] for l in txt.splitlines() if l.strip() and not l.startswith("#")]
                        ev["files"].append(f"{fn}: " + ", ".join(deps[:25]))
                rd = cx.get(base + "/readme")
                if rd.status_code == 200:
                    ev["readme"] = base64.b64decode(rd.json().get("content", "")).decode("utf-8", "ignore")[:2500]
            except (httpx.HTTPError, ValueError, KeyError):
                pass
            out.append(ev)
    return out


def evidence_text(ev: dict) -> str:
    return (f"REPO {ev['repo']} ({ev['url']}): {ev['desc']}\nlanguages: {', '.join(ev['langs'])}\nfiles: {'; '.join(ev['files'])}\n"
            f"GitHub Actions workflows: {', '.join(ev['workflows']) or 'none'}\nREADME: {ev['readme'][:1800]}")


CV_PROMPT = """Compare the candidate's CV with evidence from their public GitHub repositories.
Find things they clearly DID (shown in the repo files) that are missing or under-described in the CV,
especially skills that jobs asked for: {gaps}.

CV:
{cv}

GITHUB EVIDENCE:
{ev}

Return JSON only: {{"suggestions": [up to 5 items, each {{
  "repo": "repo name from the evidence",
  "line": "one CV bullet in English, past tense, factual, max 22 words; only facts shown in that repo",
  "where": "which CV section/project it belongs to (as written in the CV), or 'Projects'",
  "why": "one sentence in Hebrew: what this shows an employer and which job requirement it answers",
  "proof": "the exact file or README phrase that proves it"}}]}}
Never invent numbers, users, companies or results. Skip anything already clearly written in the CV."""


def cv_suggestions(cv: str, evidence: list[dict], gaps: list[str]) -> list[dict]:
    if not evidence:
        return []
    ev_by = {e["repo"].lower(): e for e in evidence}
    d = _json(chat("linkedin", "cv_suggest", [{"role": "user", "content": CV_PROMPT.format(
        gaps=", ".join(gaps) or "-", cv=cv[:5000], ev="\n\n".join(evidence_text(e) for e in evidence)[:9000])}], tier="judge", max_tokens=1800))
    out = []
    for s in (d.get("suggestions") or [])[:5]:
        e = ev_by.get(str(s.get("repo", "")).lower())
        line = str(s.get("line", "")).strip()
        if not e or not line:
            continue
        if not grounded(line, evidence_text(e) + " " + cv):   # כל טכנולוגיה ומספר בשורה חייבים להופיע בריפו או בקורות החיים
            act.log("linkedin", f"זרקתי הצעה על {e['repo']}: יש בה פרט שלא מופיע בריפו.")
            continue
        out.append({"repo": e["repo"], "url": e["url"], "line": line, "where": str(s.get("where", "Projects"))[:60],
                    "why": str(s.get("why", ""))[:200], "proof": str(s.get("proof", ""))[:120]})
    act.log("linkedin", f"עברתי על {len(evidence)} ריפוזיטוריז ב-GitHub: {len(out)} דברים שעשית ולא כתובים בקורות החיים.")
    return out
