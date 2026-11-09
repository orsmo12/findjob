"""
assistant_job.py — הסוכנים שעובדים לפי משימות: גיל (סקירה), קובי (התאמת קורות חיים), מאיה (הכנה), שי (מכתב).

יואב מתאם: לכל משרה ששמרת ושחסר לה משהו, הוא יוצר משימה לסוכן המתאים (טבלת agent_tasks).
דורון יוצר משימות בעצמו כשהוא מוצא משרה בציון גבוה מאוד. כל סוכן מבצע את המשימות שלו, לפי הסדר:
סקירה ← התאמת קורות חיים ← הכנה ← מכתב (המכתב מחכה לסקירה). אין משימות: הריצה נגמרת מהר.
רץ מיד אחרי הסריקה, ועוד כל שעתיים ביום. הכל מחכה באפליקציה. שום דבר לא נשלח ושום חשבון לא נוגעים בו.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent_core import cloud_store as db
from agent_core import handoffs as H
from agent_core import run_report as RR, budget_sync
from agent_core.agents.letters import write_letter
from agent_core.agents.letter_graph import write_letter_v4
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
budget_sync.pull()


def do_kind(kind: str, row: dict, u: dict, cv: str, name: str) -> dict:
    """מבצע עבודה אחת על משרה ומחזיר את השדות לעדכון."""
    job = row["card"]
    if kind == "brief":
        return {"brief": brief(job["co"], job["title"], cv)}
    if kind == "tailor":
        return {"tailor": G.tailor_cv(cv, job)}
    if kind == "letter":   # v4: לולאת LangGraph עם הסקירה של גיל, "המצב שלי" והמכתבים שהמשתמש העלה
        st, a = u.get("state") or {}, u.get("answers") or {}
        return {"letter": write_letter_v4(cv, job, name, row.get("brief"), str(a.get("now") or "")[:400],
                                          [str(x) for x in st.get("my_letters") or []][:3], may_reuse=True)}
    if kind == "prep":
        prep = row.get("prep") or prepare(cv, job)
        if prep.get("tasks") is None or prep.get("more_tasks"):
            used = {t["url"] for t in prep.get("tasks") or []} | set(prep.get("used_tasks") or [])
            # מטלות בית מ-GitHub מתאימות לתחומי תוכנה. בתחום אחר — לא ממציאים, נשאר ריק
            fresh = build_tasks(job, need=4, exclude=used) if domain_of(u) == "פיתוח תוכנה" else []
            prep = {**prep, "tasks": (prep.get("tasks") or []) + fresh, "more_tasks": False}
            if not fresh and (row.get("prep") or {}).get("more_tasks"):
                prep["no_more_tasks"] = True
        return {"prep": prep}
    return {}


DONE_NOTE = {"brief": "הסקירה על {co} מוכנה", "tailor": "הצעות להתאמת קורות החיים ל-{co} מוכנות",
             "prep": "שאלות ההכנה ל-{co} מוכנות", "letter": "המכתב ל-{co} מוכן"}
DONE_KEY = {"brief": "brief", "tailor": "tailor", "prep": "prep", "letter": "letter"}


def record(upd: dict, job: dict, done: dict) -> None:
    for k in upd:
        if k != "brief" or upd[k].get("found"):
            done.setdefault(k, []).append(job["co"])


def work_by_tasks(u: dict, cv: str, name: str, done: dict) -> None:
    uid = u["user_id"]
    # יואב מתאם: מה חסר במשרות ששמרת, ולמי זה הולך
    existing = H._open(uid)
    for row in db.saved_jobs(uid):
        miss = H.missing_for_saved(row)
        if miss:
            H.request_for_job(uid, "strategist", {**row["card"], "id": row["id"]}, miss, "נשמרה משרה", existing)
    act.flush()
    # כל סוכן מבצע את המשימות שלו, לפי הסדר
    for agent in H.ORDER:
        for t in H.due(uid, agent):
            row = db.get_job(uid, t["job_id"]) if t.get("job_id") else None
            if not row or (row["card"] or {}).get("closed_at") or row.get("decision") in ("skip", "removed", "filtered"):
                H.finish(t, False, {"why": "המשרה נסגרה, הוסרה או שדילגת עליה"}); continue
            if t["kind"] != "prep" and row.get(DONE_KEY[t["kind"]]) and (t["kind"] != "letter" or (row["letter"].get("v") or 0) >= 3):
                H.finish(t, True, {"skip": "כבר מוכן"}); continue
            try:
                upd = do_kind(t["kind"], row, u, cv, name)
            except BudgetDeferred:
                print("מכסה: ממשיכים בריצה הבאה")
                act.log(agent, "הגעתי למכסת ה-AI. את המשימות שנשארו אעשה בריצה הבאה.")
                act.flush()
                if not done.get("_quota"):   # הודעה אחת למשתמש, לא אחת לכל משימה
                    done["_quota"] = True
                    db.add_run(uid, agent, budget_sync.bg.quota_note(agent))
                return
            except Exception as e:  # noqa: BLE001
                print(f"{t['id']}: {type(e).__name__}: {e}")
                RR.fail(f"משימה {t['kind']}", uid, e)
                H.finish(t, False, {"error": type(e).__name__}, "לא הצלחתי הפעם. אנסה שוב בריצה הבאה."); continue
            if upd:
                db.update_job(uid, row["id"], upd)
                record(upd, row["card"], done)
            H.finish(t, True, {"fields": list(upd)}, DONE_NOTE[t["kind"]].format(co=row["card"]["co"]))
            act.flush()


def work_legacy(u: dict, cv: str, name: str, done: dict) -> None:
    """בלי טבלת משימות: כמו קודם, עובר על כל משרה שמורה שחסר לה משהו."""
    for row in db.saved_jobs(u["user_id"], with_tailor=False):
        job, upd = row["card"], {}
        miss = [k for k in H.missing_for_saved({**row, "tailor": True})]
        if not miss:
            continue
        act.log("assistant", f"נשמרה משרה: {job['title']} ב-{job['co']}. גיל — מחקר על החברה, מאיה — שאלות הכנה.", to="researcher")
        try:
            for k in miss:
                upd.update(do_kind(k, {**row, **upd}, u, cv, name))
        except BudgetDeferred:
            print("מכסה: ממשיכים בריצה הבאה")
        except Exception as e:  # noqa: BLE001
            print(f"{row['id']}: {type(e).__name__}: {e}")
        if upd:
            db.update_job(u["user_id"], row["id"], upd)
            record(upd, job, done)


from agent_core.llm_router import use_key
for u in db.profiles_ready():
    _k = ((u.get("state") or {}).get("ai_key") or "").strip()
    use_key(_k if _k.startswith("gsk_") and len(_k) > 30 else None)   # מפתח אישי אם יש, אחרת המשותף
    cv, name = u["cv_text"], u.get("name") or u.get("first") or ""
    done: dict = {}
    act.start(u["user_id"])
    try:
        (work_by_tasks if H.available() else work_legacy)(u, cv, name, done)
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: משימות נכשלו: {type(e).__name__}: {e}")
        RR.fail("משימות", u["user_id"], e)
    act.flush()
    names = lambda xs: ", ".join(xs[:3]) + (f" ועוד {len(xs) - 3}" if len(xs) > 3 else "")
    if done.get("letter"):
        db.add_run(u["user_id"], "assistant", f"מכתב פנייה מוכן ל-{names(done['letter'])}. כל פרט בו נבדק מול קורות החיים.")
    if done.get("brief"):
        db.add_run(u["user_id"], "researcher", f"הכנתי סקירה עם מקורות על {names(done['brief'])}.")
    if done.get("tailor"):
        db.add_run(u["user_id"], "linkedin", f"הכנתי הצעות להתאמת קורות החיים ל-{names(done['tailor'])}. רק ניסוח וסדר, בלי שום פרט חדש. נמצאות בגיליון ההגשה.")
    if done.get("prep"):
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
        print(f"כרטיסי כישורים נכשלו: {type(e).__name__}: {e}"); act.flush(); RR.fail("כרטיסי כישורים", u["user_id"], e)

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
        print(f"קורות חיים מ-GitHub נכשל: {type(e).__name__}: {e}"); act.flush(); RR.fail("קורות חיים מ-GitHub", u["user_id"], e)

budget_sync.push()
RR.send("המשימות")
