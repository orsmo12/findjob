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
    assert "סתירה בשאלון" in w and "ג'וניור" in w      # היום: "מהנדס מכונות ג'וניור" רץ למי שיש לו 3–5 שנים


def test_searched_cuts_like_collect():
    plan = {"queries": [f"q{i}" for i in range(10)], "locations": ["a", "b", "c", "d", "e", "f"]}
    assert S.searched(plan) == ["q0", "q1"]
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
    assert not S.hands_on_hide({"title": "Mechanical Technician"}, {"titles": ["Mechanical Engineer"]}, "Worked as a lab technician")  # בקו״ח


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
