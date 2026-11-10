"""push_test.py — כלי מפתח: שולח התראת בדיקה אחת לבעל המערכת (המשתמש הראשון), כדי לוודא שההתראות מגיעות לטלפון."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core import cloud_store as db, push as P

admin = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")[0]["id"]
u = next((x for x in db.profiles_ready() if x["user_id"] == admin), None)
sub = ((u or {}).get("state") or {}).get("push")
r = P.send(sub, {"title": "findjob", "body": "בדיקה: ההתראות עובדות ✓ מעכשיו דורון יודיע כאן כשיש משרות חדשות.", "url": "/", "tag": "test"})
print({"sent": "✓ נשלחה", "skip": "✗ אין מנוי או מפתח", "gone": "✗ המנוי לא בתוקף (צריך להפעיל מחדש)", "error": "✗ שגיאה בשליחה"}[r])
