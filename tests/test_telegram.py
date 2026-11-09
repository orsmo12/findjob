"""סבב 13: ערוצי טלגרם ציבוריים. ניתוח העמוד ובדיקת אמת, בלי רשת."""
from datetime import datetime, timezone
from agent_core.agents import telegram as T

NOW = datetime.now(timezone.utc).isoformat()
PAGE = f'''<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="hitechjobsjunior/101">
<div class="tgme_widget_message_text js-message_text" dir="auto">🔥 Junior Backend Developer at Wix<br/>Tel Aviv · Python, SQL<br/>
<a href="https://careers.wix.com/position/123">Apply here</a></div><time datetime="{NOW}" class="time">10:00</time></div></div>
<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="hitechjobsjunior/100">
<div class="tgme_widget_message_text js-message_text" dir="auto">Old post about Junior QA at Acme, a while ago, long enough text here</div><time datetime="2020-01-01T10:00:00+00:00">x</time></div></div>'''


def test_parse_recent_posts_with_links():
    posts = T.parse(PAGE)
    assert len(posts) == 1 and posts[0]["links"] == ["https://careers.wix.com/position/123"] and "Junior Backend" in posts[0]["text"]


def test_extraction_is_grounded_in_post():
    posts = T.parse(PAGE)
    items = [{"i": 0, "title": "Junior Backend Developer", "company": "Wix", "url": "https://evil.example/x"},
             {"i": 0, "title": "Senior Architect", "company": "Wix"},          # לא בפוסט
             {"i": 0, "title": "Junior Backend Developer", "company": "Google"}]  # חברה לא בפוסט
    jobs = T.to_jobs(items, posts)
    assert len(jobs) == 1 and jobs[0]["url"] == "https://careers.wix.com/position/123" and jobs[0]["source"] == "Telegram"


def test_channel_names():
    assert [T.channel_name(x) for x in ("https://t.me/s/hitechjobsjunior", "@abc_jobs", "t.me/abcd", "a b")] == ["hitechjobsjunior", "abc_jobs", "abcd", None]


def test_digest_post_gives_each_role_its_own_segment():
    posts = [{"post": "c/1", "text": "Junior roles\n🔹 Junior QA Engineer\n🏢 Acme · 📍 Haifa\n🔹 NOC Engineer Student\n🏢 Global-e · 📍 Petah Tikva",
              "links": ["https://acme.com/j/1", "https://global-e.com/c/2"], "at": "2026-11-09T06:01:00+00:00"}]
    jobs = T.to_jobs([{"i": 0, "title": "Junior QA Engineer", "company": "Acme", "url": "https://acme.com/j/1"},
                      {"i": 0, "title": "NOC Engineer Student", "company": "Global-e", "url": "https://global-e.com/c/2"}], posts)
    assert [j["company"] for j in jobs] == ["Acme", "Global-e"]
    assert "Global-e" not in jobs[0]["description"] and jobs[1]["url"].endswith("/c/2")
