"""סבב 14: סטטוס למשוב מגיע למשתמש פעם אחת לכל שינוי."""
from agent_core import usage as U

PROFS = [{"user_id": "aaaaaaaa-1111", "state": {"feedback": [{"t": "להוסיף ערוצי טלגרם", "at": "2026-11-09T10:00:00Z"}]}},
         {"user_id": "bbbbbbbb-2222", "state": {"feedback": [{"t": "מצב כהה", "at": "2026-11-08T10:00:00Z"}]}}]


def test_status_change_notifies_once():
    st = {"aaaaaaaa|2026-11-09T10:00:00Z": "doing"}
    ups = U.feedback_updates(st, PROFS, {})
    assert [(u[0], u[2]) for u in ups] == [("aaaaaaaa-1111", "doing")] and "בעבודה" in ups[0][3]
    assert U.feedback_updates(st, PROFS, {"aaaaaaaa|2026-11-09T10:00:00Z": "doing"}) == []        # כבר דווח
    assert len(U.feedback_updates({"aaaaaaaa|2026-11-09T10:00:00Z": "done"}, PROFS, {"aaaaaaaa|2026-11-09T10:00:00Z": "doing"})) == 1


def test_e2e_cleans_only_test_users():
    """e2e מוחק בתחילת הריצה רק משתמשי בדיקה שנשארו, אף פעם לא משתמש אמיתי."""
    import os, importlib.util, tempfile
    from pathlib import Path
    os.environ.setdefault("SUPABASE_URL", "https://x.supabase.co"); os.environ.setdefault("SUPABASE_SERVICE_KEY", "x")
    here = os.getcwd(); os.chdir(tempfile.mkdtemp())   # e2e יוצר תיקיית פלט בתיקייה הנוכחית
    try:
        f = Path(__file__).resolve().parents[1] / "scripts" / "e2e.py"
        spec = importlib.util.spec_from_file_location("e2e_mod", f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    finally:
        os.chdir(here)
    users = [{"id": "1", "email": "findjob.e2e.1731700000@example.com"}, {"id": "2", "email": "someone@gmail.com"},
             {"id": "3", "email": "findjob.e2e.x@example.com"}, {"id": "4", "email": "findjob.e2e.1@example.com.evil.io"}, {"id": "5"}]
    assert m.stale_test_users(users) == ["1"]
