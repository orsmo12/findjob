"""
handoffs.py — משימות בין סוכנים (טבלת agent_tasks ב-Supabase).

סוכן שצריך משהו מסוכן אחר יוצר משימה: ממי, למי, על איזו משרה, מה צריך, ואחרי איזו משימה.
הסוכן השני מבצע אותה בריצה הקרובה שלו. משימה תלויה מחכה שהקודמת תסתיים.
כל יצירה וכל סיום נכתבים ליומן במשרד, כך שרואים מי ביקש מה ממי.

אם הטבלה עוד לא קיימת (לא הורץ supabase/agent_tasks.sql), available() מחזיר False
והסוכנים חוזרים לעבודה הישנה, בלי משימות.
"""
from __future__ import annotations
from datetime import datetime, timezone

from agent_core import activity as act

KINDS = {  # סוג משימה → מי מבצע ומה זה
    "brief":  ("researcher", "סקירת חברה עם מקורות"),
    "tailor": ("linkedin",   "התאמת קורות חיים למשרה"),
    "prep":   ("coach",      "שאלות הכנה ומטלות"),
    "letter": ("assistant",  "מכתב פנייה"),
}
ORDER = ["researcher", "linkedin", "coach", "assistant"]   # הסדר שבו הסוכנים עובדים בריצה: מכתב בסוף, אחרי הסקירה
HIGH_FIT = 4.5          # משרה חדשה בציון הזה ומעלה: גיל וקובי מתחילים לעבוד עליה עוד לפני שנשמרה
HIGH_FIT_MAX = 3        # לכל היותר כך וכך משרות כאלה בכל סריקה, כדי לא לבזבז מכסה על משרות שתדלג עליהן

_avail: bool | None = None


# ── לוגיקה טהורה (נבדקת בלי רשת) ───────────────────────────────────────────

def _tailor_v() -> int:
    from agent_core.agents.growth import TAILOR_V
    return TAILOR_V


def cv_src(answers: dict | None, ad: str = "") -> str:
    """איזה קורות חיים מתאימים למשרה: 'en' (הגרסה באנגלית שהמשתמש העלה) למודעה שאינה בעברית, אחרת 'main'."""
    from agent_core.agents.letters import ad_language
    has_en = bool(((answers or {}).get("cv_en") or "").strip())
    return "en" if has_en and ad_language(ad or "") != "Hebrew" else "main"


def cv_for(cv: str, answers: dict | None, ad: str = "", english: bool = False) -> str:
    """הטקסט של קורות החיים למשרה. מכתבים (תמיד באנגלית) מקבלים english=True."""
    en = ((answers or {}).get("cv_en") or "").strip()
    if en and (english or cv_src(answers, ad) == "en"):
        return en
    return cv


def missing_for_saved(row: dict, answers: dict | None = None) -> list[str]:
    """מה חסר במשרה ששמרת, לפי סדר העבודה."""
    out = []
    if not row.get("brief"):
        out.append("brief")
    tl = row.get("tailor")
    card = row.get("card") or {}
    want = cv_src(answers, card.get("ad") or card.get("desc") or "")
    if not tl or (not tl.get("no_ad") and ((tl.get("v") or _tailor_v()) < _tailor_v() or (tl.get("src") or "main") != want)):
        out.append("tailor")   # גרסה ישנה (מחקה כלים), או שהועלו קורות חיים באנגלית: נכתבת מחדש מהגרסה הנכונה
    p = row.get("prep")
    if not p or p.get("tasks") is None or p.get("more_tasks"):
        out.append("prep")
    lt = row.get("letter")
    if not lt or (lt.get("v") or 0) < LETTER_V:
        out.append("letter")
    return out


LETTER_V = 7          # v7 (17.11): תמיד באנגלית, בלי משפטים חתוכים אחרי B.Sc. v6: עורך לפי 6 הכללים מהדוגמאות, פרויקט שני רק כשהוא מכסה דרישה נוספת, מילואים + למידה עצמית. מכתב ישן (במשרה שמורה) נכתב מחדש בהדרגה
UPGRADES_PER_RUN = 3  # שדרוג הדרגתי: לכל היותר 3 מכתבים ישנים בכל ריצה למשתמש, כדי לא לשרוף מכסה


