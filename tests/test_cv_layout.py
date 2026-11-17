"""קריאת קורות חיים לפי מיקום (XY-cut ב-app4.js): פריסות שונות, בלי תלות בקובץ אחד.
כל שורה = פריט עם x, y (y גדל למעלה כמו ב-PDF) ורוחב לפי מספר התווים. רץ ב-node; בלי node מדלג."""
import json, shutil, subprocess
from pathlib import Path
SRC = (Path(__file__).resolve().parents[1] / "prototype" / "src" / "app4.js").read_text(encoding="utf-8")
CODE = SRC[SRC.index("const CV_HEB="):SRC.index("/* קריאת קורות חיים בדפדפן:")]
TOP = 800

def col(x, lines, y0=TOP, step=16, cw=5):
    return [{"s": t, "x": x, "y": y0 - i * step, "w": len(t) * cw, "h": 10} for i, t in enumerate(lines)]

def run(items):
    if not shutil.which("node"):
        return None
    js = CODE + "\nconst I=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify({t:cvLines(I),m:cvMixed(cvLines(I))}))"
    r = subprocess.run(["node", "-e", js], input=json.dumps(items), capture_output=True, text=True, timeout=20)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)

MAIN = ["Experience", "Software Engineer, Acme 2021-2024", "Built APIs in Python and Go", "Education", "B.Sc. in Computer Science, HIT 2020-2024"]
SIDE = ["Skills", "Python, Java, React", "Docker, AWS", "Languages", "Hebrew, English"]
HEAD = col(50, ["Dana Levi", "dana@example.com | Tel Aviv"], y0=860, step=18)

def order_ok(text, *blocks):
    lines = [l for l in text.split("\n") if l.strip()]
    for b in blocks:
        i = lines.index(b[0])
        assert lines[i:i + len(b)] == b, (b, lines)

def check(items, *blocks, mixed=False):
    r = run(items)
    if r is None:
        return
    order_ok(r["t"], *blocks)
    assert r["m"] == mixed

def test_one_column_unchanged():
    check(HEAD + col(50, MAIN + SIDE, y0=TOP), MAIN + SIDE)

def test_sidebar_left():
    check(HEAD + col(50, SIDE) + col(230, MAIN), SIDE, MAIN)

def test_sidebar_right():
    check(HEAD + col(50, MAIN) + col(400, SIDE), MAIN, SIDE)

def test_columns_not_aligned():
    check(col(50, MAIN, step=17) + col(330, SIDE, step=13), MAIN, SIDE)

def test_three_columns():
    check(HEAD + col(40, MAIN[:3]) + col(220, MAIN[3:]) + col(430, SIDE), MAIN[:3], MAIN[3:], SIDE)

def test_dates_on_the_side_stay_on_the_line():
    """תאריכים מיושרים לצד הם לא עמודה: נשארים באותה שורה עם התפקיד."""
    it = []
    for i, (role, d) in enumerate([("Software Engineer, Acme Corp", "Jan 2021 - Present, Tel Aviv"), ("B.Sc. in Computer Science, HIT", "2020 - 2024, Holon"), ("Teaching Assistant, HIT", "2023 - 2024")]):
        y = TOP - i * 40
        it += [{"s": role, "x": 50, "y": y, "w": 150, "h": 10}, {"s": d, "x": 545 - len(d) * 5, "y": y, "w": len(d) * 5, "h": 10},
               {"s": "- Built features in Python and React", "x": 60, "y": y - 14, "w": 180, "h": 10}]
    r = run(it)
    if r:
        assert "B.Sc. in Computer Science, HIT 2020 - 2024, Holon" in r["t"], r["t"]

def test_hebrew_reads_right_column_first():
    main = ["ניסיון", "מפתח תוכנה באקמה 2021-2024", "השכלה", "תואר ראשון במדעי המחשב"]
    side = ["כישורים", "Python, React", "שפות", "עברית, אנגלית"]
    check(col(330, main) + col(50, side), main, side)

def test_mixed_flag():
    r = run(col(50, ["Experience Skills", "Python"]) )
    if r:
        assert r["m"] is True


def _order(lines, order):
    if not shutil.which("node"):
        return "skip"
    js = CODE + "\n" + SRC[SRC.index("function cvApplyOrder("):SRC.index("async function cvFix(")] + \
        "\nconst I=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(cvApplyOrder(I[0],I[1])))"
    r = subprocess.run(["node", "-e", js], input=json.dumps([lines, order]), capture_output=True, text=True, timeout=20)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def test_ai_order_only_reorders_our_lines():
    """סידור מה-AI: רק סדר שלם של השורות שלנו מתקבל. שורה חסרה, כפולה או מספר לא חוקי = נשארים עם הקריאה שלנו."""
    L = ["Skills", "Experience", "Python", "Engineer at Acme"]
    if _order(L, [0, 1]) == "skip":
        return
    assert _order(L, [1, 3, 0, 2]) == "Experience\nEngineer at Acme\nSkills\nPython"
    for bad in ([1, 3, 0], [1, 1, 0, 2], [1, 3, 0, 9], [1, 3, 0, "2"], None, [0.5, 1, 2, 3]):
        assert _order(L, bad) is None, bad


def test_force_cuts_aligned_columns():
    """ניסיון שני כשנשאר ערבוב: עמודות מקבילות שורה-שורה נחתכות בכל זאת."""
    if not shutil.which("node"):
        return
    a = col(50, ["Built APIs in Python", "Led a team of 4", "Wrote tests in Jest"])
    b = col(330, ["Python, Go", "Docker, AWS", "Hebrew, English"])
    js = CODE + "\nconst I=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify([cvLines(I),cvLines(I,true)]))"
    r = json.loads(subprocess.run(["node", "-e", js], input=json.dumps(a + b), capture_output=True, text=True, timeout=20).stdout)
    assert "Built APIs in Python Python, Go" in r[0]          # בלי force: שורה-שורה (כמו תאריכים בצד)
    order_ok(r[1], ["Built APIs in Python", "Led a team of 4", "Wrote tests in Jest"], ["Python, Go", "Docker, AWS", "Hebrew, English"])
