"""
usage.py — דוח שימוש לבעל המערכת (המשתמש הראשון שנרשם).

רק ספירות: כמה ימים כל משתמש נכנס, כמה משרות שמר ודילג, כמה שאלות שאל בצ׳אט,
ואילו מסכים פתח. התוכן של המשתמשים (קורות חיים, מכתבים, שיחות) לא נכלל, חוץ מהמשוב שהם כתבו בכוונה למפתח.
בנוסף: משפך (כמה הגיעו לכל שלב), איפה נוטשים את ההרשמה והסיור, וטעויות JavaScript שקרו אצל משתמשים.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone


def report(users: list[dict], profiles: list[dict], jobs_by_user: dict[str, list[dict]],
           search: dict[str, dict] | None = None) -> tuple[str | None, dict]:
    """מחזיר (user_id של בעל המערכת, הדוח). search: מצב החיפוש לכל משתמש (search_status), מתעדכן אחרי כל סריקה."""
    if not users:
        return None, {}
    admin = sorted(users, key=lambda u: u.get("created_at") or "")[0]["id"]
    prof = {p["user_id"]: p for p in profiles}
    week = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    rows, feedback, errs = [], [], {}
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
                     "cv": bool(p.get("cv_text")), "own_key": bool(__import__("agent_core.llm_router", fromlist=["valid_key"]).valid_key(st.get("ai_key"))), "domain": (p.get("answers") or {}).get("domain") or "",
                     "saved": dec("save"), "skipped": dec("skip"), "waiting": dec(None),
                     "applied": sum(1 for a in st.get("apps") or [] if a.get("status") not in (None, "saved")),
                     "chat": c.get("chat", 0), "add_job": c.get("add_job", 0), "pages": pages,
                     "search": (search or {}).get(u["id"]) or {}, "cv_len": len(str(p.get("cv_text") or "").strip()),
                     "m": sorted((us.get("m") or {}).keys()), "stuck": stuck({**us, "no_cv": len(str(p.get("cv_text") or "").strip()) < 80}), "tour": tour_of(us)})
        for e in us.get("err") or []:
            k = str(e.get("m") or "")[:90]
            errs[k] = errs.get(k, 0) + 1
        month = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
        for f in (st.get("feedback") or [])[-15:]:
            if f.get("at", "") >= month:   # המפתח מסמן סטטוס לכל משוב (key), והמשתמש מקבל עדכון
                feedback.append({"name": rows[-1]["name"], "t": f.get("t", "")[:500], "at": f.get("at", "")[:10],
                                 "key": f"{u['id'][:8]}|{f.get('at', '')}", "new": f.get("at", "") >= week})
    active = sum(1 for r in rows if r["days_week"])
    msg = (f"דוח שימוש שבועי: {len(rows)} משתמשים, {active} נכנסו השבוע. "
           + " · ".join(f"{r['name']}: {r['days_week']} ימים, {r['saved']} שמורות, {r['applied']} הגשות" for r in rows[:6])
           + (f". {sum(1 for f in feedback if f['new'])} משובים חדשים." if any(f['new'] for f in feedback) else "."))
    fun = [(lbl, sum(1 for r in rows if ev in r["m"])) for ev, lbl in FUNNEL]
    top_err = sorted(errs.items(), key=lambda x: -x[1])[:8]
    if top_err:
        msg += f" {sum(errs.values())} שגיאות באפליקציה אצל משתמשים."
    return admin, {"rows": rows, "feedback": feedback, "msg": msg, "funnel": fun, "errors": top_err}


def search_status(hunter_runs: list[dict], other_runs: list[dict]) -> dict:
    """מצב החיפוש של משתמש: הסריקה האחרונה (נאספו / בכירות / דורגו / הוצגו), כמה סריקות ב-24 שעות,
    ומה הסוכנים עשו לאחרונה. רק מספרים והודעות הסוכנים, בלי קורות חיים ובלי מכתבים."""
    day = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    scans = [r for r in hunter_runs if isinstance(r.get("stats"), dict) and "collected" in r["stats"]]
    last = scans[0] if scans else None
    s = (last or {}).get("stats") or {}
    msgs = [{"at": r["created_at"][:16], "a": r.get("agent", ""), "m": str((r.get("stats") or {}).get("msg") or "")[:160]}
            for r in other_runs if (r.get("stats") or {}).get("msg")][:4]
    fails = sum(len((r.get("stats") or {}).get("failures") or []) for r in other_runs + hunter_runs if r.get("created_at", "") >= day)
    return {"last_scan": (last or {}).get("created_at", "")[:16], "scans_24h": sum(1 for r in scans if r["created_at"] >= day),
            "collected": s.get("collected", 0), "too_senior": s.get("too_senior", 0), "rated": s.get("rated", 0), "shown": s.get("shown", 0),
            "fails_24h": fails, "recent": msgs}


# המשפך: מהרשמה ועד הגשה. כל שלב נרשם פעם אחת למשתמש (usage.m) עם הזמן הראשון שקרה.
FUNNEL = [("onb_done", "סיים הרשמה"), ("jobs_seen", "ראה משרות"), ("job_save", "שמר משרה"), ("kit_open", "פתח ערכת הגשה"),
          ("letter_copy", "העתיק מכתב"), ("applied", "סימן הגשה"), ("chat", "דיבר עם שי"), ("push_on", "הפעיל התראות"),
          ("tour_done", "סיים סיור")]


def stuck(us: dict) -> str:
    """איפה המשתמש נעצר: השלב האחרון במשפך שלא הגיע אליו, או השאלה האחרונה בהרשמה."""
    m = us.get("m") or {}
    if "onb_done" not in m:
        q = next((e.get("p", {}).get("q") or e.get("p", {}).get("s") for e in reversed(us.get("ev") or [])
                  if e.get("e") in ("onb_q", "onb_step")), None)
        return f"בהרשמה ({q})" if q is not None else "בהרשמה"
    if us.get("no_cv"):   # סיים הרשמה בלי קורות חיים: הסוכנים לא רצים בשבילו (נמצא אצל גלעד)
        return "אין קורות חיים: הסוכנים לא רצים בשבילו"
    for ev, lbl in FUNNEL[1:6]:
        if ev not in m:
            return f"לפני: {lbl}"
    return ""


def tour_of(us: dict) -> str:
    last = next((e for e in reversed(us.get("ev") or []) if e.get("e") in ("tour_done", "tour_skip") and (e.get("p") or {}).get("k") == "main"), None)
    if not last:
        return ""
    p = last.get("p") or {}
    return "סיים" if last["e"] == "tour_done" else f"דילג בצעד {int(p.get('at', 0)) + 1} מתוך {p.get('of', '?')}"


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
