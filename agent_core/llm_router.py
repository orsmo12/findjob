"""
llm_router.py — כל קריאה ל-AI עוברת מכאן.

שכבות:
  light  — משימות קצרות (חילוץ, סיווג, שאילתות)     → מודל קטן ומהיר
  judge  — דירוג משרות, ניתוח, החלטות               → סבב בין מודלים גדולים
  write  — מכתבים, תגובות, פוסטים                   → אותם מודלים, טמפרטורה גבוהה יותר

המגבלות של Groq נספרות לכל מודל, אז כשמודל מתקרב לגבול עוברים לבא בתור.
כשכולם בגבול: BudgetDeferred, והמשימה תרוץ בריצה הבאה. Claude משמש רק אם
ENABLE_CLAUDE=1 (בתשלום, לא חלק ממנוי Claude Pro), ורק כשכבת write אחרונה.

שימוש חדש:
    from agent_core.llm_router import chat
    text = chat("hunter", "score_job", messages, tier="judge", max_tokens=400)

שימוש במודולים קיימים (תחליף ל-Groq(...)):
    _client = router_client("researcher", "judge")
    _client.chat.completions.create(model="ignored", messages=..., max_tokens=...)
"""

from __future__ import annotations
import os
from types import SimpleNamespace

from agent_core import budget_guard as bg

TIERS = {
    "light": ["llama-3.1-8b-instant", "openai/gpt-oss-20b"],
    "judge": ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "qwen/qwen3-32b"],
    "write": ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "qwen/qwen3-32b"],
}
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5")

_groq = None


def clean_key(v: str | None, name: str = "") -> str:
    """מפתח שהודבק עם רווח, ירידת שורה, מרכאות או עם 'NAME=' לפניו — מנקים. אחרת החיבור נכשל בשקט."""
    v = (v or "").strip().strip('"').strip("'").strip()
    if name and v.startswith(name + "="):
        v = v[len(name) + 1:].strip().strip('"').strip("'")
    return v


def _groq_client():
    global _groq
    if _groq is None:
        from groq import Groq
        key = clean_key(os.environ.get("GROQ_API_KEY"), "GROQ_API_KEY")
        if not key:
            raise RuntimeError("GROQ_API_KEY חסר ב-.env — הסוכנים לא מחוברים")
        _groq = Groq(api_key=key)
    return _groq


_live = None
# סדר העדפה אם הרשימה הקבועה לא זמינה: מודלים גדולים קודם, בלי מודלי קול/בטיחות
_PREFER = ("gpt-oss-120b", "llama-4", "kimi", "qwen", "llama-3.3", "gpt-oss-20b", "llama-3.1-8b")
_SKIP = ("whisper", "guard", "tts", "playai", "orpheus", "compound", "prompt-guard", "allam")


def _models_for(tier: str) -> list[str]:
    """המודלים ש-Groq באמת מציע עכשיו. מודלים יוצאים משימוש, אז לא סומכים על רשימה קבועה."""
    global _live
    if _live is None:
        try:
            _live = [m.id for m in _groq_client().models.list().data]
        except Exception:  # noqa: BLE001
            _live = []
    if not _live:
        return TIERS[tier]
    fixed = [m for m in TIERS[tier] if m in _live]
    extra = [m for m in _live if m not in fixed and not any(k in m for k in _SKIP)]
    rank = lambda m: next((i for i, k in enumerate(_PREFER) if k in m), len(_PREFER))
    extra.sort(key=rank)
    if tier != "light":
        extra = [m for m in extra if "8b" not in m and "20b" not in m] + [m for m in extra if "8b" in m or "20b" in m]
    return (fixed + extra)[:4]


def set_client(client) -> None:
    """לבדיקות: מזריקים לקוח מדומה."""
    global _groq, _live
    _groq, _live = client, []


def _is_rate_limit(err: Exception) -> bool:
    return getattr(err, "status_code", None) == 429 or "rate limit" in str(err).lower() or "429" in str(err)


