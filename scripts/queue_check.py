"""כלי מפתח: בדיקת המשרות שמחכות בתור של משתמש (לא שמורות, לא נבדקו). קריאה בלבד, אלא אם apply=yes.
לכל משרה: עדיין פתוחה? (live.check) · כפולה? (same_key) · מתאימה לתוכנית? (hands_on / off_field / is_post).
apply=yes: משרות שנסגרו או כפולות יורדות מהתור (decision=filtered). משרה שלא מתאימה רק מדווחת — זה תיקון לכל המשתמשים.
בלי idx: רשימת משתמשים (מספר, תחומים, כמה מחכות). היומן אנונימי: מספר משתמש, כותרת וחברה בלבד.

  python scripts/queue_check.py [idx] [apply]
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx  # noqa: E402

from agent_core import cloud_store as db  # noqa: E402
from agent_core.agents import hunter as h, live  # noqa: E402
from scripts.insights import get  # noqa: E402
from scripts.user_diag import plan_for  # noqa: E402


def pending(uid):
    return [r for r in db.all_jobs(uid, days=60) if not r.get("decision") and (r.get("card") or {}).get("title")]


def main(idx: str = "", apply: bool = False):
    users = sorted(db.auth_users(), key=lambda u: u.get("created_at") or "")
    if idx == "":
        for i, u in enumerate(users):
            p = (get("profiles", select="answers,state,cv_text", user_id=f"eq.{u['id']}") or [{}])[0]
            plan = plan_for(u["id"], p, p.get("state") or {})
            print(f"#{i}: {', '.join(plan.get('domains') or [plan.get('domain') or ''])} | מחכות {len(pending(u['id']))}")
        return
    u = users[int(idx)]
    p = (get("profiles", select="answers,state,cv_text", user_id=f"eq.{u['id']}") or [{}])[0]
    plan = plan_for(u["id"], p, p.get("state") or {})
    rows = sorted(pending(u["id"]), key=lambda r: -float((r["card"] or {}).get("fit") or 0))
    seen, out = {}, {"open": [], "closed": [], "unknown": [], "dup": [], "unfit": []}
    cx = httpx.Client(timeout=12, follow_redirects=True, headers={"User-Agent": live.UA, "Accept-Language": "en-US,en;q=0.9,he;q=0.8"})
    for r in rows:
        c = r["card"]
        j = {"title": c["title"], "company": c.get("co") or ""}
        name = f"{c['title']} @ {c.get('co') or '?'} ({c.get('fit') or '?'}, {str(r.get('created_at'))[:10]})"
        k = h.same_key(j)
        if k in seen:
            out["dup"].append((r, name)); continue
        seen[k] = r
        why = "מפעיל/טכנאי" if h.hands_on(j, plan) else "לא מהתחום" if h.off_field(j, plan) else "פוסט" if h.is_post(j) else ""
        if why:
            out["unfit"].append((r, f"{name} — {why}"))
        st = live.check(c.get("url") or "", cx)
        if st == "unknown":   # למה לא ידוע: האתר והקוד שהחזיר (בלי הכתובת המלאה)
            u_ = c.get("url") or ""
            m = re.search(r"linkedin\.com/jobs/view/(?:[^/?#]*-)?(\d+)", u_)
            try:
                code = cx.get(f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{m.group(1)}" if m else u_).status_code if u_ else "אין קישור"
            except httpx.HTTPError as e:
                code = type(e).__name__
            mi = live.INDEED.search(u_)
            if mi:   # מה ה-API של Indeed החזיר
                from jobspy.indeed.constant import headers
                rr = cx.post("https://apis.indeed.com/graphql", headers=headers, json={"query": live.INDEED_Q.format(mi.group(1))})
                code = f"api {rr.status_code} {rr.text[:140]}"
            name += f" [{(re.search(r'//([^/]+)', u_) or [None, '?'])[1]} {code}]"
        out[st].append((r, name))
    print(f"משתמש #{idx}: {len(rows)} מחכות | פתוחות {len(out['open'])} · נסגרו {len(out['closed'])} · לא ידוע {len(out['unknown'])}"
          f" · כפולות {len(out['dup'])} · לא מתאימות {len(out['unfit'])}")
    for key, title in (("closed", "נסגרו"), ("dup", "כפולות"), ("unfit", "לא מתאימות לתוכנית (לבדוק, לא יורדות)"),
                       ("open", "פתוחות (לפי ציון)"), ("unknown", "לא ידוע (האתר חוסם/לא עונה)")):
        if out[key]:
            print(f"\n{title}:")
            for _, n in out[key]:
                print("  " + n)
    if apply:
        for key, why in (("closed", "המשרה נסגרה"), ("dup", "כפולה")):
            for r, _ in out[key]:
                db.update_job(u["id"], r["id"], {"decision": "filtered", "card": {**r["card"], "filtered_why": why}})
        print(f"\nירדו מהתור: {len(out['closed']) + len(out['dup'])}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "", len(sys.argv) > 2 and sys.argv[2] == "yes")
