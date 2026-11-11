"""
insights.py — כלי מפתח: תובנות על החיפוש והמציאה של כל המשתמשים. קריאה בלבד, אנונימי.
מדפיס רק מספרים, שמות משרות ושמות חברות (מידע ציבורי). בלי שמות משתמשים, בלי קורות חיים, בלי מכתבים.
  python scripts/insights.py [ימים=14]

מה בודקים:
  1. לכל משתמש: כמה נאספו / נפסלו כבכירות / דורגו / הוצגו בכל סריקה, וכמה סריקות יצאו ריקות
  2. מה המשתמשים עשו עם מה שהוצג: שמירה מול דילוג, לפי ציון ולפי מקור
  3. אילו מקורות וחיפושים מביאים משרות שמתאימות, ואילו "מתים" (מביאים הרבה ולא מתאים כלום)
  4. למה משרות נפסלות, ובאיזה ציונים
  5. כמה עדכניות המשרות שמוצגות
"""
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from agent_core import cloud_store as db
from agent_core.profile import normalize_answers

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 14
since = (datetime.now(timezone.utc) - timedelta(days=DAYS)).isoformat()
H, U = db._h(), db._url


def get(table, **params):
    out, off = [], 0
    while True:
        r = httpx.get(U(table), headers={**H, "Range": f"{off}-{off + 999}"}, params=params, timeout=60)
        r.raise_for_status()
        rows = r.json()
        out += rows
        if len(rows) < 1000:
            return out
        off += 1000


def pct(a, b):
    return f"{round(100 * a / b)}%" if b else "-"


def band(f):
    f = float(f or 0)
    return "4.5+" if f >= 4.5 else "4.0–4.5" if f >= 4 else "3.5–4.0" if f >= 3.5 else "3.0–3.5 (השלמה)" if f >= 3 else "<3"


users = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")
alias = {u["id"]: ("אור" if i == 0 else f"משתמש {i}") for i, u in enumerate(users)}
profs = {p["user_id"]: p for p in get("profiles", select="user_id,answers,state")}
runs = get("runs", select="user_id,stats,created_at", agent="eq.hunter", created_at=f"gte.{since}", order="created_at.asc")
scans = [r for r in runs if isinstance(r.get("stats"), dict) and "collected" in r["stats"]]
jobs = get("jobs", select="user_id,card,fit,decision,created_at", created_at=f"gte.{since}")

print(f"תובנות על החיפוש — {DAYS} הימים האחרונים. {len(users)} משתמשים, {len(scans)} סריקות, {len(jobs)} משרות במסד.\n")

# ── 1. לכל משתמש ──
print("1) לכל משתמש: סריקות ותוצאות")
print(f"   {'משתמש':<10} {'תחום':<22} {'ניסיון':<22} {'סריקות':>6} {'נאספו':>6} {'בכירות':>7} {'דורגו':>6} {'הוצגו':>6} {'ריקות':>6} {'מפתח':>5}")
per_user = defaultdict(list)
for r in scans:
    per_user[r["user_id"]].append(r["stats"])
for u in users:
    uid = u["id"]
    ss = per_user.get(uid, [])
    a = normalize_answers((profs.get(uid) or {}).get("answers") or {})
    st = (profs.get(uid) or {}).get("state") or {}
    dom = ", ".join(a.get("domains") or ["-"])[:22]
    avg = lambda k: round(sum(s.get(k, 0) or 0 for s in ss) / len(ss)) if ss else 0
    empty = sum(1 for s in ss if not s.get("shown"))
    from agent_core.llm_router import valid_key
    print(f"   {alias[uid]:<10} {dom:<22} {str(a.get('exp') or '-'):<22} {len(ss):>6} {avg('collected'):>6} {avg('too_senior'):>7} {avg('rated'):>6} {avg('shown'):>6} {empty:>6} {'כן' if valid_key(st.get('ai_key')) else 'לא':>5}")

# ── 2. מה עשו עם מה שהוצג ──
shown = [j for j in jobs if j.get("decision") in (None, "save", "skip", "applied")]
dec = Counter(j.get("decision") or "ממתין" for j in shown)
print(f"\n2) מה קרה למשרות שהוצגו ({len(shown)}): נשמרו {dec['save'] + dec['applied']}, דולגו {dec['skip']}, ממתינות {dec['ממתין']}")
by_band = defaultdict(Counter)
by_src = defaultdict(Counter)
for j in shown:
    c = j.get("card") or {}
    d = j.get("decision") or "wait"
    by_band[band(j.get("fit"))][d] += 1
    by_src[c.get("src") or "?"][d] += 1
