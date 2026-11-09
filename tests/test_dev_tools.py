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
