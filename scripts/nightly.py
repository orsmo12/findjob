"""
nightly.py — מה שרץ בענן כל לילה (GitHub Actions).

לכל משתמש שהעלה קורות חיים: יואב בונה תוכנית מהפרופיל והשאלון שלו,
דורון מחפש ומדרג, והמשרות נשמרות ב-Supabase. האפליקציה בטלפון קוראת אותן משם.
"""
import sys
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agent_core import cloud_store as db
from agent_core.profile import build_search_plan
from agent_core.agents.hunter import run, collect, rerate, RATING_V, BudgetDeferred
from agent_core import activity as act
from agent_core import handoffs as H
from agent_core import run_report as RR, budget_sync
from agent_core.agents.live import check as still_open
import httpx as _httpx
import httpx
from agent_core.agents.ats import collect_targets, name_matches, same_company
from agent_core.profile import select_targets, load_catalog
from agent_core.profile import SearchPlan
from agent_core.agents import linkedin_coach as K
from agent_core.agents import meeting as M
from datetime import datetime, timezone, timedelta

if not db.configured():
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים")

import os
budget_sync.pull()
from agent_core.llm_router import clean_key, use_key
k = clean_key(os.environ.get("GROQ_API_KEY"), "GROQ_API_KEY")
raw = os.environ.get("GROQ_API_KEY") or ""
print(f"מפתח Groq: {'תקין' if k.startswith('gsk_') and len(k) > 40 else 'לא תקין'} (אורך {len(k)}, נוקה: {'כן' if raw != k else 'לא'})")
def user_key(u: dict) -> str | None:
    from agent_core.llm_router import valid_key   # Groq, Gemini, Claude או OpenAI
    return valid_key((u.get("state") or {}).get("ai_key"))


def fair_rate_top(u: dict) -> int:
    """מפתח אישי = 25 דירוגים לסריקה. במפתח המשותף: לפי כמה המשתמש פעיל לאחרונה, כדי שהמכסה תספיק לכולם."""
    if user_key(u):
        return 25
    last = ((u.get("state") or {}).get("usage") or {}).get("last") or ""
    if last >= (datetime.now(timezone.utc) - timedelta(days=3)).isoformat():
        return 15
    return 6


# לו"ז: הסריקה רצה פעמיים ביום (בוקר ואחר הצהריים). בדיקת משרות פתוחות ודוח שימוש — רק בבוקר.
# קובי מחפש פוסטים פעם בשבוע. FORCE_MEETING מריץ הכל.
# "בוקר" = הסריקה הראשונה של היום בישראל, גם אם GitHub איחר בשעות. ריצה למשתמש אחד לא נחשבת
from zoneinfo import ZoneInfo
TODAY = datetime.now(ZoneInfo("Asia/Jerusalem")).date().isoformat()
try:
    _daily_done = db.system_memory("daily").get("day") == TODAY
except Exception:  # noqa: BLE001
    _daily_done = datetime.now(timezone.utc).hour >= 9
