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
