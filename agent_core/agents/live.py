"""
live.py — דורון בודק בכל סריקה אם המשרות ששמרת עדיין פתוחות להגשה.

סוגר משרה רק על סמך סימן חד-משמעי: הדף לא קיים (404/410), או שכתוב בו במפורש שהמשרה לא מקבלת מועמדים.
אתר שחוסם או לא עונה = "לא ידוע", והמשרה נשארת. עדיף להשאיר משרה סגורה מאשר להעיף משרה פתוחה.
"""
from __future__ import annotations
import re

import httpx

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
CLOSED = re.compile(
    r"no longer accepting applications|no longer accepting|this job is no longer available|job (?:is )?no longer (?:open|available)"
    r"|position has been filled|this (?:job|position|posting) (?:has )?(?:expired|closed)|job posting (?:has )?expired"
    r"|the job you are looking for (?:is no longer|was not found)|this job has been (?:closed|filled)"
    r"|המשרה (?:אוישה|נסגרה|אינה פעילה|כבר לא זמינה)|המשרה לא זמינה", re.I)


def check(url: str, client: httpx.Client | None = None) -> str:
    """'open' / 'closed' / 'unknown'."""
    if not url:
        return "unknown"
    own = client is None
    cx = client or httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,he;q=0.8"})
    try:
        m = re.search(r"linkedin\.com/jobs/view/(?:[^/?#]*-)?(\d+)", url)
        target = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{m.group(1)}" if m else url
        r = cx.get(target)
        if r.status_code in (404, 410):
            return "closed"
        if r.status_code != 200:
            return "unknown"
        if m and ("closed-job" in r.text or CLOSED.search(r.text)):
            return "closed"
        text = re.sub(r"<[^>]+>", " ", r.text[:400000])
        return "closed" if CLOSED.search(text) else "open"
    except httpx.HTTPError:
        return "unknown"
    finally:
        if own:
            cx.close()
