"""
budget_guard.py — שומר תקציב Groq.

מכסה יומית: 200,000 tokens/day (Groq free tier)
ClosedCircuit: עוצר ב-75% (150K) להשאיר buffer לcritical tasks

שימוש:
    from agent_core.budget_guard import check_budget, log_usage, get_report

    # לפני כל קריאה ל-LLM:
    if not check_budget(estimated_tokens=500):
        raise BudgetExhaustedError("מכסה יומית הגיעה לגבול")

    # אחרי קריאה:
    log_usage(tokens_used=450, agent="mentor", task="skill_gaps")
"""

import json
from pathlib import Path
from datetime import datetime, date

# ── Config ─────────────────────────────────────────────────────────────────────
DAILY_GROQ_LIMIT   = 200_000   # Groq free tier
SAFETY_THRESHOLD   = 0.75      # עצור ב-75% (150K)
HARD_STOP          = 0.95      # עצור הכל ב-95% (190K)
SAFETY_BUDGET      = int(DAILY_GROQ_LIMIT * SAFETY_THRESHOLD)  # 150,000
HARD_STOP_BUDGET   = int(DAILY_GROQ_LIMIT * HARD_STOP)         # 190,000

# ── Storage ────────────────────────────────────────────────────────────────────
BUDGET_DIR = Path(__file__).parent.parent / "memory"
BUDGET_DIR.mkdir(parents=True, exist_ok=True)

def _budget_file() -> Path:
    today = date.today().isoformat()
    return BUDGET_DIR / f"budget_{today}.json"


def _load_today() -> dict:
    path = _budget_file()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return {"date": date.today().isoformat(), "total_tokens": 0, "calls": []}


def _save(data: dict):
    _budget_file().write_text(json.dumps(data, ensure_ascii=False, indent=2))


# ── Public API ─────────────────────────────────────────────────────────────────

class BudgetExhaustedError(Exception):
    """נזרק כשהתקציב היומי מוצה"""
    pass


def get_tokens_used_today() -> int:
    """כמה tokens נוצלו היום"""
    return _load_today().get("total_tokens", 0)


def check_budget(estimated_tokens: int = 1000, agent: str = "") -> bool:
    """
    מחזיר True אם יש מספיק תקציב לקריאה.
    מחזיר False אם עברנו את SAFETY_BUDGET.
    זורק BudgetExhaustedError אם עברנו HARD_STOP.
    """
    used = get_tokens_used_today()

    if used + estimated_tokens > HARD_STOP_BUDGET:
        raise BudgetExhaustedError(
            f"מכסה יומית הגיעה ל-{used:,} tokens (גבול: {HARD_STOP_BUDGET:,}). "
            f"המתן למחר."
        )

    if used + estimated_tokens > SAFETY_BUDGET:
        print(f"[Budget Guard] ⚠️  {agent}: {used:,}/{SAFETY_BUDGET:,} tokens — מגבלת safety הגיעה")
        return False

    return True


def log_usage(tokens_used: int, agent: str = "unknown", task: str = ""):
    """רשום שימוש בtokens אחרי קריאה"""
    data = _load_today()
    data["total_tokens"] = data.get("total_tokens", 0) + tokens_used
    data["calls"].append({
        "time":   datetime.now().isoformat(),
        "agent":  agent,
        "task":   task,
        "tokens": tokens_used,
    })
    _save(data)
    print(f"[Budget Guard] {agent}: +{tokens_used:,} tokens | יום: {data['total_tokens']:,}/{DAILY_GROQ_LIMIT:,}")


def get_report() -> dict:
    """דוח תקציב יומי"""
    data   = _load_today()
    used   = data.get("total_tokens", 0)
    calls  = data.get("calls", [])

    # breakdown per agent
    by_agent: dict[str, int] = {}
    for c in calls:
        agent = c.get("agent", "unknown")
        by_agent[agent] = by_agent.get(agent, 0) + c.get("tokens", 0)

    return {
        "date":            data.get("date", date.today().isoformat()),
        "tokens_used":     used,
        "tokens_budget":   SAFETY_BUDGET,
        "tokens_limit":    DAILY_GROQ_LIMIT,
        "percent_used":    round(used / DAILY_GROQ_LIMIT * 100, 1),
        "calls_today":     len(calls),
        "remaining":       max(0, SAFETY_BUDGET - used),
        "status":          (
            "hard_stop" if used >= HARD_STOP_BUDGET
            else "warning" if used >= SAFETY_BUDGET
            else "ok"
        ),
        "by_agent":        by_agent,
    }


def budget_protected(agent_name: str, estimated_tokens: int = 1000):
    """
    Decorator להגנה על פונקציות שקוראות ל-Groq.

    שימוש:
        @budget_protected("mentor", estimated_tokens=800)
        def mentor_node(state): ...
    """
    def decorator(fn):
        def wrapper(*args, **kwargs):
            if not check_budget(estimated_tokens, agent=agent_name):
                print(f"[Budget Guard] דחיית {agent_name} — תקציב safety הושלם")
                return {"messages": [f"{agent_name} נדחה: תקציב יומי הגיע לסף בטיחות"]}
            result = fn(*args, **kwargs)
            # הערכת שימוש בפועל (ניתן לדייק יותר אם מחזירים token count)
            log_usage(estimated_tokens, agent=agent_name)
            return result
        return wrapper
    return decorator
