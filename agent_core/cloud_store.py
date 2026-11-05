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
    rej = [{"user_id": user_id, "id": c["id"], "card": c, "fit": c["fit"], "decision": "filtered"} for c in feed.get("rejected") or []]
    if rej:  # נבדקו ולא מתאימות: נזכרות כ"כבר נראו" ולא מדורגות שוב
        r = httpx.post(_url("jobs"), headers=_h({"Prefer": "resolution=ignore-duplicates"}), json=rej, timeout=30)
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
        "select": "id,card,letter,brief,prep", "user_id": f"eq.{user_id}", "decision": "eq.save", "card->>closed_at": "is.null",
        "or": "(letter.is.null,letter->>v.is.null,letter->>v.neq.3,brief.is.null,prep.is.null,prep->tasks.is.null,prep->>more_tasks.eq.true)"})
    if r.status_code == 400:  # גיבוי אם הסינון לפי JSON לא נתמך: מביאים הכל ומסננים כאן
        r = httpx.get(_url("jobs"), headers=_h(), timeout=30, params={
            "select": "id,card,letter,brief,prep", "user_id": f"eq.{user_id}", "decision": "eq.save"})
        r.raise_for_status()
        return [x for x in r.json() if not (x.get("card") or {}).get("closed_at") and (
            not x.get("letter") or (x.get("letter") or {}).get("v") != 3 or not x.get("brief") or not x.get("prep")
            or (x["prep"] or {}).get("tasks") is None or (x["prep"] or {}).get("more_tasks"))]
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


def saved_open(user_id: str) -> list[dict]:
    """משרות ששמרת ועוד לא סומנו כסגורות — לבדיקה אם הן עדיין פתוחות."""
    r = httpx.get(_url("jobs"), headers=_h(), timeout=30, params={
        "select": "id,card", "user_id": f"eq.{user_id}", "decision": "eq.save", "card->>closed_at": "is.null"})
    r.raise_for_status()
    return r.json()


def to_rerate(user_id: str, rating_v: int) -> list[dict]:
    """משרות בפיד שעוד לא החלטת עליהן, ושדורגו בלי מודעה מלאה או בשיטה ישנה."""
    r = httpx.get(_url("jobs"), headers=_h(), timeout=30, params={
        "select": "id,card,decision", "user_id": f"eq.{user_id}", "or": "(decision.is.null,decision.eq.save)"})
    r.raise_for_status()
    return [x for x in r.json() if not (x.get("card") or {}).get("closed_at")
            and ((x["card"] or {}).get("partial") or (x["card"] or {}).get("rv") != rating_v)]


def latest_plan(user_id: str, agent: str) -> dict:
    """ה-plan של הריצה האחרונה של סוכן (משמש כזיכרון: מטמון לוחות, מה יואב למד)."""
    r = httpx.get(_url("runs"), headers=_h(), timeout=30, params={
        "select": "plan,created_at", "user_id": f"eq.{user_id}", "agent": f"eq.{agent}", "plan": "not.is.null",
        "order": "created_at.desc", "limit": "1"})
    r.raise_for_status()
    rows = r.json()
    return (rows[0].get("plan") or {}) if rows else {}


def recent_runs(user_id: str, agent: str, days: int = 14) -> list[dict]:
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    r = httpx.get(_url("runs"), headers=_h(), timeout=30, params={
        "select": "stats,plan,created_at", "user_id": f"eq.{user_id}", "agent": f"eq.{agent}",
        "created_at": f"gte.{since}", "order": "created_at.desc", "limit": "60"})
    r.raise_for_status()
    return r.json()


def save_memory(user_id: str, agent: str, plan: dict) -> None:
    """שורה שקטה ב-runs (בלי הודעה למשתמש) ששומרת זיכרון של סוכן."""
    r = httpx.post(_url("runs"), headers=_h(), json={"user_id": user_id, "agent": agent, "stats": {"memory": True}, "plan": plan}, timeout=30)
    r.raise_for_status()


def all_jobs(user_id: str, days: int = 14) -> list[dict]:
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    r = httpx.get(_url("jobs"), headers=_h(), timeout=30, params={
        "select": "id,card,decision,created_at", "user_id": f"eq.{user_id}", "created_at": f"gte.{since}", "limit": "500"})
    r.raise_for_status()
    return r.json()


def auth_users() -> list[dict]:
    """רשימת המשתמשים (שירות בלבד): id, מייל ותאריך הרשמה. לדוח השימוש של מנהל המערכת."""
    r = httpx.get(_url("").replace("/rest/v1/", "/auth/v1/admin/users"), headers=_h(), params={"per_page": 200}, timeout=30)
    r.raise_for_status()
    d = r.json()
    return d.get("users", d) if isinstance(d, dict) else d
