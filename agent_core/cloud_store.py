"""
cloud_store.py — קריאה וכתיבה ל-Supabase מהסוכנים בענן (REST, בלי ספריות נוספות).

משתמש ב-SUPABASE_URL וב-SUPABASE_SERVICE_KEY. המפתח הסודי נשמר רק ב-GitHub Secrets,
לעולם לא בקוד ולא באפליקציה.
"""
from __future__ import annotations
import os
import httpx


def configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY"))


def _h(extra: dict | None = None) -> dict:
    from agent_core.llm_router import clean_key
    k = clean_key(os.environ["SUPABASE_SERVICE_KEY"], "SUPABASE_SERVICE_KEY")
    h = {"apikey": k, "Content-Type": "application/json"}
    if not k.startswith("sb_"):  # מפתחות ישנים (JWT) צריכים גם Authorization
        h["Authorization"] = f"Bearer {k}"
    h.update(extra or {})
    return h


def _url(table: str) -> str:
    from agent_core.llm_router import clean_key
    return clean_key(os.environ["SUPABASE_URL"], "SUPABASE_URL").rstrip("/") + "/rest/v1/" + table


def profiles_ready() -> list[dict]:
    """רק משתמשים שהעלו קורות חיים. בלי קורות חיים לא מחפשים."""
    r = httpx.get(_url("profiles"), headers=_h(), params={"select": "*", "cv_text": "neq."}, timeout=30)
    r.raise_for_status()
    return r.json()


def seen_ids(user_id: str) -> set[str]:
    r = httpx.get(_url("jobs"), headers=_h(), params={"select": "id", "user_id": f"eq.{user_id}"}, timeout=30)
    r.raise_for_status()
    return {row["id"] for row in r.json()}


def save_feed(user_id: str, feed: dict) -> None:
    rows = [{"user_id": user_id, "id": c["id"], "card": c, "fit": c["fit"]} for c in feed["jobs"]]
    if rows:
        r = httpx.post(_url("jobs"), headers=_h({"Prefer": "resolution=ignore-duplicates"}), json=rows, timeout=30)
        r.raise_for_status()
    s = feed["stats"]
    names = [f"{c['title']} ב-{c['co']}" for c in feed["jobs"][:3]]
    msg = (f"מצאתי {s['shown']} משרות חדשות שמתאימות לך: {'; '.join(names)}" + (" ועוד." if s['shown'] > 3 else ".")
           if s["shown"] else f"הלילה עברתי על {s['collected']} משרות ולא מצאתי חדשה שמתאימה לך. אמשיך לחפש מחר.")
    add_run(user_id, "hunter", msg, s, feed["plan"])


def saved_without_letter(user_id: str) -> list[dict]:
    r = httpx.get(_url("jobs"), headers=_h(), timeout=30, params={
        "select": "id,card", "user_id": f"eq.{user_id}", "decision": "eq.save", "letter": "is.null"})
    r.raise_for_status()
    return r.json()


def save_letter(user_id: str, job_id: str, letter: dict) -> None:
    r = httpx.patch(_url("jobs"), headers=_h(), json={"letter": letter},
                    params={"user_id": f"eq.{user_id}", "id": f"eq.{job_id}"}, timeout=30)
    r.raise_for_status()


def saved_missing(user_id: str) -> list[dict]:
    """משרות ששמרת שחסר להן מכתב, סקירה או הכנה."""
    r = httpx.get(_url("jobs"), headers=_h(), timeout=30, params={
        "select": "id,card,letter,brief,prep", "user_id": f"eq.{user_id}", "decision": "eq.save",
        "or": "(letter.is.null,brief.is.null,prep.is.null)"})
    r.raise_for_status()
    return r.json()


def update_job(user_id: str, job_id: str, fields: dict) -> None:
    r = httpx.patch(_url("jobs"), headers=_h(), json=fields,
                    params={"user_id": f"eq.{user_id}", "id": f"eq.{job_id}"}, timeout=30)
    r.raise_for_status()


def add_run(user_id: str, agent: str, msg: str, stats: dict | None = None, plan: dict | None = None) -> None:
    """הודעה במשרד: מה הסוכן עשה בפועל."""
    st = dict(stats or {}); st["msg"] = msg
    r = httpx.post(_url("runs"), headers=_h(), json={"user_id": user_id, "agent": agent, "stats": st, "plan": plan}, timeout=30)
    r.raise_for_status()


def update_profile(user_id: str, fields: dict) -> None:
    r = httpx.patch(_url("profiles"), headers=_h(), json=fields, params={"user_id": f"eq.{user_id}"}, timeout=30)
    r.raise_for_status()


def add_logs(rows: list[dict]) -> None:
    """שורות יומן לתהליך העבודה במשרד (בקשה אחת)."""
    r = httpx.post(_url("runs"), headers=_h(), json=rows, timeout=30)
    r.raise_for_status()
