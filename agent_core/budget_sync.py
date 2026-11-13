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
            hist = db.system_memory("budget_hist").get("days") or {}   # היסטוריה יומית לפי סוכן (המכסה עצמה מתאפסת כל יום)
            for i, f in enumerate(files.values()):   # קובץ לכל מפתח: נשמר לפי מספר הקובץ, כדי שמפתחות שונים לא ידרסו זה את זה
                if isinstance(f, dict) and f.get("date"):
                    day = hist.setdefault(f["date"], {})
                    for k, v in (f.get("usage") or {}).items():
                        day.setdefault(k, {})[str(i)] = int((v or {}).get("tokens") or 0)
            db.save_system_memory("budget_hist", {"days": {d: hist[d] for d in sorted(hist)[-30:]}})
    except Exception as e:  # noqa: BLE001
        print(f"מצב המכסה לא נשמר: {type(e).__name__}")
