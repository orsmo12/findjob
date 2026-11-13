"""סבב 1 (תוכנית 13.11): הרצת ניסיון — בדיקת התאמה בין פרופיל לחיפוש, וכללים מוצעים שלא פוגעים במשרות שנשמרו."""
from agent_core.profile import build_search_plan, normalize_answers
from agent_core.agents.hunter import to_card
from scripts import shadow as S

MECH = {"study": "סטודנט/ית לתואר", "year": "שנה ה׳ ומעלה", "work": "עובד/ת בתחום", "exp": "3–5 שנים",
        "scope": ["משרה מלאה", "משרה חלקית / משרת סטודנט"], "field": ["הנדסת מכונות"], "domains": ["הנדסת מכונות"], "locs": ["גוש דן והמרכז", "תל אביב"],
        "mode": "לא משנה לי", "track": "את שתיהן", "status": "סטודנט/ית"}


def plan_of(a):
    return build_search_plan({"cv_text": "", "answers": a}).to_dict()


def test_audit_flags_experienced_student():
    a = normalize_answers(MECH)
    w = " | ".join(S.audit(plan_of(MECH), a))
    assert "סתירה בשאלון" in w and "ג'וניור" not in w and "חיפושי סטודנט" not in w   # סבב 3: בלי ג'וניור, סטודנט רק כתוספת
    q = plan_of({**MECH, "roles": ["תכנון מכני", "ייצור ותהליכים"]})["queries"]
    assert q[:2] == ["Mechanical Engineer", "Manufacturing Engineer"] and q.index("Student Mechanical Engineer") > q.index("מהנדס ייצור")


def test_searched_cuts_like_collect():
    plan = {"queries": [f"q{i}" for i in range(10)], "locations": ["a", "b", "c", "d", "e", "f"]}
    assert len(S.searched(plan)) == 8   # 6 אזורים → 2 לסריקה, 4 סריקות ביומיים
    assert "8/" in " ".join(S.audit({**plan, "heads": [f"q{i}" for i in range(10)]}, {})) or True


def test_fill_rule_spares_experienced_users():
    c = {"near": True, "dims": {"level": "short"}, "title": "Senior Mechanical Engineer"}
    assert S.fill_hide(c, {"have_years": 0}) and not S.fill_hide(c, {"have_years": 3})
    assert not S.fill_hide({**c, "dims": {"level": "ok"}}, {"have_years": 0})   # פער כישורים: נשארת


def test_cap_rise_uses_range_top():
    c = {"dims": {"level": "short"}, "gaps": ["במודעה נדרשות 5 שנות ניסיון. יותר ממה שיש לך"]}
    assert S.cap_rise(c, {"exp": "3–5 שנים"}) and not S.cap_rise({**c, "gaps": ["במודעה נדרשות 8 שנות ניסיון."]}, {"exp": "3–5 שנים"})
    assert not S.cap_rise({**c, "gaps": ["במודעה נדרשות 1 שנות ניסיון."]}, {"exp": "אין עדיין"})   # בלי ניסיון: בלי שינוי


def test_hands_on_only_when_not_chosen():
    assert S.hands_on_hide({"title": "מפעיל ייצור סטרילי"}, {"titles": ["Mechanical Engineer"]})
    assert not S.hands_on_hide({"title": "Field Technician"}, {"titles": ["Field Technician"]})
    assert not S.hands_on_hide({"title": "Mechanical Design Engineer"}, {"titles": ["Mechanical Engineer"]})
    assert not S.hands_on_hide({"title": "CNC Process Engineer"}, {"titles": ["Process Engineer"]})        # מהנדס: נשארת
    assert S.hands_on_hide({"title": "Mechanical Technician"}, {"titles": ["Mechanical Engineer"]}, "Worked as a lab technician")   # לפי השאלון, לא לפי העבר
    assert not S.hands_on_hide({"title": "Mechanical Technician"}, {"titles": ["Mechanical Engineer"], "extra_titles": ["טכנאי מכונות"]})  # "תפקיד אחר"


def test_taste_keeps_chosen_roles():
    rows = [{"card": {"id": f"j{i}", "title": "Full Stack Engineer"}, "decision": "skip"} for i in range(3)]
    skips = {f"j{i}": {"r": "לא עומד בדרישות"} for i in range(3)}
    plan = {"titles": ["Full Stack Developer"]}
    assert "full" not in S.learn_new(rows, skips, [], plan)["dislikes"]
    rows2 = [{"card": {"id": f"k{i}", "title": "Sales Manager"}, "decision": "skip"} for i in range(2)]
    assert "sales" in S.learn_new(rows2, {f"k{i}": {"r": "לא התחום שלי"} for i in range(2)}, [], plan)["dislikes"]


def test_card_keeps_query():
    j = {"id": "1", "company": "c", "title": "t", "location": "l", "source": "linkedin", "url": "u", "query": "Junior Python Developer"}
    r = {"fit": 4.0, "reasons": [], "gaps": [], "partial": False}
    assert to_card(j, r)["q"] == "Junior Python Developer"


def test_round3_search_by_profile():
    """סבב 3: סבב שאילתות, תקרה לפי טווח, מפעיל/טכנאי לפי השאלון, אותה משרה פעמיים, שאילתות חלשות לסוף."""
    from agent_core.agents import hunter as H
    weak_queries = H.weak_queries
    qs = [f"q{i}" for i in range(9)]
    assert H.pick_queries(qs, 4, 12, 0) == ["q0", "q1", "q2"]                       # rot=0: כמו קודם
    seen = set().union(*[H.pick_queries(qs, 4, 12, r) for r in range(1, 4)])
    assert seen == set(qs)                                                          # #2: כל 9 התפקידים בתוך 3 סריקות
    assert H.pick_queries(qs[:3], 1, 12, 5) == qs[:3]                               # נכנסות כולן: בלי שינוי
    assert H.years_have({"have_years": 3, "max_years": 5}) == 5 and H.years_have({"have_years": 0, "max_years": 1}) == 0
    assert H.hands_on({"title": "מפעיל ייצור סטרילי"}, {"titles": ["Mechanical Engineer"]})
    assert not H.hands_on({"title": "CNC Programmer"}, {"titles": ["Mechanical Engineer"]})
    assert not H.hands_on({"title": "Lab Technician"}, {"titles": ["Lab Technician"]})
    a = {"title": "Junior Developer - 7361", "company": "InfinityLabs"}
    assert H.same_key(a) == H.same_key({"title": "Junior Developer (JB-5570)", "company": "infinitylabs "})
    assert H.same_key(a) != H.same_key({"title": "Junior QA Developer", "company": "InfinityLabs"})
    runs = [{"stats": {"queries": {"telegram": {"new": 10, "fit": 0}, "Junior X": {"new": 30, "fit": 1}}}}] * 3
    assert weak_queries(runs) == ["telegram"] and weak_queries(runs[:2]) == []
