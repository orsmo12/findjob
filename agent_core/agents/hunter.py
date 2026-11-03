"""
hunter.py — דורון, צייד משרות.

  plan (יואב) → איסוף (JobSpy) → ניקוי ואיחוד כפילויות → סינון בכירות בקוד →
  דירוג 1–5 ב-AI רק ל-N המובילות → memory/feed/jobs.json (מה שהאפליקציה מציגה)

כללים:
  - רק מודעות ציבוריות. אין התחברות לשום חשבון.
  - שכר מוצג רק אם פורסם במודעה. אחרת ריק.
  - אם חסר תיאור מלא, הדירוג מסומן partial=True.
  - הסיבות ומה שחסר נשענים רק על קורות החיים, השאלון והמודעה.
"""

from __future__ import annotations
import hashlib
import json
import math
import re
from datetime import datetime, date, timezone
from pathlib import Path

from agent_core.llm_router import chat
from agent_core.budget_guard import BudgetDeferred
from agent_core import activity as act

ROOT = Path(__file__).resolve().parents[2]
FEED = ROOT / "memory" / "feed" / "jobs.json"
SEEN = ROOT / "memory" / "seen_jobs.json"

SENIOR_WORDS = re.compile(r"\b(senior|sr\.?|staff|principal|lead|head|manager|architect|director|vp)\b", re.I)
# רק "N שנות ניסיון" — לא "2 שנות לימוד שנותרו" או "שנה ג׳ לתואר"
YEARS_RE = re.compile(r"(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*\+?\s*)?(?:years?|yrs)\b(?![^\n.]{0,40}?(?:left|remain|degree|stud|academ|graduat|old|of age))"
                      r"|(\d{1,2})\s*\+?\s*שנות\s+ניסיון", re.I)
JUNIOR_TITLE = re.compile(r"\b(junior|jr\.?|student|intern|internship|graduate|entry|new grad)\b|סטודנט|ג'וניור|ג׳וניור", re.I)


# ── איסוף ──────────────────────────────────────────────────────────────────────
def _clean(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and math.isnan(v):
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("nan", "none", "nat") else s


def salary_text(row: dict) -> str:
    """רק שכר שבאמת פורסם. אחרת מחרוזת ריקה."""
    lo, hi = _clean(row.get("min_amount")), _clean(row.get("max_amount"))
    if not lo and not hi:
        return ""
    cur = {"ILS": "₪", "USD": "$", "EUR": "€"}.get(_clean(row.get("currency")).upper(), "")
    per = {"yearly": " לשנה", "monthly": " לחודש", "hourly": " לשעה"}.get(_clean(row.get("interval")).lower(), "")
    fmt = lambda x: f"{int(float(x)):,}"
    return f"{cur}{fmt(lo)}–{fmt(hi)}{per}" if lo and hi else f"{cur}{fmt(lo or hi)}{per}"


def collect(plan: dict, per_search: int = 20) -> list[dict]:
    """JobSpy לפי התוכנית: עד 6 שאילתות × 2 אזורים. LinkedIn כמודעות ציבוריות בלבד."""
    from jobspy import scrape_jobs
    out = []
    for q in plan.get("queries", [])[:6]:
        for loc in plan.get("locations", ["Israel"])[:2]:
            try:
                df = scrape_jobs(
                    site_name=["indeed", "linkedin"],  # Google Jobs לא מחזיר תוצאות משרתי ענן
                    search_term=q, location=loc, results_wanted=per_search, hours_old=24 * 7,
                    country_indeed="Israel", is_remote=bool(plan.get("remote_only")),
                    google_search_term=f"{q} jobs in {loc}, Israel since last week",
                    description_format="markdown", linkedin_fetch_description=False,
                )
            except Exception as e:  # מקור אחד שנכשל לא מפיל את כל החיפוש
                act.log("hunter", f"החיפוש '{q}' ב{loc} נכשל ({type(e).__name__}). ממשיך הלאה.")
                continue
            act.log("hunter", f"LinkedIn + Indeed: '{q}' ב{loc} → {len(df)} משרות")
            for _, row in df.iterrows():
                r = row.to_dict()
                out.append({
                    "title": _clean(r.get("title")), "company": _clean(r.get("company")),
                    "location": _clean(r.get("location")) or loc, "url": _clean(r.get("job_url")),
                    "description": _clean(r.get("description"))[:6000], "source": _clean(r.get("site")),
                    "posted": _clean(r.get("date_posted")), "salary": salary_text(r),
                    "remote": bool(r.get("is_remote")) if _clean(r.get("is_remote")) else False,
                    "query": q,
                })
    return out


# ── ניקוי, כפילויות, סינון ─────────────────────────────────────────────────────
def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9א-ת]+", " ", (s or "").lower()).strip()


