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
from agent_core import activity as act
from agent_core.agents import linkedin_coach as K
from agent_core.profile import build_search_plan

if not db.configured():
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים")

for u in db.profiles_ready():
    cv, name = u["cv_text"], u.get("name") or u.get("first") or ""
    done = {"letter": [], "brief": [], "prep": []}
    act.start(u["user_id"])
    for row in db.saved_missing(u["user_id"]):
        job, upd = row["card"], {}
        act.log("assistant", f"נשמרה משרה: {job['title']} ב-{job['co']}. גיל — מחקר על החברה, מאיה — שאלות הכנה.", to="researcher")
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
            for k in upd:
                if k != "brief" or upd[k].get("found"):
                    done[k].append(job["co"])
            print(f"{u['user_id'][:8]} · {job['co']}: {', '.join(upd)}"
                  + (" (לא נמצא מידע על החברה)" if "brief" in upd and not upd["brief"].get("found") else ""))
    act.flush()
    names = lambda xs: ", ".join(xs[:3]) + (f" ועוד {len(xs) - 3}" if len(xs) > 3 else "")
    if done["letter"]:
        db.add_run(u["user_id"], "assistant", f"מכתב פנייה מוכן ל-{names(done['letter'])}. כל פרט בו נבדק מול קורות החיים.")
    if done["brief"]:
        db.add_run(u["user_id"], "researcher", f"הכנתי סקירה עם מקורות על {names(done['brief'])}.")
    if done["prep"]:
        db.add_run(u["user_id"], "coach", f"שאלות הכנה מוכנות ל-{names(done['prep'])}, לפי מה שכתוב במודעה.")
    # מאיה: שיפורי פרופיל LinkedIn — רק כשהעלית PDF חדש של הפרופיל
    lf = dict(u.get("li_fixes") or {})      # עמודה נפרדת: קובי ומאיה לא דורסים זה את זה
    lt = u.get("li_text") or ""
    if lt and lf.get("for") != K.li_hash(lt):
        try:
            plan = build_search_plan({"cv_text": cv, "answers": u.get("answers") or {}}).to_dict()
            fixes = K.profile_fixes(cv, lt, plan)
            db.update_profile(u["user_id"], {"li_fixes": {"fixes": fixes, "for": K.li_hash(lt)}})
            db.add_run(u["user_id"], "coach", f"עברתי על פרופיל ה-LinkedIn שלך: {len(fixes)} שיפורים, עם טקסט מוכן להעתקה." if fixes
                       else "עברתי על פרופיל ה-LinkedIn שלך. לא מצאתי שיפור שאפשר להציע בלי להוסיף דברים שלא כתובים אצלך.")
        except BudgetDeferred:
            print("מכסה: הפרופיל בריצה הבאה")
    act.flush()
