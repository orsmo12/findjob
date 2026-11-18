"""כתיבה מחדש של מכתבים: רק משרות שמורות שלא הוגשו, עם מכתב בגרסה הנוכחית."""
import importlib.util
from pathlib import Path

from agent_core import handoffs as H

_sp = importlib.util.spec_from_file_location("lr", Path(__file__).resolve().parents[1] / "scripts" / "letters_refresh.py")
LR = importlib.util.module_from_spec(_sp)
_sp.loader.exec_module(LR)


def test_only_saved_not_applied_with_current_letter():
    L = {"text": "Dear", "v": H.LETTER_V}
    rows = [{"id": "a", "letter": L}, {"id": "b", "letter": L}, {"id": "c", "letter": {"text": "x", "v": H.LETTER_V - 1}},
            {"id": "d", "letter": None}, {"id": "e", "letter": L}]
    apps = [{"jobId": "a", "status": "saved"}, {"jobId": "b", "status": "applied"}, {"jobId": "e", "status": "interview"}]
    assert [r["id"] for r in LR.to_refresh(rows, apps)] == ["a"]
    assert [r["id"] for r in LR.to_refresh([{"id": "z", "letter": L}], [])] == ["z"]   # בלי סטטוס = שמורה
