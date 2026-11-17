"""קיצור מודעה לפני הדירוג (hunter.ad_core): נשמטים "על החברה", הטבות והצהרות משפטיות; הדרישות נשארות תמיד."""
from agent_core.agents import hunter as h

REQ = "Requirements:\n- 3+ years of Python\n- Experience with AWS and Docker\n- B.Sc. in Computer Science\nNice to have:\n- Kubernetes\n"
ROLE = "About the role\nYou will build backend services for our payments platform, working with product and data teams every day.\n"
ABOUT = "About Acme\nAcme is a fast growing company with offices in 12 countries and a great culture of learning.\n" * 3
BEN = "What we offer\n- Free lunch\n- Gym\n- Stock options\n"
EEO = "Acme is an equal opportunity employer and considers all applicants without regard to race, religion or gender."


def test_drops_about_benefits_eeo_keeps_role_and_requirements():
    ad = ABOUT + ROLE + REQ + BEN + EEO
    c = h.ad_core(ad)
    for keep in ("About the role", "backend services", "3+ years of Python", "Kubernetes"):
        assert keep in c, keep
    for drop in ("fast growing", "Free lunch", "equal opportunity"):
        assert drop not in c, drop
    assert len(c) < len(ad)


def test_requirements_after_a_long_about_survive_the_cut():
    """מודעה ארוכה: בלי הקיצור הדרישות בסוף נחתכות ב-3500 תווים."""
    ad = ABOUT * 20 + ROLE + REQ
    assert "B.Sc." not in ad[:3500] and "B.Sc." in h.ad_core(ad)[:3500]


def test_hebrew_sections():
    ad = "על החברה\nחברה מובילה בתחום עם מאות עובדים ואווירה מעולה.\n" * 3 + "תיאור התפקיד\n" + "פיתוח צד שרת בפייתון, עבודה עם צוותי מוצר ונתונים לאורך כל הפיתוח.\n" * 3 + "דרישות:\n- שנתיים ניסיון ב-Python\n- היכרות עם SQL\n" + "הטבות\n- ארוחות\n"
    c = h.ad_core(ad)
    assert "שנתיים ניסיון" in c and "חברה מובילה" not in c and "ארוחות" not in c


def test_falls_back_when_too_little_left():
    ad = ABOUT + "Requirements: Python."
    assert h.ad_core(ad) == ad


def test_no_headings_unchanged():
    ad = "We are looking for a backend developer with Python and AWS experience to join the platform group. " * 5
    assert h.ad_core(ad) == ad


def test_switch_off_by_default():
    assert h.AD_CORE is False
