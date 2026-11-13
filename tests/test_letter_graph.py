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
    assert out["v"] == 6 and out["checked"] and "Kubernetes" not in out["text"] and out["projects"] == ["findjob"]


def test_gives_up_after_two_rounds_and_drops_bad_sentence():
    bad = "Dear Acme team, I know Rust deeply. findjob is in Python. Best regards, Dana Levi"
    out, calls = run_with({
        "letter_need": '{"requirements": [], "projects": ["findjob"]}', "letter_draft": bad,
        "letter_critique": '{"issues": []}', "letter_rewrite": bad})
    assert calls.count("letter_rewrite") == LG.MAX_ROUNDS and "Rust" not in out["text"] and "findjob is in Python" in out["text"]


def test_slop_detected_in_code():
    assert LG.slop_in("I am passionate and want to leverage synergy") == ["passionate", "leverage", "synergy"]


def test_dropping_a_bad_first_sentence_keeps_greeting_and_signature():
    """הבאג מ-11.11: משפט ראשון לא מבוסס מחק גם את ה-Dear, והכל הפך לגוש אחד."""
    out, _ = run_with({
        "letter_need": '{"requirements": [], "projects": ["findjob"]}',
        "letter_draft": "Dear Acme team, I know Rust deeply. findjob is in Python.\n\nI learn fast.\n\nBest regards,\nDana Levi",
        "letter_critique": '{"issues": []}', "letter_rewrite": "Dear Acme team, I know Rust deeply. findjob is in Python.\n\nI learn fast.\n\nBest regards,\nDana Levi"})
    t = out["text"]
    assert t.startswith("Dear Acme team,\n\n") and t.endswith("Best regards,\nDana Levi") and "Rust" not in t
    assert "findjob is in Python.\n\nI learn fast." in t


def test_flat_letter_gets_real_layout():
    flat = ("Hi Acme team, I'm applying for the AI Engineer role in Tel Aviv while finishing my B.Sc. at HIT this semester. "
            "findjob is my multi-agent system in Python. It turns messy ads into structured data. "
            "Home Poker is a React PWA I built and shipped. I learn new tools quickly on my own. "
            "I'd welcome the chance to join the team in Tel Aviv. Best regards, Dana Levi")
    t = LG.shape_letter(flat, "Acme", "Dana Levi")
    assert t.startswith("Hi Acme team,\n\n") and t.endswith("\n\nBest regards,\nDana Levi")
    body = t.split("\n\n")[1:-1]
    assert len(body) >= 3 and body[-1].startswith("I'd welcome")


def test_missing_greeting_added_and_hebrew_signoff():
    assert LG.shape_letter("My findjob project helps.", "Acme", "Dana").startswith("Dear Acme team,\n\nMy findjob")
    assert LG.shape_letter("פרויקט findjob.", "אקמה", "דנה", "Hebrew").endswith("בברכה,\nדנה")


def test_inflated_analogy_is_slop():
    assert "directly mirror" in LG.slop_in("tests directly mirroring the regression automation")


def test_letter_score_and_reserve():
    """מכתבים (סבב 7): 6 הכללים מהדוגמאות נבדקים בקוד, מילואים רק אם כתוב אצל המשתמש."""
    from agent_core.agents import letter_graph as G
    job = {"title": "AI Engineer", "co": "Monticello", "loc": "Tel Aviv, Israel"}
    text = ("Dear Monticello team,\n\nI'm applying for the AI Engineer role in Tel Aviv. I'll complete my B.Sc. at HIT soon.\n\n"
            "My main project, findjob, turns messy job ads into structured data with LLM agents, close to your document pipelines. "
            + "It keeps a human in control and checks every output against its source. " * 3 +
            "\n\nI haven't worked with Snowflake yet. During long reserve duty I completed most of my degree through self-study, "
            "and as an IDF logistics officer I learned to own decisions under pressure.\n\n"
            "I'd welcome the chance to help build the Monticello team in Tel Aviv.\n\nBest regards,\nOr")
    sc = G.letter_score(text, job, "IDF logistics officer, reserve duty", ["findjob"])
    assert all(sc.values()), sc
    assert not G.letter_score(text.replace("I'm applying for the AI Engineer role", "Hello"), job, "", ["findjob"])["opening"]
    assert G.RESERVE.search("מילואים פעילים") and not G.RESERVE.search("Python, React")
