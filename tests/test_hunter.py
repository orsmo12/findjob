"""דורון בלי רשת: נתונים מדומים ונתב מדומה."""
import sys, json, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import agent_core.agents.hunter as h

tmp = Path(tempfile.mkdtemp())
h.FEED, h.SEEN = tmp / "jobs.json", tmp / "seen.json"
PLAN = {"queries": ["Student Full Stack Developer"], "locations": ["Tel Aviv"], "levels": ["student", "intern", "junior"],
        "max_years": 1, "titles": ["Full Stack Developer"], "why": ["סטודנט"]}
CV = "Third-year CS student. Python, React, Socket.IO, OpenCV, TensorFlow."
RAW = [
    {"title": "Full Stack Developer Student", "company": "Acme", "location": "Tel Aviv", "url": "u1",
     "description": "React and Python, students welcome. " * 20, "source": "linkedin", "posted": "2026-10-30", "salary": ""},
    {"title": "Full Stack Developer Student", "company": "ACME ", "location": "Tel Aviv", "url": "u1b",
     "description": "dup", "source": "indeed", "posted": "", "salary": ""},
    {"title": "Senior Backend Engineer", "company": "Big", "location": "Tel Aviv", "url": "u2",
     "description": "8 years", "source": "indeed", "posted": "", "salary": ""},
    {"title": "Backend Developer", "company": "Mid", "location": "Tel Aviv", "url": "u3",
     "description": "Requires 4+ years of Python", "source": "indeed", "posted": "", "salary": ""},
    {"title": "QA Tester", "company": "Low", "location": "Tel Aviv", "url": "u4",
     "description": "", "source": "google", "posted": "", "salary": ""},
]


def fake_chat(agent, task, messages, **kw):
    txt = messages[0]["content"]
    if "Acme" in txt:
        return '{"fit": 4.6, "reasons": ["React ו-Python מופיעים בקורות החיים"], "gaps": ["TypeScript"], "seniority_ok": true}'
    return '{"fit": 2.1, "reasons": [], "gaps": ["תחום אחר"], "seniority_ok": true}'


def test_salary_only_when_published():
    assert h.salary_text({"min_amount": float("nan"), "max_amount": float("nan")}) == ""
    assert h.salary_text({"min_amount": 15000, "max_amount": 20000, "currency": "ILS", "interval": "monthly"}) == "₪15,000–20,000 לחודש"


def test_pipeline_dedupes_filters_rates_and_writes_feed():
    h.chat = fake_chat
    feed = h.run({"cv_text": CV}, PLAN, raw=[dict(j) for j in RAW])
    s = feed["stats"]
    assert s["collected"] == 4                      # הכפילות של Acme אוחדה
    assert s["too_senior"] == 2                     # Senior בכותרת + דרישה ל-4 שנים
    assert [j["co"] for j in feed["jobs"]] == ["Acme"]   # QA קיבל 2.1 ולא מוצג
    card = feed["jobs"][0]
    assert card["salary"] == "" and card["partial"] is False and card["src"] == "LinkedIn"
    assert json.loads(h.FEED.read_text())["jobs"][0]["fit"] == 4.6


def test_seen_jobs_not_shown_twice():
    h.chat = fake_chat
    feed = h.run({"cv_text": CV}, PLAN, raw=[dict(j) for j in RAW])
    assert feed["jobs"] == [] and feed["stats"]["already_seen"] == 1


def test_bad_model_output_is_ignored():
    assert h.parse_rating("no json here") is None
    r = h.parse_rating('{"fit": 9, "reasons": ["a","b","c","d"], "gaps": []}')
    assert r["fit"] == 5.0 and len(r["reasons"]) == 3


def test_partial_rating_claims_no_gaps():
    h.chat = lambda *a, **k: '{"fit": 4.0, "reasons": ["React"], "gaps": ["Node.js"], "seniority_ok": true}'
    r = h.rate({"title": "Dev", "company": "X", "location": "TA", "description": ""}, CV, "")
    assert r["partial"] is True and r["gaps"] == []


def test_html_text():
    assert h._html_text("<p>Hi&amp;bye</p><ul><li>Python</li></ul>") == "Hi&bye\n• Python"
