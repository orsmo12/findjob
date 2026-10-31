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
from agent_core.agents.hunter import run

if not db.configured():
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY חסרים")

users = db.profiles_ready()
print(f"{len(users)} משתמשים עם קורות חיים")
for u in users:
    prof = {"first": u.get("first", ""), "name": u.get("name", ""), "cv_text": u["cv_text"], "answers": u.get("answers") or {}}
    plan = build_search_plan(prof).to_dict()
    try:
        feed = run(prof, plan, seen=db.seen_ids(u["user_id"]), persist=False)
        db.save_feed(u["user_id"], feed)
        s = feed["stats"]
        print(f"{u['user_id'][:8]}: נאספו {s['collected']}, מוצגות {s['shown']}")
    except Exception as e:  # משתמש אחד שנכשל לא עוצר את האחרים
        print(f"{u['user_id'][:8]}: נכשל: {type(e).__name__}: {e}")
