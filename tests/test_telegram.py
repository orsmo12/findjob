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
