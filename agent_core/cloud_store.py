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
    r = httpx.post(_url("runs"), headers=_h(), json={"user_id": user_id, "agent": "hunter",
                                                     "stats": feed["stats"], "plan": feed["plan"]}, timeout=30)
    r.raise_for_status()


def saved_without_letter(user_id: str) -> list[dict]:
    r = httpx.get(_url("jobs"), headers=_h(), timeout=30, params={
        "select": "id,card", "user_id": f"eq.{user_id}", "decision": "eq.save", "letter": "is.null"})
    r.raise_for_status()
    return r.json()


def save_letter(user_id: str, job_id: str, letter: dict) -> None:
    r = httpx.patch(_url("jobs"), headers=_h(), json={"letter": letter},
                    params={"user_id": f"eq.{user_id}", "id": f"eq.{job_id}"}, timeout=30)
    r.raise_for_status()
