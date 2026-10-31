"""הבדיקה העיקרית: תוכנית החיפוש נבנית רק מהפרופיל, בלי ערכים קבועים."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core.profile import build_search_plan, select_targets, load_catalog

STUDENT = {"answers": {"status": "סטודנט/ית", "track": "את שתיהן", "roles": ["Backend", "AI / ML"],
                       "exp": "אין עדיין", "locs": ["תל אביב", "גוש דן והמרכז"], "mode": "היברידי",
                       "prio": ["למידה וחניכה", "טכנולוגיות מעניינות"]}}
SENIOR = {"answers": {"status": "עובד/ת ומחפש/ת לעבור", "exp": "3–5 שנים", "roles": ["Frontend"],
                      "locs": ["ירושלים"], "prio": ["חברה גדולה ויציבה"]}}


def test_student_plan_comes_from_answers():
    p = build_search_plan(STUDENT)
    assert p.levels == ["student", "intern", "junior"] and p.student_positions
    assert "Student Backend Developer" in p.queries() and "Junior Machine Learning Engineer" in p.queries(10)
    assert "Tel Aviv" in p.locations and "Petah Tikva" in p.locations
    assert p.max_years == 1 and "ai" in p.prefer_sectors


def test_different_user_gets_different_plan():
    a, b = build_search_plan(STUDENT), build_search_plan(SENIOR)
    assert a.queries() != b.queries()
    assert b.levels == ["mid"] and b.locations == ["Jerusalem"] and b.max_years == 5
    assert all(not q.startswith(("Junior", "Student")) for q in b.queries())


def test_empty_profile_is_generic_not_personal():
    p = build_search_plan({"answers": {}})
    assert p.locations == ["Israel"] and "Software Engineer" in p.titles
    assert any("עוד לא" in w for w in p.why)


def test_full_time_after_degree_skips_student_jobs():
    a = dict(STUDENT["answers"], track="משרה מלאה אחרי התואר")
    p = build_search_plan({"answers": a})
    assert not p.student_positions and not any(q.startswith("Student") for q in p.queries())


def test_skips_tighten_seniority():
    prof = {"answers": {"status": "ג׳וניור עם ניסיון של עד שנתיים", "exp": "1–2 שנים"},
            "skip_reasons": {"j1": "בכירה מדי", "j2": "בכירה מדי"}}
    assert build_search_plan(prof).max_years == 1


def test_targets_follow_profile_and_user_edits():
    cat = load_catalog()
    prof = dict(STUDENT, target_companies={"added": ["My Startup"], "removed": ["Mobileye"]})
    picked = select_targets(build_search_plan(prof), prof, cat)
    names = [c["name"] for c in picked]
    assert names[0] == "My Startup" and "Mobileye" not in names
    jer = select_targets(build_search_plan(SENIOR), SENIOR, cat)
    assert jer[0]["city"] == "Jerusalem"


def test_no_hardcoded_user_in_agents():
    root = Path(__file__).resolve().parents[1]
    for f in [root / "scheduler.py", root / "agent_core" / "api.py"]:
        if f.exists():
            txt = f.read_text(encoding="utf-8")
            assert "Junior Python Developer" not in txt, f"{f.name}: חיפוש קבוע במקום תוכנית מהפרופיל"


SAMPLE_CV = """Dana Levi
Ramat Gan, Israel • dana@example.com
Profile: Second-year Computer Science student.
Education: B.Sc. in Computer Science, 2023 – Present
Skills: Python, React, HTML, CSS, Node, Express, OpenCV, TensorFlow, SQL
"""


def test_cv_fills_defaults_when_questionnaire_is_empty():
    p = build_search_plan({"cv_text": SAMPLE_CV, "answers": {}})
    assert p.levels == ["student", "intern", "junior"]
    assert "Ramat Gan" in p.locations
    assert any("Full Stack" in t for t in p.titles) and any("Machine Learning" in t for t in p.titles)
    assert any("מקורות החיים" in w for w in p.why)


def test_questionnaire_overrides_cv():
    p = build_search_plan({"cv_text": SAMPLE_CV, "answers": {"roles": ["QA ואוטומציה"], "locs": ["ירושלים"]}})
    assert p.titles == ["QA Automation Engineer"] and p.locations == ["Jerusalem"]
    assert not any("תפקידים" in w and "מקורות החיים" in w for w in p.why)
