"""
live.py — דורון בודק בכל סריקה אם המשרות ששמרת עדיין פתוחות להגשה.

סוגר משרה רק על סמך סימן חד-משמעי: הדף לא קיים (404/410), או שכתוב בו במפורש שהמשרה לא מקבלת מועמדים.
אתר שחוסם או לא עונה = "לא ידוע", והמשרה נשארת. עדיף להשאיר משרה סגורה מאשר להעיף משרה פתוחה.

לפי מקור: LinkedIn (דף המשרה הציבורי), לוחות ATS (Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Comeet) דרך
ה-API הציבורי שלהם: משרה שירדה מהלוח = נסגרה. כל השאר: הדף עצמו וניסוחי סגירה בעברית ובאנגלית.
"""
from __future__ import annotations
import re
import time

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


# LinkedIn מחזיר 429 כשבודקים מהר מדי (17.11: 17 מתוך 19 בבדיקה רצופה). קצב קבוע + ניסיון חוזר אחרי המתנה.
LI_GAP, LI_WAIT, LI_TRIES = 2.5, 20.0, 3
_li_last = [0.0]
_sleep = time.sleep


def _li_get(cx: httpx.Client, url: str) -> httpx.Response:
    for i in range(LI_TRIES):
        wait = _li_last[0] + LI_GAP - time.monotonic()
        if wait > 0:
            _sleep(wait)
        r = cx.get(url)
        _li_last[0] = time.monotonic()
        if r.status_code != 429 or i == LI_TRIES - 1:
            return r
        try:
            ra = float(r.headers.get("retry-after") or 0)
        except ValueError:
            ra = 0
        _sleep(min(max(ra, LI_WAIT * (i + 1)), 60))
    return r


# Indeed חוסם את דף המשרה (401). בודקים דרך ה-API של האפליקציה שלהם, כמו JobSpy שאוסף משם (המפתח מהספרייה, לא שלנו).
INDEED = re.compile(r"indeed\.com/.*[?&]jk=([0-9a-f]{8,})", re.I)
INDEED_Q = 'query {{ jobData(jobKeys: ["{}"]) {{ results {{ job {{ key expired }} }} }} }}'


def indeed_check(jk: str, cx: httpx.Client) -> str:
    try:
        from jobspy.indeed.constant import headers
    except ImportError:
        return "unknown"
    try:
        r = cx.post("https://apis.indeed.com/graphql", headers=headers, json={"query": INDEED_Q.format(jk)})
        d = r.json() if r.status_code == 200 else {}
    except (httpx.HTTPError, ValueError):
        return "unknown"
    res = ((d.get("data") or {}).get("jobData") or {}).get("results")
    if d.get("errors") or not res:
        return "unknown"   # TODO: אם יתברר שמשרה שנמחקה מחזירה רשימה ריקה — לסמן "נסגרה"
    return "closed" if (res[0].get("job") or {}).get("expired") else "open"


# הלוגו של החברה מאותו דף של LinkedIn שכבר נטען לבדיקה (בלי בקשה נוספת). משרות ישנות נשמרו בלי לוגו
LI_LOGO = re.compile(r'(https://media\.licdn\.com/dms/image/[^"\'\s<>]*company-logo[^"\'\s<>]*)')


def li_logo(html: str) -> str:
    m = LI_LOGO.search(html or "")
    return m.group(1).replace("&amp;", "&") if m and len(m.group(1)) < 600 else ""


def check(url: str, client: httpx.Client | None = None, meta: dict | None = None) -> str:
    """'open' / 'closed' / 'unknown'. meta (לא חובה) מקבל "logo" כשנמצא בדף של LinkedIn."""
    if not url:
        return "unknown"
    own = client is None
    cx = client or httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,he;q=0.8"})
    try:
        st = ats_check(url, cx)
        if st:
            return st
        mi = INDEED.search(url)
        if mi:
            return indeed_check(mi.group(1), cx)
        m = re.search(r"linkedin\.com/jobs/view/(?:[^/?#]*-)?(\d+)", url)
        target = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{m.group(1)}" if m else url
        r = _li_get(cx, target) if m else cx.get(target)
        if r.status_code in (404, 410):
            return "closed"
        if r.status_code != 200:
            return "unknown"
        if m and meta is not None and li_logo(r.text):
            meta["logo"] = li_logo(r.text)
        if m and ("closed-job" in r.text or CLOSED.search(r.text)):
            return "closed"
        text = re.sub(r"<[^>]+>", " ", r.text[:400000])
        return "closed" if CLOSED.search(text) else "open"
    except httpx.HTTPError:
        return "unknown"
    finally:
        if own:
            cx.close()


# מתג חזרה (17.11): בסריקת הבוקר בודקים גם משרות שמחכות בתור יותר מ-QUEUE_DAYS (לא שמורות), ונסגרות יורדות מהתור
QUEUE_LIVE = True
QUEUE_DAYS = 3


def stale_pending(rows: list[dict], now, days: int = QUEUE_DAYS) -> list[dict]:
    """משרות בתור (בלי החלטה) שמחכות יותר מ-days ימים. שמורות, מדולגות ומסוננות לא נכללות."""
    from datetime import datetime, timedelta
    out = []
    for r in rows:
        c = r.get("card") or {}
        try:
            t = datetime.fromisoformat(str(r.get("created_at")).replace("Z", "+00:00"))
        except ValueError:
            continue
        if not r.get("decision") and c.get("title") and c.get("url") and now - t > timedelta(days=days):
            out.append(r)
    return out
