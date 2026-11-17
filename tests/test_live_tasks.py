import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
import agent_core.agents.live as L
import agent_core.agents.tasks as T


def _client(status, body):
    return httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(status, text=body)))


def test_live_closed_only_on_clear_signal():
    assert L.check("https://x.com/jobs/1", _client(404, "")) == "closed"
    assert L.check("https://x.com/jobs/1", _client(200, "<h1>Engineer</h1> This job is no longer available")) == "closed"
    assert L.check("https://x.com/jobs/1", _client(200, "<h1>Engineer</h1> Apply now")) == "open"
    assert L.check("https://x.com/jobs/1", _client(403, "blocked")) == "unknown"
    assert L.check("https://www.linkedin.com/jobs/view/123", _client(200, "No longer accepting applications")) == "closed"


def test_role_of():
    assert T.role_of("Junior Frontend Developer") == "frontend"
    assert T.role_of("Software Engineer - Student") == "software engineer"


def test_task_company_must_be_in_source():
    T.find_repos = lambda co, role, ex: [{"full": "dev/todo-app-assignment", "url": "u", "desc": "", "stars": 5,
                                          "readme": "Home assignment: build a todo app with React. Requirements: tests." * 20}]
    T.chat = lambda *a, **k: ('{"is_assignment": true, "title": "אפליקציית משימות", "summary": "x", "requirements": ["React"],'
                              '"company": "Google", "time": "", "solution": ["a"], "relevance": "r"}')
    t = T.build_tasks({"title": "Frontend Developer", "co": "Wix"})
    assert len(t) == 1 and t[0]["company"] == "" and t[0]["url"] == "u"


def test_linkedin_429_waits_and_retries():
    """LinkedIn: 429 = מחכים ומנסים שוב; אחרי 3 ניסיונות 'לא ידוע' (המשרה נשארת)."""
    calls, slept = [], []
    old = L._sleep
    L._sleep = slept.append
    try:
        seq = iter([429, 429, 200])
        cx = httpx.Client(transport=httpx.MockTransport(lambda req: (calls.append(1), httpx.Response(next(seq), text="Apply now"))[1]))
        assert L.check("https://il.linkedin.com/jobs/view/eng-123", cx) == "open" and len(calls) == 3
        assert any(s >= L.LI_WAIT for s in slept)
        cx = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(429, text="")))
        assert L.check("https://www.linkedin.com/jobs/view/123", cx) == "unknown"
    finally:
        L._sleep = old


def test_indeed_by_api_only_expired_closes():
    """Indeed: דרך ה-API. expired=true = נסגרה; שגיאה או תשובה ריקה = לא ידוע (המשרה נשארת)."""
    try:
        import jobspy  # noqa: F401
    except ImportError:
        return
    u = "https://il.indeed.com/viewjob?jk=abc12345def"
    ok = lambda body: httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, json=body)))
    assert L.check(u, ok({"data": {"jobData": {"results": [{"job": {"key": "abc12345def", "expired": True}}]}}})) == "closed"
    assert L.check(u, ok({"data": {"jobData": {"results": [{"job": {"key": "abc12345def", "expired": False}}]}}})) == "open"
    assert L.check(u, ok({"data": {"jobData": {"results": []}}})) == "unknown"
    assert L.check(u, ok({"errors": [{"message": "x"}]})) == "unknown"


def test_stale_pending_only_old_undecided_queue_jobs():
    """בדיקת פתיחה לתור: רק משרות בלי החלטה שמחכות יותר מ-3 ימים. שמורות, מדולגות ומסוננות לא נוגעים."""
    from datetime import datetime, timedelta, timezone
    now = datetime(2026, 11, 17, 6, tzinfo=timezone.utc)
    ago = lambda d: (now - timedelta(days=d)).isoformat()
    card = {"title": "Engineer", "co": "Acme", "url": "https://x.com/1"}
    rows = [{"id": "old", "created_at": ago(5), "decision": None, "card": card},
            {"id": "new", "created_at": ago(1), "decision": None, "card": card},
            {"id": "saved", "created_at": ago(9), "decision": "save", "card": card},
            {"id": "skip", "created_at": ago(9), "decision": "skip", "card": card},
            {"id": "filt", "created_at": ago(9), "decision": "filtered", "card": card},
            {"id": "nourl", "created_at": ago(9), "decision": None, "card": {"title": "X"}},
            {"id": "z", "created_at": "2026-11-10T06:00:00Z", "decision": None, "card": card}]
    assert [r["id"] for r in L.stale_pending(rows, now)] == ["old", "z"]
    assert L.QUEUE_LIVE is True


def test_linkedin_logo_from_the_same_page():
    """לוגו למשרות ישנות: נלקח מהדף של LinkedIn שכבר נטען לבדיקה. בלי לוגו בדף = כלום."""
    html = '<img class="artdeco-entity-image" data-delayed-url="https://media.licdn.com/dms/image/v2/C4D0BAQ/company-logo_100_100/0/1?e=2147483647&amp;v=beta&amp;t=abc" alt="Acme"> Apply'
    cx = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, text=html)))
    meta = {}
    assert L.check("https://www.linkedin.com/jobs/view/123", cx, meta) == "open"
    assert meta["logo"].startswith("https://media.licdn.com/") and "&amp;" not in meta["logo"]
    cx = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, text="Apply now")))
    meta = {}
    L.check("https://www.linkedin.com/jobs/view/123", cx, meta)
    assert meta == {}
    assert L.li_logo('<img src="https://evil.com/company-logo.png">') == ""
