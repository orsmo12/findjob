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
from agent_core.agents.ats import collect_targets
from agent_core.profile import select_targets, load_catalog
from agent_core.profile import SearchPlan
from agent_core.agents import linkedin_coach as K
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
    prof = {"first": u.get("first", ""), "name": u.get("name", ""), "cv_text": u["cv_text"], "answers": u.get("answers") or {}}
    plan = build_search_plan(prof).to_dict()
    act.start(u["user_id"])
    try:  # דורון: דירוג מחדש של משרות בפיד שדורגו בלי מודעה מלאה או בשיטה ישנה
        todo = db.to_rerate(u["user_id"], RATING_V)[:12]
        if todo:
            act.log("hunter", f"בודק שוב {len(todo)} משרות שמחכות לך: קורא את המודעה המלאה ומדרג מחדש")
        gone = []
        for row in todo:
            c = row["card"]
            try:
                st, new, why_ = rerate(c, prof, plan)
            except BudgetDeferred:
                act.log("hunter", "הגעתי למכסת ה-AI. את השאר אבדוק בסריקה הבאה."); break
            act.log("hunter", f"{c['title']} ב-{c['co']}: " + {"ok": f"דירוג מעודכן {why_}", "filtered": f"הורדתי מהרשימה ({why_})",
                                                              "later": f"{why_}, אנסה שוב בסריקה הבאה"}[st])
            if st == "ok":
                db.update_job(u["user_id"], row["id"], {"card": new, "fit": new["fit"]})
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
        targets = select_targets(plan_obj, {"target_companies": (u.get("state") or {}).get("targets") or {}}, load_catalog())
        act.log("strategist", f"גם לבדוק ישירות את דפי הקריירה של {len(targets)} חברות יעד: {', '.join(t['name'] for t in targets[:6])}…", to="hunter")
        direct, boards = collect_targets(targets, plan)
        print(f"{u['user_id'][:8]}: לוחות חברה: {len(boards)} מתוך {len(targets)} ({', '.join(boards[:8])}), {len(direct)} משרות רלוונטיות")
        feed = run(prof, plan, raw=collect(plan) + direct, seen=db.seen_ids(u["user_id"]), persist=False)
        feed["stats"]["direct_boards"] = len(boards)
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