MORNING = (not _daily_done and not (os.environ.get("ONLY_USER") or "").strip()) or bool(os.environ.get("FORCE_MEETING"))
users = db.profiles_ready()
print(f"{len(users)} משתמשים עם קורות חיים")
for u in users:
    use_key(user_key(u))
    ustate = u.get("state") or {}
    learned = db.latest_plan(u["user_id"], "meeting")          # מה יואב והצוות למדו בישיבה האחרונה
    prof = {"first": u.get("first", ""), "name": u.get("name", ""), "cv_text": u["cv_text"], "answers": u.get("answers") or {},
            "extra_titles": [x["value"] for x in ustate.get("accepted") or [] if x.get("type") == "role"],  # תפקידים שאישרת
            "drop_queries": learned.get("drop_queries") or [], "learned_queries": learned.get("add_queries") or []}
    plan = build_search_plan(prof).to_dict()
    act.start(u["user_id"])
    try:  # דורון: דירוג מחדש של משרות בפיד שדורגו בלי מודעה מלאה או בשיטה ישנה
        todo = db.to_rerate(u["user_id"], RATING_V)[:12]
        if todo:
            act.log("hunter", f"בודק שוב {len(todo)} משרות שמחכות לך: קורא את המודעה המלאה ומדרג מחדש")
        gone = []
        for row in todo:
            c = row["card"]
            saved = row.get("decision") == "save"
            try:
                st, new, why_ = rerate(c, prof, plan, min_fit=0 if saved else 3.5)
            except BudgetDeferred:
                act.log("hunter", "הגעתי למכסת ה-AI. את השאר אבדוק בסריקה הבאה."); break
            act.log("hunter", f"{c['title']} ב-{c['co']}: " + {"ok": f"דירוג מעודכן {why_}", "filtered": f"הורדתי מהרשימה ({why_})",
                                                              "later": f"{why_}, אנסה שוב בסריקה הבאה"}[st])
            if st == "ok":
                db.update_job(u["user_id"], row["id"], {"card": {**new, **{k: c[k] for k in ("closed_at",) if c.get(k)}}, "fit": new["fit"]})
            elif st == "filtered" and saved:  # משרה ששמרת לא נמחקת. רק מסמנים שלא נדרג אותה שוב
                db.update_job(u["user_id"], row["id"], {"card": {**c, "rv": RATING_V, "warn": why_}})
            elif st == "filtered":
                db.update_job(u["user_id"], row["id"], {"decision": "filtered", "card": {**c, "filtered_why": why_}})
                gone.append(f"{c['title']} ב-{c['co']}")
        if gone:
            db.add_run(u["user_id"], "hunter", "קראתי שוב את המודעות המלאות והורדתי מהרשימה משרות שלא מתאימות לך: "
                       + "; ".join(gone) + ".")
        act.flush()
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: דירוג מחדש נכשל: {type(e).__name__}: {e}")
        RR.fail("דירוג מחדש", u["user_id"], e)
        act.flush()
    act.start(u["user_id"])
    try:
        why = plan.get("why") or []
        act.log("strategist", "קורא את קורות החיים ואת התשובות שלך לשאלון")
        for w in why[:4]:
            act.log("strategist", w)
        act.log("strategist", f"תחפש: {', '.join(plan['queries'][:6])}. אזורים: {', '.join(plan['locations'][:2])}."
                + (f" עד {plan['max_years']} שנות ניסיון." if plan.get("max_years") else ""), to="hunter")
        plan_obj = build_search_plan(prof)
        tc = ustate.get("targets") or {}
        targets = select_targets(plan_obj, {"target_companies": tc}, load_catalog())
        removed = {x.lower() for x in tc.get("removed") or []}
        have = {t["name"].lower() for t in targets}
        for a in learned.get("auto_targets") or []:  # חברות שהצוות הוסיף לבד (אפשר להסיר בפרופיל)
            if a["name"].lower() not in removed and a["name"].lower() not in have:
                targets.append({"name": a["name"], "why": [a.get("why", "הצוות הוסיף")], "auto": True})
        conf, rej = tc.get("boards") or {}, tc.get("reject") or {}
        for t in targets:   # מה שאישרת או דחית בפרופיל ("זו החברה?")
            k = next((n for n in conf if n.lower() == t["name"].lower()), None)
            if k:
                t["board"] = conf[k]
            t["reject"] = next((v for n, v in rej.items() if n.lower() == t["name"].lower()), [])
        act.log("strategist", f"גם לבדוק ישירות את דפי הקריירה של {len(targets)} חברות יעד: {', '.join(t['name'] for t in targets[:6])}…", to="hunter")
        cache = db.latest_plan(u["user_id"], "boards").get("cache") or {}
        direct, boards, cache = collect_targets(targets, plan, cache)
        # חברות בלי לוח ציבורי: חיפוש לפי השם (קודם אלה שהוספת בעצמך), כולל תיקון שם
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        for b in boards:  # שם שלא נמצא — לא מחפשים שוב כל סריקה, רק פעם בשבוע
            nf = (cache.get(b["name"].lower()) or {}).get("nf")
            if b["status"] == "by_name" and nf and nf > week_ago:
                b["status"] = "not_found"
        by_name = sorted([b for b in boards if b["status"] == "by_name"], key=lambda b: 0 if "הוספת בעצמך" in b["why"] else 1)
        named = []
        for b in by_name[:3]:
            alias = (cache.get(b["name"].lower()) or {}).get("as") or b["name"]
            got = collect({"queries": [alias], "locations": ["Israel"], "remote_only": plan.get("remote_only")}, per_search=25, budget=1)
            real = name_matches(got, alias)
            if real:
                words = {w.lower() for t in plan.get("titles", []) + plan.get("extra_titles", []) for w in re.findall(r"[A-Za-z]+", t)} - {"developer", "engineer"}
                words |= {"software", "developer", "engineer", "student", "junior", "intern", "graduate"}
                mine = [j for j in got if same_company(alias, j["company"]) and any(w in j["title"].lower() for w in words)]
                named += mine
                b.update(status="by_name_ok", found_as=real if real.lower() != b["name"].lower() else None, n=len(mine))
                cache.setdefault(b["name"].lower(), {"b": None, "at": datetime.now(timezone.utc).isoformat()})["as"] = real
                act.log("hunter", f"{b['name']}: אין לה לוח ציבורי, אז חיפשתי לפי השם" + (f". במודעות היא מופיעה בשם {real}" if b.get("found_as") else "")
                        + f": {len(mine)} משרות בישראל")
            else:
                # חברה מהקטלוג קיימת בוודאות: החיפוש פשוט לא החזיר אותה הפעם. רק שם שהוספת בעצמך אולי לא מדויק
                # חברה מוכרת (קטלוג) או שמצאנו את האתר הרשמי שלה: היא קיימת, פשוט אין עכשיו משרות. רק שם שהוספת ולא נמצא בשום מקום — אולי לא מדויק
                b.update(status="not_found" if "הוספת בעצמך" in b["why"] and not b.get("official") else "by_name_miss")
                if b["status"] == "not_found":  # אולי שגיאת כתיב: השם הכי קרוב מבין החברות שהחיפוש החזיר ומהקטלוג
                    import difflib
                    pool = {j["company"]: j["company"] for j in got if j.get("company")}
                    pool.update({c["name"]: c["name"] for c in load_catalog()})
                    keyed = {re.sub(r"[^a-z0-9]", "", k.lower()): v for k, v in pool.items()}
                    m = difflib.get_close_matches(re.sub(r"[^a-z0-9]", "", alias.lower()), list(keyed), n=1, cutoff=0.7)
                    if m:
                        b["suggest"] = keyed[m[0]]
                if b["status"] == "not_found":
                    cache.setdefault(b["name"].lower(), {"b": None, "at": datetime.now(timezone.utc).isoformat()})["nf"] = datetime.now(timezone.utc).isoformat()
                act.log("hunter", f"{b['name']}: " + ("לא מצאתי משרות בשם הזה. אולי השם לא מדויק?" if b["status"] == "not_found"
                                                      else (f"מצאתי את האתר שלה ({b['official']}), אבל כרגע אין בו רשימת משרות שאפשר לקרוא, והחיפוש לפי השם לא החזיר משרות. אנסה שוב בסריקה הבאה."
                                                            if b.get("official") else "החיפוש לפי השם לא החזיר הפעם משרות שלה. אנסה שוב בסריקה הבאה.")))
        if any(b.get("found_as") or b["status"] == "not_found" for b in by_name[:3] if "הוספת בעצמך" in b["why"]):
            fixed = [b for b in by_name[:3] if "הוספת בעצמך" in b["why"]]
            db.add_run(u["user_id"], "hunter", " ".join(
                (f"חיפשתי את {b['name']}: היא מפרסמת משרות בשם {b['found_as']}, ואני מחפש לפי השם הזה." if b.get("found_as")
                 else (f"לא מצאתי חברה בשם {b['name']}." + (f" התכוונת ל-{b['suggest']}? אפשר לתקן בפרופיל ‹ חברות יעד." if b.get("suggest") else " כדאי לבדוק את השם בפרופיל ‹ חברות יעד.")) if b["status"] == "not_found" else "")
                for b in fixed).strip())
        asked = {b["name"].lower() for r in db.recent_runs(u["user_id"], "hunter", days=10)[:1]
                 for b in ((r.get("stats") or {}).get("boards") or []) if b.get("status") == "confirm"}
        new_conf = [b for b in boards if b["status"] == "confirm" and b["name"].lower() not in asked]
        if new_conf:
            db.add_run(u["user_id"], "hunter", " ".join(f"חיפשתי את {b['name']} ומצאתי דף קריירה באתר {b['found']['host']}. "
                                                       "אני לא בטוח שזו אותה חברה, אז לא סרקתי אותו." for b in new_conf)
                       + " אפשר לאשר או לדחות בפרופיל ‹ חברות יעד.")
        db.save_memory(u["user_id"], "boards", {"cache": cache})
        ok = [b for b in boards if b["status"] == "board"]
        print(f"{u['user_id'][:8]}: לוחות חברה: {len(ok)} מתוך {len(targets)} ({', '.join(b['name'] + ' ' + b['board'] for b in ok[:12])}), {len(direct)} משרות רלוונטיות")
        tg = []
        try:   # ערוצי טלגרם ציבוריים: מה שהוספת, או ברירת המחדל לתוכנה
            from agent_core.agents import telegram as TG
            chans = [c for c in (TG.channel_name(x) for x in (prof["answers"].get("telegram") or [])) if c] \
                or (TG.DEFAULT_CHANNELS if "פיתוח תוכנה" in (plan.get("domains") or [plan.get("domain", "פיתוח תוכנה")]) else [])
            tg = TG.collect(chans) if chans else []
        except BudgetDeferred:
            act.log("hunter", "מכסת ה-AI נגמרה לפני הטלגרם. אקרא אותו בסריקה הבאה.")
        except Exception as e:  # noqa: BLE001
            RR.fail("טלגרם", u["user_id"], e)
        seen_ = db.seen_ids(u["user_id"])
        rt = fair_rate_top(u)
        if not seen_:   # סריקה ראשונה של משתמש חדש: הרושם הראשון. מדרגים יותר (נמצא בבדיקה: 15 מתוך 98 → רק 3 משרות)
            rt = max(rt, 35 if user_key(u) else 25)
        if user_key(u) and len(plan.get("domains") or []) > 1:   # מפתח אישי: כל תחום נוסף מקבל עוד דירוגים, עד 50
            rt = min(50, rt + 10 * (len(plan["domains"]) - 1))
        feed = run(prof, plan, raw=collect(plan) + direct + named + tg, seen=seen_, persist=False, rate_top=rt)
        feed["stats"]["direct_boards"] = len(ok)
        feed["stats"]["boards"] = boards
        if feed["jobs"]:
            act.log("hunter", f"{len(feed['jobs'])} משרות חדשות מחכות ל{u.get('first') or 'משתמש'}. כשתישמר משרה — שי, גיל ומאיה, היא שלכם.", to="assistant")
        act.flush()
        db.save_feed(u["user_id"], feed)
        if feed["stats"].get("shown"):   # התראה לטלפון, רק למי שהפעיל
            from agent_core import push as P
            team = u.get("team") or {}
            r_ = P.send(ustate.get("push"), P.message(feed["stats"]["shown"], str(team.get("hunter") or "דורון")))
            if r_ != "skip":
                print(f"{u['user_id'][:8]}: התראה {r_}")
        if H.available():  # דורון: משרה בציון גבוה מאוד — גיל וקובי מתחילים לעבוד עליה מיד
            existing = H._open(u["user_id"])
            for j in H.high_fit(feed["jobs"]):
                H.request_for_job(u["user_id"], "hunter", j, ["brief", "tailor"], f"מצאתי משרה בציון {j['fit']:.1f}", existing)
            act.flush()
        s = feed["stats"]
        print(f"{u['user_id'][:8]}: נאספו {s['collected']}, בכירות מדי {s['too_senior']}, כבר נראו {s['already_seen']}, "
              f"דורגו {s['rated']} (מתוכם {s.get('ai_senior', 0)} בכירות לפי הדירוג), ציונים {sorted(s.get('fits', []), reverse=True)}, מוצגות {s['shown']}")
    except Exception as e:  # משתמש אחד שנכשל לא עוצר את האחרים
        import traceback; traceback.print_exc()
        print(f"{u['user_id'][:8]}: חיפוש נכשל: {type(e).__name__}: {e}")
        RR.fail("חיפוש", u["user_id"], e)
        act.log("hunter", "החיפוש נעצר בגלל תקלה. אנסה שוב בריצה הבאה.")
        act.flush()
    act.start(u["user_id"])
    try:  # דורון: האם המשרות ששמרת עדיין פתוחות להגשה (פעם ביום, בסריקת הבוקר)
        saved = db.saved_open(u["user_id"]) if MORNING else []
        closed = []
        with _httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124"}) as cx:
            for row in saved:
                st = still_open(row["card"].get("url", ""), cx)
                c = row["card"]
                act.log("hunter", f"בודק אם {c['title']} ב-{c['co']} עדיין פתוחה: "
                        + {"open": "פתוחה ✓", "closed": "נסגרה ✗", "unknown": "האתר לא ענה, משאיר אותה"}[st])
                now_iso = datetime.now(timezone.utc).isoformat()
                if st == "closed":
                    db.update_job(u["user_id"], row["id"], {"card": {**c, "closed_at": now_iso, "check": {"st": st, "at": now_iso}}})
                    closed.append(c)
                elif (c.get("check") or {}).get("st") != st or st == "unknown":   # "לא הצלחתי לבדוק" מוצג באפליקציה
                    n = ((c.get("check") or {}).get("n") or 0) + 1 if st == "unknown" else 0
                    db.update_job(u["user_id"], row["id"], {"card": {**c, "check": {"st": st, "at": now_iso, "n": n}}})
        if closed:
            db.add_run(u["user_id"], "hunter", ("המשרות האלה נסגרו ולא מקבלות יותר מועמדים: " if len(closed) > 1 else "המשרה הזו נסגרה ולא מקבלת יותר מועמדים: ")
                       + "; ".join(f"{c['title']} ב-{c['co']}" for c in closed) + ". הוצאתי מההגשות, והיא בהיסטוריה.")
        act.flush()
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: בדיקת משרות נכשלה: {type(e).__name__}: {e}")
        RR.fail("בדיקת משרות", u["user_id"], e)
        act.flush()
    act.start(u["user_id"])
    try:  # קובי: פוסטים חמים וטיוטת פוסט, פעם בשבוע
        li = dict(u.get("li") or {})
        if li.get("updated") and datetime.fromisoformat(li["updated"]) > datetime.now(timezone.utc) - timedelta(days=7) \
                and not os.environ.get("FORCE_MEETING"):
            raise StopIteration
        li["posts"] = K.hot_posts(plan, u["cv_text"])
        old = li.get("draft_at")
        if not li.get("draft") or not old or datetime.fromisoformat(old) < datetime.now(timezone.utc) - timedelta(days=7):
            li["draft"] = K.weekly_draft(u["cv_text"]); li["draft_at"] = datetime.now(timezone.utc).isoformat()
        li["updated"] = datetime.now(timezone.utc).isoformat()
        db.update_profile(u["user_id"], {"li": li})
        n = len(li["posts"])
        db.add_run(u["user_id"], "linkedin", f"מצאתי {n} פוסטים מהשבוע ששווה להגיב עליהם, והכנתי לכל אחד שתי הצעות תגובה." if n
                   else "לא מצאתי השבוע פוסטים ציבוריים שמתאימים לך. אבדוק שוב בשבוע הבא.")
        print(f"{u['user_id'][:8]}: LinkedIn {n} פוסטים")
        act.flush()
    except StopIteration:
        pass
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: LinkedIn נכשל: {type(e).__name__}: {e}")
        RR.fail("LinkedIn", u["user_id"], e)
        act.flush()


