"""
user_diag.py — כלי מפתח: למה משתמש מסוים מקבל את המשרות שהוא מקבל. קריאה בלבד ואנונימי (הריפו ציבורי):
בלי שמות, בלי מייל, בלי קורות חיים. משתמש לפי מספר הסדר בהרשמה (0 = הראשון). ברירת מחדל: האחרון שנרשם.
  python scripts/user_diag.py [מספר] [ימים=10]
"""
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core import cloud_store as db
from agent_core.profile import normalize_answers, build_search_plan
from scripts.insights import get


def age(p):
    try:
        return (date.today() - date.fromisoformat(str(p)[:10])).days
    except ValueError:
        return None


def main(idx=None, days=10):
    users = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")
    for i, u in enumerate(users):
        print(f"   #{i} נרשם {str(u.get('created_at'))[:16]}")
    u = users[idx if idx is not None else -1]
    uid = u["id"]
    p = (get("profiles", select="answers,state,cv_text", user_id=f"eq.{uid}") or [{}])[0]
    st, a = p.get("state") or {}, normalize_answers(p.get("answers") or {})
    print(f"\nמשתמש #{users.index(u)}: onboarded={st.get('onboarded')} | קו״ח {len(p.get('cv_text') or '')} תווים | מפתח אישי {'כן' if st.get('ai_key') else 'לא'}")
    for k in ("study", "year", "work", "exp", "scope", "domains", "field", "roles", "custom_roles", "locs", "mode", "track", "status"):
        if a.get(k):
            print(f"   {k}: {a.get(k)}")
    print(f"   טלגרם: {st.get('telegram') or st.get('tg_channels') or '-'} | דילוגים עם סיבה: {Counter(v.get('r') for v in (st.get('skip') or {}).values() if isinstance(v, dict))}")
    try:
        plan = build_search_plan({"cv_text": p.get("cv_text") or "", "answers": p.get("answers") or {}}).to_dict()
        print(f"   תוכנית חיפוש: levels={plan.get('levels')} domains={plan.get('domains')}\n   שאילתות: {plan.get('queries')}")
    except Exception as e:  # noqa: BLE001
        print(f"   תוכנית חיפוש: {e}")
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    runs = get("runs", select="stats,created_at", user_id=f"eq.{uid}", agent="eq.hunter", created_at=f"gte.{since}", order="created_at.asc")
    for r in runs:
        s = r.get("stats") or {}
        if "collected" in s:
            print(f"   סריקה {r['created_at'][5:16]}: נאספו {s.get('collected')}, דורגו {s.get('rated')}, הוצגו {s.get('shown')} | מקורות {s.get('sources') or ''}")
    jobs = get("jobs", select="card,fit,decision,created_at", user_id=f"eq.{uid}", created_at=f"gte.{since}", order="created_at.desc")
    shown = [j for j in jobs if j.get("decision") != "filtered"]
    print(f"\nמשרות שהוצגו ב-{days} ימים: {len(shown)} | לפי מקור {dict(Counter((j['card'] or {}).get('src') for j in shown))}")
    ages = [(j["card"] or {}).get("posted_days") if (j["card"] or {}).get("posted_days") is not None else age((j["card"] or {}).get("posted")) for j in shown]
    known = [x for x in ages if x is not None]
    print(f"   גיל מפרסום: ידוע ל-{len(known)}/{len(shown)}, מעל 30 יום {sum(x > 30 for x in known)}, מעל 90 {sum(x > 90 for x in known)}")
    for j in shown[:40]:
        c = j["card"] or {}
        print(f"   {j['created_at'][5:10]} {str(j.get('decision') or 'ממתין'):<7} {float(j.get('fit') or 0):.1f} | {str(c.get('src'))[:12]:<12} | לפני {str(c.get('posted_days') if c.get('posted_days') is not None else '?'):>3} ימים | {c.get('title', '')[:45]} @ {c.get('co', '')[:22]}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "" else None, int(sys.argv[2]) if len(sys.argv) > 2 else 10)
