"""
calibrate.py — כלי מפתח: כיול הניקוד על מודעות אמיתיות. קריאה בלבד, לא כותב כלום למסד.
לוקח עד 15 משרות של המשתמש הראשון (שמורות ומחכות, עם מודעה מלאה), מדרג אותן בשיטה החדשה ומשווה לציון שנשמר.
מדפיס רק כותרת, חברה ומספרים. בלי קורות חיים ובלי תוכן אישי.
  python scripts/calibrate.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core import cloud_store as db, budget_sync
from agent_core.profile import build_search_plan
from agent_core.agents import hunter as h
from agent_core.llm_router import clean_key, use_key

budget_sync.pull()
clean_key(os.environ.get("GROQ_API_KEY"), "GROQ_API_KEY")
users = db.profiles_ready()
admin = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")[0]["id"]
u = next(x for x in users if x["user_id"] == admin)
k = ((u.get("state") or {}).get("ai_key") or "").strip()
from agent_core.llm_router import valid_key
use_key(valid_key(k))
prof = {"cv_text": u["cv_text"], "answers": u.get("answers") or {}}
plan = build_search_plan(prof).to_dict()
print(f"רמות: {plan['levels']} | ניסיון שיש: {plan.get('have_years')} | מקסימום להצגה: {plan.get('max_years')}\n")
rows = [r for r in db.all_jobs(admin, days=30) if r.get("decision") in (None, "save") and len((r["card"] or {}).get("ad") or "") > 300][:15]
print(f"{'לפני':>5} {'אחרי':>5}  {'שנים':>4} {'רמה':<7} {'כישורים':<6} {'פער':<6}  משרה")
moved = 0
for row in rows:
    c = row["card"]
    j = {"title": c.get("title", ""), "company": c.get("co", ""), "location": c.get("loc", ""), "description": c["ad"]}
    try:
        r = h.rate(j, prof["cv_text"], h.prefs_text(plan))
    except h.BudgetDeferred:
        print("מכסה נגמרה"); break
    if not r:
        continue
    h.level_cap(r, plan, j["title"])
    work = [x["req"][:40] for x in r["core"] if x.get("kind") == "work" and not h._met(x)]
    old = float(c.get("fit") or 0)
    moved += abs(old - r["fit"]) >= 0.5
    print(f"{old:>5.1f} {r['fit']:>5.1f}  {r.get('required_years') or 0:>4} {r.get('level') or '?':<7} {r['dims']['skills']:<6} {r['dims']['level']:<6}  "
          f"{('✓ ' if row.get('decision') == 'save' else '  ')}{j['title'][:42]} @ {j['company'][:20]}" + (f"  [חסר ניסיון: {'; '.join(work)}]" if work else ""))
print(f"\n{len(rows)} משרות, {moved} זזו בחצי נקודה או יותר. ✓ = שמורה.")
