"""
meeting.py — הישיבה השבועית של הצוות. יואב (המנהל) מוביל.

כל סוכן מדווח מהנתונים האמיתיים של השבועיים האחרונים, יואב מזהה בעיות ומחליט:
  • שינויים קטנים ובטוחים — נעשים לבד ונרשמים ביומן (שאילתה שלא הביאה כלום, חברה שכדאי לבדוק).
  • שינויים שמשנים את מה שאתה מקבל — הצעה עם כפתור אישור (תפקיד חדש לחיפוש).
אין כאן ניחושים: כל מספר בדוח נספר מהטבלאות, וכל הצעה מצביעה על משרות אמיתיות.
"""
from __future__ import annotations
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from agent_core import activity as act
from agent_core.agents.ats import same_company

LEVEL_WORDS = re.compile(r"\b(junior|jr\.?|senior|sr\.?|student|intern(ship)?|graduate|grad|entry[- ]level|new grad|outstanding|talented|"
                         r"excellent|experienced|position|program|team|group|"
                         r"i{1,3}|[0-9]|lead|staff|principal|mid|level)\b", re.I)
TECH = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-/]{1,}")
STOP = {"the", "and", "with", "in", "of", "for", "to", "experience", "years", "year", "knowledge", "hands", "on",
        "strong", "proven", "professional", "or", "a", "an", "is", "skills", "background", "degree", "b.sc", "bsc", "cv"}
MEETING_EVERY_DAYS = 7


def core_title(t: str) -> str:
    """"Junior AI Engineer - Agents (Hybrid)" → "AI Engineer"."""
    t = re.split(r"\s[-–|/]\s|[,(]", t or "")[0]
    t = LEVEL_WORDS.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip().title().replace("Ai ", "AI ").replace("Ml ", "ML ").replace("Qa ", "QA ").replace("Bi ", "BI ")


def covered(title: str, plan_titles: list[str]) -> bool:
    words = {w.lower() for w in re.findall(r"[A-Za-z]+", title)} - {"engineer", "developer", "software", "specialist"}
    for p in plan_titles:
        pw = {w.lower() for w in re.findall(r"[A-Za-z]+", p)} - {"engineer", "developer", "software", "specialist"}
        if words and pw and (words <= pw or pw <= words):
            return True
    return not words


def due(last: dict) -> bool:
    at = last.get("at")
    return not at or datetime.fromisoformat(at) < datetime.now(timezone.utc) - timedelta(days=MEETING_EVERY_DAYS) + timedelta(hours=2)


