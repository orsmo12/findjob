"""סבב 4: משרה סגורה לפי מקור. בלי רשת: לקוח מדומה."""
from agent_core.agents import live as L


class R:
    def __init__(self, code, js=None, text=""):
        self.status_code, self._js, self.text = code, js, text
    def json(self):
        return self._js


class CX:
    def __init__(self, routes):
        self.routes, self.calls = routes, []
    def get(self, url):
        self.calls.append(url)
        for k, v in self.routes.items():
            if k in url:
                return v
        return R(500)


def test_greenhouse_gone_is_closed():
    cx = CX({"boards-api.greenhouse.io/v1/boards/wix/jobs/123": R(404)})
    assert L.check("https://boards.greenhouse.io/wix/jobs/123", cx) == "closed"


def test_lever_live_is_open():
    u = "https://jobs.lever.co/acme/0b1c2d3e-1111-2222-3333-444455556666"
    cx = CX({"api.lever.co/v0/postings/acme/0b1c2d3e": R(200, {"id": "x"})})
    assert L.check(u, cx) == "open"


def test_ashby_missing_from_board_is_closed():
    u = "https://jobs.ashbyhq.com/acme/0b1c2d3e-1111-2222-3333-444455556666"
    cx = CX({"posting-api/job-board/acme": R(200, {"jobs": [{"id": "other"}]})})
    assert L.check(u, cx) == "closed"


def test_workday_cannot_apply_is_closed():
    u = "https://acme.wd3.myworkdayjobs.com/en-US/Careers/job/Tel-Aviv/Junior-Dev_R123"
    cx = CX({"wday/cxs/acme/Careers/job/Tel-Aviv/Junior-Dev_R123": R(200, {"jobPostingInfo": {"canApply": False}})})
    assert L.check(u, cx) == "closed"


def test_blocked_site_is_unknown_not_closed():
    assert L.check("https://some-company.co.il/jobs/77", CX({"some-company": R(403)})) == "unknown"


def test_hebrew_closed_wording():
    cx = CX({"alljobs": R(200, text="<h1>מפתח/ת</h1><p>המשרה אינה פעילה עוד</p>")})
    assert L.check("https://www.alljobs.co.il/job/1", cx) == "closed"
