import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import agent_core.agents.ats as A


def test_greenhouse_israel_only():
    data = {"jobs": [{"title": "Junior Software Engineer", "location": {"name": "Tel Aviv, Israel"}, "absolute_url": "u1", "content": "&lt;p&gt;Python&lt;/p&gt;"},
                     {"title": "Software Engineer", "location": {"name": "New York"}, "absolute_url": "u2", "content": ""}]}
    out = A._parse("greenhouse", data, "Acme")
    assert [j["url"] for j in out] == ["u1"] and out[0]["description"] == "Python" and out[0]["source"] == "greenhouse"


def test_career_site_titles_filtered_before_reading():
    """מדוח התובנות: דפי קריירה הביאו 1,709 משרות ואחת התאימה. מסננים לפי מילת תפקיד ורמה לפני קריאה ודירוג."""
    import re
    from agent_core.agents.ats import relevant_title, GENERIC
    titles = ["Backend Developer", "AI Engineer", "QA Automation Engineer"]
    words = {w.lower() for t in titles for w in re.findall(r"[A-Za-z]+", t)} - {"developer", "engineer"}
    spec = ({w for w in words if len(w) >= 2} - GENERIC) | {"software engineer"}
    ok = ["Backend Developer", "AI Engineer", "Software Engineer, Infra", "Student - QA Automation"]
    bad = ["Senior Backend Engineer", "Hardware Engineer", "Sales Engineer", "Email Marketing Lead", "ASIC Design Engineer"]
    assert all(relevant_title(t, spec, words, True) for t in ok)
    assert not any(relevant_title(t, spec, words, True) for t in bad)
    assert relevant_title("Senior Backend Engineer", spec, words, False)   # מי שיש לו ניסיון: Senior מותר
    mech = {"mechanical", "design", "manufacturing"}
    assert relevant_title("Mechanical Design Engineer", mech, mech, True) and not relevant_title("Software Engineer", mech, mech, True)
