"""
letters_job.py — שי בענן: מכתב פנייה לכל משרה ששמרת ועוד אין לה מכתב.
רץ כל שעתיים ביום (GitHub Actions). המכתב מחכה באפליקציה. שום דבר לא נשלח.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent_core import cloud_store as db
from agent_core.agents.letters import write_letter
from agent_core.budget_guard import BudgetDeferred

if not db.configured():
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים")

for u in db.profiles_ready():
    todo = db.saved_without_letter(u["user_id"])
    for row in todo:
        try:
            letter = write_letter(u["cv_text"], row["card"], u.get("name") or u.get("first") or "")
            db.save_letter(u["user_id"], row["id"], letter)
            print(f"{u['user_id'][:8]}: מכתב ל-{row['card']['co']} ({'נבדק' if letter['checked'] else 'נבדק חלקית'})")
        except BudgetDeferred:
            print("מכסה: ממשיכים בריצה הבאה"); break
        except Exception as e:
            print(f"{row['id']}: נכשל: {type(e).__name__}: {e}")
