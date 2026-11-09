"""סבב 3: מציאת חברה לפי שם. דף קריירה באתר של החברה, ושאלת "זו החברה?" כשהשם לא זהה. בלי רשת."""
from agent_core.agents import ats as A

PAGE = """<html><a href="/company-overview/careers/">Careers</a>
<a href="/company-overview/careers/junior-software-engineer-ai-compiler/14.298/">Junior Software Engineer, AI Compiler</a>
<a href="https://hailo.ai/company-overview/careers/vlsi-design-engineer/B3.056">VLSI Design Engineer</a>
<a href="/company-overview/careers/vlsi-design-engineer/B3.056">Apply</a>
<a href="https://www.linkedin.com/company/hailo/jobs/">LinkedIn</a>
<a href="/blog/edge-ai">Edge AI blog</a></html>"""


def test_site_links_finds_job_pages_only():
    links = A.site_links(PAGE, "https://hailo.ai/company-overview/careers/")
    assert [l["title"] for l in links] == ["Junior Software Engineer, AI Compiler", "VLSI Design Engineer"]
    assert links[0]["url"].startswith("https://hailo.ai/company-overview/careers/junior")


def test_exact_host_vs_similar_company():
    assert A.exact_host("Hailo", "https://hailo.ai/company-overview/careers/")
    assert A.exact_host("monday", "https://monday.com/careers")
    assert not A.exact_host("Hailo", "https://www.hailotalent.com/careers")    # שם דומה, חברה אחרת: צריך אישור
    assert A.host_of("https://www.hailo.de/en/career") == "hailo.de"


def test_low_confidence_is_not_scanned(monkeypatch=None):
    orig = A.discover
    A.discover = lambda cx, name, slugs=None, reject=None: {"board": "site", "url": "https://www.hailotalent.com/careers", "confirm": True}
    try:
        jobs, status, cache = A.collect_targets([{"name": "Hailo", "why": ["הוספת בעצמך"]}], {"titles": ["Backend Developer"]}, {})
    finally:
        A.discover = orig
    assert jobs == [] and status[0]["status"] == "confirm" and status[0]["found"]["host"] == "hailotalent.com"
    assert "confirm" not in status[0]["found"]["board"]


def test_rejected_site_is_rediscovered():
    seen = {}
    def fake(cx, name, slugs=None, reject=None):
        seen["reject"] = reject; return None
    orig = A.discover; A.discover = fake
    from datetime import datetime, timezone
    cache = {"hailo": {"b": {"board": "site", "url": "https://www.hailotalent.com/careers", "confirm": True},
                       "at": datetime.now(timezone.utc).isoformat(), "v": A.CACHE_V}}
    try:
        _, status, _ = A.collect_targets([{"name": "Hailo", "reject": ["https://www.hailotalent.com/careers"]}], {"titles": []}, cache)
    finally:
        A.discover = orig
    assert seen["reject"] == ["https://www.hailotalent.com/careers"] and status[0]["status"] == "by_name"


def test_official_site_marks_company_as_existing():
    orig = A.discover
    def fake(cx, name, slugs=None, reject=None, seen=None):
        seen["official"] = "hailo.ai"; return None
    A.discover = fake
    try:
        _, status, cache = A.collect_targets([{"name": "Hailo", "why": ["הוספת בעצמך"]}], {"titles": []}, {})
    finally:
        A.discover = orig
    assert status[0]["status"] == "by_name" and status[0]["official"] == "hailo.ai" and cache["hailo"]["official"] == "hailo.ai"
