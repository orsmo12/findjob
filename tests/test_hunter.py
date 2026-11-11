"""דורון בלי רשת: נתונים מדומים ונתב מדומה."""
import sys, json, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import agent_core.agents.hunter as h

tmp = Path(tempfile.mkdtemp())
h.FEED, h.SEEN = tmp / "jobs.json", tmp / "seen.json"
PLAN = {"queries": ["Student Full Stack Developer"], "locations": ["Tel Aviv"], "levels": ["student", "intern", "junior"],
        "max_years": 1, "titles": ["Full Stack Developer"], "why": ["סטודנט"]}
CV = "Third-year CS student. Python, React, Socket.IO, OpenCV, TensorFlow."
RAW = [
    {"title": "Full Stack Developer Student", "company": "Acme", "location": "Tel Aviv", "url": "u1",
     "description": "React and Python, students welcome. " * 20, "source": "linkedin", "posted": "2026-10-30", "salary": ""},
    {"title": "Full Stack Developer Student", "company": "ACME ", "location": "Tel Aviv", "url": "u1b",
     "description": "dup", "source": "indeed", "posted": "", "salary": ""},
    {"title": "Senior Backend Engineer", "company": "Big", "location": "Tel Aviv", "url": "u2",
     "description": "8 years", "source": "indeed", "posted": "", "salary": ""},
    {"title": "Backend Developer", "company": "Mid", "location": "Tel Aviv", "url": "u3",
     "description": "Requires 4+ years of Python", "source": "indeed", "posted": "", "salary": ""},
    {"title": "Junior Developer", "company": "Stretch", "location": "Tel Aviv", "url": "u5",
     "description": "2+ years of Python", "source": "indeed", "posted": "", "salary": ""},
    {"title": "QA Tester", "company": "Low", "location": "Tel Aviv", "url": "u4",
     "description": "", "source": "google", "posted": "", "salary": ""},
]


def fake_chat(agent, task, messages, **kw):
    txt = messages[0]["content"]
    if "Acme" in txt:
        return '{"fit": 4.6, "reasons": ["React ו-Python מופיעים בקורות החיים"], "gaps": ["TypeScript"], "seniority_ok": true}'
    return '{"fit": 2.1, "reasons": [], "gaps": ["תחום אחר"], "seniority_ok": true}'


def test_salary_only_when_published():
    assert h.salary_text({"min_amount": float("nan"), "max_amount": float("nan")}) == ""
    assert h.salary_text({"min_amount": 15000, "max_amount": 20000, "currency": "ILS", "interval": "monthly"}) == "₪15,000–20,000 לחודש"


def test_pipeline_dedupes_filters_rates_and_writes_feed():
    h.chat = fake_chat
    feed = h.run({"cv_text": CV}, PLAN, raw=[dict(j) for j in RAW])
    s = feed["stats"]
    assert s["collected"] == 5                      # הכפילות של Acme אוחדה; "2+ שנים" עובר כמתיחה
    assert s["too_senior"] == 2                     # Senior בכותרת + דרישה ל-4 שנים
    assert [j["co"] for j in feed["jobs"]] == ["Acme"]   # QA קיבל 2.1 ולא מוצג
    card = feed["jobs"][0]
    assert card["salary"] == "" and card["partial"] is False and card["src"] == "LinkedIn"
    assert json.loads(h.FEED.read_text())["jobs"][0]["fit"] == 4.6


def test_seen_jobs_not_shown_twice():
    h.chat = fake_chat
    feed = h.run({"cv_text": CV}, PLAN, raw=[dict(j) for j in RAW])
    assert feed["jobs"] == [] and feed["stats"]["already_seen"] == 1


def test_bad_model_output_is_ignored():
    assert h.parse_rating("no json here") is None
    r = h.parse_rating('{"fit": 9, "reasons": ["a","b","c","d"], "gaps": []}')
    assert r["fit"] == 5.0 and len(r["reasons"]) == 3


def test_partial_rating_claims_no_gaps():
    h.chat = lambda *a, **k: '{"fit": 4.0, "reasons": ["React"], "gaps": ["Node.js"], "seniority_ok": true}'
    r = h.rate({"title": "Dev", "company": "X", "location": "TA", "description": ""}, CV, "")
    assert r["partial"] is True and r["gaps"] == []


def test_html_text():
    assert h._html_text("<p>Hi&amp;bye</p><ul><li>Python</li></ul>") == "Hi&bye\n• Python"


def test_tags_only_when_in_ad_and_cv():
    assert h.tags_for("We use Python, React and Kotlin", "Python React Java") == ["Python", "React"]
    assert h.tags_for("C++ and C#", "C") == []


