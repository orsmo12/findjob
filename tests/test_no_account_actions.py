"""
כלל: findjob לעולם לא נכנס לחשבונות של המשתמש ולא פועל בשמם
(LinkedIn, GitHub, מייל, אתרי משרות). הסוכנים מכינים, המשתמש מאשר ועושה.

הבדיקה סורקת את קוד הסוכנים ונכשלת אם מופיעה יכולת שפועלת בחשבון:
התחברות עם cookies, שליחת מייל, פרסום/תגובה/לייק דרך API, הגשה אוטומטית.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN = [ROOT / "agent_core", ROOT / "scripts", ROOT / "scheduler.py"]
FORBIDDEN = {
    r"add_cookies\(":                "התחברות לאתר עם cookies של המשתמש",
    r"storage_state\s*=":            "שימוש ב-session שמור של המשתמש",
    r"linkedin_cookies\.json":       "קובץ cookies של LinkedIn",
    r"smtplib|sendmail\(":           "שליחת מייל בשם המשתמש",
    r"w_member_social":              "פרסום/תגובה/לייק ב-LinkedIn בשם המשתמש",
    r"api\.github\.com/user[\"'/]": "פעולה בחשבון GitHub",  # החשבון המחובר עצמו
    r"\.(post|put|patch|delete)\(\s*f?[\"']https://api\.github\.com": "כתיבה ל-GitHub",  # קריאה של ריפו ציבורי מותרת, כתיבה לא
    r"easy.?apply":                  "הגשה אוטומטית למשרה",
}


def _code_lines(path: Path):
    for n, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("#") or not stripped:
            continue
        yield n, line.split("#", 1)[0]


def test_agents_never_act_in_user_accounts():
    hits = []
    for base in SCAN:
        files = [base] if base.is_file() else base.rglob("*.py")
        for f in files:
            if "__pycache__" in f.parts or f.name == Path(__file__).name:
                continue
            for n, code in _code_lines(f):
                for pat, why in FORBIDDEN.items():
                    if re.search(pat, code, re.I):
                        hits.append(f"{f.relative_to(ROOT)}:{n} — {why}")
    assert not hits, "פעולה בחשבון המשתמש בלי אישור:\n" + "\n".join(hits)
