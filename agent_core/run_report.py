"""
run_report.py — ריצה שנכשלה לא נכשלת בשקט: בסוף כל ריצה, אם היו תקלות, נשלחת הודעה למפתח (בעל המערכת).

ההודעה מופיעה במשרד של הבעלים ובדוח השימוש. בלי פרטים אישיים: רק איפה, מזהה משתמש מקוצר וסוג השגיאה.
"""
from __future__ import annotations
import os

_fails: list[dict] = []


def fail(where: str, user_id: str | None, err: Exception) -> None:
    _fails.append({"where": where, "user": (user_id or "")[:8], "error": f"{type(err).__name__}: {str(err)[:160]}"})


def summary(job: str, fails: list[dict]) -> str:
    places = sorted({f["where"] for f in fails})
    return (f"דוח למפתח: בריצת {job} היו {len(fails)} תקלות ({', '.join(places)}). "
            "הסוכנים המשיכו לשאר המשתמשים. הפרטים בכלי המפתח.")


def send(job: str) -> None:
    if not _fails:
        return
    run_url = ""
    if os.environ.get("GITHUB_RUN_ID"):
        run_url = f"https://github.com/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    try:
        from agent_core import cloud_store as db
        users = db.auth_users()
        owner = sorted(users, key=lambda u: u.get("created_at") or "")[0]["id"] if users else None
        if owner:
            db.add_run(owner, "strategist", summary(job, _fails), {"failures": _fails[:30], "job": job, "run": run_url})
    except Exception as e:  # noqa: BLE001
        print(f"דוח התקלות לא נשלח: {type(e).__name__}")
