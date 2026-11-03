"""
nightly.py — מה שרץ בענן כל לילה (GitHub Actions).

לכל משתמש שהעלה קורות חיים: יואב בונה תוכנית מהפרופיל והשאלון שלו,
דורון מחפש ומדרג, והמשרות נשמרות ב-Supabase. האפליקציה בטלפון קוראת אותן משם.
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agent_core import cloud_store as db
from agent_core.profile import build_search_plan
from agent_core.agents.hunter import run, collect, rerate, RATING_V, BudgetDeferred
from agent_core import activity as act
from agent_core.agents.live import check as still_open
import httpx as _httpx
from agent_core.agents.ats import collect_targets, name_matches, same_company
from agent_core.profile import select_targets, load_catalog
from agent_core.profile import SearchPlan
from agent_core.agents import linkedin_coach as K
from agent_core.agents import meeting as M
from datetime import datetime, timezone, timedelta

if not db.configured():
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים")

import os
from agent_core.llm_router import clean_key
k = clean_key(os.environ.get("GROQ_API_KEY"), "GROQ_API_KEY")
raw = os.environ.get("GROQ_API_KEY") or ""
print(f"מפתח Groq: {'תקין' if k.startswith('gsk_') and len(k) > 40 else 'לא תקין'} (אורך {len(k)}, נוקה: {'כן' if raw != k else 'לא'})")
users = db.profiles_ready()
print(f"{len(users)} משתמשים עם קורות חיים")
for u in users:
    st = u.get("state") or {}
    learned = db.latest_plan(u["user_id"], "meeting")          # מה יואב והצוות למדו בישיבה האחרונה
    prof = {"first": u.get("first", ""), "name": u.get("name", ""), "cv_text": u["cv_text"], "answers": u.get("answers") or {},
            "extra_titles": [x["value"] for x in st.get("accepted") or [] if x.get("type") == "role"],  # תפקידים שאישרת
            "drop_queries": learned.get("drop_queries") or []}
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
        tc = st.get("targets") or {}
        targets = select_targets(plan_obj, {"target_companies": tc}, load_catalog())
        removed = {x.lower() for x in tc.get("removed") or []}
        have = {t["name"].lower() for t in targets}
        for a in learned.get("auto_targets") or []:  # חברות שהצוות הוסיף לבד (אפשר להסיר בפרופיל)
            if a["name"].lower() not in removed and a["name"].lower() not in have:
                targets.append({"name": a["name"], "why": [a.get("why", "הצוות הוסיף")], "auto": True})
        act.log("strategist", f"גם לבדוק ישירות את דפי הקריירה של {len(targets)} חברות יעד: {', '.join(t['name'] for t in targets[:6])}…", to="hunter")
        cache = db.latest_plan(u["user_id"], "boards").get("cache") or {}
        direct, boards, cache = collect_targets(targets, plan, cache)
        # חברות בלי לוח ציבורי: חיפוש לפי השם (קודם אלה שהוספת בעצמך), כולל תיקון שם
        by_name = sorted([b for b in boards if b["status"] == "by_name"], key=lambda b: 0 if "הוספת בעצמך" in b["why"] else 1)
        named = []
        for b in by_name[:3]:
            alias = (cache.get(b["name"].lower()) or {}).get("as") or b["name"]
            got = collect({"queries": [alias], "locations": ["Israel"], "remote_only": plan.get("remote_only")}, per_search=25, budget=1)
            real = name_matches(got, alias)
            if real:
                mine = [j for j in got if same_company(alias, j["company"])]
                named += mine
                b.update(status="by_name_ok", found_as=real if real.lower() != b["name"].lower() else None, n=len(mine))
                cache.setdefault(b["name"].lower(), {"b": None, "at": datetime.now(timezone.utc).isoformat()})["as"] = real
                act.log("hunter", f"{b['name']}: אין לה לוח ציבורי, אז חיפשתי לפי השם" + (f". במודעות היא מופיעה בשם {real}" if b.get("found_as") else "")
                        + f": {len(mine)} משרות בישראל")
            else:
                b.update(status="not_found")
                act.log("hunter", f"{b['name']}: לא מצאתי משרות בשם הזה. אולי השם לא מדויק?")
        if any(b.get("found_as") or b["status"] == "not_found" for b in by_name[:3] if "הוספת בעצמך" in b["why"]):
            fixed = [b for b in by_name[:3] if "הוספת בעצמך" in b["why"]]
            db.add_run(u["user_id"], "hunter", " ".join(
                (f"חיפשתי את {b['name']}: היא מפרסמת משרות בשם {b['found_as']}, ואני מחפש לפי השם הזה." if b.get("found_as")
                 else f"לא מצאתי משרות של {b['name']}. כדאי לבדוק את השם בפרופיל ›› חברות יעד." if b["status"] == "not_found" else "")
                for b in fixed).strip())
        db.save_memory(u["user_id"], "boards", {"cache": cache})
        ok = [b for b in boards if b["status"] == "board"]
        print(f"{u['user_id'][:8]}: לוחות חברה: {len(ok)} מתוך {len(targets)} ({', '.join(b['name'] + ' ' + b['board'] for b in ok[:12])}), {len(direct)} משרות רלוונטיות")
        feed = run(prof, plan, raw=collect(plan) + direct + named, seen=db.seen_ids(u["user_id"]), persist=False)
        feed["stats"]["direct_boards"] = len(ok)
        feed["stats"]["boards"] = boards
        if feed["jobs"]:
            act.log("hunter", f"{len(feed['jobs'])} משרות חדשות מחכות ל{u.get('first') or 'משתמש'}. כשתישמר משרה — שי, גיל ומאיה, היא שלכם.", to="assistant")
        act.flush()
        db.save_feed(u["user_id"], feed)
        s = feed["stats"]
        print(f"{u['user_id'][:8]}: נאספו {s['collected']}, בכירות מדי {s['too_senior']}, כבר נראו {s['already_seen']}, "
              f"דורגו {s['rated']} (מתוכם {s.get('ai_senior', 0)} בכירות לפי הדירוג), ציונים {sorted(s.get('fits', []), reverse=True)}, מוצגות {s['shown']}")
    except Exception as e:  # משתמש אחד שנכשל לא עוצר את האחרים
        print(f"{u['user_id'][:8]}: חיפוש נכשל: {type(e).__name__}: {e}")
        act.log("hunter", "החיפוש נעצר בגלל תקלה. אנסה שוב בריצה הבאה.")
        act.flush()
    act.start(u["user_id"])
    try:  # דורון: האם המשרות ששמרת עדיין פתוחות להגשה
        saved = db.saved_open(u["user_id"])
        closed = []
        with _httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124"}) as cx:
            for row in saved:
                st = still_open(row["card"].get("url", ""), cx)
                c = row["card"]
                act.log("hunter", f"בודק אם {c['title']} ב-{c['co']} עדיין פתוחה: "
                        + {"open": "פתוחה ✓", "closed": "נסגרה ✗", "unknown": "האתר לא ענה, משאיר אותה"}[st])
                if st == "closed":
                    db.update_job(u["user_id"], row["id"], {"card": {**c, "closed_at": datetime.now(timezone.utc).isoformat()}})
                    closed.append(c)
        if closed:
            db.add_run(u["user_id"], "hunter", ("המשרות האלה נסגרו ולא מקבלות יותר מועמדים: " if len(closed) > 1 else "המשרה הזו נסגרה ולא מקבלת יותר מועמדים: ")
                       + "; ".join(f"{c['title']} ב-{c['co']}" for c in closed) + ". הוצאתי מההגשות, והיא בהיסטוריה.")
        act.flush()
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: בדיקת משרות נכשלה: {type(e).__name__}: {e}")
        act.flush()
    act.start(u["user_id"])
    try:  # קובי: פוסטים חמים כל לילה, טיוטת פוסט פעם בשבוע
        li = dict(u.get("li") or {})
        li["posts"] = K.hot_posts(plan, u["cv_text"])
        old = li.get("draft_at")
        if not li.get("draft") or not old or datetime.fromisoformat(old) < datetime.now(timezone.utc) - timedelta(days=7):
            li["draft"] = K.weekly_draft(u["cv_text"]); li["draft_at"] = datetime.now(timezone.utc).isoformat()
        li["updated"] = datetime.now(timezone.utc).isoformat()
        db.update_profile(u["user_id"], {"li": li})
        n = len(li["posts"])
        db.add_run(u["user_id"], "linkedin", f"מצאתי {n} פוסטים מהשבוע ששווה להגיב עליהם, והכנתי לכל אחד שתי הצעות תגובה." if n
                   else "לא מצאתי השבוע פוסטים ציבוריים שמתאימים לך. אבדוק שוב מחר.")
        print(f"{u['user_id'][:8]}: LinkedIn {n} פוסטים")
        act.flush()
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: LinkedIn נכשל: {type(e).__name__}: {e}")
        act.flush()


# ── הישיבה השבועית: יואב והצוות בודקים מה עבד, מה לא, ומה לשנות ─────────────
for u in users:
    try:
        last = db.latest_plan(u["user_id"], "meeting")
        if not (M.due(last) or os.environ.get("FORCE_MEETING")):
            continue
        st = u.get("state") or {}
        prof = {"cv_text": u["cv_text"], "answers": u.get("answers") or {},
                "extra_titles": [x["value"] for x in st.get("accepted") or [] if x.get("type") == "role"],
                "drop_queries": last.get("drop_queries") or []}
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
        print(f"{u['user_id'][:8]}: ישיבה: {len(r['issues'])} בעיות, {len(r['actions'])} שינויים, {len(r['suggestions'])} הצעות — {out['msg'][:300]}")
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: ישיבה נכשלה: {type(e).__name__}: {e}")
        act.flush()