def job_id(j: dict) -> str:
    return "j-" + hashlib.sha1(f"{norm(j['company'])}|{norm(j['title'])}".encode()).hexdigest()[:10]


def dedupe(jobs: list[dict]) -> list[dict]:
    seen, out = set(), []
    for j in jobs:
        if not j.get("title") or not j.get("company"):
            continue
        k = job_id(j)
        if k in seen:
            continue
        seen.add(k); j["id"] = k; out.append(j)
    return out


def years_phrase(desc: str) -> str:
    m = YEARS_RE.search(desc or "")
    return " ".join(desc[max(0, m.start() - 25): m.end() + 35].split()) if m else ""


def too_senior(job: dict, plan: dict) -> bool:
    levels = set(plan.get("levels", []))
    if levels & {"student", "intern", "junior", "entry"} and SENIOR_WORDS.search(job.get("title", "")):
        return True
    mx = plan.get("max_years")
    if mx:
        ys = [int(a or b) for a, b in YEARS_RE.findall(job.get("description", ""))]
        if ys and min(ys) > mx + 1:  # שנה אחת "מתיחה" מותרת: מודעות לג׳וניור כותבות לא פעם 2+ שנים
            return True
    return False


def ai_too_senior(r: dict, plan: dict, title: str = "") -> bool:
    """שנות הניסיון שה-AI קרא מהמודעה הן הקובעות (עם שנה מתיחה).
    seniority_ok=false נאכף רק כשאין מספר שנים — למשל ראש צוות או מנהל."""
    req = r.get("required_years", 0) or 0
    if req:
        return years_too_many(req, plan)
    if JUNIOR_TITLE.search(title):  # משרה שמוגדרת לג׳וניור/סטודנט ואין דרישת שנים — לא בכירה
        return False
    return not r.get("seniority_ok", True)


def years_too_many(req: int, plan: dict) -> bool:
    """שנות הניסיון שה-AI קרא מהמודעה, נאכפות בקוד: מעל המקסימום שלך + שנה אחת = לא מוצג."""
    mx = plan.get("max_years")
    return bool(mx) and req > mx + 1


def prefilter(jobs: list[dict], plan: dict, seen_ids: set[str]) -> tuple[list[dict], dict]:
    stats = {"collected": len(jobs), "too_senior": 0, "already_seen": 0}
    keep = []
    for j in jobs:
        if j["id"] in seen_ids:
            stats["already_seen"] += 1; continue
        if too_senior(j, plan):
            stats["too_senior"] += 1; continue
        keep.append(j)
    return keep, stats


def cheap_rank(j: dict, plan: dict, cv: str) -> int:
    """מיון ראשוני בלי AI כדי לבחור את מי שווה לדרג: חפיפת מילים בין קורות החיים למודעה."""
    words = {w for w in re.findall(r"[a-z][a-z+#.]{1,}", cv.lower()) if len(w) > 2}
    text = (j["title"] + " " + j.get("description", "")).lower()
    s = sum(1 for w in words if w in text)
    if any(t.lower() in j["title"].lower() for t in plan.get("titles", [])):
        s += 5
    return s


