"""כניסה: Google היא הדרך הראשית, ובלי הרשאות מעבר לשם ומייל."""
from pathlib import Path
SRC = (Path(__file__).resolve().parents[1] / "prototype" / "src" / "cloud.js").read_text(encoding="utf-8")

def test_google_login_present():
    assert "signInWithOAuth({provider:'google'" in SRC
    assert 'id="googleBtn"' in SRC

def test_google_login_no_extra_scopes():
    # רק פרופיל בסיסי: אסור לבקש גישה ל-Gmail, ליומן או ל-Drive
    for bad in ("scopes:", "gmail", "calendar", "drive"):
        assert bad not in SRC.split("async function cloudGoogle")[1].split("}\n")[0].lower(), bad

def test_email_link_kept_as_fallback():
    assert "signInWithOtp" in SRC
