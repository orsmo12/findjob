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

ROOT = Path(__file__).resolve().parents[2]
FEED = ROOT / "memory" / "feed" / "jobs.json"
SEEN = ROOT / "memory" / "seen_jobs.json"

SENIOR_WORDS = re.compile(r"\b(senior|sr\.?|staff|principal|lead|head|manager|architect|director|vp)\b", re.I)
YEARS_RE = re.compile(r"(\d{1,2})\s*\+?\s*(?:-\s*\d+\s*)?(?:years|yrs|שנות|שנים)", re.I)


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


def collect(plan: dict, per_search: int = 15) -> list[dict]:
    """JobSpy לפי התוכנית: עד 3 שאילתות × 2 אזורים. LinkedIn כמודעות ציבוריות בלבד."""
    from jobspy import scrape_jobs
    out = []
    for q in plan.get("queries", [])[:3]:
        for loc in plan.get("locations", ["Israel"])[:2]:
            try:
                df = scrape_jobs(
                    site_name=["indeed", "linkedin", "google"],
                    search_term=q, location=loc, results_wanted=per_search, hours_old=24 * 7,
                    country_indeed="Israel", is_remote=bool(plan.get("remote_only")),
                    google_search_term=f"{q} jobs in {loc}, Israel since last week",
                    description_format="markdown", linkedin_fetch_description=False,
                )
            except Exception as e:  # מקור אחד שנכשל לא מפיל את כל החיפוש
                print(f"[דורון] {q} / {loc}: {type(e).__name__}: {e}")
                continue
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


def too_senior(job: dict, plan: dict) -> bool:
    levels = set(plan.get("levels", []))
    if levels & {"student", "intern", "junior", "entry"} and SENIOR_WORDS.search(job.get("title", "")):
        return True
    mx = plan.get("max_years")
    if mx:
        ys = [int(y) for y in YEARS_RE.findall(job.get("description", ""))]
        if ys and min(ys) > mx:
            return True
    return False


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


def enrich(job: dict) -> dict:
    """מודעות LinkedIn מגיעות בלי תיאור. מביאים אותו מהעמוד הציבורי של המשרה (בלי התחברות)."""
    if len(job.get("description", "")) >= 300 or "linkedin.com/jobs/view/" not in job.get("url", ""):
        return job
    m = re.search(r"/jobs/view/(?:[^/?]*-)?(\d+)", job["url"])
    if not m:
        return job
    try:
        import httpx
        r = httpx.get(f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{m.group(1)}", timeout=15,
                      headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en-US,en;q=0.9"})
        if r.status_code == 200:
            mm = re.search(r'show-more-less-html__markup[^>]*>(.*?)</div>', r.text, re.S)
            if mm:
                job["description"] = _html_text(mm.group(1))[:6000]
    except Exception as e:  # noqa: BLE001
        print(f"[דורון] לא הצלחתי להביא תיאור: {job['title']} ({type(e).__name__})")
    return job


# ── דירוג ב-AI ─────────────────────────────────────────────────────────────────
RANK_PROMPT = """You rate how well a job fits a candidate. Use ONLY facts written in the CV, the preferences and the job ad.
Never invent experience, numbers or requirements.

CANDIDATE CV:
{cv}

CANDIDATE PREFERENCES:
{prefs}

JOB: {title} at {company} ({location})
{desc}

Return JSON only:
{{"fit": number 1.0-5.0 with one decimal,
  "reasons": [up to 3 short reasons, each pointing to a concrete CV fact that matches a requirement in the ad],
  "gaps": [up to 2 short items: requirements written in the ad that the CV does not show],
  "seniority_ok": true/false (false if the ad clearly needs more experience than the candidate has)}}
Write reasons and gaps in natural, fluent Hebrew (as a native Israeli recruiter would), max 12 words each.
Keep technology and company names in English. Do not use location as a reason.
Scale: 5 = almost every requirement is shown in the CV and the level fits; 3 = partial match; 1 = wrong field or level."""


def parse_rating(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
        fit = round(max(1.0, min(5.0, float(d.get("fit", 0)))), 1)
        clip = lambda xs, n: [str(x).strip()[:140] for x in (xs or []) if str(x).strip()][:n]
        return {"fit": fit, "reasons": clip(d.get("reasons"), 3), "gaps": clip(d.get("gaps"), 2),
                "seniority_ok": bool(d.get("seniority_ok", True))}
    except (ValueError, TypeError):
        return None


def rate(job: dict, cv: str, prefs: str) -> dict | None:
    desc = job.get("description", "")
    prompt = RANK_PROMPT.format(cv=cv[:5000], prefs=prefs, title=job["title"], company=job["company"],
                                location=job["location"], desc=(desc[:3500] or "(no description available)"))
    r = parse_rating(chat("hunter", "rate_job", [{"role": "user", "content": prompt}], tier="judge", max_tokens=1000))  # בלי json_mode: חלק מהמודלים נכשלים בו; parse_rating מחלץ את ה-JSON
    if r:
        r["partial"] = len(desc) < 300
        if r["partial"]:
            r["gaps"] = []  # בלי המודעה המלאה אין לנו דרישות אמיתיות להשוות אליהן
    return r


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
            "src": {"indeed": "Indeed", "linkedin": "LinkedIn", "google": "Google Jobs"}.get(j["source"], j["source"]),
            "posted_days": days, "salary": j.get("salary", ""), "desc": j.get("description", "")[:600], "url": j["url"]}


def run(profile: dict, plan: dict, raw: list[dict] | None = None, rate_top: int = 15, min_fit: float = 3.5, remember: bool = True) -> dict:
    cv = profile.get("cv_text", "")
    jobs = dedupe(raw if raw is not None else collect(plan))
    seen = set(json.loads(SEEN.read_text())) if SEEN.exists() else set()
    jobs, stats = prefilter(jobs, plan, seen)
    jobs.sort(key=lambda j: -cheap_rank(j, plan, cv))
    cards, deferred = [], 0
    for j in jobs[:rate_top]:
        enrich(j)
        if too_senior(j, plan):  # עכשיו כשיש תיאור מלא, בודקים שוב את שנות הניסיון
            stats["too_senior"] += 1; continue
        try:
            r = rate(j, cv, prefs_text(plan))
        except BudgetDeferred as e:
            if not deferred:
                print(f"[דורון] דירוג נדחה: {e}")
            deferred += 1; continue
        if not r:
            continue
        if not r["seniority_ok"]:
            stats["too_senior"] += 1; continue
        if r["fit"] >= min_fit:
            cards.append(to_card(j, r, cv))
    cards.sort(key=lambda c: -c["fit"])
    stats.update(rated=min(len(jobs), rate_top) - deferred, deferred=deferred, shown=len(cards))
    feed = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "stats": stats,
            "plan": {k: plan.get(k) for k in ("queries", "locations", "levels", "why")}, "jobs": cards}
    FEED.parent.mkdir(parents=True, exist_ok=True)
    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2), encoding="utf-8")
    if remember:  # בריצת ניסיון לא מסמנים "כבר ראית"
        SEEN.write_text(json.dumps(sorted(seen | {c["id"] for c in cards})), encoding="utf-8")
    return feed