# ── השלמת תיאור מהעמוד הציבורי של המשרה ──────────────────────────────────────
def _html_text(html: str) -> str:
    import html as H
    html = re.sub(r"<(br|/p|/li|/div|/h\d)[^>]*>", "\n", html, flags=re.I)
    html = re.sub(r"<li[^>]*>", "• ", html, flags=re.I)
    txt = H.unescape(re.sub(r"<[^>]+>", "", html))
    return re.sub(r"\n\s*\n+", "\n", txt).strip()


_LAST_LI = [0.0]


def _li_get(url: str):
    """בקשה ל-LinkedIn בקצב מתון. הוא חוסם (429) כשמגיעות הרבה בקשות מהר משרתי ענן."""
    import httpx, time
    wait = 1.6 - (time.time() - _LAST_LI[0])
    if wait > 0:
        time.sleep(wait)
    _LAST_LI[0] = time.time()
    return httpx.get(url, timeout=15, follow_redirects=True,
                     headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
                              "Accept-Language": "en-US,en;q=0.9"})


def _li_desc(html: str) -> str:
    mm = re.search(r'show-more-less-html__markup[^>]*>(.*?)</div>', html, re.S)
    if mm:
        return _html_text(mm.group(1))
    mm = re.search(r'"description"\s*:\s*"((?:[^"\\]|\\.)*)"', html)  # JSON-LD בעמוד הציבורי
    if mm:
        try:
            return _html_text(json.loads('"' + mm.group(1) + '"'))
        except ValueError:
            pass
    return ""


def enrich(job: dict, tries: tuple[float, ...] = (0, 5, 12)) -> dict:
    """מודעות LinkedIn מגיעות בלי תיאור. מביאים אותו מהעמוד הציבורי של המשרה (בלי התחברות).
    אם LinkedIn חוסם — מחכים ומנסים שוב, ואז דרך עמוד המשרה עצמו."""
    if len(job.get("description", "")) >= 300 or "linkedin.com/jobs/view/" not in job.get("url", ""):
        return job
    m = re.search(r"/jobs/view/(?:[^/?]*-)?(\d+)", job["url"])
    if not m:
        return job
    import time
    urls = [f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{m.group(1)}",
            f"https://www.linkedin.com/jobs/view/{m.group(1)}"]
    last = ""
    for i, delay in enumerate(tries):
        if delay:
            time.sleep(delay)
        for u in urls:
            try:
                r = _li_get(u)
                last = str(r.status_code)
                if r.status_code == 200:
                    d = _li_desc(r.text)
                    if len(d) >= 300:
                        job["description"] = d[:6000]
                        return job
                elif r.status_code in (404, 410):
                    return job
            except Exception as e:  # noqa: BLE001
                last = type(e).__name__
    print(f"[דורון] לא הצלחתי להביא תיאור: {job['title']} ({last})")
    return job


def has_full_ad(job: dict) -> bool:
    return len(job.get("description", "")) >= 300


# ── דירוג ב-AI ─────────────────────────────────────────────────────────────────
RANK_PROMPT = """You rate how well a job fits a candidate. Use ONLY facts written in the CV, the preferences and the job ad.
Never invent experience, numbers or requirements.

CANDIDATE CV:
{cv}

CANDIDATE PREFERENCES:
{prefs}

JOB: {title} at {company} ({location})
{desc}

How to judge:
1. Split the ad into CORE requirements (under "Requirements", "Must", "What you bring", "You have") and NICE-TO-HAVE
   (anything marked "advantage", "a plus", "bonus", "nice to have", "also valuable", "preferred").
   Missing nice-to-have items lower the score by at most 0.3 in total. Missing CORE items matter most.
2. "required_years": the minimum years of professional work experience the ad demands as a CORE requirement
   (e.g. "3+ years of experience" -> 3, "2-4 years" -> 2). 0 if the ad asks for none or is for students/juniors.
   Years of a degree or "years of hands-on with X in projects" do not count as work years.
3. For juniors and students, personal, academic and side projects written in the CV DO count as hands-on experience
   with the technologies they use.
4. If the ad needs no prior job and asks for skills the CV shows (in projects too), the score should be high (4+).

Return JSON only:
{{"fit": number 1.0-5.0 with one decimal,
  "required_years": integer,
  "reasons": [up to 3 short reasons, each naming a concrete CV fact (project, course, tool) that matches a CORE requirement],
  "gaps": [up to 2 short items: CORE requirements written in the ad that the CV does not show; only nice-to-have if no core gaps],
  "seniority_ok": true/false (false if the ad clearly needs more work experience than the candidate has)}}
Write reasons and gaps in natural, fluent Hebrew (as a native Israeli recruiter would), max 12 words each.
Keep technology, project and company names in English, spelled exactly as they appear in the CV or ad.
Do not use location as a reason.
Scale: 5 = almost every core requirement is shown in the CV and the level fits; 3 = partial match; 1 = wrong field or level."""


