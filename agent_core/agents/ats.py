"""
ats.py — דורון בודק את חברות היעד ישירות, בלוחות המשרות הציבוריים שלהן:
Greenhouse, Lever, Ashby. קריאה בלבד, בלי התחברות. משרות בישראל בלבד.
"""
from __future__ import annotations
import html
import re

import httpx

BOARDS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
    "lever": "https://api.lever.co/v0/postings/{slug}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true",
}
ISRAEL = re.compile(r"israel|tel aviv|tel-aviv|herzliya|haifa|jerusalem|petah|petach|ramat gan|ra'?anana|netanya|"
                    r"rehovot|be'?er sheva|beer sheva|yokneam|hod hasharon|kfar saba|airport city|or yehuda|rosh ha", re.I)


def _text(h: str) -> str:
    h = html.unescape(h or "")
    h = re.sub(r"<(br|/p|/li|/div|/h\d)[^>]*>", "\n", h, flags=re.I)
    h = re.sub(r"<li[^>]*>", "• ", h, flags=re.I)
    return re.sub(r"\n\s*\n+", "\n", re.sub(r"<[^>]+>", "", h)).strip()


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
    return [{**x, "company": company, "source": board, "salary": "", "description": x["description"][:6000]}
            for x in out if x["title"] and x["url"] and ISRAEL.search(x["location"] or "")]


def collect_targets(targets: list[dict], plan: dict, timeout: float = 8.0) -> tuple[list[dict], list[str]]:
    """מחזיר (משרות, חברות שנמצא להן לוח). חברה בלי לוח ציבורי פשוט מדולגת."""
    words = {w.lower() for t in plan.get("titles", []) for w in re.findall(r"[A-Za-z]+", t)} - {"developer", "engineer"}
    words |= {"software", "developer", "engineer", "student", "junior", "intern", "graduate"}
    jobs, found = [], []
    with httpx.Client(timeout=timeout, follow_redirects=True, headers={"User-Agent": "findjob/1.0 (job search for a student)"}) as cx:
        for c in targets:
            slugs = c.get("slugs") or [re.sub(r"[^a-z0-9]", "", c["name"].lower())]  # חברה שהוספת בעצמך
            for slug in slugs[:3]:
                hit = False
                for board, url in BOARDS.items():
                    try:
                        r = cx.get(url.format(slug=slug))
                    except httpx.HTTPError:
                        continue
                    if r.status_code != 200:
                        continue
                    try:
                        items = _parse(board, r.json(), c["name"])
                    except ValueError:
                        continue
                    hit = True
                    jobs += [j for j in items if any(w in j["title"].lower() for w in words)]
                    found.append(f"{c['name']} ({board})")
                    break
                if hit:
                    break
    return jobs, found