def hold(plan: dict, hunter_runs: list[dict], jobs: list[dict], last: dict, accepted: list[dict], dismissed: list[str],
         target_names: list[str]) -> dict:
    """מחזיר {"report", "plan", "msg"}. jobs: שורות מטבלת jobs (card, decision, created_at)."""
    scans = [r for r in hunter_runs if (r.get("stats") or {}).get("collected") is not None]
    S = [r["stats"] for r in scans]
    n = len(S)
    tot = lambda k: sum(int(s.get(k) or 0) for s in S)
    collected, senior, no_desc, rated, shown = tot("collected"), tot("too_senior"), tot("no_desc"), tot("rated"), tot("shown")
    fits = [f for s in S for f in s.get("fits") or []]
    boards = (S[0].get("boards") if S else None) or []
    report = {"scans": n, "collected": collected, "too_senior": senior, "no_desc": no_desc, "rated": rated, "shown": shown,
              "avg_fit": round(sum(fits) / len(fits), 1) if fits else None,
              "boards_ok": sum(1 for b in boards if b.get("status") == "board"), "boards_total": len(boards),
              "decisions": dict(Counter(j.get("decision") or "ממתינה" for j in jobs)), "issues": [], "actions": [], "suggestions": []}
    act.log("strategist", f"פותח את הישיבה השבועית. על השולחן: {n} סריקות מהשבועיים האחרונים.")
    if not n:
        report["issues"].append("עוד לא היו סריקות. אין על מה לדבר עדיין.")
        return {"report": report, "plan": {**last, "at": datetime.now(timezone.utc).isoformat()}, "msg": ""}

    # ── דורון מדווח ─────────────────────────────────────────────
    act.log("hunter", f"אספתי {collected} משרות, {senior} נפסלו כבכירות מדי ({round(100 * senior / max(collected, 1))}%), "
                      f"{no_desc} לא הצלחתי לקרוא, דירגתי {rated}, הצגתי {shown}.", to="strategist")
    if collected and senior / collected > 0.5:
        report["issues"].append(f"{round(100 * senior / collected)}% מהמשרות שנאספו בכירות מדי. החיפוש מביא הרבה משרות שלא מתאימות לרמה.")
    if rated and no_desc / max(rated + no_desc, 1) > 0.2:
        report["issues"].append(f"ב-{no_desc} משרות לא הצלחתי לקרוא את המודעה המלאה (LinkedIn חוסם). כדאי להישען יותר על דפי קריירה.")
    zero_scans = sum(1 for s in S[:4] if not s.get("shown"))
    if zero_scans >= 2:
        report["issues"].append(f"ב-{zero_scans} מתוך {min(n, 4)} הסריקות האחרונות לא נמצאה אף משרה חדשה שמתאימה.")

    # ── שאילתות: מה הביא ומה לא ─────────────────────────────────
    qy: dict[str, list[dict]] = defaultdict(list)
    for s in S[:6]:
        for q, v in (s.get("queries") or {}).items():
            qy[q].append(v)
    drop = set(last.get("drop_queries") or [])
    plan_q = set(plan.get("queries") or [])
    for q, vs in qy.items():
        if q in plan_q and len(vs) >= 3 and sum(v.get("new", 0) for v in vs[:3]) == 0 and q not in drop:
            drop.add(q)
            report["actions"].append(f"הורדתי את החיפוש '{q}': בשלוש סריקות הוא לא הביא אף משרה חדשה ברמה שלך.")
            act.log("strategist", f"'{q}' לא הביא כלום שלוש פעמים. מוריד אותו ומפנה את המקום לחיפוש אחר.", to="hunter")
    best = sorted(((q, sum(v.get("fit", 0) for v in vs)) for q, vs in qy.items()), key=lambda x: -x[1])
    if best and best[0][1]:
        act.log("hunter", f"החיפוש שהביא הכי הרבה משרות מתאימות: '{best[0][0]}' ({best[0][1]}).", to="strategist")

    # ── לוחות חברה ──────────────────────────────────────────────
    bad = [b["name"] for b in boards if b.get("status") == "not_found"]
    if bad:
        report["issues"].append("לא מצאתי משרות בשם: " + ", ".join(bad) + ". כדאי לבדוק את השם בפרופיל.")
    renamed = [f"{b['name']} ← {b['found_as']}" for b in boards if b.get("found_as")]
    if renamed:
        report["actions"].append("תיקנתי שם חברה לחיפוש: " + ", ".join(renamed) + ".")

    # ── תפקידים שהשוק מציע ואתה לא מחפש ──────────────────────────
    good = [j for j in jobs if (j.get("card") or {}).get("fit", 0) >= 3.5]
    titles_now = (plan.get("titles") or []) + (plan.get("extra_titles") or []) + [a["value"] for a in accepted if a.get("type") == "role"]
    by_role: dict[str, list[dict]] = defaultdict(list)
    for j in good:
        ct = core_title(j["card"].get("title", ""))
        if ct and len(ct) > 3 and not covered(ct, titles_now):
            by_role[ct].append(j["card"])
    for role, cards in sorted(by_role.items(), key=lambda x: (-len(x[1]), -max(c["fit"] for c in x[1]))):
        if role.lower() in {d.lower() for d in dismissed} or len(report["suggestions"]) >= 3:
            continue
        # הצעה רק כשיש דפוס אמיתי: לפחות 2 משרות מ-2 חברות שונות
        if len(cards) >= 2 and len({c["co"] for c in cards}) >= 2:
            ex = sorted(cards, key=lambda c: -c["fit"])[:3]
            needs = Counter(t for c in ex for g in c.get("gaps") or [] for t in TECH.findall(g) if t.lower() not in STOP)
            report["suggestions"].append({
                "type": "role", "value": role,
                "why": f"{len(cards)} משרות {role} קיבלו אצלך ציון גבוה, למרות שלא חיפשת את התפקיד הזה.",
                "examples": [{"title": c["title"], "co": c["co"], "fit": c["fit"], "id": c["id"]} for c in ex],
                "needs": [t for t, _ in needs.most_common(4)]})
            act.log("strategist", f"שמתי לב ש-{role} מופיע שוב ושוב עם ציון גבוה. מציע להוסיף אותו לחיפוש.", to="hunter")

    # ── חברות שכדאי לבדוק ישירות ─────────────────────────────────
    auto = list(last.get("auto_targets") or [])
    have = [t.lower() for t in target_names] + [a["name"].lower() for a in auto]
    cos = Counter(j["card"]["co"] for j in good if j["card"].get("co"))
    for co, k in cos.most_common():
        if k < 2 or len([a for a in auto if a.get("at", "") >= (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()]) >= 3:
            continue
        if any(same_company(co, h) for h in have) or co.lower().startswith("confidential"):
            continue
        auto.append({"name": co, "why": f"{k} משרות מתאימות ממנה בשבועיים האחרונים", "at": datetime.now(timezone.utc).isoformat()})
        have.append(co.lower())
        report["actions"].append(f"הוספתי את {co} לחברות היעד: {k} משרות מתאימות ממנה. אפשר להסיר בפרופיל.")
        act.log("strategist", f"{co} הביאה {k} משרות מתאימות. מוסיף אותה לחברות היעד ובודק את דף הקריירה שלה.", to="hunter")

    # ── כישורים שחסרים שוב ושוב (מאיה וקובי ישתמשו בזה) ──────────
    gap_terms = Counter()
    for j in jobs:
        c = j.get("card") or {}
        if c.get("fit", 0) >= 3.0:
            for g in c.get("gaps") or []:
                if "שנות ניסיון" in g:
                    continue
                for t in set(TECH.findall(g)):
                    if t.lower() not in STOP and len(t) > 1:
                        gap_terms[t] += 1
    skill_gaps = [{"skill": t, "jobs": k} for t, k in gap_terms.most_common(6) if k >= 2]
    if skill_gaps:
        act.log("coach", "מהישיבה: הכישורים שחסרים הכי הרבה במשרות שמתאימות לך הם "
                + ", ".join(f"{g['skill']} ({g['jobs']})" for g in skill_gaps[:4]) + ". אכין על זה חומר.", to="strategist")
        report["skill_gaps"] = skill_gaps

    act.log("strategist", f"סיכום: {len(report['issues'])} בעיות, {len(report['actions'])} שינויים שעשיתי, "
                          f"{len(report['suggestions'])} הצעות שמחכות לאישור שלך.")
    parts = [f"ישיבה שבועית: {n} סריקות, {collected} משרות נאספו, {shown} הוצגו לך."]
    if report["actions"]:
        parts.append("שיניתי: " + " ".join(report["actions"]))
    if report["suggestions"]:
        parts.append("יש לי הצעה: " + "; ".join(s["value"] for s in report["suggestions"]) + ". אפשר לאשר בפרופיל › מה מחפשים בשבילך.")
    if report["issues"]:
        parts.append("שמתי לב: " + " ".join(report["issues"][:2]))
    new_plan = {"at": datetime.now(timezone.utc).isoformat(), "drop_queries": sorted(drop), "auto_targets": auto,
                "suggestions": report["suggestions"], "skill_gaps": skill_gaps}
    return {"report": report, "plan": new_plan, "msg": " ".join(parts)}
