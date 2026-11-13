"""
taste.py — דורון לומד את הטעם של כל משתמש מהשימוש באפליקציה (לא מניחושים):
  • מילים בכותרות של משרות ששמר (+). מילים יורדות (−) רק מדילוג עם "לא התחום שלי" (כפול) או "לא מעניין":
    דילוג בגלל דרישות/בכירות/מיקום/חברה הוא לא טעם בתחום. מילים של התפקידים שהמשתמש בחר לא נלמדות כ"נוטה לדלג".
  • חברות שדילג עליהן עם "החברה" (או 3 דילוגים בלי אף שמירה) → בעדיפות נמוכה.
  • ערים שדילג עליהן עם "מיקום" פעמיים → בעדיפות נמוכה.
  • "אחר" עם טקסט חופשי → 5 הניסוחים האחרונים עוברים לסוכן המדרג בשורה אחת (בלי לשנות את הציון מול קורות החיים).
  • "בכירה מדי" פעמיים → הסינון לפי שנות ניסיון מחמיר (profile.build_search_plan, skip_reasons).
הטעם משפיע על אילו משרות מגיעות לדירוג (cheap_rank) ומוסבר לסוכן המדרג בשורה אחת. הציון עצמו נשאר מול קורות החיים.
כל מה שנלמד מוצג למשתמש ב"מה מחפשים בשבילך", ואפשר לבטל כל פריט (state.taste_off).
"""
from __future__ import annotations
import re
from collections import Counter

STOP = {"and", "the", "for", "with", "of", "in", "to", "at", "a", "an", "&", "-", "–", "il", "israel", "tel", "aviv", "hybrid", "remote",
        "junior", "jr", "senior", "sr", "student", "intern", "internship", "graduate", "entry", "level", "lead", "principal", "staff", "ii", "iii",
        "engineer", "engineering", "developer", "development", "software", "position", "team", "group", "role", "new", "grad", "מהנדס", "מהנדסת",
        "דרוש", "דרושה", "דרושים", "משרת", "סטודנט", "סטודנטית", "ג׳וניור", "גוניור"}
SKIP_FIELD = "לא התחום שלי"
SKIP_CO = "החברה"
SKIP_LOC = "מיקום"
SKIP_DULL = "לא מעניין"
TASTE_REASONS_ONLY = True   # מתג חזרה (13.11): מילים יורדות רק מ"לא התחום שלי"/"לא מעניין"


def words(title: str) -> set[str]:
    return {w for w in re.findall(r"[a-z][a-z+#.]{1,}|[א-ת׳']{2,}", (title or "").lower()) if w not in STOP}


def role_words(plan: dict) -> set[str]:
    """המילים של התפקידים שהמשתמש בחר (כותרות, ראשיות, שאושרו ו"תפקיד אחר")."""
    return set().union(set(), *[words(t) for t in (plan.get("titles") or []) + (plan.get("heads") or []) + (plan.get("extra_titles") or [])])


