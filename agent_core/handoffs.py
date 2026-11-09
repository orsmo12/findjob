"""
handoffs.py — משימות בין סוכנים (טבלת agent_tasks ב-Supabase).

סוכן שצריך משהו מסוכן אחר יוצר משימה: ממי, למי, על איזו משרה, מה צריך, ואחרי איזו משימה.
הסוכן השני מבצע אותה בריצה הקרובה שלו. משימה תלויה מחכה שהקודמת תסתיים.
כל יצירה וכל סיום נכתבים ליומן במשרד, כך שרואים מי ביקש מה ממי.

אם הטבלה עוד לא קיימת (לא הורץ supabase/agent_tasks.sql), available() מחזיר False
והסוכנים חוזרים לעבודה הישנה, בלי משימות.
"""
from __future__ import annotations
from datetime import datetime, timezone

from agent_core import activity as act

KINDS = {  # סוג משימה → מי מבצע ומה זה
    "brief":  ("researcher", "סקירת חברה עם מקורות"),
    "tailor": ("linkedin",   "התאמת קורות חיים למשרה"),
    "prep":   ("coach",      "שאלות הכנה ומטלות"),
    "letter": ("assistant",  "מכתב פנייה"),
}
ORDER = ["researcher", "linkedin", "coach", "assistant"]   # הסדר שבו הסוכנים עובדים בריצה: מכתב בסוף, אחרי הסקירה
HIGH_FIT = 4.5          # משרה חדשה בציון הזה ומעלה: גיל וקובי מתחילים לעבוד עליה עוד לפני שנשמרה
HIGH_FIT_MAX = 3        # לכל היותר כך וכך משרות כאלה בכל סריקה, כדי לא לבזבז מכסה על משרות שתדלג עליהן

_avail: bool | None = None


# ── לוגיקה טהורה (נבדקת בלי רשת) ───────────────────────────────────────────

def missing_for_saved(row: dict) -> list[str]:
    """מה חסר במשרה ששמרת, לפי סדר העבודה."""
    out = []
    if not row.get("brief"):
        out.append("brief")
    if not row.get("tailor"):
        out.append("tailor")
    p = row.get("prep")
    if not p or p.get("tasks") is None or p.get("more_tasks"):
        out.append("prep")
    lt = row.get("letter")
    if not lt or (lt.get("v") or 0) < 3:
        out.append("letter")
    return out


def plan_tasks(kinds: list[str]) -> list[dict]:
    """רשימת משימות עם תלויות: מכתב מחכה לסקירה כשגם היא נוצרת עכשיו."""
    out = []
    for k in kinds:
        to, what = KINDS[k]
        out.append({"kind": k, "to": to, "what": what, "after": "brief" if k == "letter" and "brief" in kinds else None})
    return out


def ready(tasks: list[dict], status_of: dict) -> list[dict]:
    """משימות פתוחות שאפשר לבצע עכשיו: אין להן תלות, או שהתלות הסתיימה (או נכשלה, ואז לא מחכים לנצח)."""
    return [t for t in tasks if t.get("status") == "pending"
            and (not t.get("depends_on") or status_of.get(t["depends_on"], "done") in ("done", "failed"))]


def high_fit(jobs: list[dict]) -> list[dict]:
    """משרות חדשות בציון גבוה מאוד, הטובות ביותר קודם."""
    return sorted([j for j in jobs if (j.get("fit") or 0) >= HIGH_FIT], key=lambda j: -j["fit"])[:HIGH_FIT_MAX]


# ── Supabase ───────────────────────────────────────────────────────────────

def available() -> bool:
    global _avail
    if _avail is None:
        try:
            import httpx
            from agent_core import cloud_store as db
            r = httpx.get(db._url("agent_tasks"), headers=db._h(), params={"select": "id", "limit": "1"}, timeout=20)
            _avail = r.status_code == 200
            if not _avail:
                print("טבלת המשימות עוד לא קיימת (supabase/agent_tasks.sql). הסוכנים עובדים בלי משימות.")
        except Exception:  # noqa: BLE001
            _avail = False
    return _avail


def _open(user_id: str) -> list[dict]:
    import httpx
    from agent_core import cloud_store as db
    r = httpx.get(db._url("agent_tasks"), headers=db._h(), timeout=30, params={
        "select": "*", "user_id": f"eq.{user_id}", "status": "eq.pending", "order": "id.asc", "limit": "200"})
    r.raise_for_status()
    return r.json()


def create(user_id: str, frm: str, kind: str, need: str, job_id: str | None = None,
           after: int | None = None, existing: list[dict] | None = None) -> int | None:
    """יוצר משימה, אלא אם כבר יש משימה פתוחה זהה (אותו סוכן, סוג ומשרה). מחזיר את המזהה."""
    import httpx
    from agent_core import cloud_store as db
    to = KINDS[kind][0]
    for t in existing if existing is not None else _open(user_id):
        if t["to_agent"] == to and t["kind"] == kind and t.get("job_id") == job_id:
            return t["id"]
    r = httpx.post(db._url("agent_tasks"), headers=db._h({"Prefer": "return=representation"}), timeout=30, json={
        "user_id": user_id, "job_id": job_id, "from_agent": frm, "to_agent": to, "kind": kind,
        "need": need[:300], "depends_on": after})
    r.raise_for_status()
    act.log(frm, need, to=to)
    row = r.json()[0]
    if existing is not None:
        existing.append(row)
    return row["id"]


def request_for_job(user_id: str, frm: str, job: dict, kinds: list[str], why: str,
                    existing: list[dict] | None = None) -> list[int]:
    """כמה משימות על משרה אחת, עם התלויות ביניהן."""
    ids, by_kind = [], {}
    for t in plan_tasks(kinds):
        need = f"{why}: {job.get('title')} ב-{job.get('co')}. צריך {t['what']}."
        tid = create(user_id, frm, t["kind"], need, job.get("id"), by_kind.get(t["after"]) if t["after"] else None, existing)
        by_kind[t["kind"]] = tid
        ids.append(tid)
    return ids


def due(user_id: str, agent: str) -> list[dict]:
    """המשימות של סוכן שאפשר לבצע עכשיו."""
    rows = _open(user_id)
    mine = [t for t in rows if t["to_agent"] == agent]
    dep_ids = {t["depends_on"] for t in mine if t.get("depends_on")} - {t["id"] for t in rows}
    status = {t["id"]: t["status"] for t in rows}
    if dep_ids:  # תלויות שכבר לא פתוחות: מביאים את הסטטוס שלהן
        import httpx
        from agent_core import cloud_store as db
        r = httpx.get(db._url("agent_tasks"), headers=db._h(), timeout=30, params={
            "select": "id,status", "id": f"in.({','.join(str(i) for i in dep_ids)})"})
        if r.status_code == 200:
            status.update({x["id"]: x["status"] for x in r.json()})
    return ready(mine, status)


def finish(task: dict, ok: bool = True, result: dict | None = None, note: str = "") -> None:
    import httpx
    from agent_core import cloud_store as db
    httpx.patch(db._url("agent_tasks"), headers=db._h(), timeout=30, params={"id": f"eq.{task['id']}"}, json={
        "status": "done" if ok else "failed", "result": result, "done_at": datetime.now(timezone.utc).isoformat()}).raise_for_status()
    if note:
        act.log(task["to_agent"], note, to=task["from_agent"] if task["from_agent"] != task["to_agent"] else None)
