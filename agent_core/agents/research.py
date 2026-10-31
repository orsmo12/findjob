"""
research.py — גיל, חוקר החברות: סקירה קצרה על החברה לכל משרה ששמרת.

כללים:
  - כל עובדה בסקירה מגיעה ממקור שנמצא בחיפוש, עם קישור. בלי מקור — לא נכתב.
  - בדיקה בקוד: כל שם באנגלית ומספר בעובדה חייבים להופיע בקטע של המקור שצוין.
  - "למה זה מתחבר אליך" נשען רק על קורות החיים.
  - אם לא נמצא כלום, אומרים את זה. לא משלימים מהזיכרון של המודל.
"""
from __future__ import annotations
import json
import re

from agent_core.llm_router import chat

LATIN = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-]{2,}")
NUM = re.compile(r"\d[\d.,%+]*")


def search_web(query: str, n: int = 6) -> list[dict]:
    try:
        from ddgs import DDGS
        res = DDGS().text(query, region="wt-wt", max_results=n) or []
    except Exception as e:  # noqa: BLE001
        print(f"[גיל] חיפוש נכשל: {type(e).__name__}")
        return []
    return [{"title": r.get("title", ""), "url": r.get("href", ""), "text": r.get("body", "")} for r in res if r.get("href")]


def gather(company: str) -> list[dict]:
    seen, out = set(), []
    for q in (f'"{company}" company Israel', f'"{company}" about products', f'"{company}" news 2026'):
        for r in search_web(q):
            dom = re.sub(r"^https?://(www\.)?", "", r["url"]).split("/")[0]
            if r["url"] in seen or "linkedin.com/in/" in r["url"]:
                continue
            seen.add(r["url"]); r["domain"] = dom; out.append(r)
    return out[:10]


PROMPT = """You write a short company brief for a job candidate, in Hebrew.
Use ONLY the numbered search snippets below. Every fact must cite the snippet number it came from.
If the snippets are not clearly about "{company}" (the employer of the job "{title}"), return {{"found": false}}.

SNIPPETS:
{snips}

CANDIDATE CV (only for "why_you"):
{cv}

Return JSON only:
{{"found": true,
  "what": "one Hebrew sentence: what the company does", "what_src": snippet number,
  "facts": [{{"text": "short Hebrew fact (size, product, funding, news)", "src": snippet number}}] (max 4),
  "why_you": ["short Hebrew line linking a CV fact to the company"] (max 2)}}"""


def _ok(text: str, source: str) -> bool:
    s = source.lower()
    return all(w.lower().strip(".-,") in s for w in LATIN.findall(text)) and \
        all(n.strip(".,") in s for n in NUM.findall(text) if n.strip(".,"))


def brief(company: str, title: str, cv: str) -> dict:
    snips = gather(company)
    if not snips:
        return {"found": False, "sources": []}
    block = "\n".join(f"[{i}] {s['title']} — {s['text']}" for i, s in enumerate(snips))
    raw = chat("researcher", "company_brief", [{"role": "user", "content": PROMPT.format(
        company=company, title=title, snips=block, cv=cv[:3000])}], tier="judge", max_tokens=1800)
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        d = json.loads(m.group(0)) if m else {}
    except ValueError:
        d = {}
    if not d.get("found"):
        return {"found": False, "sources": []}
    src_txt = lambda i: (snips[i]["title"] + " " + snips[i]["text"]) if isinstance(i, int) and 0 <= i < len(snips) else ""
    used, facts = set(), []
    for f in (d.get("facts") or [])[:4]:
        i = f.get("src")
        if src_txt(i) and _ok(str(f.get("text", "")), src_txt(i)):
            facts.append({"text": str(f["text"])[:200], "src": i}); used.add(i)
    what = str(d.get("what", ""))[:220]
    wi = d.get("what_src")
    if not (src_txt(wi) and _ok(what, src_txt(wi) + " " + company)):
        what, wi = "", None
    else:
        used.add(wi)
    why = [w[:180] for w in (d.get("why_you") or [])[:2] if _ok(str(w), cv + " " + company)]
    if not what and not facts:
        return {"found": False, "sources": []}
    order = sorted(used)
    remap = {old: new for new, old in enumerate(order)}
    return {"found": True, "what": what, "what_src": remap.get(wi),
            "facts": [{"text": f["text"], "src": remap[f["src"]]} for f in facts],
            "why_you": why,
            "sources": [{"title": snips[i]["title"][:90], "url": snips[i]["url"], "domain": snips[i]["domain"]} for i in order]}
