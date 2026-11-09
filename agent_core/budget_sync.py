"""
budget_sync.py — מצב מכסת ה-AI עובר בין ריצות דרך Supabase.

pull() בתחילת ריצה, push() בסוף. כישלון כאן לא מפיל ריצה: במקרה הגרוע הנתב לומד את המכסה מחדש מ-Groq.
"""
from agent_core import budget_guard as bg


def pull() -> None:
    try:
        from agent_core import cloud_store as db
        bg.restore(db.system_memory("budget").get("files") or {})
    except Exception as e:  # noqa: BLE001
        print(f"מצב המכסה לא נטען: {type(e).__name__}")


def push() -> None:
    try:
        from agent_core import cloud_store as db
        files = bg.snapshot()
        if files:
            db.save_system_memory("budget", {"files": files})
    except Exception as e:  # noqa: BLE001
        print(f"מצב המכסה לא נשמר: {type(e).__name__}")
