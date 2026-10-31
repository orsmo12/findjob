import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import agent_core.agents.linkedin_coach as K

CV = "CS student at HIT. Built AI Smart Crosswalk with React and OpenCV."


def test_hot_posts_filters_irrelevant_and_invented():
    K.find_posts = lambda plan, limit: [
        {"id": "p1", "url": "u1", "author": "Dana Levi", "text": "We are hiring junior developers in Tel Aviv! Python and React. DM me." * 2},
        {"id": "p2", "url": "u2", "author": "Bob", "text": "My vacation photos from the beach, lovely weather today." * 2}]
    def fake(agent, task, messages, **kw):
        if "vacation" in messages[0]["content"]:
            return '{"relevant": false}'
        return ('{"relevant": true, "why": "מגייסת ג׳וניורים", "lang": "en", "drafts": ['
                '{"k": "ניסיון אישי", "t": "I built AI Smart Crosswalk with React."},'
                '{"k": "שאלה", "t": "Do you use Kubernetes at Google?"}]}')
    K.chat = fake
    posts = K.hot_posts({"titles": ["Full Stack Developer"]}, CV)
    assert [p["id"] for p in posts] == ["p1"] and len(posts[0]["drafts"]) == 1


def test_profile_fixes_need_pdf():
    assert K.profile_fixes(CV, "", {"titles": []}) == []


def test_profile_fix_copy_grounded():
    K.chat = lambda *a, **k: ('{"fixes": [{"t": "כותרת", "why": "x", "copy": "CS Student @ HIT | React · OpenCV"},'
                              '{"t": "About", "why": "y", "copy": "Ex-Google engineer with 10 years"}]}')
    fx = K.profile_fixes(CV, "Or Smolarchik. Student at HIT. Skills: React" * 3, {"titles": ["Full Stack Developer"]})
    assert [f["t"] for f in fx] == ["כותרת"]
