"""סינון בכירות בקוד: לפי הרמה ושנות הניסיון שנגזרו מהפרופיל."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core.agents.hunter import too_senior as _too_senior

STUDENT = {"levels": ["student", "intern", "junior"], "max_years": 1}
MID = {"levels": ["mid"], "max_years": 5}


def test_senior_titles_filtered_for_student():
    assert _too_senior({"title": "Senior Data Scientist"}, STUDENT)
    assert _too_senior({"title": "Principal Engineer"}, STUDENT)
    assert not _too_senior({"title": "Junior Software Engineer"}, STUDENT)


def test_years_requirement():
    assert _too_senior({"title": "Backend Developer", "description": "3+ years of Python"}, STUDENT)
    assert not _too_senior({"title": "Backend Developer", "description": "0-1 years, students welcome"}, STUDENT)
    assert not _too_senior({"title": "Senior Backend Developer", "description": "4 years"}, MID)
