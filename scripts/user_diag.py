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


def plan_for(uid, p, st):
    """תוכנית החיפוש כמו ב-nightly: שאילתות שנלמדו, תפקידים שאושרו וסיבות דילוג."""
    learned = db.latest_plan(uid, "meeting")
    return build_search_plan({"cv_text": p.get("cv_text") or "", "answers": p.get("answers") or {},
                              "extra_titles": [x["value"] for x in st.get("accepted") or [] if x.get("type") == "role"],
                              "drop_queries": learned.get("drop_queries") or [], "learned_queries": learned.get("add_queries") or [],
                              "skip_reasons": {k: v.get("r") for k, v in (st.get("skip") or {}).items() if isinstance(v, dict)}}).to_dict()


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
    us = st.get("usage") or {}
    print(f"   שימוש: אבני דרך {us.get('m')} | ימים {us.get('days')} | שגיאות {us.get('err')}")
    print(f"   אירועים אחרונים: {(us.get('ev') or [])[-15:]}")
    print(f"   טלגרם: {st.get('telegram') or st.get('tg_channels') or '-'} | דילוגים עם סיבה: {Counter(v.get('r') for v in (st.get('skip') or {}).values() if isinstance(v, dict))}")
    try:
        plan = plan_for(uid, p, st)
        print(f"   תוכנית חיפוש: levels={plan.get('levels')} domains={plan.get('domains')}\n   שאילתות: {plan.get('queries')}")
    except Exception as e:  # noqa: BLE001
        plan = {}
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

    # למה משרה עברה ונדחתה: סיבת הדילוג, ציון, תקרת ניסיון, השלמה, ומה הסוכן המדרג קיבל מהטעם
    from agent_core.agents.hunter import off_field, prefs_text, MIN_SHOWN, NEAR_FIT
    from agent_core.taste import learn, role_words
    skips = st.get("skip") or {}
    try:
        plan["taste"] = learn(db.all_jobs(uid, days=60), skips, st.get("taste_off") or [], role_words(plan))
        print(f"\nטעם: { {k: plan['taste'][k] for k in ('likes', 'dislikes', 'avoid_cos', 'avoid_locs', 'reasons', 'own', 'n')} }")
        print(f"   prefs_text לסוכן המדרג: {prefs_text(plan)[:600]}")
    except Exception as e:  # noqa: BLE001
        print(f"   טעם: {e}")
    print(f"\nהחלטות בפירוט (סף 3.5, השלמה ל-{MIN_SHOWN} מ-{NEAR_FIT}):")
    for j in [j for j in jobs if j.get("decision") in ("skip", "removed", "save", "applied")][:40]:
        c, k = j["card"] or {}, skips.get((j["card"] or {}).get("id")) or {}
        print(f"   {j['decision']:<7} {float(j.get('fit') or 0):.1f} near={int(bool(c.get('near')))} off_field={int(off_field({'title': c.get('title')}, plan))} "
              f"gap={c.get('level_gap') or '-'} dims={c.get('dims') or {}} | סיבה={k.get('r') or '-'} {('«' + k['x'] + '»') if k.get('x') else ''} | q={c.get('q') or '?'} | {str(c.get('title'))[:50]}")
    qs = {}
    for r in runs:
        for q, v in ((r.get("stats") or {}).get("queries") or {}).items():
            t = qs.setdefault(q, [0, 0, 0]); t[0] += v.get("got", 0); t[1] += v.get("new", 0); t[2] += v.get("fit", 0)
    print("\nתשואה לפי שאילתה (נאספו → חדשות → עברו סף):")
    for q, (g, n, f) in sorted(qs.items(), key=lambda x: -x[1][1]):
        print(f"   {str(q)[:45]:<45} {g:>5} → {n:>4} → {f:>3}")
    tot = Counter()
    for r in runs:
        tot.update({k: v for k, v in (r.get("stats") or {}).items() if isinstance(v, int)})
    print(f"   סיכום משפך: {dict(tot)}")
    # הסוכנים: ריצות, משימות ותקלות של המשתמש, וטוקנים היום (מכסה משותפת, מתאפסת כל יום)
    ag = get("runs", select="agent,stats,created_at", user_id=f"eq.{uid}", created_at=f"gte.{since}")
    fails = Counter(r["agent"] for r in ag if (r.get("stats") or {}).get("failures"))
    print(f"\nריצות לפי סוכן: {dict(Counter(r['agent'] for r in ag))} | עם תקלות: {dict(fails)}")
    tk = get("agent_tasks", select="kind,status", user_id=f"eq.{uid}", created_at=f"gte.{since}") or []
    print(f"   agent_tasks: {dict(Counter((t.get('kind'), t.get('status')) for t in tk))}")
    for d, ag in sorted((db.system_memory("budget_hist").get("days") or {}).items())[-7:]:
        print(f"   טוקנים {d}: " + ", ".join(f"{a} {sum(v.values()):,}" for a, v in sorted(ag.items(), key=lambda x: -sum(x[1].values()))))
    for f in (db.system_memory("budget").get("files") or {}).values():
        d = f if isinstance(f, dict) else {}
        for k, u in (d.get("usage") or {}).items():
            print(f"   טוקנים {d.get('date')} {k}: {u.get('calls')} קריאות, {u.get('tokens')} טוקנים, משימות {u.get('tasks')}")
    # מכתבים: מספרים בלבד (בלי טקסט, הריפו ציבורי)
    import re, statistics
    from agent_core.agents.letter_graph import slop_in
    lrows = [j for j in (get("jobs", select="letter,decision", user_id=f"eq.{uid}", letter="not.is.null") or []) if (j.get("letter") or {}).get("text")]
    lt = [j["letter"] for j in lrows]
    if lrows:
        from agent_core.handoffs import LETTER_V
        print(f"\nמכתבים ישנים (מתחת ל-v{LETTER_V}) לפי החלטה: {dict(Counter(j.get('decision') for j in lrows if (j['letter'].get('v') or 0) < LETTER_V))} (רק שמורות נכתבות מחדש)")
        sc = [x["score"] for x in lt if x.get("score")]
        if sc:
            print(f"   6 הכללים (מכתבים חדשים, {len(sc)}): " + ", ".join(f"{k} {sum(bool(d.get(k)) for d in sc)}/{len(sc)}" for k in sc[0]))
    if lt:
        wc = [len(x["text"].split()) for x in lt]
        paras = [x["text"].strip().split("\n\n") for x in lt]
        firsts = Counter(re.sub(r"\W+", " ", (pp[1] if len(pp) > 1 else pp[0]).lower())[:60] for pp in paras)
        prj = Counter(tuple(sorted(x.get("projects") or [])) for x in lt)
        print(f"\nמכתבים: {len(lt)} | גרסאות {dict(Counter(x.get('v') for x in lt))} | שפה {dict(Counter(x.get('lang') for x in lt))} | סבבי תיקון {dict(Counter(x.get('rounds') for x in lt))} | לא עברו בדיקת אמת {sum(not x.get('checked') for x in lt)}")
        print(f"   מילים: חציון {statistics.median(wc)}, טווח {min(wc)}–{max(wc)} | פסקאות {dict(Counter(len(pp) for pp in paras))} | ביטויים שחוקים {sum(bool(slop_in(x['text'])) for x in lt)}")
        print(f"   פתיחות שונות: {len(firsts)}/{len(lt)} (הנפוצה ×{firsts.most_common(1)[0][1]}) | צירופי פרויקטים שונים: {len(prj)} (הנפוץ ×{prj.most_common(1)[0][1]}) | בלי פרויקט {sum(not x.get('projects') for x in lt)}")
        print(f"   העתקת מכתב (אירועים אחרונים): {sum(1 for e in (us.get('ev') or []) if e.get('e') == 'letter_copy')} | אחרונה {(us.get('m') or {}).get('letter_copy')}")

if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "" else None, int(sys.argv[2]) if len(sys.argv) > 2 else 10)
