import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import agent_core.agents.research as R
import agent_core.agents.prep as P

CV = "CS student at HIT. Built AI Smart Crosswalk with React and OpenCV."


def test_brief_keeps_only_sourced_facts():
    R.gather = lambda co: [{"title": "Acme raises $20M", "url": "u0", "text": "Acme builds warehouse robots in Tel Aviv", "domain": "a"},
                           {"title": "x", "url": "u1", "text": "unrelated", "domain": "b"}]
    R.chat = lambda *a, **k: ('{"found": true, "what": "Acme בונה רובוטים למחסנים", "what_src": 0,'
                              '"facts": [{"text": "גייסה $20M", "src": 0}, {"text": "1,000 עובדים", "src": 1}],'
                              '"why_you": ["ניסיון ב-OpenCV", "ניסיון ב-Kubernetes"]}')
    b = R.brief("Acme", "Dev", CV)
    assert b["found"] and len(b["facts"]) == 1 and b["facts"][0]["src"] == 0
    assert b["why_you"] == ["ניסיון ב-OpenCV"] and len(b["sources"]) == 1


def test_brief_nothing_found():
    R.gather = lambda co: []
    assert R.brief("Nope", "Dev", CV) == {"found": False, "sources": []}


def test_prep_drops_invented_names():
    P.chat = lambda *a, **k: ('{"questions": [{"tag": "React", "q": "ספר על React", "hint": "AI Smart Crosswalk"},'
                              '{"tag": "x", "q": "ניסיון ב-Kafka?", "hint": "ספר על Kafka בצבא"}]}')
    r = P.prepare(CV, {"title": "Dev", "co": "Acme", "ad": "We use React"})
    assert len(r["questions"]) == 1 and r["questions"][0]["tag"] == "React"
