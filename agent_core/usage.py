"""
usage.py — דוח שימוש לבעל המערכת (המשתמש הראשון שנרשם).

רק ספירות: כמה ימים כל משתמש נכנס, כמה משרות שמר ודילג, כמה שאלות שאל בצ׳אט,
ואילו מסכים פתח. התוכן של המשתמשים (קורות חיים, מכתבים, שיחות) לא נכלל, חוץ מהמשוב שהם כתבו בכוונה למפתח.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone


def report(users: list[dict], profiles: list[dict], jobs_by_user: dict[str, list[dict]]) -> tuple[str | None, dict]:
    """מחזיר (user_id של בעל המערכת, הדוח)."""
    if not users:
        return None, {}
    admin = sorted(users, key=lambda u: u.get("created_at") or "")[0]["id"]
    prof = {p["user_id"]: p for p in profiles}
    week = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    rows, feedback = [], []
    for u in sorted(users, key=lambda u: u.get("created_at") or ""):
        p = prof.get(u["id"]) or {}
        st = p.get("state") or {}
        us = st.get("usage") or {}
        c = us.get("c") or {}
        days = us.get("days") or []
        jobs = jobs_by_user.get(u["id"], [])
        dec = lambda d: sum(1 for j in jobs if j.get("decision") == d)
        pages = sorted(((k[5:], v) for k, v in c.items() if k.startswith("page_")), key=lambda x: -x[1])[:3]
        rows.append({"name": p.get("first") or (u.get("email") or "").split("@")[0][:3] + "…",
                     "joined": (u.get("created_at") or "")[:10], "last": (us.get("last") or "")[:10],
                     "days": len(days), "days_week": sum(1 for d in days if d >= week),
                     "cv": bool(p.get("cv_text")), "own_key": str(st.get("ai_key") or "").startswith("gsk_"), "domain": (p.get("answers") or {}).get("domain") or "",
                     "saved": dec("save"), "skipped": dec("skip"), "waiting": dec(None),
                     "applied": sum(1 for a in st.get("apps") or [] if a.get("status") not in (None, "saved")),
                     "chat": c.get("chat", 0), "add_job": c.get("add_job", 0), "pages": pages})
        month = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
        for f in (st.get("feedback") or [])[-15:]:
            if f.get("at", "") >= month:   # המפתח מסמן סטטוס לכל משוב (key), והמשתמש מקבל עדכון
                feedback.append({"name": rows[-1]["name"], "t": f.get("t", "")[:500], "at": f.get("at", "")[:10],
                                 "key": f"{u['id'][:8]}|{f.get('at', '')}", "new": f.get("at", "") >= week})
    active = sum(1 for r in rows if r["days_week"])
    msg = (f"דוח שימוש שבועי: {len(rows)} משתמשים, {active} נכנסו השבוע. "
           + " · ".join(f"{r['name']}: {r['days_week']} ימים, {r['saved']} שמורות, {r['applied']} הגשות" for r in rows[:6])
           + (f". {sum(1 for f in feedback if f['new'])} משובים חדשים." if any(f['new'] for f in feedback) else "."))
    return admin, {"rows": rows, "feedback": feedback, "msg": msg}


FB_STATUS = {"got": "התקבלה", "doing": "בעבודה", "done": "נוספה לאפליקציה", "no": "לא תיכנס כרגע"}


def feedback_updates(statuses: dict, profiles: list[dict], seen: dict) -> list[tuple[str, str, str, str]]:
    """(user_id, key, status, message) לכל משוב שהמפתח שינה לו סטטוס ועוד לא דווח למשתמש."""
    out = []
    for p in profiles:
        uid = p.get("user_id") or ""
        for f in ((p.get("state") or {}).get("feedback") or []):
            key = f"{uid[:8]}|{f.get('at', '')}"
            st = statuses.get(key)
            if st in FB_STATUS and seen.get(key) != st:
                out.append((uid, key, st, f"עדכון על הבקשה שלך \"{str(f.get('t', ''))[:70]}\": {FB_STATUS[st]}. תודה ששלחת!"))
    return out
