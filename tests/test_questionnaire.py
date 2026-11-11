"""השאלון החדש (לימודים + עבודה, היקף משרה, כמה תחומים, "אחר") וספקי AI למפתח אישי."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core.profile import normalize_answers as N, build_search_plan
from agent_core import llm_router as L

PART = "משרה חלקית / משרת סטודנט"


def plan(a):
    return build_search_plan({"cv_text": "", "answers": a}).to_dict()


def test_every_study_work_combination_maps_to_a_status():
    for study in ["לא לומד/ת כרגע", "סטודנט/ית לתואר", "סיימתי תואר", "לימודי הנדסאות או תעודה", "קורס או בוטקאמפ", "אחר", ""]:
        for work in ["לא עובד/ת כרגע", "עובד/ת בתחום", "עובד/ת בתחום אחר", "משתחרר/ת משירות", "אחר", ""]:
            p = plan({"study": study, "work": work})
            assert p["levels"], (study, work)


def test_student_who_works_in_field():
    a = N({"study": "סטודנט/ית לתואר", "year": "שנה ה׳ ומעלה", "work": "עובד/ת בתחום", "exp": "1–2 שנים"})
    assert a["status"] == "סטודנט/ית"
    p = plan(a)
    assert "student" in p["levels"] and p["have_years"] == 1


def test_scope_full_part_both():
    assert plan({"study": "סטודנט/ית לתואר", "scope": ["משרה מלאה"]})["student_positions"] is False
    assert plan({"study": "סטודנט/ית לתואר", "scope": [PART]})["student_positions"] is True
    p = plan({"work": "לא עובד/ת כרגע", "scope": ["משרה מלאה", PART], "domains": ["הנדסת מכונות"]})
    assert p["part_time"] and any("חלקית" in q for q in p["he_queries"])


def test_old_answers_still_work():
    a = N({"status": "סטודנט/ית", "track": "משרת סטודנט חלקית", "domain": "הנדסת מכונות"})
    assert a["study"] == "סטודנט/ית לתואר" and a["scope"] == [PART] and a["domains"] == ["הנדסת מכונות"]
    assert N({"status": "עובד/ת ומחפש/ת לעבור", "exp": "3–5 שנים"})["status"] == "עובד/ת ומחפש/ת לעבור"


def test_several_domains_and_custom_roles():
    p = plan({"domains": ["הנדסת מכונות", "פיתוח תוכנה"], "roles": ["תכנון מכני", "Backend", "מהנדס HVAC"],
              "custom_roles": [{"label": "מהנדס HVAC", "titles": ["HVAC Engineer"]}], "custom_he": ["מהנדס מיזוג אוויר"]})
    assert {"Mechanical Engineer", "HVAC Engineer"} <= set(p["titles"]) and any("Backend" in t for t in p["titles"])
    assert "מהנדס מיזוג אוויר" in p["he_queries"] and p["domains"] == ["הנדסת מכונות", "פיתוח תוכנה"]


def test_other_location_is_searched():
    assert "Ashdod" in plan({"locs": ["אחר"], "locs_other": "Ashdod"})["locations"]


def test_ai_key_providers():
    assert [L.provider_of(k) for k in ["gsk_x", "AIzaSy", "sk-ant-api03", "sk-proj-x", "abc"]] == ["groq", "gemini", "anthropic", "openai", ""]
    assert L.valid_key("sk-ant-" + "a" * 40) and not L.valid_key("hello")


def test_provider_model_picking_prefers_newest():
    L.use_key("sk-proj-" + "a" * 40)
    L._live = ["gpt-5-nano", "gpt-5-mini", "gpt-5.5-mini", "gpt-5.5-nano"]
    assert L._compat_models("light")[0] == "gpt-5.5-nano" and L._compat_models("judge")[0] == "gpt-5.5-mini"
    L.use_key("sk-ant-" + "a" * 40)
    L._live = ["claude-haiku-4-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
    assert L._compat_models("light")[0] == "claude-haiku-5-5" and L._compat_models("judge")[0] == "claude-sonnet-5-5"
    L.use_key(None)


def test_experience_decides_level_not_studies():
    """סטודנט עם ניסיון רב (כמו גלעד) לא מקבל רק משרות ג׳וניור."""
    from agent_core.agents.hunter import too_senior, level_cap
    base = {"study": "סטודנט/ית לתואר", "work": "עובד/ת בתחום", "domains": ["הנדסת מכונות"], "roles": ["תכנון מכני"]}
    p = plan({**base, "exp": "יותר מ-5 שנים", "scope": ["משרה מלאה"]})
    assert "mid" in p["levels"] and not p["student_positions"] and p["have_years"] == 5
    assert not too_senior({"title": "Senior Mechanical Engineer", "description": ""}, p)
    r = {"fit": 4.6, "core": [], "required_years": 4, "level": "senior"}
    level_cap(r, p, "Senior Mechanical Engineer")
    assert r["fit"] == 4.6
    p2 = plan({**base, "exp": "3–5 שנים", "scope": ["משרה מלאה", PART]})
    assert {"mid", "student"} <= set(p2["levels"]) and p2["student_positions"]
    assert not too_senior({"title": "Senior Mechanical Engineer", "description": ""}, p2)
    p3 = plan({**base, "exp": "אין עדיין", "scope": ["משרה מלאה"]})
    assert "mid" not in p3["levels"] and too_senior({"title": "Senior Mechanical Engineer", "description": ""}, p3)


def test_taste_learned_from_saves_and_skips():
    """הטעם האישי: מה המשתמש שומר ועל מה מדלג, כולל סיבות דילוג. משפיע על הסדר, לא על הציון."""
    from agent_core.taste import learn, boost
    rows = [{"id": f"s{i}", "card": {"id": f"s{i}", "title": t, "co": "Acme"}, "decision": "save"}
            for i, t in enumerate(["AI Engineer", "Junior AI Developer", "LLM Engineer", "AI Agents Developer"])]
    rows += [{"id": f"k{i}", "card": {"id": f"k{i}", "title": t, "co": co}, "decision": "skip"}
             for i, (t, co) in enumerate([("QA Automation Engineer", "Foo"), ("QA Engineer", "Foo"), ("Manual QA", "Bar"), ("Frontend Developer", "Baz")])]
    skips = {"k0": {"r": "לא התחום שלי"}, "k1": {"r": "החברה", "co": "Foo"}, "k3": {"r": "מיקום", "loc": "Haifa"},
             "x": {"r": "מיקום", "loc": "Haifa, Israel"}}
    t = learn(rows, skips)
    assert "ai" in t["likes"] and "qa" in t["dislikes"] and t["avoid_cos"] == ["Foo"] and t["avoid_locs"] == ["Haifa"]
    assert boost({"title": "AI Engineer", "company": "X", "location": "TA"}, t) > 0
    assert boost({"title": "QA Engineer", "company": "Foo", "location": "Haifa"}, t) < -20
    t2 = learn(rows, skips, off=["qa", "Foo"])   # המשתמש ביטל: לא נלמד יותר
    assert "qa" not in t2["dislikes"] and "Foo" not in t2["avoid_cos"]
    # "בכירה מדי" פעמיים מחמיר את הסינון
    p = build_search_plan({"cv_text": "", "answers": {"exp": "1–2 שנים"}, "skip_reasons": {"a": "בכירה מדי", "b": "בכירה מדי"}})
    assert p.max_years == 1
