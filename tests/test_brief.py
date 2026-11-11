"""הסיכום היומי של שי: רק מהעובדות, ובדיקת אמת בקוד."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core import brief as B

FS = [{"k": "update", "t": "מכתבים חדשים הוכנו: Mobileye (4.6)", "go": "apps"},
      {"k": "new", "t": "13 משרות חדשות מחכות להחלטה. הבולטות: Sapiens (4.8), TheMarker (4.5)", "go": "jobs"},
      {"k": "bg", "t": "יואב: ישיבה שבועית", "go": ""}]


def test_ground_drops_invented_names_and_numbers():
    d = {"headline": "יום טוב להגיש ל-Mobileye", "items": [
        {"t": "המכתב ל-Mobileye מוכן (4.6)", "tone": "act", "go": "apps"},
        {"t": "13 משרות חדשות, הבולטת Sapiens", "tone": "new", "go": "jobs"},
        {"t": "Google פרסמה 5 משרות חדשות", "tone": "new", "go": "jobs"}]}   # מומצא
    g = B.ground(d, FS)
    assert len(g["items"]) == 2 and g["items"][0]["t"].startswith("13") and g["items"][1]["t"].startswith("המכתב") and g["headline"]
    assert all(i["tone"] != "act" for i in g["items"])   # שי לא נותן הוראות
    assert B.ground({"items": [{"t": "Google 99"}]}, FS) is None


def test_fallback_from_facts_keeps_order():
    f = B.from_facts(FS)
    assert f["items"][0]["tone"] == "new" and f["items"][-1]["tone"] == "bg"


def test_write_uses_code_when_ai_fails(monkeypatch=None):
    import agent_core.llm_router as L
    orig = L.chat
    L.chat = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("quota"))
    try:
        b, how = B.write(FS)
    finally:
        L.chat = orig
    assert how == "code" and b["items"]
