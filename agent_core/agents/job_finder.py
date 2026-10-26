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


# ── LinkedIn Playwright Scraper ────────────────────────────────────────────────

COOKIES_PATH = Path(__file__).parent.parent / "linkedin_cookies.json"

LINKEDIN_SEARCH_URL = (
    "https://www.linkedin.com/jobs/search/"
    "?keywords={query}&location={location}&f_TPR=r259200"  # 72 שעות אחרונות
)


async def _scrape_linkedin_playwright(
    query: str,
    location: str,
    max_results: int,
) -> list[JobResult]:
    """
    מסרק LinkedIn עם Playwright + cookies session של המשתמש.

    דורש קובץ `agent_core/linkedin_cookies.json` שמכיל את ה-cookies
    של session מחובר של LinkedIn.

    כיצד לייצר: הרץ `python scripts/save_linkedin_session.py`
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[LinkedIn] ❌ playwright לא מותקן — הרץ: pip install playwright && playwright install chromium")
        return []

    if not COOKIES_PATH.exists():
        print(f"[LinkedIn] ⚠️  לא נמצא {COOKIES_PATH}")
        print("[LinkedIn] הרץ: python scripts/save_linkedin_session.py")
        return []

    jobs: list[JobResult] = []
    url = LINKEDIN_SEARCH_URL.format(
        query=query.replace(" ", "%20"),
        location=location.replace(" ", "%20"),
    )

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 720},
        )

        # טען cookies
        try:
            cookies = json.loads(COOKIES_PATH.read_text(encoding="utf-8"))
            await context.add_cookies(cookies)
            print(f"[LinkedIn] ✅ Cookies נטענו ({len(cookies)} cookies)")
        except Exception as e:
            print(f"[LinkedIn] ❌ שגיאה בטעינת cookies: {e}")
            await browser.close()
            return []

        page = await context.new_page()

        try:
            print(f"[LinkedIn] 🔍 מחפש: '{query}' ב-'{location}'")
            await page.goto(url, timeout=30000, wait_until="networkidle")

            # בדוק שמחוברים
            if "authwall" in page.url or "login" in page.url:
                print("[LinkedIn] ❌ Session פג — הרץ מחדש save_linkedin_session.py")
                await browser.close()
                return []

            # חכה שהמשרות יטענו
            try:
                await page.wait_for_selector(".job-card-container", timeout=10000)
            except Exception:
                print("[LinkedIn] ⚠️  לא נמצאו job cards — דף ריק?")
                await browser.close()
                return []

            # גלול לטעון עוד תוצאות
            for _ in range(3):
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1500)

            job_cards = await page.query_selector_all(".job-card-container")
            print(f"[LinkedIn] נמצאו {len(job_cards)} כרטיסי משרה")

            for card in job_cards[:max_results]:
                try:
                    title_el = await card.query_selector(".job-card-list__title")
                    company_el = await card.query_selector(".job-card-container__primary-description")
                    location_el = await card.query_selector(".job-card-container__metadata-item")
                    link_el = await card.query_selector("a.job-card-list__title")

                    title   = (await title_el.inner_text()).strip() if title_el else ""
                    company = (await company_el.inner_text()).strip() if company_el else ""
                    loc     = (await location_el.inner_text()).strip() if location_el else location
                    href    = await link_el.get_attribute("href") if link_el else ""
                    job_url = f"https://www.linkedin.com{href}" if href and href.startswith("/") else href

                    if title:
                        jobs.append({
                            "title":       title,
                            "company":     company,
                            "location":    loc,
                            "salary":      "",    # LinkedIn לא תמיד מראה שכר
                            "url":         job_url or "",
                            "description": "",    # נשלים בסוכן linkedin_scout
                            "ats_score":   0,     # יחושב אחרי
                            "source":      "linkedin",
                        })
                except Exception as card_err:
                    print(f"[LinkedIn] שגיאה בכרטיס: {card_err}")

        except Exception as e:
            print(f"[LinkedIn] ❌ שגיאת Playwright: {e}")
        finally:
            await browser.close()

    print(f"[LinkedIn] ✅ נמצאו {len(jobs)} משרות")
    return jobs


def _scrape_linkedin_sync(query: str, location: str, max_results: int) -> list[JobResult]:
    """Wrapper סינכרוני ל-async Playwright."""
    try:
        return asyncio.run(_scrape_linkedin_playwright(query, location, max_results))
    except RuntimeError:
        # אם כבר יש event loop (למשל בתוך Jupyter/FastAPI)
        import nest_asyncio
        nest_asyncio.apply()
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(_scrape_linkedin_playwright(query, location, max_results))


# ── JobSpy scraper (Indeed / Glassdoor / Google) ───────────────────────────────

def _scrape_jobspy(query: str, location: str, max_results: int) -> list[JobResult]:
    """JobSpy עבור Indeed, Glassdoor, Google Jobs (ללא LinkedIn)."""
    try:
        from jobspy import scrape_jobs
        jobs_df = scrape_jobs(
            site_name=["indeed", "glassdoor", "google"],
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

    # 1. LinkedIn (Playwright)
    linkedin_jobs = _scrape_linkedin_sync(query, location, max_results // 2)
    all_jobs.extend(linkedin_jobs)

    # 2. Indeed / Glassdoor / Google (JobSpy)
    jobspy_jobs = _scrape_jobspy(query, location, max_results)
    all_jobs.extend(jobspy_jobs)

    # 3. AllJobs (ישראלי)
    israeli_jobs = _scrape_israeli_boards(query, max_results // 3)
    all_jobs.extend(israeli_jobs)

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
