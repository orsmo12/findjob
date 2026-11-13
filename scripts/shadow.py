"""
shadow.py — כלי מפתח: הרצת ניסיון לכללים חדשים, בלי לשמור ובלי לשנות כלום אצל המשתמשים.
לכל משתמש (אנונימי, לפי סדר הרשמה):
  1. בדיקת התאמה בין הפרופיל לחיפוש: רמות, אילו שאילתות באמת רצות (עד 12 חיפושים), אזהרות על אי-התאמה.
  2. סימולציה של כללים מוצעים על המשרות שכבר הוצגו לו: מה היה יורד/עולה, ובמיוחד אם משרה ששמר או הגיש הייתה נפגעת.
כלל עולה לאוויר רק אם בכל המשתמשים אין משרה שנשמרה/הוגשה שהייתה נעלמת.
  python scripts/shadow.py [ימים=7]
"""
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core.profile import EXP_MAX_YEARS, normalize_answers
from agent_core.taste import SKIP_FIELD, learn, words

KEEP = ("save", "applied")          # החלטות שאסור לפגוע בהן
BUDGET = 12                          # כמו collect(): עד 12 חיפושים (שאילתה × אזור)
EARLY_Q = re.compile(r"^(junior|graduate|entry level)\b|ג'וניור|ג׳וניור", re.I)
STUDENT_Q = re.compile(r"^student\b|סטודנט", re.I)
HANDS_ON = re.compile(r"\b(operator|technician|machinist|cnc)\b|מפעיל|טכנאי|כרסם|חרט|רתך|מרכיב", re.I)
YEARS = re.compile(r"נדרשות (\d+) שנות ניסיון")


# ── 1. בדיקת התאמה בין הפרופיל לחיפוש ──────────────────────────────────────
def searched(plan: dict) -> list[str]:
    """השאילתות שבאמת רצות בסריקה (אותו חיתוך כמו collect)."""
    locs = plan.get("locations") or ["Israel"]
    return list(dict.fromkeys(q for q, _ in [(q, l) for q in plan.get("queries", []) for l in locs][:BUDGET]))


def audit(plan: dict, a: dict) -> list[str]:
    """אזהרות על אי-התאמה בין מה שהמשתמש ענה לבין מה שמחפשים לו."""
    w, ran = [], searched(plan)
    levels = set(plan.get("levels") or [])
    if "mid" in levels and any(EARLY_Q.search(q) for q in ran):
        w.append(f"חיפוש ג'וניור/Graduate למשתמש עם ניסיון ({a.get('exp')}): {[q for q in ran if EARLY_Q.search(q)]}")
    st = [q for q in ran if STUDENT_Q.search(q)]
    if st and "mid" in levels and len(st) * 3 > len(ran):
        w.append(f"{len(st)}/{len(ran)} חיפושי סטודנט למשתמש עם ניסיון בתחום")
    heads = plan.get("heads") or (plan.get("titles") or [])[:3]
    miss = [h for h in heads if not any(h.lower() in q.lower() for q in ran)]
    if miss:
        w.append(f"{len(miss)}/{len(heads)} תפקידים שבחר לא מחופשים: {miss}")
    if len(plan.get("locations") or []) > 2:
        w.append(f"{len(plan['locations'])} אזורים → רק {len(ran)} שאילתות שונות רצות")
    if a.get("status") == "סטודנט/ית" and EXP_MAX_YEARS.get(a.get("exp") or "", 1) not in (None, 1, 2):
        w.append(f"סתירה בשאלון: סטודנט + {a.get('exp')} ניסיון")
    return w


# ── 2. כללים מוצעים (פונקציות טהורות, נבדקות ב-tests) ──────────────────────
def fill_hide(card: dict, plan: dict) -> bool:
    """השלמה ל-6 לא מחזירה משרה שהורדה בגלל ניסיון — רק למי שאין לו ניסיון."""
    return bool(card.get("near")) and (card.get("dims") or {}).get("level") in ("short", "level") and not plan.get("have_years")


def cap_rise(card: dict, a: dict) -> bool:
    """תקרת ניסיון לפי הקצה העליון של הטווח שסימן (3–5 → עד 5)."""
    if (card.get("dims") or {}).get("level") != "short":
        return False
    m = YEARS.search(" ".join(card.get("gaps") or []))
    top = EXP_MAX_YEARS.get(a.get("exp") or "")
    has = (a.get("exp") or "") not in ("", "אין עדיין", "פחות משנה")   # רק מי שסימן טווח ניסיון; בלי ניסיון — התקרה נשארת
    return bool(has and m and top and int(m.group(1)) <= top)


ENGINEER = re.compile(r"\b(engineer|developer|designer)\b|מהנדס|מתכנן", re.I)