def parse_rating(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
        fit = round(max(1.0, min(5.0, float(d.get("fit", 0)))), 1)
        clip = lambda xs, n: [str(x).strip()[:140] for x in (xs or []) if str(x).strip()][:n]
        return {"fit": fit, "reasons": clip(d.get("reasons"), 3), "gaps": clip(d.get("gaps"), 2),
                "seniority_ok": bool(d.get("seniority_ok", True)), "required_years": d.get("required_years", 0)}
    except (ValueError, TypeError):
        return None


def rate(job: dict, cv: str, prefs: str) -> dict | None:
    desc = job.get("description", "")
    prompt = RANK_PROMPT.format(cv=cv[:5000], prefs=prefs, title=job["title"], company=job["company"],
                                location=job["location"], desc=(desc[:3500] or "(no description available)"))
    r = parse_rating(chat("hunter", "rate_job", [{"role": "user", "content": prompt}], tier="judge", max_tokens=1600, temperature=0))
    if r is None:  # תשובה שנחתכה או לא בפורמט — ניסיון נוסף אחד
        r = parse_rating(chat("hunter", "rate_job_retry", [{"role": "user", "content": prompt + "\n\nReturn ONLY the JSON object, nothing else."}],
                              tier="judge", max_tokens=1600, temperature=0))
    if r is None:
        act.log("hunter", f"לא הצלחתי לדרג את {job['title']} ב-{job['company']}. אנסה בריצה הבאה.")  # בלי json_mode: חלק מהמודלים נכשלים בו; parse_rating מחלץ את ה-JSON
    if r:
        try:
            r["required_years"] = int(float(r.get("required_years") or 0))
        except (TypeError, ValueError):
            r["required_years"] = 0
        print(f"[דורון/אבחון] {job['title']} @ {job['company']}: fit={r['fit']} years={r['required_years']} ok={r['seniority_ok']} "
              f"reasons={r['reasons']} gaps={r['gaps']} desc_len={len(desc)}")
        r["reasons"] = grounded(r["reasons"], cv)        # סיבה = עובדה מקורות החיים
        r["gaps"] = grounded(r["gaps"], desc)             # חסר = דרישה שכתובה במודעה
        r["partial"] = len(desc) < 300
        if r["partial"]:
            r["gaps"] = []  # בלי המודעה המלאה אין לנו דרישות אמיתיות להשוות אליהן
    return r


LATIN = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-]{2,}")


