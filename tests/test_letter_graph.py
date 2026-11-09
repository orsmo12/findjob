"""סבב 8: מכתב בלולאת LangGraph. מודל מדומה: טיוטה עם קלישאה ופרט מומצא, ביקורת, שכתוב, בדיקת אמת."""
from agent_core.agents import letter_graph as LG

CV = "Dana Levi. B.Sc. Computer Science, HIT. Projects: findjob - multi-agent job search in Python with Supabase. Home Poker - React PWA."
JOB = {"title": "AI Engineer", "co": "Acme", "loc": "Tel Aviv", "ad": "We build AI pipelines over documents. Python, LLM agents, React. " * 6}


def run_with(replies):
    calls = []
    def fake(agent, task, msgs, **k):
        calls.append(task)
        return replies[task].pop(0) if isinstance(replies[task], list) else replies[task]
    LG.chat, LG._graph = fake, None
    LG.act.log = lambda *a, **k: None
    out = LG.write_letter_v4(CV, JOB, "Dana Levi", {"found": True, "what": "Acme reads loan documents"}, "Final semester at HIT", ["x" * 250])
    return out, calls


def test_loop_fixes_slop_and_grounding():
    good = "Dear Acme team, I'm applying for the AI Engineer role in Tel Aviv, in my final semester at HIT. findjob, my multi-agent system in Python with Supabase, turns messy ads into structured data, like your documents. Best regards, Dana Levi"
    out, calls = run_with({
        "letter_need": '{"requirements": ["AI pipelines", "Python"], "domain": "documents", "projects": ["findjob", "Kubernetes Thing"], "gaps": []}',
        "letter_draft": "Dear Acme team, I am writing to express my strong interest. I deployed findjob on Kubernetes for 5000 users. Best regards, Dana Levi",
        "letter_critique": ['{"issues": ["generic opening"]}', '{"issues": []}', '{"issues": []}'],
        "letter_rewrite": ["Dear Acme team, findjob runs on Kubernetes for 5000 users in Tel Aviv. Best regards, Dana Levi", good],
    })
    assert calls[:3] == ["letter_need", "letter_draft", "letter_critique"]
    assert calls.count("letter_rewrite") == 2                 # פעם בגלל הביקורת, פעם בגלל בדיקת האמת
    assert out["v"] == 4 and out["checked"] and "Kubernetes" not in out["text"] and out["projects"] == ["findjob"]


def test_gives_up_after_two_rounds_and_drops_bad_sentence():
    bad = "Dear Acme team, I know Rust deeply. findjob is in Python. Best regards, Dana Levi"
    out, calls = run_with({
        "letter_need": '{"requirements": [], "projects": ["findjob"]}', "letter_draft": bad,
        "letter_critique": '{"issues": []}', "letter_rewrite": bad})
    assert calls.count("letter_rewrite") == LG.MAX_ROUNDS and "Rust" not in out["text"] and "findjob is in Python" in out["text"]


def test_slop_detected_in_code():
    assert LG.slop_in("I am passionate and want to leverage synergy") == ["passionate", "leverage", "synergy"]