def is_upgrade(row: dict) -> bool:
    """כבר יש מכתב, רק בגרסה ישנה. מכתב שהמשתמש ערך בעצמו שמור אצלו (apps[].letter) ולא נדרס."""
    lt = row.get("letter")
    return bool(lt and lt.get("text") and (lt.get("v") or 0) < LETTER_V)


def cap_upgrades(rows_miss: list[tuple[dict, list[str]]], n: int = UPGRADES_PER_RUN) -> list[tuple[dict, list[str]]]:
    """מוריד 'letter' ממשרות שהן רק שדרוג, אחרי n הראשונות. מכתב חדש (שלא היה) תמיד נשאר."""
    out, used = [], 0
    for row, miss in rows_miss:
        if "letter" in miss and is_upgrade(row):
            if used >= n:
                miss = [k for k in miss if k != "letter"]
            else:
                used += 1
        out.append((row, miss))
    return out


def plan_tasks(kinds: list[str]) -> list[dict]:
    """רשימת משימות עם תלויות: מכתב מחכה לסקירה כשגם היא נוצרת עכשיו."""
    out = []
    for k in kinds:
        to, what = KINDS[k]
        out.append({"kind": k, "to": to, "what": what, "after": "brief" if k == "letter" and "brief" in kinds else None})
    return out


def ready(tasks: list[dict], status_of: dict) -> list[dict]:
    """משימות פתוחות שאפשר לבצע עכשיו: אין להן תלות, או שהתלות הסתיימה (או נכשלה, ואז לא מחכים לנצח)."""
    return [t for t in tasks if t.get("status") == "pending"
            and (not t.get("depends_on") or status_of.get(t["depends_on"], "done") in ("done", "failed"))]


def high_fit(jobs: list[dict]) -> list[dict]:
    """משרות חדשות בציון גבוה מאוד, הטובות ביותר קודם."""
    return sorted([j for j in jobs if (j.get("fit") or 0) >= HIGH_FIT], key=lambda j: -j["fit"])[:HIGH_FIT_MAX]


# ── Supabase ───────────────────────────────────────────────────────────────

def available() -> bool:
    global _avail
    if _avail is None:
        try:
            import httpx
            from agent_core import cloud_store as db
            r = httpx.get(db._url("agent_tasks"), headers=db._h(), params={"select": "id", "limit": "1"}, timeout=20)
            _avail = r.status_code == 200
            if not _avail:
                print("טבלת המשימות עוד לא קיימת (supabase/agent_tasks.sql). הסוכנים עובדים בלי משימות.")
        except Exception:  # noqa: BLE001
            _avail = False
    return _avail


def _open(user_id: str) -> list[dict]:
    import httpx
    from agent_core import cloud_store as db
    r = httpx.get(db._url("agent_tasks"), headers=db._h(), timeout=30, params={
        "select": "*", "user_id": f"eq.{user_id}", "status": "eq.pending", "order": "id.asc", "limit": "200"})
    r.raise_for_status()
    return r.json()


def create(user_id: str, frm: str, kind: str, need: str, job_id: str | None = None,
           after: int | None = None, existing: list[dict] | None = None) -> int | None:
    """יוצר משימה, אלא אם כבר יש משימה פתוחה זהה (אותו סוכן, סוג ומשרה). מחזיר את המזהה."""
    import httpx
    from agent_core import cloud_store as db
    to = KINDS[kind][0]
    for t in existing if existing is not None else _open(user_id):
        if t["to_agent"] == to and t["kind"] == kind and t.get("job_id") == job_id:
            return t["id"]
    r = httpx.post(db._url("agent_tasks"), headers=db._h({"Prefer": "return=representation"}), timeout=30, json={
        "user_id": user_id, "job_id": job_id, "from_agent": frm, "to_agent": to, "kind": kind,
        "need": need[:300], "depends_on": after})
    r.raise_for_status()
    act.log(frm, need, to=to)
    row = r.json()[0]
    if existing is not None:
        existing.append(row)
    return row["id"]


def request_for_job(user_id: str, frm: str, job: dict, kinds: list[str], why: str,
                    existing: list[dict] | None = None) -> list[int]:
    """כמה משימות על משרה אחת, עם התלויות ביניהן."""
    ids, by_kind = [], {}
    for t in plan_tasks(kinds):
        need = f"{why}: {job.get('title')} ב-{job.get('co')}. צריך {t['what']}."
        tid = create(user_id, frm, t["kind"], need, job.get("id"), by_kind.get(t["after"]) if t["after"] else None, existing)
        by_kind[t["kind"]] = tid
        ids.append(tid)
    return ids


