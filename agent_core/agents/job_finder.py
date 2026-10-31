"""
job_finder.py — מחפש משרות ממספר מקורות במקביל.

LinkedIn: Playwright עם session cookies שמור של המשתמש (cookies.json)
Indeed / Glassdoor / Google: JobSpy (ללא אימות)

ATS Scoring: AI-based (Groq) עם fallback לכישורים מהפרופיל
"""

from __future__ import annotations
import os
import re
import json
import asyncio
from pathlib import Path
from typing import Optional

from agent_core.state import CareerState, JobResult

# ── ATS Scoring ────────────────────────────────────────────────────────────────

def _ats_score_keywords(resume: str, job_description: str, cv_profile: Optional[dict] = None) -> int:
    """ATS scoring חכם — משתמש בפרופיל CV אם קיים."""
    if not resume or not job_description:
        return 50

    stop_words = {"the", "and", "for", "with", "this", "that", "have", "from", "are", "was",
                  "ה", "ו", "ב", "ל", "מ", "של", "את", "על", "אל", "כי", "הם"}

    jd_words = set(
        w.lower() for w in re.findall(r'\b\w{3,}\b', job_description)
        if w.lower() not in stop_words
    )

    # אם יש פרופיל AI — השתמש בכישורים שזוהו
    if cv_profile and cv_profile.get("top_skills"):
        skills = [s.lower() for s in cv_profile["top_skills"]]
        frameworks = [f.lower() for f in cv_profile.get("frameworks", [])]
        keywords = [k.lower() for k in cv_profile.get("search_keywords", [])]
        profile_words = set(skills + frameworks + keywords)

        matches = profile_words.intersection(jd_words)
        base = min(100, int((len(matches) / max(len(profile_words), 1)) * 200))
    else:
        resume_words = set(
            w.lower() for w in re.findall(r'\b\w{3,}\b', resume)
            if w.lower() not in stop_words
        )
        matches = resume_words.intersection(jd_words)
        base = min(100, int((len(matches) / max(len(resume_words), 1)) * 200))

    # בונוס סניוריטי: job_finder מוריד ניקוד למשרות Senior כשהמועמד הוא junior
    seniority = cv_profile.get("seniority", "junior") if cv_profile else "junior"
    jd_lower = job_description.lower()
    senior_markers = {"senior", "staff", "principal", "architect", "lead", "director", "vp"}
    junior_markers = {"junior", "entry", "associate", "graduate", "intern", "student"}

    has_senior = bool(senior_markers.intersection(jd_lower.split()))
    has_junior = bool(junior_markers.intersection(jd_lower.split()))

    if seniority == "junior" and has_senior and not has_junior:
        base = int(base * 0.6)   # הורד 40% למשרות senior-only
    elif seniority == "junior" and has_junior:
        base = min(100, int(base * 1.2))  # בונוס למשרות junior
    elif seniority == "senior" and has_junior and not has_senior:
        base = int(base * 0.7)   # senior לא ירצה junior role

    return base


# ── LinkedIn ───────────────────────────────────────────────────────────────────
# אין גישה לחשבון: משרות LinkedIn מגיעות רק כמודעות ציבוריות דרך JobSpy.


def _scrape_linkedin_playwright(*_a, **_k):
    """הוסר: התחברות ל-LinkedIn עם ה-cookies שלך. findjob לא פועל בחשבונות שלך."""
    raise RuntimeError("disabled by policy: no logged-in access to user accounts")


def _scrape_linkedin_sync(*_a, **_k) -> list[JobResult]:
    """הוסר: התחברות ל-LinkedIn. משרות LinkedIn מגיעות כמודעות ציבוריות דרך JobSpy."""
    return []


# ── JobSpy scraper (Indeed / Glassdoor / Google) ───────────────────────────────

