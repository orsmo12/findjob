"""
brief.py — "מה חדש": שי מסכם פעם ביום את מה שחשוב מ-24 השעות האחרונות.

  1. facts(): עובדות בקוד, מכל הסוכנים — משרות חדשות (הבולטות לפי ציון), מכתבים שהוכנו, משרות ששמרת שנסגרו,
     ראיונות קרובים, מעקבים שהגיע זמנם, LinkedIn, ומה שקרה ברקע. כל עובדה עם סוג ויעד במסך.
  2. write(): קריאת AI אחת (שי) שהופכת את העובדות לסיכום: כותרת קצרה ונקודות לפי חשיבות, בגוף ראשון.
  3. ground(): בדיקת אמת בקוד — כל שם באנגלית וכל מספר בסיכום חייבים להופיע בעובדות. נקודה שלא עוברת נמחקת.
     אם לא נשאר כלום, או שהמכסה נגמרה: הסיכום בגרסת הקוד (from_facts). אף פעם לא ריק ולא מומצא.
נשמר פעם ביום (שעון ישראל, אחרי 06:00) ב-runs, בלי הודעה בפיד. דברים קריטיים שקורים אחר כך מתווספים באפליקציה, בקוד.
"""
from __future__ import annotations
import json
import re
from datetime import datetime, timedelta, timezone

import httpx

from agent_core import cloud_store as db

IL = timezone(timedelta(hours=2))
ORDER = {"new": 0, "update": 1, "wait": 2, "bg": 3}
OLD = {"act": "update"}   # סיכומים ישנים: שי לא נותן הוראות, רק מעדכן. מה לעשות נמצא ב"הצעדים הבאים"
GO = {"apps", "jobs", "linkedin", "prep", "profile", ""}


def _runs_24h(uid: str) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    r = httpx.get(db._url("runs"), headers=db._h(), timeout=30, params={
        "select": "agent,stats,created_at", "user_id": f"eq.{uid}", "created_at": f"gte.{since}",
        "stats->>msg": "not.is.null", "order": "created_at.desc", "limit": "80"})
    r.raise_for_status()
    return [x for x in r.json() if (x.get("stats") or {}).get("msg")]


def facts(u: dict) -> list[dict]:
    """העובדות של 24 השעות האחרונות. כל אחת: {k: סוג, t: טקסט קצר בעברית, go: מסך}."""
    uid, out = u["user_id"], []
    st = u.get("state") or {}
    day = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    jobs = db.all_jobs(uid, days=1)
    new = sorted([j for j in jobs if j.get("decision") is None and not (j.get("card") or {}).get("closed_at")],
                 key=lambda j: -float((j.get("card") or {}).get("fit") or 0))
    if new:
        top = ", ".join(f"{j['card'].get('co', '')} ({float(j['card'].get('fit') or 0):.1f})" for j in new[:3])
        out.append({"k": "new", "t": f"{len(new)} משרות חדשות מחכות להחלטה. הבולטות: {top}", "go": "jobs"})
    saved = db.saved_jobs(uid, with_tailor=False)
    closed = [r["card"] for r in saved if (r.get("card") or {}).get("closed_at", "") >= day]
    if closed:
        out.append({"k": "update", "t": "משרות ששמרת נסגרו למועמדים והועברו להיסטוריה: " + ", ".join(c.get("co", "") for c in closed[:4]), "go": ""})
    waiting = [r for r in saved if not (r.get("letter") or {}).get("text") and not (r.get("card") or {}).get("closed_at")]
    if waiting:
        out.append({"k": "wait", "t": f"{len(waiting)} משרות ששמרת עוד בהכנה (מכתב, סקירה)", "go": "apps"})
    cards = {r["id"]: r.get("card") or {} for r in saved}
    for a in st.get("apps") or []:
        if a.get("status") == "interview":
            c = cards.get(a.get("jobId")) or {}
            out.append({"k": "update", "t": f"יש לך ראיון ב-{c.get('co') or 'משרה ששמרת'}" + (f": {a['iv']}" if a.get("iv") else ""), "go": "prep"})
    for x in _runs_24h(uid):
        m, ag = str(x["stats"]["msg"]), x.get("agent", "")
        if ag == "hunter" and ("משרות חדשות" in m or "נסגרה" in m):
            continue   # כבר מכוסה בעובדות למעלה
        if ag == "assistant" and "מכתב פנייה מוכן" in m:
            out.append({"k": "update", "t": "מכתבים חדשים הוכנו: " + m.split("ל-", 1)[-1].split(".")[0], "go": "apps"})
        elif ag == "linkedin" and "פוסטים" in m:
            out.append({"k": "new", "t": m[:160], "go": "linkedin"})
        elif ag in ("coach", "researcher", "linkedin", "strategist"):
            out.append({"k": "bg", "t": m[:140], "go": ""})
    seen, uniq = set(), []
    for f in out:   # בלי כפילויות
        if f["t"] not in seen:
            seen.add(f["t"]); uniq.append(f)
    return sorted(uniq, key=lambda f: ORDER.get(f["k"], 9))[:14]


