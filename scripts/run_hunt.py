"""
run_hunt.py — חיפוש אמיתי אחד של דורון, לפי הפרופיל שלך.

  python scripts/run_hunt.py            חיפוש ודירוג, נשמר ל-memory/feed/jobs.json
  python scripts/run_hunt.py --plan     רק מציג את תוכנית החיפוש, בלי לחפש
"""
import sys, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass
from agent_core.profile import load_profile, build_search_plan

prof = load_profile()
plan = build_search_plan(prof).to_dict()
print("יואב בנה את תוכנית החיפוש:")
for w in plan["why"]:
    print("  •", w)
print("  שאילתות:", ", ".join(plan["queries"][:3]), "| אזורים:", ", ".join(plan["locations"][:2]))
if "--plan" in sys.argv:
    sys.exit(0)

from agent_core.agents.hunter import run
test = "--test" in sys.argv
if test:
    print("(ריצת ניסיון: המשרות לא יסומנו כ'כבר ראית')")
feed = run(prof, plan, remember=not test)
s = feed["stats"]
print(f"\nדורון: נאספו {s['collected']}, סוננו {s['too_senior']} בכירות מדי, {s['already_seen']} כבר ראית,"
      f" דורגו {s['rated']}, מוצגות {s['shown']}" + (f", {s['deferred']} נדחו למחר (מכסה)" if s['deferred'] else ""))
for j in feed["jobs"]:
    print(f"\n{j['fit']:.1f}  {j['title']} · {j['co']} · {j['loc']}{'  (דירוג חלקי: אין תיאור מלא)' if j['partial'] else ''}")
    for r in j["reasons"]:
        print("   ✓", r)
    for g in j["gaps"]:
        print("   !", g)
    print("  ", j["url"])
