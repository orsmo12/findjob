"""סבב 10: התראה לטלפון. בלי מפתח או מנוי לא שולחים, וההודעה בלי פרטים אישיים."""
import os
from agent_core import push as P


def test_no_key_or_sub_means_skip():
    os.environ.pop("VAPID_PRIVATE_KEY", None)
    assert P.send({"endpoint": "https://x"}, P.message(3)) == "skip"
    assert P.send(None, P.message(3)) == "skip"


def test_message_has_only_count():
    m = P.message(1, "דורון")
    assert m["body"] == "דורון מצא משרה חדשה אחת שמתאימה לך."
    assert P.message(4)["body"].endswith("4 משרות חדשות שמתאימות לך.")
    assert set(m) == {"title", "body", "url", "tag"}


def test_ask_after_a_week_once():
    """מסלול הגשה סבב 3: "שמעת מ-X?" שבוע אחרי הגשה, עם 3 כפתורים, לא פעמיים בשבוע על אותה הגשה."""
    from agent_core.push import ask_payload
    apps = [{"id": "a1", "jobId": "j1", "status": "applied", "date": "2026-11-01T10:00:00Z"},
            {"id": "a2", "jobId": "j2", "status": "applied", "date": "2026-11-12T10:00:00Z"}]
    pay, aid = ask_payload(apps, {"j1": {"co": "Wix"}}, {}, "2026-11-13")
    assert aid == "a1" and "Wix" in pay["body"] and len(pay["actions"]) == 3 and pay["url"] == "/#ask=a1"
    assert ask_payload(apps, {}, {"a1": "2026-11-10"}, "2026-11-13") == (None, "")
    assert ask_payload([{**apps[0], "snooze": "2026-11-20T00:00:00Z"}], {}, {}, "2026-11-13") == (None, "")
    iv = [{"id": "b", "jobId": "j", "status": "interview", "when": "2026-11-12T10:00:00Z", "date": "2026-11-01"}]
    assert "איך היה" in ask_payload(iv, {}, {}, "2026-11-13")[0]["body"]
