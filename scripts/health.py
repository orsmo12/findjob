"""
health.py — כלי מפתח: בדיקת בריאות של כל המערכת, קריאה בלבד. מדפיס ✓ / ✗ לכל בדיקה, בלי פרטים אישיים.
  python scripts/health.py
"""
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx

SITE = "https://findjob-web.vercel.app"
ok_all = True


def check(name: str, ok: bool, note: str = "") -> None:
    global ok_all
    ok_all &= bool(ok)
    print(f"{'✓' if ok else '✗'} {name}" + (f" — {note}" if note else ""))


def main() -> None:
    with httpx.Client(timeout=20, follow_redirects=True) as cx:
        # ── האתר ב-Vercel ──
        r = cx.get(SITE + "/")
        check("האתר עולה", r.status_code == 200, str(r.status_code))
        check("מפתח ההתראות הציבורי בתוך האפליקציה", "VAPID_PUB='B" in r.text)
        check("כפתור Google בדף הכניסה", "cloudGoogle" in r.text)
        for p in ("/privacy.html", "/sw.js", "/manifest.webmanifest", "/icon.svg"):
            rr = cx.get(SITE + p)
            check(f"קובץ {p}", rr.status_code == 200, str(rr.status_code))
        rr = cx.post(SITE + "/api/prepnow", json={"token": "x"})
        check("להכין עכשיו: דוחה בלי התחברות (401), והטוקן מוגדר", rr.status_code == 401, f"{rr.status_code} {rr.text[:60]}")
        rr = cx.get(SITE + "/api/cron")
        check("cron: דוחה בלי הסוד (401)", rr.status_code == 401, str(rr.status_code))
        rr = cx.post(SITE + "/api/chat", json={"token": "x", "messages": []})
        check("צ׳אט: דוחה בלי התחברות", rr.status_code in (401, 400), str(rr.status_code))

        # ── Supabase ──
        from agent_core import cloud_store as db
        H, U = db._h(), db._url
        for table, col in (("agent_tasks", "id"), ("jobs", "tailor"), ("profiles", "chat_use")):
            rr = cx.get(U(table), headers=H, params={"select": col, "limit": "1"})
            check(f"מסד: {table}.{col}", rr.status_code == 200, "" if rr.status_code == 200 else rr.text[:80])
        rr = cx.post(SITE.replace(SITE, os.environ["SUPABASE_URL"].rstrip("/")) + "/rest/v1/rpc/delete_my_account", headers=H, json={})
        check("מסד: הפונקציה delete_my_account קיימת (ומסרבת בלי משתמש)", "not signed in" in rr.text, f"{rr.status_code} {rr.text[:80]}")
        anon = cx.get(U("profiles"), headers={"apikey": re.search(r'"key":"([^"]+)"', r.text).group(1)}, params={"select": "user_id", "limit": "5"})
        check("אבטחה: מפתח ציבורי בלי התחברות לא רואה פרופילים", anon.status_code in (200, 401) and (anon.status_code == 401 or anon.json() == []),
              f"{anon.status_code}, {len(anon.json()) if anon.status_code == 200 else 0} שורות")

        profs = cx.get(U("profiles"), headers=H, params={"select": "user_id,cv_text,answers,state"}).json()
        users = [p for p in profs if p.get("cv_text")]
        check("משתמשים עם קורות חיים", len(users) >= 1, str(len(users)))
        pushes = sum(1 for p in profs if ((p.get("state") or {}).get("push") or {}).get("endpoint"))
        print(f"  · מנויים להתראות בטלפון: {pushes}")
        kits = sum(1 for p in profs if ((p.get("answers") or {}).get("kit") or {}).get("phone"))
        print(f"  · מילאו פרטים לטפסים: {kits}")

        since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        tasks = cx.get(U("agent_tasks"), headers=H, params={"select": "status,kind", "created_at": f"gte.{since}"}).json()
        by = {}
        for t in tasks:
            by[t["status"]] = by.get(t["status"], 0) + 1
        print(f"  · משימות בין סוכנים ב-24 שעות: {by or 'אין'}")
        check("אין משימות שנכשלו ב-24 שעות", not by.get("failed"), str(by.get("failed", 0)))

        runs = cx.get(U("runs"), headers=H, params={"select": "stats,created_at", "created_at": f"gte.{since}", "limit": "500"}).json()
        fails = [x for x in runs if isinstance((x.get("stats") or {}).get("failures"), list)]
        check("אין דוחות תקלות ב-24 שעות", not fails, f"{len(fails)}: " + "; ".join(f["where"] + " " + f["error"][:60] for x in fails for f in x["stats"]["failures"][:3]))
        quota = any((x.get("stats") or {}).get("msg", "").startswith("הגעתי לגבול מכסת") for x in runs)
        check("מכסת ה-AI לא נגמרה היום", not quota)

        jobs = cx.get(U("jobs"), headers=H, params={"select": "card,letter,brief,tailor,decision", "decision": "eq.save"}).json()
        open_ = [j for j in jobs if not (j.get("card") or {}).get("closed_at")]
        n = len(open_) or 1
        print(f"  · משרות שמורות פתוחות: {len(open_)} | מכתב v4: {sum(1 for j in open_ if (j.get('letter') or {}).get('v') == 4)}"
              f" | סקירה: {sum(1 for j in open_ if j.get('brief'))} | התאמת קו״ח: {sum(1 for j in open_ if j.get('tailor'))}"
              f" | נבדקו אם פתוחות: {sum(1 for j in open_ if (j.get('card') or {}).get('check'))}")
        tg = cx.get(U("jobs"), headers=H, params={"select": "card", "card->>src": "eq.Telegram", "limit": "5"}).json()
        print(f"  · משרות מטלגרם במסד: {len(tg)}")

    print("\n" + ("הכל תקין ✓" if ok_all else "יש מה לתקן ✗"))


if __name__ == "__main__":
    main()
