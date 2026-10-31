import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import agent_core.agents.letters as L

CV = "Or Smolarchik. Third-year CS student at HIT. Built AI Smart Crosswalk with React, Socket.IO and OpenCV."
JOB = {"title": "Full Stack Developer", "co": "Acme", "ad": "We use React and Node. Students welcome."}


def test_flags_invented_facts():
    bad = L.unsupported("I worked 3 years at Google with Kubernetes and React.", CV, JOB["ad"], "Acme", "Or")
    assert set(bad) == {"Google", "Kubernetes", "3"}


def test_retry_then_drop():
    calls = []
    def fake(agent, task, messages, **kw):
        calls.append(task)
        return "Hi Acme team. I built AI Smart Crosswalk with React. I led 40 engineers at Google. Or"
    L.chat = fake
    r = L.write_letter(CV, JOB, "Or")
    assert calls == ["cover_letter", "cover_letter_retry"]
    assert "Google" not in r["text"] and "Crosswalk" in r["text"] and r["checked"]


def test_language_follows_ad():
    assert L.ad_language("דרוש מפתח עם ניסיון ב-React") == "Hebrew"
    assert L.ad_language("We are hiring a developer") == "English"