print("   לפי ציון (נשמרו / דולגו / ממתינות → אחוז שמירה מתוך מה שהוחלט):")
for b in ["4.5+", "4.0–4.5", "3.5–4.0", "3.0–3.5 (השלמה)"]:
    c = by_band.get(b, Counter())
    s, k = c["save"] + c["applied"], c["skip"]
    print(f"   {b:<18} {s:>4} / {k:>4} / {c['wait']:>4}   → {pct(s, s + k)}")
print("   לפי מקור:")
for src, c in sorted(by_src.items(), key=lambda x: -sum(x[1].values())):
    s, k = c["save"] + c["applied"], c["skip"]
    print(f"   {src:<18} הוצגו {sum(c.values()):>4}, נשמרו {s:>3}, דולגו {k:>3}   → {pct(s, s + k)}")

# ── 3. מקורות וחיפושים ──
q = defaultdict(Counter)
for s in (r["stats"] for r in scans):
    for name, v in (s.get("queries") or {}).items():
        for k in ("got", "new", "fit"):
            q[name][k] += int(v.get(k, 0) or 0)
good = sorted(q.items(), key=lambda x: -x[1]["fit"])[:12]
dead = sorted([x for x in q.items() if x[1]["got"] >= 20 and x[1]["fit"] == 0], key=lambda x: -x[1]["got"])[:12]
print(f"\n3) חיפושים ({len(q)} שונים). הכי מוצלחים (נאספו → חדשות → מתאימות):")
for name, c in good:
    print(f"   {name[:46]:<46} {c['got']:>5} → {c['new']:>5} → {c['fit']:>3}")
print("   'מתים': מביאים הרבה ושום דבר לא מתאים:")
for name, c in dead or [("אין", Counter())]:
    print(f"   {name[:46]:<46} {c['got']:>5} → {c['new']:>5} → 0")

# ── 4. למה נפסלות ──
filt = [j for j in jobs if j.get("decision") == "filtered"]
why = Counter()
for j in filt:
    w = str((j.get("card") or {}).get("filtered_why") or "?")
    why["ציון נמוך" if w.startswith("ציון") else w] += 1
fb = Counter(band(j.get("fit")) for j in filt if str((j.get("card") or {}).get("filtered_why", "")).startswith("ציון"))
print(f"\n4) נפסלו אחרי דירוג או סינון: {len(filt)}. סיבות: {dict(why.most_common(6))}")
print(f"   ציוני הנפסלות בגלל ציון: {dict(sorted(fb.items()))}")
tags = Counter(str((j.get("card") or {}).get("level_gap") or "") for j in shown if (j.get("card") or {}).get("level_gap"))
print(f"   משרות מוצגות עם תגית ניסיון: {dict(tags)}")

# ── 5. עדכניות ──
ages = []
for j in shown:
    p = str((j.get("card") or {}).get("posted") or "")[:10]
    try:
        ages.append((datetime.fromisoformat(j["created_at"][:10]) - datetime.fromisoformat(p)).days)
    except ValueError:
        pass
if ages:
    ages.sort()
    print(f"\n5) גיל המשרות כשהוצגו (ימים מפרסום): חציון {ages[len(ages) // 2]}, "
          f"עד שבוע {pct(sum(a <= 7 for a in ages), len(ages))}, מעל חודש {pct(sum(a > 30 for a in ages), len(ages))} (מתוך {len(ages)} עם תאריך)")

# ── 6. משרות שהוצגו לכמה משתמשים ──
dup = Counter(((j.get("card") or {}).get("title", ""), (j.get("card") or {}).get("co", "")) for j in shown)
multi = [(t, c, n) for (t, c), n in dup.items() if n > 1]
print(f"\n6) משרות שהוצגו ליותר ממשתמש אחד: {len(multi)}" + ("".join(f"\n   {t[:40]} @ {c[:20]} ×{n}" for t, c, n in sorted(multi, key=lambda x: -x[2])[:5])))
