"""
budget_guard.py — שומר תקציב אמיתי למכסה החינמית של Groq.

במקום להעריך, הוא קורא את מה ש-Groq מחזיר בכל תשובה:
  x-ratelimit-remaining-requests / x-ratelimit-reset-requests   (מכסה יומית)
  x-ratelimit-remaining-tokens   / x-ratelimit-reset-tokens     (מכסה לדקה)
  retry-after (בשגיאת 429)
המגבלות של Groq נספרות לכל מודל בנפרד, ולכן גם המעקב כאן הוא לכל מודל.
אין כרטיס אשראי בחשבון, כך שאין חיוב: כשנגמר, הנתב פשוט עובר מודל או דוחה.
"""

from __future__ import annotations
import json
import re
import time
from datetime import date
from pathlib import Path

STATE_FILE = Path(__file__).parent.parent / "memory" / "llm_budget.json"
_BASE = STATE_FILE


def set_scope(name: str) -> None:
    """מעקב מכסה נפרד לכל מפתח (shared = המפתח המשותף)."""
    global STATE_FILE
    STATE_FILE = _BASE if name == "shared" else _BASE.with_name(f"llm_budget_{name}.json")
# משאירים מרווח קטן כדי לא להיתקע באמצע משימה
MIN_REQUESTS_LEFT = 3
MIN_TOKENS_LEFT = 1500


class BudgetDeferred(Exception):
    """כל המודלים בשכבה הגיעו לגבול. המשימה תרוץ בפעם הבאה."""


def parse_reset(value: str | None) -> float:
    """'2m59.56s' / '7.66s' / '1h2m3s' / '450ms' -> שניות."""
    if not value:
        return 0.0
    value = str(value).strip()
    try:
        return float(value)
    except ValueError:
        pass
    total = 0.0
    for num, unit in re.findall(r"([\d.]+)(ms|h|m|s)", value):
        n = float(num)
        total += {"h": 3600, "m": 60, "s": 1, "ms": 0.001}[unit] * n
    return total


def _load() -> dict:
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    if data.get("date") != date.today().isoformat():
        # יום חדש: שומרים את מצב המודלים (המכסה שלהם מתאפסת לפי reset), מאפסים את השימוש היומי
        data = {"date": date.today().isoformat(), "models": data.get("models", {}), "usage": {}}
    data.setdefault("models", {})
    data.setdefault("usage", {})
    return data


def _save(data: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def is_available(model: str, now: float | None = None) -> bool:
    now = now or time.time()
    m = _load()["models"].get(model)
    if not m:
        return True
    if m.get("blocked_until", 0) > now:
        return False
    if m.get("req_left") is not None and m["req_left"] < MIN_REQUESTS_LEFT and m.get("req_reset_at", 0) > now:
        return False
    if m.get("tok_left") is not None and m["tok_left"] < MIN_TOKENS_LEFT and m.get("tok_reset_at", 0) > now:
        return False
    return True


def wait_hint(model: str, now: float | None = None) -> float:
    """כמה שניות עד שהמודל יחזור להיות זמין (0 אם זמין)."""
    now = now or time.time()
    m = _load()["models"].get(model, {})
    times = [t for t in (m.get("blocked_until", 0), m.get("tok_reset_at", 0), m.get("req_reset_at", 0)) if t > now]
    return max(0.0, min(times) - now) if times and not is_available(model, now) else 0.0


def record(model: str, agent: str, task: str, tokens: int, headers: dict | None = None) -> None:
    """נרשם אחרי כל קריאה מוצלחת."""
    data = _load()
    now = time.time()
    m = data["models"].setdefault(model, {})
    h = {k.lower(): v for k, v in (headers or {}).items()}
    if "x-ratelimit-remaining-requests" in h:
        m["req_left"] = int(float(h["x-ratelimit-remaining-requests"]))
        m["req_reset_at"] = now + parse_reset(h.get("x-ratelimit-reset-requests"))
    if "x-ratelimit-remaining-tokens" in h:
        m["tok_left"] = int(float(h["x-ratelimit-remaining-tokens"]))
        m["tok_reset_at"] = now + parse_reset(h.get("x-ratelimit-reset-tokens"))
    m.pop("blocked_until", None)
    u = data["usage"].setdefault(agent, {"calls": 0, "tokens": 0, "tasks": {}})
    u["calls"] += 1
    u["tokens"] += int(tokens or 0)
    u["tasks"][task] = u["tasks"].get(task, 0) + 1
    _save(data)


def block(model: str, seconds: float) -> None:
    """נקרא בשגיאת 429: המודל לא בשימוש עד שיעבור הזמן."""
    data = _load()
    data["models"].setdefault(model, {})["blocked_until"] = time.time() + max(5.0, seconds)
    _save(data)


def get_report() -> dict:
    """לנקודת הקצה /budget/report ולמסך ההגדרות (בלי מספרים טכניים למשתמש)."""
    data = _load()
    now = time.time()
    models = {k: {"available": is_available(k, now),
                  "requests_left": v.get("req_left"), "tokens_left_this_minute": v.get("tok_left")}
              for k, v in data["models"].items()}
    usage = data["usage"]
    return {
        "date": data["date"],
        "tokens_used": sum(u["tokens"] for u in usage.values()),
        "calls_today": sum(u["calls"] for u in usage.values()),
        "by_agent": {k: u["tokens"] for k, u in usage.items()},
        "models": models,
        "status": "ok" if any(m["available"] for m in models.values()) or not models else "resting",
    }


# ── תאימות לאחור (api.py ומודולים ישנים) ───────────────────────────────────────
def check_budget(estimated_tokens: int = 1000, agent: str = "") -> bool:
    return True  # ההחלטה האמיתית מתקבלת בנתב לפי המכסה שנשארה


def log_usage(tokens_used: int, agent: str = "unknown", task: str = "") -> None:
    record("unknown", agent, task, tokens_used)


# ── שמירת מצב המכסה בין ריצות (Supabase) ──────────────────────────────────────
# כל ריצה ב-GitHub Actions מתחילה על מחשב נקי. בלי זה, ריצת המכתבים לא יודעת שהסריקה כבר ניצלה את המכסה.
def snapshot() -> dict:
    """כל קבצי המכסה של היום (שם מקוצר של המפתח בלבד, אף פעם לא המפתח עצמו)."""
    out = {}
    for f in _BASE.parent.glob("llm_budget*.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if d.get("date") == date.today().isoformat():
            out[f.name] = d
    return out


def restore(files: dict) -> None:
    for name, d in (files or {}).items():
        if re.fullmatch(r"llm_budget(_[0-9a-f]{10})?\.json", name) and d.get("date") == date.today().isoformat():
            p = _BASE.with_name(name)
            if not p.exists():
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


def quota_note(agent: str) -> str:
    """ההודעה למשתמש כשהמכסה נגמרה באמצע עבודה."""
    return "הגעתי לגבול מכסת ה-AI להיום. הכנתי חלק, והשאר יוכן בריצה הבאה."
