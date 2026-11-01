"""
tasks.py — מאיה: מטלות בית לדוגמה, לכל משרה ששמרת.

המטלות אמיתיות: מאגרי GitHub ציבוריים של מטלות בית (take-home assignments). לכל מטלה:
מקור עם קישור, ואם המאגר מציין במפורש שזו מטלה של חברה מסוימת — שם החברה. אחרת: "מקור ציבורי".
התקציר נשען רק על ה-README. הפתרון הוא הצעה של מאיה, ומסומן ככזה.
"""
from __future__ import annotations
import base64
import json
import os
import re

import httpx

from agent_core.llm_router import chat
from agent_core import activity as act

ROLE_WORDS = [("frontend", "frontend"), ("front-end", "frontend"), ("react", "frontend"), ("backend", "backend"),
              ("back-end", "backend"), ("full stack", "full stack"), ("full-stack", "full stack"), ("fullstack", "full stack"),
              ("data", "data"), ("machine learning", "machine learning"), ("ml", "machine learning"), ("ai", "machine learning"),
              ("qa", "qa automation"), ("automation", "qa automation"), ("devops", "devops"), ("mobile", "mobile"),
              ("android", "mobile"), ("ios", "mobile")]


def role_of(title: str) -> str:
    t = f" {title.lower()} "
    for w, r in ROLE_WORDS:
        if re.search(rf"(?<![a-z]){re.escape(w)}(?![a-z])", t):
            return r
    return "software engineer"


def _gh() -> httpx.Client:
    h = {"Accept": "application/vnd.github+json", "User-Agent": "findjob"}
    tok = os.environ.get("GITHUB_TOKEN")
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return httpx.Client(timeout=15, headers=h, follow_redirects=True)


def find_repos(company: str, role: str, exclude: set[str]) -> list[dict]:
    qs = [f'"{company}" home assignment', f'"{company}" take home', f'{role} "home assignment"',
          f'{role} take-home assignment in:name,description', f'{role} interview take home challenge in:name,description']
    out, seen = [], set(exclude)
    with _gh() as cx:
        for q in qs:
            try:
                r = cx.get("https://api.github.com/search/repositories", params={"q": q, "sort": "stars", "per_page": 8})
            except httpx.HTTPError:
                continue
            if r.status_code != 200:
                continue
            for it in r.json().get("items", []):
                url = it.get("html_url", "")
                if url in seen or it.get("fork"):
                    continue
                seen.add(url)
                out.append({"full": it["full_name"], "url": url, "desc": it.get("description") or "", "stars": it.get("stargazers_count", 0),
                            "company_query": company.lower() in q.lower()})
            if len(out) >= 12:
                break
        for o in out:
            try:
                rr = cx.get(f"https://api.github.com/repos/{o['full']}/readme")
                o["readme"] = base64.b64decode(rr.json().get("content", "")).decode("utf-8", "ignore")[:9000] if rr.status_code == 200 else ""
            except (httpx.HTTPError, ValueError):
                o["readme"] = ""
    return [o for o in out if len(o["readme"]) > 400 and re.search(r"assignment|task|requirement|challenge|exercise|implement", o["readme"], re.I)]


PROMPT = """You turn a public GitHub README into a home-assignment card for a candidate preparing for: {title} at {company}.
Write in Hebrew; keep technology names in English. Use ONLY what the README says for the task itself.

README of {repo}:
{readme}

Return JSON only:
{{"is_assignment": true/false (false if this is not a coding/home assignment that a company gives candidates),
  "title": "short Hebrew title of the task",
  "summary": "2-4 Hebrew sentences: what you must build, faithful to the README",
  "requirements": ["up to 5 short Hebrew bullet points from the README"],
  "company": "the company that gives this assignment ONLY if the README explicitly says so, else \\"\\"",
  "time": "time limit ONLY if the README states one, else \\"\\"",
  "solution": ["4-7 short Hebrew steps: how to solve it well (structure, key decisions, tests)"],
  "relevance": "one Hebrew sentence: why practicing this helps for this job"}}"""


def build_tasks(job: dict, need: int = 4, exclude: set[str] | None = None) -> list[dict]:
    role = role_of(job.get("title", ""))
    repos = find_repos(job.get("co", ""), role, exclude or set())
    act.log("coach", f"מחפשת מטלות בית לדוגמה ל-{job.get('co')} ({role}): {len(repos)} מאגרים ציבוריים מתאימים")
    out = []
    for r in repos:
        if len(out) >= need:
            break
        raw = chat("coach", "home_task", [{"role": "user", "content": PROMPT.format(
            title=job.get("title", ""), company=job.get("co", ""), repo=r["full"], readme=r["readme"])}], tier="write", max_tokens=1800)
        m = re.search(r"\{.*\}", raw or "", re.S)
        try:
            d = json.loads(m.group(0)) if m else {}
        except ValueError:
            d = {}
        if not d.get("is_assignment"):
            continue
        comp = str(d.get("company", "")).strip()
        if comp and comp.lower() not in (r["readme"] + " " + r["full"] + " " + r["desc"]).lower():
            comp = ""  # שם חברה שלא כתוב במקור — לא נכתב
        out.append({"id": r["full"], "title": str(d.get("title", ""))[:90], "summary": str(d.get("summary", ""))[:600],
                    "req": [str(x)[:160] for x in (d.get("requirements") or [])[:5]],
                    "company": comp[:60], "same_company": bool(comp) and comp.lower() in job.get("co", "").lower(),
                    "time": str(d.get("time", ""))[:40], "solution": [str(x)[:220] for x in (d.get("solution") or [])[:7]],
                    "why": str(d.get("relevance", ""))[:200], "url": r["url"], "repo": r["full"], "stars": r["stars"]})
    act.log("coach", f"הכנתי {len(out)} מטלות לדוגמה, כל אחת עם קישור למקור ופתרון מוצע")
    return out
