"""בדיקות לנתב ולשומר התקציב, בלי רשת ובלי מפתח: לקוח Groq מדומה."""
import sys, time, tempfile
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent_core import budget_guard as bg, llm_router as lr

bg.STATE_FILE = Path(tempfile.mkdtemp()) / "llm_budget.json"


class RateLimit(Exception):
    status_code = 429
    def __init__(self):
        super().__init__("429 rate limit")
        self.response = SimpleNamespace(headers={"retry-after": "30"})


class FakeRaw:
    def __init__(self, model, headers):
        self.headers = headers
        self._model = model
    def parse(self):
        return SimpleNamespace(usage=SimpleNamespace(total_tokens=120),
                               choices=[SimpleNamespace(message=SimpleNamespace(content=f"<think>x</think>ok from {self._model}"))])


class FakeGroq:
    def __init__(self, fail=(), headers=None):
        self.calls, self.fail, self.headers = [], set(fail), headers or {}
        outer = self
        class _WR:
            def create(self, **kw):
                outer.calls.append(kw["model"])
                if kw["model"] in outer.fail:
                    raise RateLimit()
                return FakeRaw(kw["model"], outer.headers.get(kw["model"], {}))
        self.chat = SimpleNamespace(completions=SimpleNamespace(with_raw_response=_WR()))


def reset(fake):
    if bg.STATE_FILE.exists():
        bg.STATE_FILE.unlink()
    lr.set_client(fake)


def test_parse_reset():
    assert abs(bg.parse_reset("2m59.56s") - 179.56) < 1e-6
    assert bg.parse_reset("450ms") == 0.45
    assert bg.parse_reset("1h2m3s") == 3723
    assert bg.parse_reset("7.66") == 7.66


def test_first_model_answers_and_think_is_stripped():
    reset(FakeGroq())
    out = lr.chat("hunter", "score", [{"role": "user", "content": "hi"}], tier="judge")
    assert out == "ok from openai/gpt-oss-120b"
    assert bg.get_report()["by_agent"]["hunter"] == 120


def test_429_rotates_to_next_model_and_blocks_first():
    fake = FakeGroq(fail={"openai/gpt-oss-120b"})
    reset(fake)
    out = lr.chat("coach", "prep", [{"role": "user", "content": "q"}], tier="judge")
    assert out.endswith("llama-3.3-70b-versatile")
    assert not bg.is_available("openai/gpt-oss-120b")
    lr.chat("coach", "prep", [{"role": "user", "content": "q"}], tier="judge")
    assert fake.calls.count("openai/gpt-oss-120b") == 1   # לא ניסינו שוב מודל חסום


def test_low_remaining_requests_skips_model_before_hitting_limit():
    heads = {"openai/gpt-oss-120b": {"x-ratelimit-remaining-requests": "2", "x-ratelimit-reset-requests": "3h"}}
    fake = FakeGroq(headers=heads)
    reset(fake)
    lr.chat("assistant", "brief", [{"role": "user", "content": "q"}], tier="write")
    out = lr.chat("assistant", "brief", [{"role": "user", "content": "q"}], tier="write")
    assert out.endswith("llama-3.3-70b-versatile")


def test_all_exhausted_defers_instead_of_paying():
    reset(FakeGroq(fail=set(lr.TIERS["light"])))
    try:
        lr.chat("strategist", "queries", [{"role": "user", "content": "q"}], tier="light")
        assert False, "expected BudgetDeferred"
    except bg.BudgetDeferred:
        pass


def test_legacy_client_is_drop_in():
    reset(FakeGroq())
    c = lr.router_client("researcher", "judge")
    r = c.chat.completions.create(model="qwen/qwen3.8-27b", messages=[{"role": "user", "content": "x"}], max_tokens=50)
    assert r.choices[0].message.content == "ok from openai/gpt-oss-120b"
