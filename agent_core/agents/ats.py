"""
ats.py — דורון בודק את חברות היעד ישירות, בלוחות המשרות הציבוריים שלהן.
Greenhouse, Lever, Ashby, SmartRecruiters, Comeet (נפוץ בישראל) ו-Workday. קריאה בלבד, בלי התחברות.

לכל חברה נשמר סטטוס אמיתי:
  board     — נמצא לוח, נסרק ישירות
  by_name   — אין לוח ציבורי שאפשר לקרוא; מחפשים את המשרות שלה ב-LinkedIn וב-Indeed לפי השם
  not_found — לא נמצאה חברה או משרות בשם הזה (אולי השם לא מדויק)
"""
from __future__ import annotations
import html
import json
import re
from datetime import datetime, timedelta, timezone

import httpx

from agent_core import activity as act

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124", "Accept": "application/json,text/html"}
BOARDS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
    "lever": "https://api.lever.co/v0/postings/{slug}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true",
    "smartrecruiters": "https://api.smartrecruiters.com/v1/companies/{slug}/postings?country=il&limit=100",
}
ISRAEL = re.compile(r"israel|\bIL\b|tel aviv|tel-aviv|herzliya|haifa|jerusalem|petah|petach|ramat gan|ra'?anana|netanya|"
                    r"rehovot|be'?er sheva|beer sheva|yokneam|hod hasharon|kfar saba|airport city|or yehuda|rosh ha|caesarea|"
                    r"modiin|modi'in|holon|rishon|ashdod|karmiel|migdal|nazareth|qiryat|kiryat|yavne|lod", re.I)
COMEET_RE = re.compile(r"comeet\.(?:com|co)/jobs/([a-z0-9\-_.]+)/([0-9A-F]{2}\.[0-9A-F]{3})", re.I)
WORKDAY_RE = re.compile(r"https?://([a-z0-9\-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([A-Za-z0-9_\-]+)", re.I)
REDISCOVER_DAYS = 7


def _text(h: str) -> str:
    h = html.unescape(h or "")
    h = re.sub(r"<(br|/p|/li|/div|/h\d)[^>]*>", "\n", h, flags=re.I)
    h = re.sub(r"<li[^>]*>", "• ", h, flags=re.I)
    return re.sub(r"\n\s*\n+", "\n", re.sub(r"<[^>]+>", "", h)).strip()


def norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"\b(israel|ltd|inc|technologies|technology|group|careers|jobs|systems|software|\.com)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)


def same_company(a: str, b: str) -> bool:
    """שם חברה מול slug או שם אחר: אחד מכיל את השני (Elbit ↔ Elbit Systems, monday ↔ monday.com)."""
    x, y = norm(a), norm(b)
    return len(x) >= 3 and len(y) >= 3 and (x in y or y in x)


# ── קריאת לוחות ────────────────────────────────────────────────────────────────
def _parse(board: str, data, company: str) -> list[dict]:
    out = []
    if board == "greenhouse":
        for j in (data or {}).get("jobs", []):
            out.append({"title": j.get("title", ""), "location": (j.get("location") or {}).get("name", ""),
                        "url": j.get("absolute_url", ""), "description": _text(j.get("content", "")), "posted": (j.get("updated_at") or "")[:10]})
    elif board == "lever":
        for j in data or []:
            cat = j.get("categories") or {}
            out.append({"title": j.get("text", ""), "location": cat.get("location", "") or ", ".join(cat.get("allLocations") or []),
                        "url": j.get("hostedUrl", ""), "description": j.get("descriptionPlain", "") + "\n" +
                        "\n".join(_text(l.get("content", "")) for l in j.get("lists") or []), "posted": ""})
    elif board == "ashby":
        for j in (data or {}).get("jobs", []):
            locs = [j.get("location", "")] + [x.get("location", "") for x in j.get("secondaryLocations") or []]
            out.append({"title": j.get("title", ""), "location": ", ".join(l for l in locs if l),
                        "url": j.get("jobUrl", ""), "description": j.get("descriptionPlain", "") or _text(j.get("descriptionHtml", "")),
                        "posted": (j.get("publishedAt") or "")[:10]})
    elif board == "smartrecruiters":
        for j in (data or {}).get("content", []):
            loc = j.get("location") or {}
            out.append({"title": j.get("name", ""), "location": ", ".join(x for x in (loc.get("city"), "Israel" if loc.get("country") == "il" else loc.get("country")) if x),
                        "url": f"https://jobs.smartrecruiters.com/{(j.get('company') or {}).get('identifier', '')}/{j.get('id', '')}",
                        "description": "", "posted": (j.get("releasedDate") or "")[:10], "_sr": j.get("ref", "")})
    elif board == "comeet":
        for j in data or []:
            loc = j.get("location") or {}
            details = ((j.get("custom_fields") or {}).get("details") or [])
            desc = "\n".join(f"{d.get('name', '')}:\n{_text(d.get('value', ''))}" for d in details if d.get("value"))
            out.append({"title": j.get("name", ""), "location": ", ".join(x for x in (loc.get("city") or loc.get("name"), "Israel" if loc.get("country") == "IL" else loc.get("country")) if x),
                        "url": j.get("url_active_page") or j.get("url_comeet_hosted_page", ""), "description": desc,
                        "posted": (j.get("time_updated") or "")[:10]})
    elif board == "workday":
        out = data or []
    return [{**x, "company": company, "source": board, "salary": "", "description": (x.get("description") or "")[:6000]}
            for x in out if x.get("title") and x.get("url") and ISRAEL.search(x.get("location") or "")]