def hands_on_hide(card: dict, plan: dict, cv: str = "") -> bool:
    """משרת מפעיל/טכנאי (בלי "מהנדס" בכותרת) — יורדת אם בשאלון המשתמש לא בחר תפקיד כזה (תפקידים או "תפקיד אחר").
    לפי השאלון בלבד: ניסיון קודם כטכנאי בקורות החיים הוא עבר, לא יעד (cv נשאר לתאימות, לא משפיע)."""
    t = card.get("title") or ""
    mine = " ".join((plan.get("titles") or []) + (plan.get("heads") or []) + (plan.get("extra_titles") or []))
    return bool(HANDS_ON.search(t)) and not ENGINEER.search(t) and not HANDS_ON.search(mine)


def learn_new(rows: list[dict], skips: dict, off: list, plan: dict) -> dict:
    """טעם: מילים יורדות רק מ"לא התחום שלי"/"לא מעניין", ולעולם לא מילים של התפקידים שבחר."""
    mine = set().union(*[words(t) for t in (plan.get("titles") or []) + (plan.get("heads") or [])] or [set()])
    keep = []
    for r in rows:
        c = r.get("card") or {}
        why = (skips.get(c.get("id") or r.get("id")) or {}).get("r", "")
        if r.get("decision") == "skip" and why not in (SKIP_FIELD, "לא מעניין"):
            continue
        keep.append(r)
    t = learn(keep, skips, list(off or []) + sorted(mine))
    return t


def show(name: str, hit: list[dict]) -> None:
    d = Counter(j.get("decision") or "ממתין" for j in hit)
    bad = [j for j in hit if j.get("decision") in KEEP]
    up = name.startswith("עולות")
    verdict = (f"✓ {len(bad)} מהן נשמרו — הכלל מתקן" if up and bad else "" if up
               else f"⚠️ פוגע ב-{len(bad)} שנשמרו/הוגשו" if bad else "✓ לא פוגע במשרות שנשמרו")
    print(f"   {name}: {len(hit)} משרות | {dict(d)} | {verdict}")
    for j in (bad or hit)[:5]:
        c = j.get("card") or {}
        print(f"      {float(j.get('fit') or 0):.1f} {j.get('decision') or 'ממתין':<7} {str(c.get('title'))[:55]}")


def main(days=7):
    from agent_core import cloud_store as db
    from scripts.insights import get
    from scripts.user_diag import plan_for
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    users = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")
    tot = Counter()
    for i, u in enumerate(users):
        uid = u["id"]
        p = (get("profiles", select="answers,state,cv_text", user_id=f"eq.{uid}") or [{}])[0]
        st, a = p.get("state") or {}, normalize_answers(p.get("answers") or {})
        try:
            plan = plan_for(uid, p, st)
        except Exception as e:  # noqa: BLE001
            print(f"\n#{i}: תוכנית חיפוש נכשלה: {e}")
            continue
        print(f"\n═══ משתמש #{i} | {a.get('status')} | ניסיון {a.get('exp')} | תחום {a.get('field') or a.get('domains')} | levels={plan.get('levels')} have_years={plan.get('have_years')}")
        print(f"   רצות: {searched(plan)}")
        print(f"   לפי השאלון: תפקידים שבחר {a.get('roles') or '-'} | תפקיד אחר {a.get('custom_roles') or '-'} | מפעיל/טכנאי בקו״ח: {sorted({m.group(0).lower() for m in HANDS_ON.finditer(p.get('cv_text') or '')}) or 'לא'}")
        for w in audit(plan, a) or ["אין אזהרות"]:
            print(f"   {'⚠️ ' if w != 'אין אזהרות' else '✓ '}{w}")
        jobs = [j for j in get("jobs", select="id,card,fit,decision", user_id=f"eq.{uid}", created_at=f"gte.{since}") or []
                if j.get("decision") != "filtered"]
        print(f"   משרות שהוצגו ב-{days} ימים: {len(jobs)}")
        for name, rule in (("השלמה בלי משרות שהורדו בגלל ניסיון", lambda c: fill_hide(c, plan)),
                           ("עולות: תקרה לפי הטווח העליון", lambda c: cap_rise(c, a)),
                           ("יורדות: מפעיל/טכנאי", lambda c: hands_on_hide(c, plan, p.get("cv_text") or ""))):
            hit = [j for j in jobs if rule(j.get("card") or {})]
            show(name, hit)
            tot[name] += sum(1 for j in hit if j.get("decision") in KEEP) * (0 if name.startswith("עולות") else 1)
        skips, off = st.get("skip") or {}, st.get("taste_off") or []
        rows = db.all_jobs(uid, days=60)
        old, new = learn(rows, skips, off), learn_new(rows, skips, off, plan)
        print(f"   טעם, נוטה לדלג: לפני {old['dislikes']} → אחרי {new['dislikes']}")
    print(f"\nסיכום: משרות שנשמרו/הוגשו שהיו נפגעות: {dict(tot) or 'אף אחת ✓'}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] else 7)
