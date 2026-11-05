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
        for f in (st.get("feedback") or [])[-10:]:
            if f.get("at", "") >= week:
                feedback.append({"name": rows[-1]["name"], "t": f.get("t", "")[:500], "at": f.get("at", "")[:10]})
    active = sum(1 for r in rows if r["days_week"])
    msg = (f"דוח שימוש שבועי: {len(rows)} משתמשים, {active} נכנסו השבוע. "
           + " · ".join(f"{r['name']}: {r['days_week']} ימים, {r['saved']} שמורות, {r['applied']} הגשות" for r in rows[:6])
           + (f". {len(feedback)} משובים חדשים." if feedback else "."))
    return admin, {"rows": rows, "feedback": feedback, "msg": msg}