def _scrape_jobspy(query: str, location: str, max_results: int) -> list[JobResult]:
    """JobSpy עבור Indeed, Glassdoor, Google Jobs (ללא LinkedIn)."""
    try:
        from jobspy import scrape_jobs
        jobs_df = scrape_jobs(
            site_name=["indeed", "glassdoor", "google", "linkedin"],  # linkedin = מודעות ציבוריות, בלי התחברות
            search_term=query,
            location=location,
            results_wanted=max_results,
            hours_old=72,
            country_indeed="Israel",
        )

        results: list[JobResult] = []
        for _, row in jobs_df.iterrows():
            results.append({
                "title":       str(row.get("title", "Unknown")),
                "company":     str(row.get("company", "Unknown")),
                "location":    str(row.get("location", location)),
                "salary":      f"{row.get('min_amount', '')}–{row.get('max_amount', '')}",
                "url":         str(row.get("job_url", "")),
                "description": str(row.get("description", ""))[:500],
                "ats_score":   0,   # יחושב אחרי
                "source":      str(row.get("site", "unknown")),
            })

        print(f"[JobSpy] ✅ {len(results)} משרות (Indeed/Glassdoor/Google)")
        return results

    except Exception as e:
        print(f"[JobSpy] ❌ שגיאה: {e}")
        return []


# ── Israeli Job Boards (AllJobs, Drushim) ──────────────────────────────────────

