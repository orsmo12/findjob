"""
push.py — הודעה לטלפון כשדורון מוצא משרות חדשות (Web Push).

המנוי נשמר בפרופיל (state.push) רק אחרי שהמשתמש הפעיל התראות בהגדרות. המפתח הפרטי (VAPID_PRIVATE_KEY)
נמצא רק ב-GitHub Secrets. בלי מפתח או בלי מנוי — לא שולחים כלום. התוכן: רק מספר המשרות, בלי פרטים אישיים.
"""
from __future__ import annotations
import json
import os


def message(n: int, hunter: str = "דורון") -> dict:
    return {"title": "findjob", "body": f"{hunter} מצא " + ("משרה חדשה אחת שמתאימה לך." if n == 1 else f"{n} משרות חדשות שמתאימות לך."),
            "url": "/", "tag": "new-jobs"}


def send(sub: dict | None, payload: dict) -> str:
    """'sent' / 'skip' (אין מנוי או מפתח) / 'gone' (המנוי כבר לא בתוקף) / 'error'."""
    key = (os.environ.get("VAPID_PRIVATE_KEY") or "").strip()
    if not sub or not sub.get("endpoint") or not key:
        return "skip"
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        return "skip"
    try:
        webpush(subscription_info=sub, data=json.dumps(payload, ensure_ascii=False), vapid_private_key=key,
                vapid_claims={"sub": "mailto:findjob@users.noreply.github.com"}, ttl=6 * 3600)
        return "sent"
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", 0)
        return "gone" if code in (404, 410) else "error"
    except Exception:  # noqa: BLE001
        return "error"


def ask_payload(apps: list[dict], cards: dict, asked: dict, today: str) -> tuple[dict | None, str]:
    """מסלול הגשה: שאלה אחת ביום עם כפתורים. שבוע אחרי הגשה, או יום אחרי שיחה/מטלה/ראיון.
    asked: {app_id: תאריך ששאלנו} — לא שואלים על אותה הגשה פעמיים בשבוע. מחזיר (payload, app_id) או (None, "")."""
    from datetime import date, datetime
    d0 = date.fromisoformat(today)
    days = lambda iso: (d0 - datetime.fromisoformat(str(iso).replace("Z", "+00:00")).date()).days if iso else -1
    for a in apps or []:
        st, aid = a.get("status"), a.get("id")
        if not aid or (a.get("snooze") and str(a["snooze"])[:10] > today):
            continue
        if asked.get(aid) and days(asked[aid]) < 7:
            continue
        steps = a.get("steps") or []
        last = steps[-1]["at"] if steps else a.get("date")
        co = (cards.get(a.get("jobId")) or {}).get("co") or "החברה"
        if st == "applied" and 7 <= days(last) < 30:
            q = f"שמעת מ-{co}?"
        elif st in ("screening", "task", "interview") and a.get("when") and days(a["when"]) >= 1:
            q = f"איך היה ב-{co}?"
        else:
            continue
        return ({"title": "findjob", "body": q, "url": f"/#ask={aid}", "tag": "ask-" + aid,
                 "actions": [{"action": "yes", "title": "ממשיכים איתי" if st == "applied" else "עברתי לשלב הבא"},
                             {"action": "no", "title": "לא ממשיכים"}, {"action": "wait", "title": "עוד אין תשובה"}]}, aid)
    return None, ""
