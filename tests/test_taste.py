"""טעם אישי: סיבות במילים של המשתמש ("אחר") מגיעות לסוכן המדרג, בלי כפילויות ועד 5."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core.taste import learn


def test_own_words_reach_rating_note():
    skips = {f"j{i}": {"r": "אחר", "x": x, "at": f"2026-11-{10 + i}"} for i, x in
             enumerate(["רק משרות אם", "בלי משמרות", "בלי  משמרות", "a", "b", "c", "d"])}
    skips["k"] = {"r": "לא עומד בדרישות", "at": "2026-11-01"}
    t = learn([], skips, ["c"])
    assert len(t["own"]) == 5 and "c" not in t["own"] and t["own"][0] == "d"
    assert t["own"].count("בלי משמרות") == 1 and "own words" in t["note"]
    assert learn([], {}, [])["own"] == [] and "own words" not in learn([], {}, [])["note"]
