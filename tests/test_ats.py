import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import agent_core.agents.ats as A


def test_greenhouse_israel_only():
    data = {"jobs": [{"title": "Junior Software Engineer", "location": {"name": "Tel Aviv, Israel"}, "absolute_url": "u1", "content": "&lt;p&gt;Python&lt;/p&gt;"},
                     {"title": "Software Engineer", "location": {"name": "New York"}, "absolute_url": "u2", "content": ""}]}
    out = A._parse("greenhouse", data, "Acme")
    assert [j["url"] for j in out] == ["u1"] and out[0]["description"] == "Python" and out[0]["source"] == "greenhouse"