def _norm_term(w: str) -> str:
    w = w.lower().strip(".-,;:()")
    for suf in (".js", ".py", "'s", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 2:
            w = w[: -len(suf)]
    return w.replace("-", "").replace(".", "")


def grounded(items: list[str], source: str) -> list[str]:
    """בדיקת מקור: כל שם באנגלית (טכנולוגיה, מוסד, חברה) חייב להופיע בטקסט המקור. אחרת המשפט נזרק.
    ההשוואה סלחנית לרישיות, רבים (LLMs/LLM), סיומות .js ומקפים — אבל לא ממציאה."""
    src_raw = source.lower()
    src_norm = re.sub(r"[\s\-.]", "", src_raw)
    def ok(w: str) -> bool:
        lw = w.lower().strip(".-,;:()")
        return lw in src_raw or _norm_term(w) in src_norm
    return [t for t in items if all(ok(w) for w in LATIN.findall(t))]


def prefs_text(plan: dict) -> str:
    return "; ".join(plan.get("why", [])) or "none given"


# ── ריצה ───────────────────────────────────────────────────────────────────────
TECH = ["Python", "Java", "C++", "C#", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "Docker", "Kubernetes",
        "AWS", "GCP", "Azure", "Linux", "Git", "TensorFlow", "PyTorch", "Keras", "OpenCV", "Go", "Kotlin", "REST", "GraphQL"]


def tags_for(desc: str, cv: str) -> list[str]:
    """טכנולוגיות שמופיעות גם במודעה וגם בקורות החיים. בלי ניחושים."""
    has = lambda t, txt: re.search(r"(?<![A-Za-z])" + re.escape(t) + r"(?![A-Za-z+#])", txt, re.I)
    return [t for t in TECH if has(t, desc) and has(t, cv)][:4]


def to_card(j: dict, r: dict, cv: str = "") -> dict:
    """הפורמט שהאפליקציה מציגה. ריק = לא ידוע, לעולם לא ניחוש."""
    days = None
    try:
        days = (date.today() - date.fromisoformat(j["posted"][:10])).days if j.get("posted") else None
    except ValueError:
        pass
    return {"id": j["id"], "co": j["company"], "title": j["title"], "loc": j["location"],
            "fit": r["fit"], "reasons": r["reasons"], "gaps": r["gaps"], "partial": r["partial"],
            "tags": tags_for(j.get("description", ""), cv),
            "src": {"indeed": "Indeed", "linkedin": "LinkedIn", "google": "Google Jobs", "greenhouse": "אתר החברה",
                    "lever": "אתר החברה", "ashby": "אתר החברה"}.get(j["source"], j["source"]),
            "posted_days": days, "salary": j.get("salary", ""), "desc": j.get("description", "")[:600], "ad": j.get("description", "")[:4000], "url": j["url"], "rv": RATING_V}


RATING_V = 4  # גרסת שיטת הדירוג. משרות שדורגו בגרסה ישנה מדורגות מחדש


def rerate(card: dict, profile: dict, plan: dict, min_fit: float = 3.5) -> tuple[str, dict | None, str]:
    """דירוג מחדש של משרה שכבר בפיד ועוד לא החלטת עליה.
    מחזיר ("ok", כרטיס חדש, ""), ("filtered", None, סיבה) או ("later", None, סיבה)."""
    src = {v: k for k, v in {"indeed": "Indeed", "linkedin": "LinkedIn", "google": "Google Jobs"}.items()}
    j = {"id": card["id"], "title": card.get("title", ""), "company": card.get("co", ""), "location": card.get("loc", ""),
         "url": card.get("url", ""), "description": card.get("ad") or "", "posted": "", "salary": card.get("salary", ""),
         "source": src.get(card.get("src"), "greenhouse" if card.get("src") == "אתר החברה" else card.get("src", ""))}
    if len(j["description"]) < 300:
        j["description"] = ""
    enrich(j)
    if not has_full_ad(j):
        return "later", None, "עדיין אין מודעה מלאה"
    if too_senior(j, plan):
        return "filtered", None, f"במודעה המלאה כתוב „{years_phrase(j['description'])}”"
    cv = profile.get("cv_text", "")
    r = rate(j, cv, prefs_text(plan))
    if not r:
        return "later", None, "הדירוג לא הצליח"
    if ai_too_senior(r, plan, j["title"]):
        return "filtered", None, f"נדרשות {r.get('required_years') or 'יותר'} שנות ניסיון"
    if r["fit"] < min_fit:
        return "filtered", None, f"אחרי קריאת המודעה המלאה: {r['fit']:.1f}/5, מתחת לסף"
    new = to_card(j, r, cv)
    new["posted_days"] = card.get("posted_days")
    return "ok", new, f"{r['fit']:.1f}/5"


def run(profile: dict, plan: dict, raw: list[dict] | None = None, rate_top: int = 25, min_fit: float = 3.5, remember: bool = True,
        seen: set[str] | None = None, persist: bool = True) -> dict:
    """persist=False: לא כותבים קבצים מקומיים (בענן התוצאות נשמרות ב-Supabase)."""
    cv = profile.get("cv_text", "")
    raw = raw if raw is not None else collect(plan)
    jobs = dedupe(raw)
    act.log("hunter", f"איחדתי כפילויות: {len(raw)} → {len(jobs)} משרות שונות")
    if seen is None:
        seen = set(json.loads(SEEN.read_text())) if SEEN.exists() else set()
    jobs, stats = prefilter(jobs, plan, seen)
    act.log("hunter", f"סיננתי {stats['too_senior']} בכירות מדי ו-{stats['already_seen']} שכבר ראית. נשארו {len(jobs)}.")
    jobs.sort(key=lambda j: -cheap_rank(j, plan, cv))
    if jobs:
        act.log("hunter", f"מדרג את {min(len(jobs), rate_top)} המבטיחות מול קורות החיים שלך")
    cards, deferred = [], 0
    for j in jobs[:rate_top]:
        enrich(j)
        if not has_full_ad(j):  # בלי מודעה מלאה אי אפשר לדרג באמת. לא מציגים — ננסה שוב בסריקה הבאה
            stats["no_desc"] = stats.get("no_desc", 0) + 1
            act.log("hunter", f"{j['title']} ב-{j['company']}: לא הצלחתי לקרוא את המודעה המלאה. לא מדרג לפי כותרת בלבד, אנסה שוב בסריקה הבאה.")
            continue
        if too_senior(j, plan):  # עכשיו כשיש תיאור מלא, בודקים שוב את שנות הניסיון
            stats["too_senior"] += 1
            act.log("hunter", f"{j['title']} ב-{j['company']}: במודעה כתוב „{years_phrase(j.get('description', ''))}”. יותר ניסיון ממה שיש לך, מדלג.")
            continue
        try:
            r = rate(j, cv, prefs_text(plan))
        except BudgetDeferred as e:
            if not deferred:
                print(f"[דורון] דירוג נדחה: {e}")
                act.log("hunter", "הגעתי למכסה היומית של ה-AI. שאר המשרות ידורגו בריצה הבאה.")
            deferred += 1; continue
        if not r:
            continue
        if ai_too_senior(r, plan, j["title"]):
            stats["too_senior"] += 1; stats["ai_senior"] = stats.get("ai_senior", 0) + 1
            act.log("hunter", f"{j['title']} ב-{j['company']}: " + (f"דורשת {r['required_years']} שנות ניסיון. מדלג." if r.get("required_years") else "תפקיד בכיר יותר ממה שמתאים לך. מדלג."))
            continue
        stats.setdefault("fits", []).append(r["fit"])
        ok = r["fit"] >= min_fit
        act.log("hunter", f"{j['title']} ב-{j['company']}: {r['fit']:.1f}/5" + (f" (נדרשות {r['required_years']} שנים)" if r.get("required_years") else "") + f" {'✓ מתאימה' if ok else '· מתחת לסף'}")
        if ok:
            cards.append(to_card(j, r, cv))
    cards.sort(key=lambda c: -c["fit"])
    stats.update(rated=min(len(jobs), rate_top) - deferred, deferred=deferred, shown=len(cards))
    feed = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "stats": stats,
            "plan": {k: plan.get(k) for k in ("queries", "locations", "levels", "why")}, "jobs": cards}
    if not persist:
        return feed
    FEED.parent.mkdir(parents=True, exist_ok=True)
    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
    if remember:  # בריצת ניסיון לא מסמנים "כבר ראית"
        SEEN.write_text(json.dumps(sorted(seen | {c["id"] for c in cards})), encoding="utf-8")
    return feed