def _retry_after(err: Exception) -> float:
    resp = getattr(err, "response", None)
    headers = getattr(resp, "headers", {}) or {}
    return bg.parse_reset(headers.get("retry-after") or headers.get("x-ratelimit-reset-tokens")) or 60.0


def _strip_think(text: str) -> str:
    # מודלי reasoning לפעמים מחזירים <think>...</think> לפני התשובה
    if "</think>" in text:
        text = text.split("</think>", 1)[1]
    return text.strip()


def chat(agent: str, task: str, messages: list, tier: str = "judge",
         max_tokens: int = 600, temperature: float | None = None, json_mode: bool = False,
         max_wait: float = 75.0) -> str:
    """max_wait: מגבלות הדקה של Groq מתאפסות תוך שניות — מחכים במקום לדחות למחר."""
    try:
        return _chat_once(agent, task, messages, tier, max_tokens, temperature, json_mode)
    except bg.BudgetDeferred:
        waits = [bg.wait_hint(m) for m in _models_for(tier)]
        soon = min([w for w in waits if w > 0] or [0])
        if not soon or soon > max_wait:
            raise
        import time
        time.sleep(soon + 1)
        return _chat_once(agent, task, messages, tier, max_tokens, temperature, json_mode)


def _chat_once(agent, task, messages, tier, max_tokens, temperature, json_mode) -> str:
    if temperature is None:
        temperature = {"light": 0.1, "judge": 0.2, "write": 0.6}[tier]
    tried = []
    for model in _models_for(tier):
        if not bg.is_available(model):
            tried.append(f"{model}: בגבול")
            continue
        try:
            kwargs = dict(model=model, messages=messages, temperature=temperature, max_tokens=max_tokens)
            # מודלי reasoning "חושבים" לפני התשובה ושורפים את תקציב הטוקנים — מקצרים את החשיבה
            if "gpt-oss" in model:
                kwargs["extra_body"] = {"reasoning_effort": "low"}
            elif "qwen3" in model:
                kwargs["extra_body"] = {"reasoning_effort": "none"}
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            try:
                raw = _groq_client().chat.completions.with_raw_response.create(**kwargs)
            except Exception as e:  # noqa: BLE001 — מודל שלא מכיר reasoning_effort: שוב בלי
                if "reasoning" not in str(e).lower() or "extra_body" not in kwargs:
                    raise
                kwargs.pop("extra_body")
                raw = _groq_client().chat.completions.with_raw_response.create(**kwargs)
            resp = raw.parse()
            usage = getattr(resp, "usage", None)
            bg.record(model, agent, task, getattr(usage, "total_tokens", 0) or 0, dict(raw.headers))
            return _strip_think(resp.choices[0].message.content or "")
        except Exception as err:  # noqa: BLE001 — כל כשל במודל אחד → מנסים את הבא
            if _is_rate_limit(err):
                bg.block(model, _retry_after(err))
                tried.append(f"{model}: 429")
                continue
            tried.append(f"{model}: {type(err).__name__}: {str(err)[:160]}")
            continue
    if tier == "write" and os.environ.get("ENABLE_CLAUDE") == "1" and os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        msg = anthropic.Anthropic().messages.create(model=CLAUDE_MODEL, max_tokens=max_tokens, messages=messages)
        bg.record(CLAUDE_MODEL, agent, task, msg.usage.input_tokens + msg.usage.output_tokens)
        return msg.content[0].text.strip()
    raise bg.BudgetDeferred(f"{agent}/{task}: אין מודל זמין ({'; '.join(tried)})")


class _Completions:
    def __init__(self, agent, tier):
        self.agent, self.tier = agent, tier

    def create(self, model=None, messages=None, temperature=None, max_tokens=600, response_format=None, **_):
        text = chat(self.agent, "legacy", messages or [], tier=self.tier, max_tokens=max_tokens,
                    temperature=temperature, json_mode=bool(response_format))
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


def router_client(agent: str, tier: str = "judge"):
    """תחליף שקוף ל-Groq(...) במודולים הקיימים: הפרמטר model מתעלם, הנתב בוחר."""
    return SimpleNamespace(chat=SimpleNamespace(completions=_Completions(agent, tier)))
