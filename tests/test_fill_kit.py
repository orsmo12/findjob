"""סבב 7: הסימנייה ממלאת ולא שולחת לעולם. בדיקה סטטית של הקוד שלה."""
from pathlib import Path
SRC = (Path(__file__).resolve().parents[1] / "prototype" / "src" / "app3.js").read_text(encoding="utf-8")
BM = SRC[SRC.index("function fillBookmarklet("):SRC.index("function openFillHelp(")]


def test_bookmarklet_never_submits():
    for bad in (".submit(", "requestSubmit", ".click()", "fetch(", "XMLHttpRequest", "sendBeacon", "location.href="):
        assert bad not in BM, bad


def test_bookmarklet_marks_uncertain_yellow():
    assert "#E9A825" in BM and "type==='file'" in BM