def _comeet_positions(cx: httpx.Client, url: str) -> list | None:
    t = cx.get(url).text
    m = re.search(r"COMPANY_POSITIONS_DATA\s*=\s*(\[.*?\]);", t, re.S)
    return json.loads(m.group(1)) if m else None


def _workday(cx: httpx.Client, b: dict, words: set[str], detail_max: int = 12) -> list[dict]:
    base = f"https://{b['tenant']}.{b['wd']}.myworkdayjobs.com"
    api = f"{base}/wday/cxs/{b['tenant']}/{b['site']}"
    posts, off = [], 0
    while off < 100:
        r = cx.post(f"{api}/jobs", json={"appliedFacets": {}, "limit": 20, "offset": off, "searchText": "Israel"})
        d = r.json() if r.status_code == 200 else {}
        batch = d.get("jobPostings") or []
        posts += batch
        if len(batch) < 20:
            break
        off += 20
    out = []
    for p in posts:
        if not ISRAEL.search(p.get("locationsText", "") + " " + p.get("externalPath", "")):
            continue
        row = {"title": p.get("title", ""), "location": p.get("locationsText", "") + ", Israel", "url": base + "/" + b["site"] + p.get("externalPath", ""),
               "description": "", "posted": ""}
        if len([o for o in out if o["description"]]) < detail_max and any(w in row["title"].lower() for w in words):
            try:
                info = cx.get(api + p.get("externalPath", "")).json().get("jobPostingInfo", {})
                row["description"] = _text(info.get("jobDescription", "")); row["posted"] = (info.get("startDate") or "")[:10]
            except (httpx.HTTPError, ValueError):
                pass
        out.append(row)
    return out


def read_board(cx: httpx.Client, b: dict, name: str, words: set[str]) -> list[dict] | None:
    """None = הלוח לא ענה כמו שצריך (לא ידוע). [] = הלוח עובד ואין משרות בישראל."""
    kind = b["board"]
    try:
        if kind == "comeet":
            data = _comeet_positions(cx, b["url"])
            return None if data is None else _parse("comeet", data, name)
        if kind == "workday":
            return _parse("workday", _workday(cx, b, words), name)
        r = cx.get(BOARDS[kind].format(slug=b["slug"]))
        if r.status_code != 200:
            return None
        items = _parse(kind, r.json(), name)
        if kind == "smartrecruiters":
            for j in items[:15]:
                if any(w in j["title"].lower() for w in words) and j.get("_sr"):
                    try:
                        ad = cx.get(j["_sr"]).json().get("jobAd", {}).get("sections", {})
                        j["description"] = "\n".join(_text((ad.get(k) or {}).get("text", "")) for k in ("jobDescription", "qualifications", "additionalInformation"))[:6000]
                    except (httpx.HTTPError, ValueError):
                        pass
        return items
    except (httpx.HTTPError, ValueError):
        return None


# ── גילוי: איפה החברה מפרסמת משרות ───────────────────────────────────────────
def _search(q: str, n: int = 8) -> list[str]:
    try:
        from ddgs import DDGS
        return [(r.get("href", "") + " " + r.get("body", "")) for r in (DDGS().text(q, max_results=n) or [])]
    except Exception:  # noqa: BLE001
        return []


