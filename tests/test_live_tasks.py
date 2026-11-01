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
