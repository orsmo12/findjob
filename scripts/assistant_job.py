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
from agent_core.agents.tasks import build_tasks
from agent_core.budget_guard import BudgetDeferred
from agent_core import activity as act
from agent_core.agents import linkedin_coach as K
from agent_core.profile import build_search_plan, domain_of
from agent_core.agents import growth as G
import hashlib, json as _json
from datetime import datetime, timedelta, timezone

if not db.configured():
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים")

from agent_core.llm_router import use_key
for u in db.profiles_ready():
    _k = ((u.get("state") or {}).get("ai_key") or "").strip()
    use_key(_k if _k.startswith("gsk_") and len(_k) > 30 else None)   # מפתח אישי אם יש, אחרת המשותף
    cv, name = u["cv_text"], u.get("name") or u.get("first") or ""
    done = {"letter": [], "brief": [], "prep": []}
    act.start(u["user_id"])
    for row in db.saved_missing(u["user_id"]):
        job, upd = row["card"], {}
        act.log("assistant", f"נשמרה משרה: {job['title']} ב-{job['co']}. גיל — מחקר על החברה, מאיה — שאלות הכנה.", to="researcher")
        try:
            if not row.get("letter") or (row["letter"].get("v") or 0) < 3:  # v3: מכתב קצר וממוקד, בדיקת מקור כוללת את שם המשרה
                upd["letter"] = write_letter(cv, job, name)
            if not row.get("brief"):
                upd["brief"] = brief(job["co"], job["title"], cv)
            prep = row.get("prep")
            if not prep:
                prep = prepare(cv, job); upd["prep"] = prep
            if prep.get("tasks") is None or prep.get("more_tasks"):
                used = {t["url"] for t in prep.get("tasks") or []} | set(prep.get("used_tasks") or [])
                # מטלות בית מ-GitHub מתאימות לתחומי תוכנה. בתחום אחר — לא ממציאים, נשאר ריק
                fresh = build_tasks(job, need=4, exclude=used) if domain_of(u) == "פיתוח תוכנה" else []
                prep = {**prep, "tasks": (prep.get("tasks") or []) + fresh, "more_tasks": False}
                if not fresh and row.get("prep") and row["prep"].get("more_tasks"):
                    prep["no_more_tasks"] = True
                upd["prep"] = prep
        except BudgetDeferred:
            print("מכסה: ממשיכים בריצה הבאה")
        except Exception as e:  # noqa: BLE001
            print(f"{row['id']}: {type(e).__name__}: {e}")
        if upd:
            db.update_job(u["user_id"], row["id"], upd)
            for k in upd:
                if k != "brief" or upd[k].get("found"):
                    done[k].append(job["co"])
            act.debug(f"{u['user_id'][:8]} · {job['co']}: {', '.join(upd)}"
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
            db.add_run(u["user_id"], "linkedin", f"עברתי על פרופיל ה-LinkedIn שלך: {len(fixes)} שיפורים, עם טקסט מוכן להעתקה." if fixes
                       else "עברתי על פרופיל ה-LinkedIn שלך. לא מצאתי שיפור שאפשר להציע בלי להוסיף דברים שלא כתובים אצלך.")
        except BudgetDeferred:
            print("מכסה: הפרופיל בריצה הבאה")
    act.flush()

    # ── מאיה: כרטיסי כישורים מהפערים שהישיבה השבועית מצאה ──────────────────
    try:
        gaps = (db.latest_plan(u["user_id"], "meeting").get("skill_gaps") or [])
        key = hashlib.sha1(_json.dumps([g["skill"] for g in gaps[:3]]).encode()).hexdigest()[:10]
        prev = next((r["stats"] for r in db.recent_runs(u["user_id"], "coach", days=30) if (r.get("stats") or {}).get("skills")), {})
        if gaps and prev.get("for") != key:
            ex: dict[str, list[str]] = {}
            for j in db.all_jobs(u["user_id"], days=21):
                c = j.get("card") or {}
                for g in gaps:
                    if any(g["skill"].lower() in x.lower() for x in c.get("gaps") or []):
                        ex.setdefault(g["skill"], []).append(f"{c.get('title')} ב-{c.get('co')}")
            res = G.skill_cards(gaps, cv, ex)
            db.add_run(u["user_id"], "coach", "הכנתי כרטיסי כישורים לפערים שחוזרים במשרות שמתאימות לך: "
                       + ", ".join(c["skill"] for c in res["cards"]) + ". יש בהם מקורות לימוד ואיך להכניס את זה לפרויקט שלך. נמצאים במסך ההכנה.",
                       {"skills": res, "for": key})
            act.flush()
    except BudgetDeferred:
        print("מכסה: כרטיסי כישורים בריצה הבאה")
    except Exception as e:  # noqa: BLE001
        print(f"כרטיסי כישורים נכשלו: {type(e).__name__}: {e}"); act.flush()

    # ── קובי: מה עשית ב-GitHub ולא כתוב בקורות החיים (פעם בשבוע, או כשהשם משתנה) ──
    try:
        gh = ((u.get("answers") or {}).get("github") or "").strip().lstrip("@").split("/")[-1]
        prev = next((r["stats"] for r in db.recent_runs(u["user_id"], "linkedin", days=30) if (r.get("stats") or {}).get("cv_for")), {})
        stale = not prev.get("at") or prev.get("at") < (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        cvh = hashlib.sha1(cv.encode()).hexdigest()[:10]
        if gh and (prev.get("cv_for") != f"{gh}:{cvh}" or stale):
            ev = G.github_evidence(gh)
            gaps = [g["skill"] for g in (db.latest_plan(u["user_id"], "meeting").get("skill_gaps") or [])]
            sug = G.cv_suggestions(cv, ev, gaps)
            db.add_run(u["user_id"], "linkedin",
                       (f"עברתי על {len(ev)} הריפוזיטוריז הציבוריים שלך ב-GitHub ומצאתי {len(sug)} דברים שעשית ולא כתובים בקורות החיים. "
                        "אפשר לאשר ולקבל קורות חיים מעודכנים בפרופיל." if sug else
                        f"עברתי על {len(ev)} ריפוזיטוריז ב-GitHub. לא מצאתי משהו חשוב שחסר בקורות החיים." if ev else
                        f"לא הצלחתי לקרוא ריפוזיטוריז ציבוריים של {gh} ב-GitHub. כדאי לבדוק את שם המשתמש בפרופיל."),
                       {"cv_suggest": sug, "cv_for": f"{gh}:{cvh}", "at": datetime.now(timezone.utc).isoformat()})
            act.flush()
    except BudgetDeferred:
        print("מכסה: GitHub בריצה הבאה")
    except Exception as e:  # noqa: BLE001
        print(f"קורות חיים מ-GitHub נכשל: {type(e).__name__}: {e}"); act.flush()
