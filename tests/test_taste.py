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


def test_skip_for_requirements_is_not_taste():
    """סבב 2 (13.11): אור דילג על Full Stack בגלל דרישות → נלמד "נוטה לדלג: full stack". עכשיו רק "לא התחום שלי"/"לא מעניין"."""
    from agent_core.taste import role_words
    rows = [{"card": {"id": f"j{i}", "title": "Full Stack Engineer"}, "decision": "skip"} for i in range(3)]
    assert learn(rows, {f"j{i}": {"r": "לא עומד בדרישות"} for i in range(3)})["dislikes"] == []
    assert learn(rows, {})["dislikes"] == []                                   # דילוג בלי סיבה: לא נלמד
    sales = [{"card": {"id": f"k{i}", "title": "Sales Manager"}, "decision": "skip"} for i in range(2)]
    assert "sales" in learn(sales, {f"k{i}": {"r": "לא מעניין"} for i in range(2)})["dislikes"]
    mine = role_words({"titles": ["Full Stack Developer"]})
    assert "full" not in learn(rows, {f"j{i}": {"r": "לא התחום שלי"} for i in range(3)}, [], mine)["dislikes"]


def test_unmet_requirement_reaches_rater():
    """סבב 5: "לא עומד בדרישות" + איזו דרישה → הסוכן המדרג יודע מה המשתמש אמר שאין לו."""
    t = learn([], {"a": {"r": "לא עומד בדרישות", "q": "Armored corps background", "at": "2026-11-13"},
                   "b": {"r": "לא עומד בדרישות", "q": "armored corps background", "at": "2026-11-12"}})
    assert t["unmet"] == ["Armored corps background"] and "do NOT meet" in t["note"]