def test_reasons_must_come_from_cv():
    cv = "Third-year CS student at HIT. Python, React."
    assert h.grounded(["סטודנט ב-Bar-Ilan", "ניסיון ב-Python ו-React", "סטודנט שנה ג׳"], cv) == ["ניסיון ב-Python ו-React", "סטודנט שנה ג׳"]


def test_rank_fix_v2():
    from agent_core.agents import hunter as H
    # השוואה סלחנית: רבים, .js, רישיות
    assert H.grounded(["פרויקט עם LLMs ו-React.js"], "Built an llm agent in react") == ["פרויקט עם LLMs ו-React.js"]
    assert H.grounded(["ניסיון ב-Kubernetes"], "python react") == []
    # שנות ניסיון שה-AI קרא נאכפות בקוד
    assert H.years_too_many(3, {"max_years": 1}) and not H.years_too_many(2, {"max_years": 1})
    assert not H.years_too_many(5, {"max_years": None})
    # משרה בלי מודעה מלאה לא מדורגת לפי כותרת
    calls = []
    oe, orr, ol = H.enrich, H.rate, H.act.log
    H.enrich = lambda j, *a, **k: j
    H.rate = lambda *a, **k: calls.append(1)
    H.act.log = lambda *a, **k: None
    jobs = [{"id": "x", "title": "Junior Backend Developer", "company": "Minute", "location": "TA", "url": "https://www.linkedin.com/jobs/view/1",
             "description": "", "source": "linkedin", "posted": "", "salary": ""}]
    feed = H.run({"cv_text": "python"}, {"titles": [], "levels": ["junior"], "max_years": 1}, raw=jobs, seen=set(), persist=False)
    H.enrich, H.rate, H.act.log = oe, orr, ol
    assert feed["jobs"] == [] and feed["stats"]["no_desc"] == 1 and not calls
    print("ok rank v2")


def test_years_not_company_age():
    from agent_core.agents import hunter as H
    assert H.years_required("For over 50 years, organizations have trusted SAP") == []
    assert H.years_required("With over 20 years of experience in data collection") == []
    assert H.years_required("at least 1.5 years left to complete your degree") == []
    assert H.years_required("Requirements: 4+ years of Full-Stack experience") == [4]
    assert H.years_required("Requires 4+ years of Python") == [4]


def test_computed_fit():
    from agent_core.agents import hunter as H
    r = {"fit": 2.5, "core": [{"req": "Python", "met": True}, {"req": "LLM APIs", "met": True}, {"req": "React", "met": True},
                              {"req": "AWS Bedrock", "met": False}], "nice_missing": 3}
    assert H.computed_fit(r) == 3.7
    assert H.computed_fit({**r, "wrong_field": True}) == 2.0
    assert H.computed_fit({"fit": 3.3, "core": []}) == 3.3


def _r(core, years=0, level="junior", fit=4.8):
    from agent_core.agents.hunter import computed_fit
    r = {"fit": fit, "core": core, "required_years": years, "level": level, "nice_missing": 0}
    r["fit"] = computed_fit(r)
    return r


def test_calibration_experience_caps_score():
    """כיול: משרות שדורשות ניסיון בעבודה לא מקבלות ציון גבוה רק בגלל שהכישורים מתאימים מפרויקטים."""
    from agent_core.agents.hunter import level_cap
    student = {"levels": ["student", "junior"], "max_years": 1, "have_years": 0}
    S = lambda req, key=False: {"req": req, "kind": "skill", "key": key, "met": True}
    skills = [S("Python", True), S("SQL"), S("REST APIs")]
    # 1. משרת סטודנט, כל הכישורים: גבוה
    r = _r(skills, level="student"); level_cap(r, student, "Software Engineer Student"); assert r["fit"] == 5.0 and r["dims"]["level"] == "ok"
    # 2. אותם כישורים, "ניסיון מוכח כמפתח Backend" בלי מספר: תקרה
    r = _r(skills + [{"req": "proven experience as backend developer", "kind": "work", "met": False}])
    assert r["fit"] == 5.0   # ממד הכישורים לבד לא נפגע
    level_cap(r, student, "Backend Developer"); assert r["fit"] == 3.6 and r["level_gap"] == "work"
    # 3. דורשת שנה (יש 0): פער קל
    r = _r(skills, years=1); level_cap(r, student, "Backend Developer"); assert r["fit"] == 3.8
    # 4. דורשת 2 שנים: מתחת לסף ההצגה
    r = _r(skills, years=2); level_cap(r, student, "Backend Developer"); assert r["fit"] < 3.5
    # 5. נכתבה ל-mid, בלי מספר שנים
    r = _r(skills, level="mid"); level_cap(r, student, "Software Engineer"); assert r["fit"] == 3.3
    # 6. כותרת ג׳וניור עם דרישת "ניסיון בעבודה": לא נענשת על זה
    r = _r(skills + [{"req": "industry experience", "kind": "work", "met": False}]); level_cap(r, student, "Junior Developer"); assert r["fit"] == 5.0
    # 7. מפתח עם 3 שנים, משרה ל-mid: בלי תקרה
    r = _r(skills, years=3, level="mid"); level_cap(r, {"levels": ["junior", "mid"], "max_years": 5, "have_years": 3}, "Backend Developer"); assert r["fit"] == 5.0