PROMPT = """You are Shai, the user's job-search assistant. Write today's short summary in Hebrew, first person, warm and concise.
Use ONLY the facts below. Never invent a company, number, job or event. Copy company names and numbers exactly.
Report what happened that is relevant for the user to know. Do NOT tell the user what to do: no instructions, no advice,
no imperatives ("submit", "prepare", "should"). Next steps are shown separately in the app.
Order by importance: new jobs first, then updates, then what is in progress.
Merge related facts. Skip routine background work unless it matters; you may sum it up in one short "bg" item.
Return JSON only:
{{"headline": "one sentence, max 12 words, what happened today (a description, not an instruction)",
  "items": [{{"t": "max 22 words", "tone": "new|update|wait|bg", "go": "apps|jobs|linkedin|prep|profile|"}}]}}
Up to 8 items, only important and relevant ones.

FACTS:
{facts}"""


def _tokens(s: str) -> set[str]:
    return {w.lower() for w in re.findall(r"[A-Za-z][A-Za-z0-9&.+-]{1,}|\d+(?:\.\d+)?", s)}


def ground(d: dict, fs: list[dict]) -> dict | None:
    """כל שם באנגלית וכל מספר חייבים להופיע בעובדות. נקודה שלא עוברת נמחקת."""
    src = _tokens(" ".join(f["t"] for f in fs))
    ok = lambda t: _tokens(t) <= src
    items = [{"t": str(i.get("t") or "")[:220], "tone": OLD.get(i.get("tone"), i.get("tone")) if OLD.get(i.get("tone"), i.get("tone")) in ORDER else "update",
              "go": i.get("go") if i.get("go") in GO else ""} for i in (d.get("items") or []) if i.get("t") and ok(str(i["t"]))][:8]
    if not items:
        return None
    head = str(d.get("headline") or "")[:90]
    return {"headline": head if head and ok(head) else "", "items": sorted(items, key=lambda i: ORDER[i["tone"]])}


def from_facts(fs: list[dict]) -> dict:
    """הגרסה בקוד: אם אין AI או שהבדיקה נכשלה."""
    items = sorted([{"t": f["t"], "tone": OLD.get(f["k"], f["k"]), "go": f["go"]} for f in fs if f["k"] != "bg"],
                   key=lambda i: ORDER.get(i["tone"], 9))[:7]
    bg = [f for f in fs if f["k"] == "bg"]
    if bg:
        items.append({"t": f"ברקע: {len(bg)} עדכונים קטנים מהצוות", "tone": "bg", "go": ""})
    return {"headline": "", "items": items}


def write(fs: list[dict]) -> tuple[dict, str]:
    if not fs:
        return {"headline": "יום שקט. אין חדש שדורש ממך משהו.", "items": []}, "code"
    try:
        from agent_core.llm_router import chat
        raw = chat("assistant", "daily_brief", [{"role": "user", "content": PROMPT.format(facts="\n".join(f"- [{f['k']}] {f['t']}" for f in fs))}],
                   tier="light", max_tokens=700)
        m = re.search(r"\{.*\}", raw or "", re.S)
        g = ground(json.loads(m.group(0)) if m else {}, fs)
        if g:
            return g, "ai"
    except Exception as e:  # noqa: BLE001  (מכסה, רשת, JSON שבור) → גרסת הקוד
        print(f"סיכום יומי: {type(e).__name__}: {str(e)[:120]}")
    return from_facts(fs), "code"


def daily(u: dict) -> bool:
    """פעם ביום, אחרי 06:00 שעון ישראל. מחזיר True אם נכתב סיכום."""
    now = datetime.now(IL)
    if now.hour < 6:
        return False
    today = now.date().isoformat()
    for r in db.recent_runs(u["user_id"], "assistant", days=2):
        b = (r.get("stats") or {}).get("brief_ai")
        if b and b.get("day") == today:
            return False
    fs = facts(u)
    b, how = write(fs)
    db.add_run(u["user_id"], "assistant", "", {"brief_ai": {**b, "day": today, "how": how, "at": datetime.now(timezone.utc).isoformat()}})
    return True
