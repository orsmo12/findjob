"""
e2e.py — כלי מפתח: בדיקה מקצה לקצה במערכת האמיתית, עם משתמש בדיקה זמני (מהנדס מכונות בדיוני).

  1. יוצר משתמש בדיקה ב-Supabase + פרופיל (קורות חיים בדיוניים, שאלון של הנדסת מכונות)
  2. נכנס לאתר האמיתי בדפדפן (Playwright, קישור כניסה חד-פעמי) ומפעיל "סריקה ראשונה" מהאפליקציה עצמה
  3. מחכה שדורון יסיים, ומדפיס אילו משרות נמצאו (כך רואים אם להנדסת מכונות יש משרות אמיתיות)
  4. שומר את המשרה הטובה ביותר ומריץ את הסוכנים (סקירה, התאמת קו״ח, הכנה, מכתב), ובודק שהכל נוצר
  5. שואל את שי שאלה בצ׳אט, ובודק שאין שגיאות JavaScript בדפדפן
  6. מוחק את החשבון דרך "מחיקת חשבון" האמיתית, ובודק שלא נשאר כלום
המשתמש בדיקה נמחק תמיד בסוף, גם אם משהו נכשל. לא נוגע במשתמשים אמיתיים.
"""
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
SITE = "https://findjob-web.vercel.app"
SB = os.environ["SUPABASE_URL"].rstrip("/")
SK = os.environ["SUPABASE_SERVICE_KEY"]
ADM = {"apikey": SK, "Authorization": "Bearer " + SK, "Content-Type": "application/json"}
OUT = Path("e2e_out"); OUT.mkdir(exist_ok=True)
ok_all = True

CV = """Noa Tester — Mechanical Engineer (B.Sc.)  [fictional test profile]
Tel Aviv, Israel

EDUCATION
B.Sc. Mechanical Engineering, Tel Aviv University, 2022-2026. GPA 86.
Final project: design of a lightweight drone landing gear — SolidWorks modeling, FEA in ANSYS, 3D-printed prototype and load tests.

SKILLS
SolidWorks, AutoCAD, ANSYS (static and modal FEA), GD&T, MATLAB, Python (basic), 3D printing, CNC basics, technical drawing.
Hebrew (native), English (very good).

PROJECTS
- Formula Student team (2024-2025): suspension upright design, tolerance analysis, worked with machine shop on CNC parts.
- Heat-exchanger thermal analysis course project: MATLAB model and test-rig measurements.

EXPERIENCE
- Student lab assistant, materials lab (2025): ran tensile tests, wrote test reports.
"""
ANSWERS = {"study": "סטודנט/ית לתואר", "year": "שנה ה׳ ומעלה", "work": "עובד/ת בתחום", "scope": ["משרה מלאה", "משרה חלקית / משרת סטודנט"],
           "domains": ["הנדסת מכונות"], "exp": "פחות משנה",
           "roles": ["תכנון מכני", "R&D ופיתוח מוצר", "ייצור ותהליכים"], "locs": ["תל אביב", "גוש דן והמרכז", "השרון"],
           "mode": "היברידי", "english": "טובה מאוד"}   # השאלון החדש: סטודנט שנה ה׳ שעובד בתחום, משרה מלאה וחלקית


def check(name, cond, note=""):
    global ok_all
    ok_all &= bool(cond)
    print(f"{'✓' if cond else '✗'} {name}" + (f" — {note}" if note else ""), flush=True)


def rest(path, **kw):
    return httpx.request(kw.pop("method", "GET"), f"{SB}/rest/v1/{path}", headers={**ADM, **kw.pop("headers", {})}, timeout=30, **kw)


def wait_prep_done(uid, since, minutes):
    t0 = time.time()
    while time.time() - t0 < minutes * 60:
        r = rest("runs", params={"select": "plan,created_at", "user_id": f"eq.{uid}", "plan->>prep_done": "not.is.null",
                                 "created_at": f"gte.{since}", "limit": "1"}).json()
        if r:
            return True
        time.sleep(20)
    return False


def main():
    email = f"findjob.e2e.{int(time.time())}@example.com"
    r = httpx.post(f"{SB}/auth/v1/admin/users", headers=ADM, json={"email": email, "email_confirm": True}, timeout=30)
    check("1. יצירת משתמש בדיקה", r.status_code in (200, 201), str(r.status_code))
    uid = r.json()["id"]
    try:
        run(uid, email)
    finally:
        httpx.delete(f"{SB}/auth/v1/admin/users/{uid}", headers=ADM, timeout=30)   # ניקוי, גם אם נכשל באמצע
        left = rest("profiles", params={"select": "user_id", "user_id": f"eq.{uid}"}).json()
        jobs = rest("jobs", params={"select": "id", "user_id": f"eq.{uid}", "limit": "1"}).json()
        check("ניקוי: לא נשאר כלום ממשתמש הבדיקה", not left and not jobs)
    print("\n" + ("הכל תקין ✓" if ok_all else "יש מה לתקן ✗"))


