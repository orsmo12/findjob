"""
activity.py — יומן העבודה של הסוכנים (מה שמוצג ב"תהליך עבודה" במשרד).

כל סוכן כותב מה הוא עושה עכשיו, ומה הוא מעביר לסוכן אחר (to=...).
זה יכול להיות עמוס — בכוונה. ההודעות למשתמש (מה שרלוונטי אליך) נשמרות בנפרד, ב-cloud_store.add_run.
בלי משתמש פעיל (בדיקות, הרצה מקומית) — רק מדפיס.
"""
from __future__ import annotations
from datetime import datetime, timezone

_user: str | None = None
_buf: list[dict] = []


def start(user_id: str) -> None:
    global _user, _buf
    _user, _buf = user_id, []


def log(agent: str, text: str, to: str | None = None) -> None:
    print(f"  [{agent}{' → ' + to if to else ''}] {text}")
    if _user:
        _buf.append({"user_id": _user, "agent": agent,
                     "stats": {"log": text[:300], **({"to": to} if to else {})},
                     "created_at": datetime.now(timezone.utc).isoformat()})


def flush() -> None:
    """שולח את היומן ל-Supabase בבקשה אחת. כישלון כאן לא מפיל ריצה."""
    global _buf
    if not (_user and _buf):
        _buf = []; return
    try:
        from agent_core import cloud_store as db
        db.add_logs(_buf)
    except Exception as e:  # noqa: BLE001
        print(f"יומן לא נשמר: {type(e).__name__}: {e}")
    _buf = []