# ── הישיבה השבועית: יואב והצוות בודקים מה עבד, מה לא, ומה לשנות ─────────────
for u in users:
    use_key(user_key(u))
    try:
        last = db.latest_plan(u["user_id"], "meeting")
        if not (M.due(last) or os.environ.get("FORCE_MEETING")):
            continue
        st = u.get("state") or {}
        prof = {"cv_text": u["cv_text"], "answers": u.get("answers") or {},
                "extra_titles": [x["value"] for x in st.get("accepted") or [] if x.get("type") == "role"],
                "drop_queries": last.get("drop_queries") or [], "learned_queries": last.get("add_queries") or []}
        plan = build_search_plan(prof).to_dict()
        tc = st.get("targets") or {}
        names = [t["name"] for t in select_targets(build_search_plan(prof), {"target_companies": tc}, load_catalog())]
        act.start(u["user_id"])
        out = M.hold(plan, db.recent_runs(u["user_id"], "hunter"), db.all_jobs(u["user_id"]), last,
                     st.get("accepted") or [], st.get("dismissed") or [], names)
        act.flush()
        db.save_memory(u["user_id"], "meeting", out["plan"])
        if out["msg"]:
            db.add_run(u["user_id"], "strategist", out["msg"], {"report": out["report"]})
        r = out["report"]
        print(f"{u['user_id'][:8]}: ישיבה: {len(r['issues'])} בעיות, {len(r['actions'])} שינויים, {len(r['suggestions'])} הצעות")
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: ישיבה נכשלה: {type(e).__name__}: {e}")
        RR.fail("ישיבה", u["user_id"], e)
        act.flush()


