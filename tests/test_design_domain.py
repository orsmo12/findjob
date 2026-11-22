"""22.11: תחום עיצוב. הכותרות מהרצה היבשה (domain_dry.yml) על משרות אמיתיות."""
from agent_core.agents import hunter as h
from agent_core import profile as P

PLAN = {"domains": ["עיצוב UI/UX וגרפי"], "titles": ["Product Designer", "UI/UX Designer"]}
SW = {"domains": ["פיתוח תוכנה"], "titles": ["Frontend Developer"]}
off = lambda t, plan=PLAN: h.off_field({"title": t}, plan)


def test_design_keeps_design_titles():
    for t in ["Product Designer", "UI Designer", "Brand Designer", "Motion Graphic Designer", "UX Researcher", "UX Writer",
              "Graphic Designer for a Leading Fashion Brand", "אינפוגרפיקאי/ת", "מעצב/ת UX UI"]:
        assert not off(t), t


def test_design_drops_other_professions_with_design_in_the_title():
    for t in ["Mechanical Designer", "Board Design Engineer, NVLINK", "Junior Mechanical Design Engineer (242268)", "Chip Design Student",
              "Front-end Developer", "Hardware Engineer", "Industrial Designer", "Games Designer", "Full-cycle B2C Sales Closer",
              "Junior QA Engineer- Manual", "Media Buyer"]:
        assert off(t), t


def test_software_users_not_hurt():
    for t in ["UI Engineer", "Frontend Developer", "UX Engineer", "Full-Stack Developer"]:
        assert not off(t, SW), t
    assert off("Product Designer", SW)   # מעצב לא מגיע למפתח


def test_domain_from_cv():
    cv = "B.Des Visual Communication. Figma, Illustrator, Photoshop, After Effects. Wireframes and prototyping."
    assert P.domain_of({"cv_text": cv}) == "עיצוב UI/UX וגרפי"
    assert P.domain_of({"cv_text": "Python, React, Node, SQL developer, Figma"}) == "פיתוח תוכנה"
