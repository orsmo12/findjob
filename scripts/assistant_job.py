"""
assistant_job.py — מה שרץ בענן כל שעתיים ביום, לכל משרה ששמרת:
  שי: מכתב פנייה · גיל: סקירת חברה עם מקורות · מאיה: שאלות הכנה.
הכל מחכה באפליקציה. שום דבר לא נשלח ושום חשבון לא נוגעים בו.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent_core import cloud_store as db
from agent_core.agents.letters import write_letter
from agent_core.agents.research import brief
from agent_core.agents.prep import prepare
from agent_core.budget_guard import BudgetDeferred

if not db.configured():
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים")

for u in db.profiles_ready():
    cv, name = u["cv_text"], u.get("name") or u.get("first") or ""
    for row in db.saved_missing(u["user_id"]):
        job, upd = row["card"], {}
        try:
            if not row.get("letter"):
                upd["letter"] = write_letter(cv, job, name)
            if not row.get("brief"):
                upd["brief"] = brief(job["co"], job["title"], cv)
            if not row.get("prep"):
                upd["prep"] = prepare(cv, job)
        except BudgetDeferred:
            print("מכסה: ממשיכים בריצה הבאה")
        except Exception as e:  # noqa: BLE001
            print(f"{row['id']}: {type(e).__name__}: {e}")
        if upd:
            db.update_job(u["user_id"], row["id"], upd)
            print(f"{u['user_id'][:8]} · {job['co']}: {', '.join(upd)}"
                  + (" (לא נמצא מידע על החברה)" if "brief" in upd and not upd["brief"].get("found") else ""))
