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


_key: str | None = None

# ── ספקים: מפתח אישי יכול להיות של Groq, Google Gemini, Anthropic (Claude) או OpenAI ──
# כולם דרך ממשק תואם OpenAI (chat/completions), בלי ספריות נוספות. המפתח המשותף תמיד Groq.
# המודל נבחר מהרשימה החיה של הספק (מודלים מתחלפים), לפי דפוסים: קל = הזול והמהיר, שופט/כותב = האיכותי.
PROVIDERS = {
    "gemini": {"base": "https://generativelanguage.googleapis.com/v1beta/openai", "name": "Google Gemini",
               "light": [r"flash-lite", r"flash"], "judge": [r"flash(?!-lite)", r"flash"], "temp": True, "json": False,
               "extra": {"reasoning_effort": "low"}, "fallback": {"light": ["gemini-2.5-flash-lite"], "judge": ["gemini-2.5-flash"]}},
    "anthropic": {"base": "https://api.anthropic.com/v1", "name": "Claude",
                  "light": [r"haiku"], "judge": [r"sonnet", r"haiku"], "temp": False, "json": False, "extra": {},
                  "fallback": {"light": ["claude-haiku-4-5"], "judge": ["claude-sonnet-4-5"]}},
    "openai": {"base": "https://api.openai.com/v1", "name": "OpenAI",
               "light": [r"^gpt-[\d.]+-nano$", r"^gpt-[\d.]+-mini$", r"^gpt-4o-mini$"], "judge": [r"^gpt-[\d.]+-mini$", r"^gpt-4o$"],
               "temp": False, "json": True, "extra": {"reasoning_effort": "low"}, "max_param": "max_completion_tokens",
               "fallback": {"light": ["gpt-5-nano"], "judge": ["gpt-5-mini"]}},
}
_NOT_CHAT = ("image", "tts", "audio", "live", "embed", "vision", "realtime", "search", "transcribe", "codex", "computer", "dall", "whisper", "moderation")


def provider_of(key: str | None) -> str:
    """זיהוי הספק לפי תחילת המפתח."""
    k = (key or "").strip()
    if k.startswith("gsk_"):
        return "groq"
    if k.startswith("AIza"):
        return "gemini"
    if k.startswith("sk-ant-"):
        return "anthropic"
    if k.startswith("sk-"):
        return "openai"
    return ""


def valid_key(key: str | None) -> str | None:
    """מפתח אישי תקין (בצורה) של אחד הספקים, אחרת None."""
    k = clean_key(key or "")
    return k if provider_of(k) and len(k) > 30 else None


def use_key(key: str | None) -> None:
    """מפתח Groq אישי של משתמש (או None = המפתח המשותף). לכל מפתח מכסה משלו, אז גם מעקב המכסה נפרד."""
    global _groq, _live, _key
    import hashlib
    k = clean_key(key or "") or None
    if k == _key and _groq is not None:
        return
    _key, _groq, _live = k, None, None
    bg.set_scope(hashlib.sha1(k.encode()).hexdigest()[:10] if k else "shared")


def using_own_key() -> bool:
    return bool(_key)


def _provider() -> str:
    return provider_of(_key) if _key else "groq"


def _compat_headers(prov: str) -> dict:
    if prov == "anthropic":   # Anthropic: מפתח בכותרת x-api-key (לא Bearer)
        return {"x-api-key": _key or "", "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
    return {"Authorization": "Bearer " + (_key or ""), "Content-Type": "application/json"}


def _compat_models(tier: str) -> list[str]:
    """המודלים החיים אצל הספק, לפי דפוסי השכבה. הכי חדש קודם."""
    import re
    import httpx
    global _live
    prov, cfg = _provider(), PROVIDERS[_provider()]
    if _live is None:
        try:
            r = httpx.get(cfg["base"] + "/models", headers=_compat_headers(prov), timeout=20)
            data = r.json().get("data") or r.json().get("models") or []
            _live = [str(m.get("id") or m.get("name") or "").replace("models/", "") for m in data]
            _live = [m for m in _live if m and not any(x in m for x in _NOT_CHAT)]
        except Exception:  # noqa: BLE001
            _live = []
    key = "light" if tier == "light" else "judge"
    ver = lambda m: ([int(x) for x in re.findall(r"\d+", m)] + [0, 0, 0])[:3]
    out = []
    for pat in cfg[key]:
        hits = [m for m in _live if re.search(pat, m) and m not in out]
        hits.sort(key=lambda m: ("preview" in m or "exp" in m, [-v for v in ver(m)]))
        out += hits[:2]
    return (out or cfg["fallback"][key])[:3]


def _compat_call(model, messages, temperature, max_tokens, json_mode):
    """קריאה לספק שאינו Groq, בממשק התואם. מחזיר (טקסט, טוקנים, כותרות)."""
    import httpx
    prov = _provider(); cfg = PROVIDERS[prov]
    body = {"model": model, "messages": messages, cfg.get("max_param", "max_tokens"): max_tokens}
    if cfg["temp"]:
        body["temperature"] = temperature
    if json_mode and cfg["json"]:
        body["response_format"] = {"type": "json_object"}
    body.update(cfg["extra"])
    r = httpx.post(cfg["base"] + "/chat/completions", headers=_compat_headers(prov), json=body, timeout=120)
    if r.status_code == 400 and "reasoning" in r.text.lower() and cfg["extra"]:
        body = {k: v for k, v in body.items() if k not in cfg["extra"]}
        r = httpx.post(cfg["base"] + "/chat/completions", headers=_compat_headers(prov), json=body, timeout=120)
    if r.status_code >= 400:
        err = RuntimeError(f"{prov} {r.status_code}: {r.text[:200]}")
        err.status_code = r.status_code   # type: ignore[attr-defined]
        err.response = r                  # type: ignore[attr-defined]
        raise err
    d = r.json()
    text = (((d.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
    return text, (d.get("usage") or {}).get("total_tokens", 0) or 0, dict(r.headers)


def _groq_client():
    global _groq
    if _groq is None:
        from groq import Groq
        key = _key or clean_key(os.environ.get("GROQ_API_KEY"), "GROQ_API_KEY")
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
    if _provider() != "groq":
        return _compat_models(tier)
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
    prov = _provider()
    for model in _models_for(tier):
        if not bg.is_available(model):
            tried.append(f"{model}: בגבול")
            continue
        if prov != "groq":   # מפתח אישי של Gemini / Claude / OpenAI
            try:
                text, tokens, headers = _compat_call(model, messages, temperature, max_tokens, json_mode)
                bg.record(model, agent, task, tokens, headers)
                if text.strip():
                    return _strip_think(text)
                tried.append(f"{model}: ריק")
            except Exception as err:  # noqa: BLE001
                if _is_rate_limit(err):
                    bg.block(model, _retry_after(err))
                    tried.append(f"{model}: 429")
                else:
                    tried.append(f"{model}: {str(err)[:160]}")
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
    if prov != "groq" and os.environ.get("GROQ_API_KEY"):
        # המפתח האישי לא עבד (נגמר הקרדיט, מפתח שבוטל): לא משאירים את המשתמש בלי כלום — המפתח המשותף לקריאה הזו
        own = _key
        use_key(None)
        try:
            return _chat_once(agent, task, messages, tier, max_tokens, temperature, json_mode)
        finally:
            use_key(own)
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