def test_key_requirements_weigh_double():
    r = _r([{"req": "Python", "kind": "skill", "key": True, "met": False}, {"req": "Git", "kind": "skill", "met": True},
            {"req": "Docker", "kind": "skill", "met": True}])
    assert r["fit"] == 3.0   # חסרה דרישה מרכזית: 2 מתוך 4 משקלות, לא 2 מתוך 3 (3.7)


def test_few_skill_items_blend_with_model():
    """מהכיול: משרה עם דרישת כישורים אחת שלא סומנה ירדה ל-1.0. עם מעט דרישות משקללים עם המודל."""
    from agent_core.agents.hunter import level_cap
    r = _r([{"req": "C++", "kind": "skill", "met": False}, {"req": "industry experience", "kind": "work", "met": False}], fit=4.7)
    assert 3.0 < r["fit"] < 4.0
    level_cap(r, {"levels": ["junior"], "max_years": 1, "have_years": 0}, "Software Engineer")
    assert r["fit"] <= 3.6


def test_thin_results_topped_up_with_near_misses():
    """מהבדיקה מקצה לקצה: מכונות, 25 דורגו → 4 הוצגו. פחות מ-6 עוברות → משלימים מהקרובות לסף (3.0+), עם תגית."""
    from agent_core.agents import hunter as H
    fits = iter([4.4, 3.4, 3.2, 2.5, 3.1])
    oe, orr, ol, ofa, otc = H.enrich, H.rate, H.act.log, H.has_full_ad, H.to_card
    H.enrich = lambda j, *a, **k: j
    H.has_full_ad = lambda j: True
    H.rate = lambda *a, **k: {"fit": next(fits), "core": [], "required_years": 0, "reasons": [], "gaps": [], "partial": False}
    H.to_card = lambda j, r, cv: {"id": j["id"], "fit": r["fit"], "tags": []}
    H.act.log = lambda *a, **k: None
    jobs = [{"id": f"j{i}", "title": f"Mechanical Engineer {i}", "company": f"Co{i}", "location": "TA", "url": f"https://x/{i}",
             "description": "x" * 900, "source": "linkedin", "posted": "", "salary": ""} for i in range(5)]
    try:
        feed = H.run({"cv_text": "solidworks"}, {"titles": [], "levels": ["junior"], "max_years": 1, "domains": ["הנדסת מכונות"]}, raw=jobs, seen=set(), persist=False)
    finally:
        H.enrich, H.rate, H.act.log, H.has_full_ad, H.to_card = oe, orr, ol, ofa, otc
    got = {c["fit"]: c for c in feed["jobs"]}
    assert set(got) == {4.4, 3.4, 3.2, 3.1}          # 4.4 עברה, 3.4/3.2/3.1 השלמה, 2.5 לא
    assert got[3.4].get("near") and "התאמה חלקית" in got[3.4]["tags"] and not got[4.4].get("near")
    assert [x["fit"] for x in feed["rejected"]] == [2.5]


def test_off_field_titles_skip_rating():
    """מגלעד: 40 דורגו, רובן 1.0–2.0 (תחום אחר). כותרת שבבירור מתחום אחר לא נשלחת לדירוג. תחום מותאם: לא מסננים."""
    from agent_core.agents.hunter import off_field
    mech = {"domains": ["הנדסת מכונות"], "titles": ["Mechanical Engineer"]}
    sw = {"domains": ["פיתוח תוכנה"], "titles": ["Backend Developer"]}
    assert off_field({"title": "Frontend Developer"}, mech) and off_field({"title": "Account Executive"}, sw)
    assert not off_field({"title": "Junior Mechanical Planning Engineer"}, mech)
    assert not off_field({"title": "Process Engineer"}, mech) and not off_field({"title": "R&D Engineer"}, sw)
    assert not off_field({"title": "Frontend Developer"}, {"domains": ["הנדסת מכונות", "פיתוח תוכנה"]})
    assert not off_field({"title": "Sales Engineer"}, {"domains": ["שיווק דיגיטלי"]})
