"""סבב 12: כלל סינון שאושר בצ׳אט נכנס לתוכנית, ודורון לא מציג משרות עם המילה בכותרת."""
from agent_core.profile import build_search_plan
from agent_core.agents.hunter import prefilter


def test_exclude_rule_flows_to_hunter():
    plan = build_search_plan({"cv_text": "Python developer", "answers": {"exclude": [".NET", "C#"]}}).to_dict()
    assert plan["exclude_words"] == [".NET", "C#"] and any(".NET" in w for w in plan["why"])
    jobs = [{"id": "1", "title": "Junior .NET Developer"}, {"id": "2", "title": "Junior Python Developer"}, {"id": "3", "title": "C# Engineer"}]
    keep, st = prefilter(jobs, plan, set())
    assert [j["id"] for j in keep] == ["2"] and st["excluded"] == 2
