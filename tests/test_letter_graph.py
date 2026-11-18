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
    assert out["v"] == LG.LETTER_V and out["checked"] and "Kubernetes" not in out["text"] and out["projects"] == ["findjob"]


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


def test_letter_why_codes_only():
    """כלי המפתח רואה למה כלל נכשל בקודים, בלי טקסט מהמכתב."""
    from agent_core.agents.letter_graph import letter_why
    txt = "Dear Wix team,\n\nI am excited to apply.\n\nI hold a B.Sc. in Computer Science and built a backend project.\n\nBest regards,\nOr"
    why = letter_why(txt, {"title": "Backend Developer", "co": "Wix", "loc": "Tel Aviv"})
    assert "opening:no_title_word" in why and "opening:degree_later" in why and "closing:no_company_in_letter" in why
    assert all(":" in c and len(c) < 40 for c in why)   # רק קודים קצרים


def test_code_rule_failures_reach_the_rewrite():
    """כלל שנכשל בבדיקה בקוד עובר לעורך כהוראת תיקון מדויקת, גם כשה-AI אישר אותו. המתג מכבה."""
    txt = "Dear Acme team,\n\nI am applying.\n\nfindjob is my project in Python.\n\nBest regards,\nDana Levi"
    got = LG.code_issues(txt, JOB)
    assert any("AI Engineer" in x for x in got) and any("degree" in x for x in got) and any("Acme" in x and "Tel Aviv" in x for x in got)
    LG.chat, LG.act.log = (lambda *a, **k: '{"fail": [], "issues": []}'), (lambda *a, **k: None)
    old = LG.CODE_RULES_IN_CRITIQUE
    try:
        LG.CODE_RULES_IN_CRITIQUE = True
        assert len(LG.critique({"text": txt, "job": JOB})["issues"]) >= 3
        LG.CODE_RULES_IN_CRITIQUE = False   # כבוי מ-18.11
        assert LG.critique({"text": txt, "job": JOB})["issues"] == []
    finally:
        LG.CODE_RULES_IN_CRITIQUE = old


def test_letters_always_english_and_no_cut_after_degree():
    """17.11: מודעה בעברית יצרה פנייה בעברית וגוף באנגלית, ומחיקת משפט נחתכה אחרי B.Sc. והשאירה שבר משפט."""
    from agent_core.agents.letters import _sentences, _drop_bad_sentences
    assert LG.need.__globals__["LETTERS_EN_ONLY"] is True
    p = "I am pursuing a B.Sc. in Computer Science at HIT. I built findjob."
    assert _sentences(p) == ["I am pursuing a B.Sc. in Computer Science at HIT.", "I built findjob."]
    out = _drop_bad_sentences("Dear X team,\n\n" + p, ["HIT"])
    assert "in Computer Science" not in out and "I built findjob." in out


def test_parts_fix_only_the_failing_part_and_keep_it_through_rewrite():
    """18.11: מכתב בחלקים. סגירה בלי שם החברה נכתבת מחדש לבד; שכתוב מלא שמאבד את הסגירה לא נשמר."""
    parts = ('{"opening": "I am applying for the AI Engineer role in Tel Aviv, in my final semester of a B.Sc. at HIT.", '
             '"body": ["findjob is my multi-agent job search system in Python with Supabase, which turns messy ads into structured data for ranking, and ships a mobile app that real users open every day."], '
             '"closing": "I would be glad to talk."}')
    LG.LETTER_PARTS = True
    out, calls = run_with({
        "letter_need": '{"requirements": ["Python"], "projects": ["findjob"], "gaps": []}',
        "letter_draft": parts,
        "letter_part": "I would be glad to talk with the Acme team in Tel Aviv.",
        "letter_critique": ['{"fail": [7], "issues": ["paragraphs do not connect"]}', '{"issues": []}', '{"issues": []}'],
        "letter_rewrite": "Dear Acme team,\n\nI am applying for the AI Engineer role, B.Sc. at HIT.\n\nfindjob is in Python with Supabase.\n\nThanks.\n\nBest regards,\nDana Levi",
    })
    assert calls.count("letter_part") == 1                      # רק הסגירה נכתבה מחדש
    assert "Acme team in Tel Aviv" in out["text"]               # השכתוב המלא איבד את הסגירה, ולכן לא נשמר
    assert out["text"].startswith("Dear Acme team,\n\n") and out["text"].endswith("Best regards,\nDana Levi")
    LG.LETTER_PARTS, LG._graph = False, None


def test_part_issues_in_code():
    j = {"title": "Backend Developer", "co": "Wix", "loc": "Tel Aviv"}
    good = {"opening": "Applying for the Backend Developer role, finishing my B.Sc. at HIT.", "body": ["x " * 30], "closing": "Glad to meet the Wix team."}
    assert LG.part_issues(good, j) == []
    assert LG.part_issues({**good, "opening": "Applying for the Backend Developer role."}, j) == ["opening"]
    assert LG.part_issues({**good, "closing": "Thanks!"}, j) == ["closing"]
    assert LG.part_issues({**good, "opening": "Mechanical engineer with 8 years in design, applying for the Backend Developer role."}, j) == []


def test_job_location_is_not_an_invented_fact():
    """18.11: בדיקת האמת לא כללה את מיקום המשרה, ולכן מחקה את משפט הסגירה (שחייב לכלול את המיקום)."""
    st = {"job": JOB, "cv": CV, "name": "Dana Levi", "status": "", "brief": {},
          "text": "Dear Acme team,\n\nfindjob is in Python.\n\nI would be glad to meet the Acme team in Tel Aviv.\n\nBest regards,\nDana Levi"}
    assert LG.ground(st)["bad"] == []


def test_opening_needs_the_degree_when_the_cv_has_one():
    j = {"title": "Mechanical Engineer", "co": "Acme", "loc": "Haifa"}
    p = {"opening": "Mechanical engineer with 8 years in design, applying for the Mechanical Engineer role.", "body": ["x " * 30], "closing": "Acme in Haifa"}
    assert LG.part_issues(p, j, "B.Sc. Mechanical Engineering, Technion") == ["opening"]
    assert LG.part_issues({**p, "opening": "With a B.Sc. in Mechanical Engineering and 8 years in design, I am applying for the Mechanical Engineer role."}, j, "B.Sc. Mechanical Engineering") == []
