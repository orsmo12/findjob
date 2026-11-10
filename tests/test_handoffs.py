"""משימות בין סוכנים: מה חסר, תלויות, ומתי מותר להתחיל. בלי רשת."""
from agent_core import handoffs as H
from agent_core.agents.growth import tailor_edits


def test_missing_for_saved_order():
    assert H.missing_for_saved({}) == ["brief", "tailor", "prep", "letter"]
    full = {"brief": {"found": True}, "tailor": {"edits": []}, "prep": {"tasks": []}, "letter": {"v": 4}}
    assert H.missing_for_saved(full) == []
    assert H.missing_for_saved({**full, "letter": {"v": 2}}) == ["letter"]          # מכתב בגרסה ישנה נכתב מחדש
    assert H.missing_for_saved({**full, "prep": {"tasks": [], "more_tasks": True}}) == ["prep"]


def test_letter_waits_for_brief():
    ts = {t["kind"]: t for t in H.plan_tasks(["brief", "letter"])}
    assert ts["letter"]["after"] == "brief" and ts["brief"]["after"] is None
    assert H.plan_tasks(["letter"])[0]["after"] is None                             # אין סקירה חדשה: לא מחכים
    assert {t["to"] for t in H.plan_tasks(["brief", "tailor", "prep", "letter"])} == {"researcher", "linkedin", "coach", "assistant"}


def test_ready_respects_dependencies():
    tasks = [{"id": 1, "status": "pending"}, {"id": 2, "status": "pending", "depends_on": 1},
             {"id": 3, "status": "pending", "depends_on": 9}, {"id": 4, "status": "done"}]
    assert [t["id"] for t in H.ready(tasks, {1: "pending", 9: "done"})] == [1, 3]
    assert [t["id"] for t in H.ready(tasks, {1: "done", 9: "failed"})] == [1, 2, 3]    # תלות שנכשלה לא תוקעת לנצח


def test_high_fit_only_best_few():
    jobs = [{"fit": f} for f in (3.9, 4.5, 4.9, 4.7, 4.6)]
    assert [j["fit"] for j in H.high_fit(jobs)] == [4.9, 4.7, 4.6]


def test_order_letter_last():
    assert H.ORDER.index("assistant") > H.ORDER.index("researcher")


def test_tailor_keeps_only_true_edits():
    cv = "Projects\n- Built findjob, a multi-agent job search system in Python with Supabase.\n- Home Poker PWA in React."
    d = {"edits": [
        {"before": "Built findjob, a multi-agent job search system in Python with Supabase.",
         "after": "Built a multi-agent system in Python that turns job ads into structured data, stored in Supabase.", "why": "עיבוד מסמכים"},
        {"before": "Home Poker PWA in React.", "after": "Home Poker PWA in React and AWS for 500 users.", "why": "x"},  # המציא AWS ו-500
        {"before": "Something not in the CV", "after": "Whatever", "why": "x"}]}
    out = tailor_edits(cv, d)
    assert len(out) == 1 and out[0]["after"].startswith("Built a multi-agent")


def test_letter_upgrade_to_v4_is_gradual():
    full = {"brief": {"x": 1}, "tailor": {"x": 1}, "prep": {"tasks": []}}
    assert H.missing_for_saved({**full, "letter": {"v": 4, "text": "x"}}) == []
    assert H.missing_for_saved({**full, "letter": {"v": 3, "text": "x"}}) == ["letter"]   # v3 משודרג ל-v4
    old = [({**full, "letter": {"v": 3, "text": "x"}}, ["letter"]) for _ in range(5)]
    new = [({**full}, ["letter"])]   # בלי מכתב בכלל: תמיד נכתב, לא נספר בתקרה
    out = H.cap_upgrades(old + new)
    assert sum(1 for _, m in out if "letter" in m) == H.UPGRADES_PER_RUN + 1
    assert "letter" in out[-1][1]


def test_usage_funnel_and_dropoff():
    from agent_core import usage as U
    users = [{"id": "a" * 36, "created_at": "2026-11-01"}, {"id": "b" * 36, "created_at": "2026-11-02"}]
    profs = [{"user_id": "a" * 36, "first": "אור", "state": {"usage": {"m": {"onb_done": 1, "jobs_seen": 1, "job_save": 1},
              "ev": [{"e": "tour_skip", "p": {"k": "main", "at": 1, "of": 6}}], "err": [{"m": "TypeError: x"}, {"m": "TypeError: x"}]}}},
             {"user_id": "b" * 36, "first": "גלעד", "state": {"usage": {"m": {}, "ev": [{"e": "onb_q", "p": {"q": "domain"}}]}}}]
    _, rep = U.report(users, profs, {})
    fun = dict(rep["funnel"])
    assert fun["סיים הרשמה"] == 1 and fun["שמר משרה"] == 1
    assert rep["rows"][0]["stuck"] == "לפני: פתח ערכת הגשה" and rep["rows"][0]["tour"] == "דילג בצעד 2 מתוך 6"
    assert rep["rows"][1]["stuck"] == "בהרשמה (domain)"
    assert rep["errors"] == [("TypeError: x", 2)]