def learn(rows: list[dict], skips: dict | None = None, off: list[str] | None = None, mine: set[str] | None = None) -> dict:
    """rows: שורות מטבלת jobs (card, decision). skips: {job_id: {"r": סיבה, "t": כותרת, "co": חברה, "loc": מיקום}}.
    mine: מילות התפקידים שבחר (role_words) — לא נלמדות כ"נוטה לדלג"."""
    skips = skips or {}
    off_l = {str(x).lower() for x in off or []}
    mine = {str(x).lower() for x in mine or ()}
    plus, minus = Counter(), Counter()
    saved_cos, skip_cos = Counter(), Counter()
    for r in rows:
        c, d = r.get("card") or {}, r.get("decision")
        if d in ("save", "applied"):
            plus.update(words(c.get("title", "")))
            saved_cos[c.get("co", "")] += 1
        elif d == "skip":
            why = (skips.get(c.get("id") or r.get("id")) or {}).get("r", "")
            if not TASTE_REASONS_ONLY or why in (SKIP_FIELD, SKIP_DULL):
                for w in words(c.get("title", "")):
                    minus[w] += 2 if why == SKIP_FIELD else 1
            skip_cos[c.get("co", "")] += 1
    score = {w: plus[w] - minus[w] for w in set(plus) | set(minus) if w not in off_l}
    likes = sorted([w for w, s in score.items() if s >= 2], key=lambda w: -score[w])[:8]
    dislikes = sorted([w for w, s in score.items() if s <= -2 and w not in mine], key=lambda w: score[w])[:8]
    by_reason = Counter(v.get("r") for v in skips.values() if isinstance(v, dict))
    avoid_cos = sorted({v.get("co") for v in skips.values() if isinstance(v, dict) and v.get("r") == SKIP_CO and v.get("co")}
                       | {co for co, k in skip_cos.items() if co and k >= 3 and not saved_cos.get(co)})
    avoid_cos = [c for c in avoid_cos if c.lower() not in off_l]
    locs = Counter(re.split(r"[,·|-]", v.get("loc") or "")[0].strip() for v in skips.values()
                   if isinstance(v, dict) and v.get("r") == SKIP_LOC and v.get("loc"))
    avoid_locs = [l for l, k in locs.items() if l and k >= 2 and l.lower() not in off_l and l.lower() not in ("israel", "ישראל")]
    own = []   # "אחר" בדילוג או בהסרה: המשתמש כתב במילים שלו. 5 האחרונים, בלי כפילויות, עד 60 תווים
    for v in sorted((v for v in skips.values() if isinstance(v, dict) and str(v.get("x") or "").strip()), key=lambda v: v.get("at") or "", reverse=True):
        x = re.sub(r"\s+", " ", str(v["x"])).strip()[:60]
        if x.lower() not in {o.lower() for o in own} and x.lower() not in off_l:
            own.append(x)
    own = own[:5]
    unmet = []   # "לא עומד בדרישות" + איזו דרישה: מה המשתמש אמר שאין לו (5 אחרונים)
    for v in sorted((v for v in skips.values() if isinstance(v, dict) and str(v.get("q") or "").strip()), key=lambda v: v.get("at") or "", reverse=True):
        q = re.sub(r"\s+", " ", str(v["q"])).strip()[:40]
        if q.lower() not in {u.lower() for u in unmet} and q.lower() not in off_l:
            unmet.append(q)
    unmet = unmet[:5]
    note = "; ".join(x for x in ((f"tends to save: {', '.join(likes)}" if likes else ""),
                                 (f"tends to skip: {', '.join(dislikes)}" if dislikes else ""),
                                 (f"said in their own words when skipping jobs: {' | '.join(own)}" if own else ""),
                                 (f"said they do NOT meet these requirements (mark them met only with clear CV evidence): {' | '.join(unmet)}" if unmet else "")) if x)
    return {"likes": likes, "dislikes": dislikes, "score": {w: score[w] for w in likes + dislikes}, "avoid_cos": avoid_cos,
            "avoid_locs": avoid_locs, "reasons": dict(by_reason), "own": own, "unmet": unmet, "note": note,
            "n": sum(1 for r in rows if r.get("decision") in ("save", "applied", "skip"))}


def boost(job: dict, taste: dict | None) -> int:
    """תוספת לדירוג הראשוני (cheap_rank). חסום ל-±15, כדי שהטעם יכוון ולא ישתלט."""
    if not taste:
        return 0
    s = sum(3 * taste["score"].get(w, 0) for w in words(job.get("title", "")))
    if any(job.get("company", "").lower() == c.lower() for c in taste.get("avoid_cos") or []):
        s -= 20
    loc = (job.get("location") or "").lower()
    if any(l.lower() in loc for l in taste.get("avoid_locs") or []):
        s -= 10
    return max(-25, min(15, s))
