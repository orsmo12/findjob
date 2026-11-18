"""כלי מפתח: לכתוב מחדש מכתבים קיימים של משתמשים נבחרים (במשרות שמורות שעוד לא הוגשו).
לא כותב מכתב בעצמו: מסמן את המכתב כגרסה ישנה, והריצה הרגילה (assistant_job) כותבת אותו מחדש בהדרגה,
3 מכתבים לריצה למשתמש (UPGRADES_PER_RUN), כדי לא לשרוף מכסה. בלי apply=yes רק סופר.

  python scripts/letters_refresh.py "1,2,3" [yes]
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core import cloud_store as db, handoffs as H  # noqa: E402
from scripts.insights import get  # noqa: E402


def to_refresh(rows: list[dict], apps: list[dict]) -> list[dict]:
    """משרות שמורות עם מכתב בגרסה הנוכחית, שלא הוגשו (סטטוס באפליקציה 'saved' או בלי סטטוס)."""
    st = {a.get("jobId"): a.get("status") for a in apps or []}
    return [r for r in rows if (r.get("letter") or {}).get("text") and (r["letter"].get("v") or 0) >= H.LETTER_V
            and st.get(r["id"], "saved") == "saved"]


def main(idxs: str, apply: bool):
    users = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")
    for i in [int(x) for x in idxs.replace(" ", "").split(",") if x]:
        u = users[i]
        st = ((get("profiles", select="state", user_id=f"eq.{u['id']}") or [{}])[0].get("state") or {})
        rows = to_refresh(db.saved_jobs(u["id"], with_tailor=False), st.get("apps"))
        if apply:
            for r in rows:
                db.update_job(u["id"], r["id"], {"letter": {**r["letter"], "v": H.LETTER_V - 1, "refresh": True}})
        print(f"#{i}: {len(rows)} מכתבים {'סומנו לכתיבה מחדש' if apply else 'ייכתבו מחדש (הרצה יבשה)'}")


if __name__ == "__main__":
    main(sys.argv[1], len(sys.argv) > 2 and sys.argv[2] == "yes")
