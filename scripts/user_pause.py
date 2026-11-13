"""
user_pause.py — כלי מפתח: השהיית משתמש (לפי מספר הסדר בהרשמה, אנונימי). משתמש מושהה לא נסרק,
הסוכנים לא מכינים לו חומרים ולא נשלחות לו התראות. הנתונים שלו לא נמחקים. ביטול: אותה פקודה עם off.
  python scripts/user_pause.py <idx> on|off      (בלי ארגומנטים: מציג מי מושהה)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core import cloud_store as db

users = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")
ids = list(db.system_memory("paused").get("ids") or [])
if len(sys.argv) > 2 and sys.argv[1].strip():
    uid = users[int(sys.argv[1])]["id"]
    on = sys.argv[2].strip().lower() != "off"
    ids = sorted(set(ids) | {uid}) if on else [x for x in ids if x != uid]
    db.save_system_memory("paused", {"ids": ids})
    print(f"משתמש #{sys.argv[1]}: {'מושהה' if on else 'פעיל'}")
print("מושהים: " + (", ".join(f"#{i}" for i, u in enumerate(users) if u["id"] in ids) or "אין"))
