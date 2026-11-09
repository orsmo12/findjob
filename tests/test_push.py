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
