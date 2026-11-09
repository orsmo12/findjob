"""
live.py — דורון בודק בכל סריקה אם המשרות ששמרת עדיין פתוחות להגשה.

סוגר משרה רק על סמך סימן חד-משמעי: הדף לא קיים (404/410), או שכתוב בו במפורש שהמשרה לא מקבלת מועמדים.
אתר שחוסם או לא עונה = "לא ידוע", והמשרה נשארת. עדיף להשאיר משרה סגורה מאשר להעיף משרה פתוחה.

לפי מקור: LinkedIn (דף המשרה הציבורי), לוחות ATS (Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Comeet) דרך
ה-API הציבורי שלהם: משרה שירדה מהלוח = נסגרה. כל השאר: הדף עצמו וניסוחי סגירה בעברית ובאנגלית.
"""
from __future__ import annotations
import re

import httpx

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
CLOSED = re.compile(
    r"no longer accepting applications|no longer accepting|this job is no longer available|job (?:is )?no longer (?:open|available)"
    r"|position has been filled|this (?:job|position|posting) (?:has )?(?:expired|closed)|job posting (?:has )?expired"
    r"|the job you are looking for (?:is no longer|was not found)|this job has been (?:closed|filled)"
    r"|position (?:is )?no longer available|this requisition is no longer|job not found|posting (?:is )?closed"
    r"|המשרה (?:אוישה|נסגרה|אינה פעילה|כבר לא זמינה|הוסרה|לא רלוונטית)|המשרה לא זמינה|המשרה אינה פעילה עוד"
    r"|לא ניתן להגיש מועמדות|הגשת המועמדות (?:הסתיימה|נסגרה)", re.I)

# כתובת משרה בלוח ATS ← בדיקה דרך ה-API הציבורי. מחזיר כתובת API ופונקציה שאומרת אם התשובה "סגורה"
ATS_RULES = [
    (re.compile(r"(?:boards|job-boards)\.greenhouse\.io/([a-z0-9]+)/jobs/(\d+)", re.I),
     lambda m: f"https://boards-api.greenhouse.io/v1/boards/{m.group(1)}/jobs/{m.group(2)}"),
    (re.compile(r"jobs\.lever\.co/([a-z0-9\-]+)/([0-9a-f\-]{36})", re.I),
     lambda m: f"https://api.lever.co/v0/postings/{m.group(1)}/{m.group(2)}"),
    (re.compile(r"jobs\.smartrecruiters\.com/([A-Za-z0-9\-]+)/(\d+)", re.I),
     lambda m: f"https://api.smartrecruiters.com/v1/companies/{m.group(1)}/postings/{m.group(2)}"),
    (re.compile(r"https?://([a-z0-9\-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([A-Za-z0-9_\-]+)/(job/[^?#]+)", re.I),
     lambda m: f"https://{m.group(1)}.{m.group(2)}.myworkdayjobs.com/wday/cxs/{m.group(1)}/{m.group(3)}/{m.group(4)}"),
]
ASHBY = re.compile(r"jobs\.ashbyhq\.com/([a-z0-9\-.]+)/([0-9a-f\-]{36})", re.I)


def ats_check(url: str, cx: httpx.Client) -> str | None:
    """None = לא כתובת ATS מוכרת. אחרת open / closed / unknown לפי ה-API של הלוח."""
    m = ASHBY.search(url)
    if m:   # ל-Ashby אין API למשרה בודדת: בודקים אם היא עדיין ברשימה של הלוח
        r = cx.get(f"https://api.ashbyhq.com/posting-api/job-board/{m.group(1)}")
        if r.status_code != 200:
            return "unknown"
        ids = {j.get("id") for j in (r.json() or {}).get("jobs", [])}
        return "open" if m.group(2) in ids else "closed"
    for rx, api in ATS_RULES:
        m = rx.search(url)
        if not m:
            continue
        r = cx.get(api(m))
        if r.status_code in (404, 410):
            return "closed"
        if r.status_code != 200:
            return "unknown"
        try:
            d = r.json()
        except ValueError:
            return "unknown"
        if isinstance(d, dict) and (d.get("active") is False or (d.get("jobPostingInfo") or {}).get("canApply") is False
                                    or (d.get("jobPostingInfo") or {}).get("postingAvailable") is False):
            return "closed"
        return "open"
    return None


def check(url: str, client: httpx.Client | None = None) -> str:
    """'open' / 'closed' / 'unknown'."""
    if not url:
        return "unknown"
    own = client is None
    cx = client or httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,he;q=0.8"})
    try:
        st = ats_check(url, cx)
        if st:
            return st
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
