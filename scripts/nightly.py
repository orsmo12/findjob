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
from agent_core.agents.hunter import run, collect
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
    try:
        why = plan.get("why") or []
        db.add_run(u["user_id"], "strategist", "תוכנית החיפוש להלילה: " + "; ".join(w.split(" (")[0] for w in why[:3]) + ".")
        plan_obj = build_search_plan(prof)
        targets = select_targets(plan_obj, {"target_companies": (u.get("state") or {}).get("targets") or {}}, load_catalog())
        direct, boards = collect_targets(targets, plan)
        print(f"{u['user_id'][:8]}: לוחות חברה: {len(boards)} מתוך {len(targets)} ({', '.join(boards[:8])}), {len(direct)} משרות רלוונטיות")
        feed = run(prof, plan, raw=collect(plan) + direct, seen=db.seen_ids(u["user_id"]), persist=False)
        feed["stats"]["direct_boards"] = len(boards)
        db.save_feed(u["user_id"], feed)
        s = feed["stats"]
        print(f"{u['user_id'][:8]}: נאספו {s['collected']}, בכירות מדי {s['too_senior']}, כבר נראו {s['already_seen']}, "
              f"דורגו {s['rated']} (מתוכם {s.get('ai_senior', 0)} בכירות לפי הדירוג), ציונים {sorted(s.get('fits', []), reverse=True)}, מוצגות {s['shown']}")
    except Exception as e:  # משתמש אחד שנכשל לא עוצר את האחרים
        print(f"{u['user_id'][:8]}: חיפוש נכשל: {type(e).__name__}: {e}")
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
    except Exception as e:  # noqa: BLE001
        print(f"{u['user_id'][:8]}: LinkedIn נכשל: {type(e).__name__}: {e}")