def due(user_id: str, agent: str) -> list[dict]:
    """המשימות של סוכן שאפשר לבצע עכשיו."""
    rows = _open(user_id)
    mine = [t for t in rows if t["to_agent"] == agent]
    dep_ids = {t["depends_on"] for t in mine if t.get("depends_on")} - {t["id"] for t in rows}
    status = {t["id"]: t["status"] for t in rows}
    if dep_ids:  # תלויות שכבר לא פתוחות: מביאים את הסטטוס שלהן
        import httpx
        from agent_core import cloud_store as db
        r = httpx.get(db._url("agent_tasks"), headers=db._h(), timeout=30, params={
            "select": "id,status", "id": f"in.({','.join(str(i) for i in dep_ids)})"})
        if r.status_code == 200:
            status.update({x["id"]: x["status"] for x in r.json()})
    return ready(mine, status)


def finish(task: dict, ok: bool = True, result: dict | None = None, note: str = "") -> None:
    import httpx
    from agent_core import cloud_store as db
    httpx.patch(db._url("agent_tasks"), headers=db._h(), timeout=30, params={"id": f"eq.{task['id']}"}, json={
        "status": "done" if ok else "failed", "result": result, "done_at": datetime.now(timezone.utc).isoformat()}).raise_for_status()
    if note:
        act.log(task["to_agent"], note, to=task["from_agent"] if task["from_agent"] != task["to_agent"] else None)


INACTIVE_DAYS = 3   # מתג (סבב 9): משתמש שלא נכנס 3 ימים — הסוכנים לא מכינים חומרים חדשים עד שיחזור (חוסך מכסה)


def active_recently(state: dict | None, days: int = INACTIVE_DAYS) -> bool:
    """נכנס לאפליקציה ב-N הימים האחרונים. בלי נתוני שימוש (משתמש חדש / ישן) = פעיל."""
    from datetime import datetime, timezone, timedelta
    last = ((state or {}).get("usage") or {}).get("last")
    if not last or not days:
        return True
    try:
        return datetime.fromisoformat(str(last).replace("Z", "+00:00")) >= datetime.now(timezone.utc) - timedelta(days=days)
    except ValueError:
        return True


# סבב ב (16.11): משתמש שלא עובר על המשרות לא מקבל עוד ועוד. הערימה מעמיסה עליו כשיחזור ושורפת מכסה.
SCAN_PENDING_MAX = 25   # מתג: מעל 25 משרות שמחכות → סריקה אחת ביום (0 = כבוי)
SCAN_SLOW_DAYS = 3      # לא נכנס 3 ימים → סריקה אחת ביום
SCAN_PAUSE_DAYS = 7     # לא נכנס 7 ימים → עוצרים עד שיחזור (0 = כבוי)
SCAN_QUEUE_FULL = 30    # מתג (22.11): 30 משרות מחכות → לא סורקים עד שיעבור עליהן. בדיקת הפתיחה ממשיכה (0 = כבוי)


def days_away(state: dict | None, now=None) -> float:
    from datetime import datetime, timezone
    last = ((state or {}).get("usage") or {}).get("last")
    if not last:
        return 0.0
    try:
        t = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    return ((now or datetime.now(timezone.utc)) - t).total_seconds() / 86400


def pending_jobs(rows: list[dict]) -> int:
    """משרות שהוצגו ועוד לא החלטת עליהן (בלי משרות שנסגרו)."""
    return sum(1 for r in rows if not r.get("decision") and not (r.get("card") or {}).get("closed_at"))


def scan_mode(state: dict | None, pending: int, morning: bool, now=None) -> str:
    """'full' (פעמיים ביום) / 'skip' (היום כבר סרקנו פעם אחת) / 'paused' (לא נכנס 7 ימים) / 'queue_full' (30 מחכות)."""
    away = days_away(state, now)
    if SCAN_PAUSE_DAYS and away >= SCAN_PAUSE_DAYS:
        return "paused"
    if SCAN_QUEUE_FULL and pending >= SCAN_QUEUE_FULL:
        return "queue_full"
    slow = away >= SCAN_SLOW_DAYS or (SCAN_PENDING_MAX and pending >= SCAN_PENDING_MAX)
    return "skip" if slow and not morning else "full"