def discover(cx: httpx.Client, name: str, slugs: list[str] | None = None) -> dict | None:
    """מחפש את הלוח של החברה. מקבל רק לוח שהשם שלו תואם את שם החברה, ושבאמת עונה."""
    cands = list(dict.fromkeys((slugs or []) + [re.sub(r"[^a-z0-9]", "", name.lower()), norm(name)]))
    for slug in [c for c in cands if c][:4]:
        for kind in BOARDS:
            try:
                r = cx.get(BOARDS[kind].format(slug=slug))
            except httpx.HTTPError:
                continue
            if r.status_code != 200:
                continue
            try:
                d = r.json()
            except ValueError:
                continue
            if kind == "smartrecruiters" and not (d.get("totalFound") or d.get("content")):
                continue  # SmartRecruiters מחזיר 200 גם לחברה שלא קיימת
            return {"board": kind, "slug": slug}
    texts = []
    for q in (f'"{name}" comeet jobs', f'"{name}" careers myworkdayjobs', f'{name} careers jobs Israel'):
        texts += _search(q)
    for t in texts:
        for m in COMEET_RE.finditer(t):
            if same_company(name, m.group(1)):
                url = f"https://www.comeet.com/jobs/{m.group(1)}/{m.group(2)}"
                try:
                    if _comeet_positions(cx, url):  # לוח ריק = כנראה לא הלוח הפעיל של החברה
                        return {"board": "comeet", "url": url}
                except httpx.HTTPError:
                    pass
        for m in WORKDAY_RE.finditer(t):
            if same_company(name, m.group(1)) and m.group(3).lower() not in ("login", "wday"):
                b = {"board": "workday", "tenant": m.group(1).lower(), "wd": m.group(2).lower(), "site": m.group(3)}
                try:
                    r = cx.post(f"https://{b['tenant']}.{b['wd']}.myworkdayjobs.com/wday/cxs/{b['tenant']}/{b['site']}/jobs",
                                json={"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""})
                    if r.status_code == 200 and "jobPostings" in r.json():
                        return b
                except (httpx.HTTPError, ValueError):
                    pass
    return None


def board_label(b: dict) -> str:
    return {"greenhouse": "Greenhouse", "lever": "Lever", "ashby": "Ashby", "smartrecruiters": "SmartRecruiters",
            "comeet": "Comeet", "workday": "Workday"}.get(b.get("board"), b.get("board", ""))


def collect_targets(targets: list[dict], plan: dict, cache: dict | None = None, discover_max: int = 30,
                    timeout: float = 12.0) -> tuple[list[dict], list[dict], dict]:
    """מחזיר (משרות, סטטוס לכל חברה, מטמון גילוי מעודכן).
    חברה בלי לוח מסומנת by_name — דורון יחפש אותה לפי השם ב-LinkedIn וב-Indeed."""
    words = {w.lower() for t in plan.get("titles", []) + plan.get("extra_titles", []) for w in re.findall(r"[A-Za-z]+", t)} - {"developer", "engineer"}
    words |= {"software", "developer", "engineer", "student", "junior", "intern", "graduate"}
    cache = dict(cache or {})
    now = datetime.now(timezone.utc)
    jobs, status, discovered = [], [], 0
    with httpx.Client(timeout=timeout, follow_redirects=True, headers=UA) as cx:
        for c in targets:
            name = c["name"]
            key = name.lower()
            ent = cache.get(key)
            fresh = ent and datetime.fromisoformat(ent["at"]) > now - timedelta(days=REDISCOVER_DAYS)
            b = (ent or {}).get("b") if fresh else None
            if c.get("board"):
                b = c["board"]
            elif not fresh and discovered < discover_max:
                discovered += 1
                b = discover(cx, name, c.get("slugs"))
                cache[key] = {"b": b, "at": now.isoformat()}
                act.log("hunter", f"מחפש איפה {name} מפרסמת משרות: " + (f"נמצא לוח {board_label(b)} ✓" if b else "אין לוח ציבורי שאפשר לקרוא. אחפש אותה לפי השם ב-LinkedIn וב-Indeed"))
            elif not fresh:
                status.append({"name": name, "status": "pending", "why": c.get("why", []), "auto": c.get("auto", False)})
                continue
            if not b:
                status.append({"name": name, "status": "by_name", "why": c.get("why", []), "auto": c.get("auto", False)})
                continue
            items = read_board(cx, b, name, words)
            if items is None:
                act.log("hunter", f"הלוח של {name} ({board_label(b)}) לא ענה הפעם. אבדוק שוב.")
                cache.pop(key, None)
                status.append({"name": name, "status": "by_name", "board": board_label(b), "why": c.get("why", []), "auto": c.get("auto", False)})
                continue
            rel = [j for j in items if any(w in j["title"].lower() for w in words)]
            jobs += rel
            act.log("hunter", f"דף הקריירה של {name} ({board_label(b)}): {len(items)} משרות בישראל, {len(rel)} בתחום שלך")
            status.append({"name": name, "status": "board", "board": board_label(b), "il": len(items), "rel": len(rel),
                           "why": c.get("why", []), "auto": c.get("auto", False)})
    return jobs, status, cache


def name_matches(raw: list[dict], name: str) -> str | None:
    """מתוך תוצאות חיפוש לפי שם החברה: השם המדויק כפי שהחברה מופיעה במודעות (Elbit → Elbit Systems)."""
    counts: dict[str, int] = {}
    for j in raw:
        co = j.get("company", "")
        if same_company(name, co):
            counts[co] = counts.get(co, 0) + 1
    return max(counts, key=counts.get) if counts else None
