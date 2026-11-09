"""
telegram.py — דורון קורא ערוצי טלגרם ציבוריים של משרות (בלי חשבון, בלי התחברות).

קריאה בלבד של העמוד הציבורי t.me/s/<ערוץ>, שכל אחד יכול לפתוח בדפדפן. פוסטים מהימים האחרונים בלבד.
מכל פוסט מחלצים כותרת, חברה, קישור ודרישות: קודם בקוד (קישור, תגיות), ואז קריאה אחת קלה ל-AI לכל הפוסטים יחד.
פוסט שאין בו משרה (פרסומת, הודעה כללית) נזרק. כל פרט חייב להופיע בטקסט הפוסט עצמו.
"""
from __future__ import annotations
import html
import json
import re
from datetime import datetime, timedelta, timezone

import httpx

from agent_core import activity as act

DEFAULT_CHANNELS = ["hitechjobsjunior"]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124", "Accept-Language": "he,en;q=0.9"}
POST = re.compile(r'data-post="([^"]+)"')
TEXT = re.compile(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', re.S)
TIME = re.compile(r'<time[^>]+datetime="([^"]+)"')


def channel_name(s: str) -> str | None:
    """'https://t.me/s/abc', 't.me/abc', '@abc' או 'abc' → 'abc'. שם לא תקין → None."""
    s = (s or "").strip()
    m = re.search(r"(?:t\.me/(?:s/)?|@)?([A-Za-z][A-Za-z0-9_]{3,31})/?$", s)
    return m.group(1) if m else None


def _text(h: str) -> str:
    h = re.sub(r"<br\s*/?>", "\n", h or "")
    return html.unescape(re.sub(r"<[^>]+>", "", h)).strip()


def parse(page: str, days: int = 3) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    out = []
    for chunk in page.split('class="tgme_widget_message_wrap')[1:]:   # כל פוסט בנפרד: פוסט בלי טקסט (תמונה) לא "בולע" את הבא
        mp, mt, mw = POST.search(chunk), TEXT.search(chunk), TIME.search(chunk)
        if not (mp and mt and mw):
            continue
        post, body, when = mp.group(1), mt.group(1), mw.group(1)
        try:
            at = datetime.fromisoformat(when.replace("Z", "+00:00"))
        except ValueError:
            continue
        if at < since:
            continue
        links = re.findall(r'href="(https?://[^"]+)"', body)
        links = [html.unescape(u) for u in links if "t.me/" not in u]
        text = _text(body)
        if len(text) > 40:
            out.append({"post": post, "text": text[:2500], "links": links[:4], "at": at.isoformat()})
    return out


def fetch(channel: str, cx: httpx.Client, days: int = 3) -> list[dict]:
    r = cx.get(f"https://t.me/s/{channel}")
    return parse(r.text, days) if r.status_code == 200 else []


PROMPT = """These are posts from a public Telegram channel of job ads in Israel. For each post that is a real job ad, extract the fields.
Return JSON only: {{"jobs": [{{"i": post number, "title": "job title as written", "company": "company as written, or empty if not named",
"location": "as written or empty", "url": "the application link from the post's links, or empty", "requirements": "short, only from the post"}}]}}
Skip posts that are not a specific job. Never invent a company, link or requirement.

{posts}"""


def extract(posts: list[dict]) -> list[dict]:
    if not posts:
        return []
    from agent_core.llm_router import chat
    block = "\n\n".join(f"POST {i}:\n{p['text'][:1200]}\nLINKS: {' '.join(p['links']) or 'none'}" for i, p in enumerate(posts))
    raw = chat("hunter", "telegram_extract", [{"role": "user", "content": PROMPT.format(posts=block)}], tier="light", max_tokens=2000)
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        items = (json.loads(m.group(0)) if m else {}).get("jobs") or []
    except ValueError:
        items = []
    return to_jobs(items, posts)


def to_jobs(items: list[dict], posts: list[dict]) -> list[dict]:
    """בדיקת אמת: כותרת וחברה חייבות להופיע בפוסט, וקישור חייב להיות אחד מהקישורים בפוסט."""
    out = []
    for x in items:
        try:
            p = posts[int(x.get("i"))]
        except (TypeError, ValueError, IndexError):
            continue
        low = p["text"].lower()
        title, co = str(x.get("title") or "").strip(), str(x.get("company") or "").strip()
        if not title or title.lower() not in low or (co and co.lower() not in low):
            continue
        url = str(x.get("url") or "").strip()
        url = url if url in p["links"] else (p["links"][0] if p["links"] else f"https://t.me/{p['post']}")
        out.append({"title": title, "company": co or "לא צוין בפוסט", "location": str(x.get("location") or "") or "Israel",
                    "url": url, "description": p["text"], "source": "Telegram", "posted": p["at"][:10], "salary": "",
                    "remote": False, "query": "telegram"})
    return out


def collect(channels: list[str], max_posts: int = 20) -> list[dict]:
    posts = []
    with httpx.Client(timeout=15, follow_redirects=True, headers=UA) as cx:
        for ch in channels:
            try:
                got = fetch(ch, cx)
            except httpx.HTTPError:
                got = []
            act.log("hunter", f"ערוץ הטלגרם {ch}: {len(got)} פוסטים מהימים האחרונים")
            posts += got
    posts = posts[-max_posts:]
    jobs = extract(posts)
    if posts:
        act.log("hunter", f"מתוך {len(posts)} פוסטים בטלגרם, {len(jobs)} הם משרות עם כותרת וקישור")
    return jobs