# ── דוח שימוש לבעל המערכת: פעם ביום, בסריקת הבוקר ─────────────────────────
try:
    from agent_core import usage as U
    if MORNING:
        allp = httpx.get(db._url("profiles"), headers=db._h(), params={"select": "user_id,first,cv_text,answers,state"}, timeout=30).json()
        users_auth = db.auth_users()
        jb = {u["id"]: db.all_jobs(u["id"], days=30) for u in users_auth}
        admin, rep = U.report(users_auth, allp, jb)
        if admin and rep:
            db.add_run(admin, "strategist", rep["msg"], {"usage_report": rep})
            print(f"דוח שימוש: {len(rep['rows'])} משתמשים")
        il_day = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=2))).weekday()   # ראשון = 6
        if admin and (il_day == 6 or os.environ.get("FORCE_INSIGHTS")):   # תובנות על החיפוש: פעם בשבוע, לכלי המפתח
            import contextlib, io
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            import insights as INS
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                INS.main(7)
            db.add_run(admin, "strategist", "דוח תובנות שבועי על החיפוש מוכן בכלי המפתח.", {"insights": buf.getvalue()[:20000]})
            print("דוח תובנות שבועי נשמר")
        if admin:   # סטטוס לבקשות ולמשובים: המפתח מסמן בכלי המפתח, המשתמש מקבל הודעה פעם אחת לכל שינוי
            allp = httpx.get(db._url("profiles"), headers=db._h(), params={"select": "user_id,state"}, timeout=30).json()
            owner = next((p for p in allp if p["user_id"] == admin), {})
            stats_ = (owner.get("state") or {}).get("fb_status") or {}
            seen = db.system_memory("feedback").get("seen") or {}
            ups = U.feedback_updates(stats_, allp, seen)
            for uid, key, st, msg in ups:
                db.add_run(uid, "assistant", msg); seen[key] = st
            if ups:
                db.save_system_memory("feedback", {"seen": seen})
except Exception as e:  # noqa: BLE001
    print(f"דוח שימוש נכשל: {type(e).__name__}: {e}")
    RR.fail("דוח שימוש", None, e)

if MORNING and not (os.environ.get("ONLY_USER") or "").strip():
    try:
        db.save_system_memory("daily", {"day": TODAY})
    except Exception as e:  # noqa: BLE001
        RR.fail("סימון בוקר", None, e)
budget_sync.push()
RR.send("הסריקה")