def run(uid, email):
    r = rest("profiles", method="POST", headers={"Prefer": "resolution=merge-duplicates"},
             json=[{"user_id": uid, "first": "נועה", "name": "נועה בדיקה", "cv_text": CV, "answers": ANSWERS,
                    "state": {"onboarded": True, "tourDone": True, "tips": {"jobs": 1, "apps": 1, "profile": 1}}}])
    check("   פרופיל: קורות חיים ושאלון הנדסת מכונות", r.status_code in (200, 201, 204), str(r.status_code))
    from agent_core.profile import build_search_plan
    plan = build_search_plan({"cv_text": CV, "answers": ANSWERS}).to_dict()
    print(f"   תוכנית חיפוש: {plan['titles'][:6]} | עברית: {plan.get('he_queries')} | רמות: {plan['levels']} | ניסיון: {plan.get('have_years')}")

    link = httpx.post(f"{SB}/auth/v1/admin/generate_link", headers=ADM, timeout=30,
                      json={"type": "magiclink", "email": email, "redirect_to": SITE + "/"}).json()
    action = link.get("action_link") or (link.get("properties") or {}).get("action_link")
    check("   קישור כניסה חד-פעמי", bool(action))

    # ── שלב א: כניסה בדפדפן, בדיקת המסכים, והפעלת סריקה ראשונה מהאפליקציה ──
    since = datetime.now(timezone.utc).isoformat()
    res = browser("phase1", action)
    check("2. כניסה לאתר האמיתי בדפדפן", res.get("logged_in"), res.get("note", ""))
    check("   אין שגיאות JavaScript", not res.get("errors"), "; ".join(res.get("errors", [])[:3]))
    check("   הסריקה הראשונה הופעלה מהאפליקציה (prepnow)", res.get("prep_ok"), res.get("prep_note", ""))
    token = res.get("token") or ""

    # ── "אחר" בשאלון: יואב הופך טקסט חופשי לתפקידים אמיתיים, ובדיקת מפתח של ספק אחר ──
    if token:
        d = httpx.post(SITE + "/api/domain", json={"token": token, "cv": CV, "hint": "מהנדס מיזוג אוויר ותכנון HVAC", "kind": "roles"}, timeout=60)
        dj = d.json() if d.status_code == 200 else {}
        check("   'אחר' בשאלון: יואב תרגם טקסט חופשי לתפקידים", bool(dj.get("roles")), "; ".join(f"{r['label']} → {', '.join(r['titles'])}" for r in dj.get("roles", [])[:3]) or d.text[:80])
        k = httpx.post(SITE + "/api/checkkey", json={"token": token, "key": "AIzaSy" + "x" * 33}, timeout=30).json()
        check("   בדיקת מפתח Gemini: מזהה את הספק ודוחה מפתח מזויף", k.get("provider") == "gemini" and not k.get("ok"), str(k))
        mail = ("Hi, thank you for applying to the Mechanical Engineer position at Acme. After careful review we decided "
                "to move forward with other candidates. We wish you the best of luck. Dana, Talent team")
        m = httpx.post(SITE + "/api/mailparse", json={"token": token, "text": mail, "co": "Acme", "title": "Mechanical Engineer"}, timeout=60).json()
        check("   הדבקת מייל: שי מזהה דחייה ולא ממציא תאריך", m.get("kind") == "rejection" and not m.get("when"), str(m)[:160])

    # ── שלב ב: דורון סורק. מחכים לסיום ──
    done = res.get("prep_ok") and wait_prep_done(uid, since, 32)
    check("3. הסריקה הראשונה הסתיימה", done)
    jobs = rest("jobs", params={"select": "id,card,fit,decision", "user_id": f"eq.{uid}", "order": "fit.desc", "limit": "60"}).json()
    shown = [j for j in jobs if j.get("decision") is None]
    filt = [j for j in jobs if j.get("decision") == "filtered"]
    check("   נמצאו משרות להנדסת מכונות", len(shown) >= 3, f"{len(shown)} מוצגות, {len(filt)} סוננו")
    print("\n   המשרות שנמצאו (ציון · תפקיד · חברה · מקור · פער ניסיון):")
    for j in shown[:20]:
        c = j["card"]
        print(f"   {c.get('fit', 0):.1f} · {c.get('title', '')[:45]} · {c.get('co', '')[:22]} · {c.get('src', '')} · {c.get('level_gap') or '-'}")
    srcs = {}
    for j in shown:
        srcs[j["card"].get("src", "?")] = srcs.get(j["card"].get("src", "?"), 0) + 1
    print(f"   לפי מקור: {srcs}")
    if filt:
        print("   דוגמאות לסינון: " + "; ".join(f"{j['card'].get('title', '')[:30]} ({j['card'].get('filtered_why', '')[:30]})" for j in filt[:5]))
    logs = rest("runs", params={"select": "stats", "user_id": f"eq.{uid}", "stats->>log": "not.is.null", "order": "created_at.asc", "limit": "300"}).json()
    hl = [x["stats"]["log"] for x in logs if any(k in x["stats"]["log"] for k in ("איחדתי", "סיננתי", "מדרג את", "טלגרם", "דפי קריירה", "אספתי"))]
    print("   מיומן דורון:", *hl[:8], sep="\n     ")

    # ── שלב ג: שמירת המשרה הטובה והרצת הסוכנים ──
    if shown:
        best = shown[0]
        rest(f"jobs?user_id=eq.{uid}&id=eq.{best['id']}", method="PATCH", json={"decision": "save"})
        since2 = datetime.now(timezone.utc).isoformat()
        rest(f"profiles?user_id=eq.{uid}", method="PATCH", json={"chat_use": {}})   # בלי המתנת 10 הדקות בין הפעלות
        d = httpx.post(SITE + "/api/prepnow", json={"token": token, "kind": "prep"}, timeout=30)   # כמו הכפתור "לעדכן הכל עכשיו"
        check("4. שמירת משרה ו\"לעדכן הכל עכשיו\"", d.status_code == 200, f"{d.status_code} {d.text[:80]}")
        wait_prep_done(uid, since2, 14)
        row = rest("jobs", params={"select": "card,letter,brief,prep,tailor", "user_id": f"eq.{uid}", "id": f"eq.{best['id']}"}).json()[0]
        lt = row.get("letter") or {}
        check("   גיל: סקירת חברה", bool(row.get("brief")))
        check("   קובי: התאמת קורות חיים", row.get("tailor") is not None)
        check("   מאיה: שאלות הכנה", bool((row.get("prep") or {}).get("tasks") is not None))
        check("   שי: מכתב בגרסה האחרונה", (lt.get("v") or 0) >= 6, f"v{lt.get('v')}, {len((lt.get('text') or '').split())} מילים, בדיקת אמת: {lt.get('checked')}")
        if lt.get("text"):
            (OUT / "letter.txt").write_text(lt["text"])

    # ── שלב ד: צ׳אט עם שי ──
    if token:
        c = httpx.post(SITE + "/api/chat", json={"token": token, "messages": [{"role": "user", "content": "איך מפעילים התראות על משרות חדשות? צריך אימייל?"}]}, timeout=60)
        txt = (c.json() or {}).get("reply") or (c.json() or {}).get("text") or c.text
        check("5. שי עונה בצ׳אט", c.status_code == 200 and len(str(txt)) > 30, str(txt)[:160].replace("\n", " "))

    # ── שלב ה: דפדפן שוב: המשרות מוצגות, ואז מחיקת חשבון אמיתית ──
    res2 = browser("phase2", action_refresh(email))
    check("6. המשרות מוצגות באפליקציה", res2.get("cards", 0) > 0, f"{res2.get('cards', 0)} כרטיסים")
    check("   אין שגיאות JavaScript", not res2.get("errors"), "; ".join(res2.get("errors", [])[:3]))
    check("7. מחיקת חשבון מהאפליקציה", res2.get("deleted"), res2.get("del_note", ""))
    left = rest("profiles", params={"select": "user_id", "user_id": f"eq.{uid}"}).json()
    check("   הפרופיל נמחק מהמסד", not left)


def action_refresh(email):
    l = httpx.post(f"{SB}/auth/v1/admin/generate_link", headers=ADM, timeout=30,
                   json={"type": "magiclink", "email": email, "redirect_to": SITE + "/"}).json()
    return l.get("action_link") or (l.get("properties") or {}).get("action_link")


def browser(phase, link):
    p = subprocess.run(["node", "scripts/e2e_browser.js", phase, link, str(OUT)], capture_output=True, text=True, timeout=240)
    last = [x for x in p.stdout.splitlines() if x.startswith("RESULT ")]
    if p.returncode or not last:
        print(p.stdout[-1500:], p.stderr[-1500:])
        return {"note": "הדפדפן נכשל"}
    return json.loads(last[-1][7:])


if __name__ == "__main__":
    main()