def _scrape_israeli_boards(query: str, max_results: int) -> list[JobResult]:
    """
    סקראפינג בסיסי של AllJobs.co.il ו-Drushim.co.il.
    מחזיר רשימה ריקה אם נחסם — לא קריטי.
    """
    import urllib.request
    from html.parser import HTMLParser

    results: list[JobResult] = []

    class JobParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.jobs = []
            self._in_title = False
            self._current = {}

        def handle_starttag(self, tag, attrs):
            attrs_dict = dict(attrs)
            if tag == "a" and "job" in attrs_dict.get("class", "").lower():
                self._current = {
                    "url": attrs_dict.get("href", ""),
                    "title": "",
                    "company": "AllJobs",
                    "location": "ישראל",
                }
                self._in_title = True

        def handle_data(self, data):
            if self._in_title and data.strip():
                self._current["title"] = data.strip()

        def handle_endtag(self, tag):
            if tag == "a" and self._in_title:
                self._in_title = False
                if self._current.get("title"):
                    self.jobs.append(self._current.copy())

    # AllJobs
    try:
        alljobs_url = (
            f"https://www.alljobs.co.il/SearchResultsGuest.aspx"
            f"?position={query.replace(' ', '+')}"
        )
        req = urllib.request.Request(alljobs_url, headers={
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # חלץ משרות בסיסי מה-HTML
        title_pattern = r'class="[^"]*job[^"]*title[^"]*"[^>]*>([^<]{5,80})<'
        titles = re.findall(title_pattern, html, re.IGNORECASE)[:max_results // 2]

        for t in titles:
            results.append({
                "title":       t.strip(),
                "company":     "AllJobs",
                "location":    "ישראל",
                "salary":      "",
                "url":         alljobs_url,
                "description": "",
                "ats_score":   0,
                "source":      "alljobs",
            })

        if titles:
            print(f"[AllJobs] ✅ {len(titles)} משרות")

    except Exception as e:
        print(f"[AllJobs] ⚠️  {e}")

    return results


# ── Main Node ───────────────────────────────────────────────────────────────────

SENIOR_WORDS = re.compile(r"\b(senior|sr\.?|staff|principal|lead|head|manager|architect|director|vp)\b", re.I)
YEARS_RE = re.compile(r"(\d{1,2})\s*\+?\s*(?:-\s*\d+\s*)?(?:years|yrs|שנות|שנים)", re.I)


def _too_senior(job: dict, plan: dict) -> bool:
    """True אם המשרה מעל הרמה שנגזרה מהפרופיל (כותרת בכירה או דרישת שנים גבוהה)."""
    levels = set(plan.get("levels", []))
    if levels & {"student", "intern", "junior", "entry"} and SENIOR_WORDS.search(job.get("title", "")):
        return True
    max_years = plan.get("max_years")
    if max_years:
        years = [int(y) for y in YEARS_RE.findall(job.get("description", "") or "")]
        if years and min(years) > max_years:
            return True
    return False


def job_finder_node(state: CareerState) -> dict:
    """
    LangGraph node: מחפש משרות ממספר מקורות.

    LinkedIn ← Playwright (session cookies)
    Indeed/Glassdoor/Google ← JobSpy
    AllJobs/Drushim ← Israeli boards

    קורא:  search_query | refined_query, location, resume_text, cv_profile, max_results
    כותב: raw_jobs, filtered_jobs, iteration, should_refine, messages
    """
    query       = state.get("refined_query") or state.get("search_query", "Software Engineer")
    location    = state.get("location", "Israel")
    resume      = state.get("resume_text", "")
    cv_profile  = state.get("cv_profile")
    max_results = state.get("max_results", 10)
    iteration   = state.get("iteration", 0)

    # אם יש פרופיל — השתמש בתפקיד הראשון המומלץ כ-query
    if cv_profile and cv_profile.get("role_titles") and iteration == 0:
        profile_query = cv_profile["role_titles"][0]
        if profile_query and profile_query != query:
            print(f"[Job Finder] 🎯 CV Profile override: '{query}' → '{profile_query}'")
            query = profile_query

    print(f"[Job Finder] 🔍 '{query}' ב-'{location}' (סבב {iteration + 1})")

    # ── סריקה מקבילית ─────────────────────────────────────────────────────────
    all_jobs: list[JobResult] = []

    # 1. LinkedIn — רק משרות ציבוריות דרך JobSpy (בלי התחברות לחשבון שלך).
    #    כלל: findjob לעולם לא נכנס לחשבונות שלך ולא פועל בשמך. ראה docs/AGENTS.md
    linkedin_jobs: list[JobResult] = []

    # 2. Indeed / Glassdoor / Google / LinkedIn ציבורי (JobSpy) — לפי תוכנית החיפוש של המשתמש
    plan = state.get("search_plan") or {}
    if plan and iteration == 0:
        pairs = [(q, l) for q in plan.get("queries", [query])[:3] for l in plan.get("locations", [location])[:2]]
    else:
        pairs = [(query, location)]
    jobspy_jobs: list[JobResult] = []
    for q, l in pairs:
        jobspy_jobs.extend(_scrape_jobspy(q, l, max(5, max_results // len(pairs) + 2)))
    all_jobs.extend(jobspy_jobs)

    # 3. AllJobs (ישראלי)
    israeli_jobs = _scrape_israeli_boards(query, max_results // 3)
    all_jobs.extend(israeli_jobs)

    # ── סינון לפי הפרופיל (בקוד, בלי AI): בכירות ושנות ניסיון ─────────────────
    too_senior = 0
    if plan:
        kept = []
        for j in all_jobs:
            if _too_senior(j, plan):
                too_senior += 1
            else:
                kept.append(j)
        all_jobs = kept
        print(f"[Job Finder] סוננו {too_senior} משרות בכירות מדי לפי הפרופיל")

    # ── סינון זיכרון ──────────────────────────────────────────────────────────
    try:
        from agent_core.memory.manager import filter_new_jobs
        new_jobs, skipped = filter_new_jobs(all_jobs)
    except Exception:
        new_jobs, skipped = all_jobs, 0

    # ── ATS Scoring ───────────────────────────────────────────────────────────
    ats_threshold = 30 if cv_profile and cv_profile.get("seniority") == "junior" else 35

    scored_jobs: list[JobResult] = []
    for job in new_jobs:
        score = _ats_score_keywords(
            resume,
            job.get("description", job.get("title", "")),
            cv_profile,
        )
        job["ats_score"] = score
        scored_jobs.append(job)

    filtered_jobs = [j for j in scored_jobs if j["ats_score"] >= ats_threshold]
    should_refine = len(filtered_jobs) < 3 and iteration < 2

    print(f"[Job Finder] {len(all_jobs)} נמצאו | {skipped} דולגו | {len(filtered_jobs)} התאמות (סף {ats_threshold})")
    print(f"  LinkedIn: {len(linkedin_jobs)} | JobSpy: {len(jobspy_jobs)} | ישראלי: {len(israeli_jobs)}")

    return {
        "raw_jobs":      scored_jobs,
        "filtered_jobs": filtered_jobs,
        "iteration":     iteration + 1,
        "should_refine": should_refine,
        "messages": [
            f"Job Finder סבב {iteration+1}: {len(all_jobs)} נמצאו "
            f"(LI:{len(linkedin_jobs)}, JS:{len(jobspy_jobs)}, IL:{len(israeli_jobs)}), "
            f"{skipped} דולגו, {len(filtered_jobs)} עמדו בסף {ats_threshold}"
        ],
    }
