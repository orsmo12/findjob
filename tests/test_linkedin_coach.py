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


def test_grounding_allows_plain_words_blocks_known_names():
    src = "CS student at HIT. React, OpenCV."
    assert K.grounded("Aspiring Full-Stack Developer | Seeking Junior Roles | React · OpenCV", src)
    assert not K.grounded("Experienced with Kubernetes and React", src)
    assert not K.grounded("Led a team of 12 engineers", src)


def test_linkedin_unslop_and_who():
    """17.11: פוסטים ותגובות בלי ניסוחי AI, ומותאמים לתחום של כל משתמש (לא "ג'וניור מפתח" לכולם)."""
    from agent_core.agents import linkedin_coach as K
    assert "Mechanical Engineer" in K.who({"titles": ["Mechanical Engineer"], "domains": ["הנדסת מכונות"]})
    assert K.unslop("Built it — fast 🚀  done") == "Built it, fast done"
    assert K.slop_in("I'm excited to share my project") and not K.slop_in("Built a scanner in Python")
    calls = []
    def fake(agent, kind, msgs, **k):
        calls.append(kind); return "Excited to share: I built findjob in Python." if kind == "weekly_post" else "I built findjob in Python."
    old = K.chat; K.chat = fake
    try:
        out = K.weekly_draft("Built findjob in Python", {"titles": ["Backend Developer"]})
    finally:
        K.chat = old
    assert calls == ["weekly_post", "weekly_post_fix"] and "xcited" not in out
