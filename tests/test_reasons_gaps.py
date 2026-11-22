"""22.11: "חסר" = שם הדרישה בלבד; סיבה חייבת לצטט משהו שכתוב בקורות החיים."""
from agent_core.agents import hunter as h


def test_gap_text_keeps_only_the_requirement():
    assert h.gap_text("הקודמת לא מציינת ידע בתבניות עיצוב") == "ידע בתבניות עיצוב"
    assert h.gap_text("קורות החיים לא מראים ניסיון ב-Java.") == "ניסיון ב-Java"
    assert h.gap_text("חוסר ניסיון ב-Kubernetes") == "ניסיון ב-Kubernetes"
    assert h.gap_text("ניסיון ב-Kubernetes") == "ניסיון ב-Kubernetes"   # כבר תקין: לא משתנה


def test_reason_must_cite_the_cv():
    cv = "Projects: Shuk app in Figma. Pixel Studio intern. פרויקט גמר"
    assert h.cites_cv("בפרויקט Shuk השתמשה ב-Figma", cv)
    assert h.cites_cv("פרויקט גמר באפליקציה", cv)
    assert not h.cites_cv("פורטפוליו חזק עם מותגים וקמפיינים דיגיטליים", cv)


def test_switch_on():
    assert h.CLEAN_REASONS is True
