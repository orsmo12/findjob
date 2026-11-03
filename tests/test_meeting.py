from agent_core.agents import meeting as M


def _card(i, t, co, fit, gaps=()):
    return {"card": {"id": i, "title": t, "co": co, "fit": fit, "gaps": list(gaps)}, "decision": None}


def test_meeting_finds_roles_drops_queries_adds_companies():
    M.act.log = lambda *a, **k: None
    runs = [{"stats": {"collected": 100, "too_senior": 70, "rated": 20, "shown": 0, "fits": [3.0],
                       "queries": {"Junior React Developer": {"got": 20, "new": 0, "fit": 0}, "Junior Backend Developer": {"got": 20, "new": 5, "fit": 1}},
                       "boards": [{"name": "Elbit", "status": "by_name_ok", "found_as": "Elbit Systems"}, {"name": "Foo", "status": "not_found"}]}}] * 3
    jobs = [_card("a", "AI Engineer", "Skai", 4.3, ["ניסיון ב-AWS Bedrock"]), _card("b", "Junior AI Engineer - Agents", "Acme", 3.8, ["Docker"]), _card("e", "Outstanding Graduate Algorithm Developer", "Mobileye", 4.9),
            _card("c", "Junior Backend Developer", "Acme", 3.9, ["Docker", "CI/CD"]), _card("d", "Data Analyst", "X", 3.0)]
    plan = {"queries": ["Junior React Developer", "Junior Backend Developer"], "titles": ["Backend Developer", "React Developer"]}
    out = M.hold(plan, runs, jobs, {}, [], [], ["Wix"])
    r = out["report"]
    assert "Junior React Developer" in out["plan"]["drop_queries"] and "Junior Backend Developer" not in out["plan"]["drop_queries"]
    assert [s["value"] for s in r["suggestions"]] == ["AI Engineer"]
    assert [a["name"] for a in out["plan"]["auto_targets"]] == ["Acme"]
    assert any("Foo" in i for i in r["issues"]) and any("70%" in i for i in r["issues"])
    assert {"skill": "Docker", "jobs": 2} in out["plan"]["skill_gaps"]
    # הצעה שדחית לא חוזרת, ותפקיד שאישרת כבר לא מוצע
    assert not M.hold(plan, runs, jobs, {}, [], ["AI Engineer"], [])["report"]["suggestions"]
    assert not M.hold(plan, runs, jobs, {}, [{"type": "role", "value": "AI Engineer"}], [], [])["report"]["suggestions"]


def test_core_title():
    assert M.core_title("Junior AI Engineer - Agents (Hybrid)") == "AI Engineer"
    assert M.core_title("Software Engineer III, Cloud") == "Software Engineer"
    assert M.core_title("Outstanding Graduate Algorithm Developer - Vision Localization Group") == "Algorithm Developer"
