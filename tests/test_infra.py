"""סבב 2ב: מכסה בין ריצות, דוח תקלות למפתח, ריצה למשתמש אחד. בלי רשת."""
import json, tempfile
from datetime import date
from pathlib import Path
from agent_core import budget_guard as bg, run_report as RR


def test_budget_snapshot_roundtrip():
    old = bg._BASE
    with tempfile.TemporaryDirectory() as d:
        try:
            bg._BASE = Path(d) / "llm_budget.json"
            (Path(d) / "llm_budget.json").write_text(json.dumps({"date": date.today().isoformat(), "models": {"m": {"req_left": 2}}}))
            (Path(d) / "llm_budget_abcdef0123.json").write_text(json.dumps({"date": "2000-01-01", "models": {}}))  # ישן: לא נשמר
            snap = bg.snapshot()
            assert list(snap) == ["llm_budget.json"]
            (Path(d) / "llm_budget.json").unlink()
            bg.restore({**snap, "../evil.json": {"date": date.today().isoformat()}})   # שם קובץ חשוד נדחה
            assert (Path(d) / "llm_budget.json").exists() and not (Path(d).parent / "evil.json").exists()
        finally:
            bg._BASE = old


def test_failure_summary_has_no_personal_details():
    RR._fails.clear()
    RR.fail("חיפוש", "1234567890abcdef", ValueError("boom"))
    f = RR._fails[0]
    assert f["user"] == "12345678" and f["error"].startswith("ValueError")
    assert "1 תקלות" in RR.summary("הסריקה", RR._fails)
    RR._fails.clear()


def test_workflows_run_per_user():
    for wf in ("nightly.yml", "letters.yml"):
        s = (Path(__file__).resolve().parents[1] / ".github" / "workflows" / wf).read_text(encoding="utf-8")
        assert "ONLY_USER" in s and "inputs.user" in s
