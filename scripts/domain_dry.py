"""כלי מפתח: הרצה יבשה לתחום חדש. קורות חיים מומצאים (בקובץ, לא של משתמש), תוכנית חיפוש, איסוף, סינון ודירוג של כמה משרות.
לא שומר כלום ולא נוגע במשתמשים. מדפיס: התחום שזוהה, התפקידים והחיפושים, כמה נזרקו ולמה (עם כותרות), ודירוג של המובילות.

  python scripts/domain_dry.py design [rate_n]
"""
from __future__ import annotations
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent_core.profile import build_search_plan, domain_of, DOMAINS  # noqa: E402
from agent_core.agents import hunter as h  # noqa: E402
from agent_core.llm_router import chat  # noqa: E402

CVS = {"design": """Noa Cohen | UI/UX & Visual Designer | Tel Aviv | noacohen.design
EDUCATION
B.Des in Visual Communication, Shenkar College, 2021-2025
EXPERIENCE
Design Intern, Pixel Studio (digital agency), 2024-2025: designed landing pages and mobile app screens in Figma, built a small design system, ran 6 usability tests.
Freelance Graphic Designer, 2022-present: logos, brand identity and social media visuals for small businesses (Illustrator, Photoshop).
PROJECTS
Final project: "Shuk" grocery app — user research (12 interviews), personas, user flows, wireframes, high-fidelity prototype in Figma.
Portfolio website built in Framer.
SKILLS
Figma, Adobe XD, Illustrator, Photoshop, After Effects, InDesign, Framer, Webflow, HTML/CSS basics, user research, wireframing, prototyping, design systems, typography
MILITARY SERVICE
IDF Spokesperson Unit, graphic designer, 2018-2020
LANGUAGES
Hebrew (native), English (fluent)"""}

# כמו ב-web/api/domain.js: "ערכת תחום" שיואב בונה מקורות החיים
PACK_PROMPT = """You build a job-search kit for a candidate in Israel, based ONLY on their CV.
CV:
{cv}

Return JSON only:
{{"label": "the professional field in Hebrew, 2-4 words (e.g. 'הנדסה כימית', 'שיווק דיגיטלי')",
 "field": ["4-6 Hebrew answers to 'what is your professional background' in this field, last one 'אחר'"],
 "roles": [5-8 items: {{"label": "role family in Hebrew, short", "titles": ["1-3 English job titles exactly as Israeli job ads write them"]}}],
 "he_queries": ["2-3 Hebrew search phrases as written in Israeli job ads, e.g. 'מהנדס כימיה'"],
 "tools": ["up to 10 tools/skills typical for this field that employers list"]}}
Roles must be realistic entry-level paths for this CV. No seniority words in titles."""


def main(kind: str, rate_n: int = 6):
    cv = CVS[kind]
    print(f"תחום לפי קורות החיים בלבד (בלי שאלון): {domain_of({'cv_text': cv})}")
    dom = domain_of({"cv_text": cv})
    if dom in DOMAINS and DOMAINS[dom]["roles"]:   # תחום מוכר: התפקידים מהקוד
        ans = {"domains": [dom], "roles": list(DOMAINS[dom]["roles"])}
    else:   # תחום אחר: ערכת תחום כמו ב-web/api/domain.js
        raw = chat("yoav", "domain_pack", [{"role": "user", "content": PACK_PROMPT.format(cv=cv)}], tier="judge", max_tokens=900)
        pack = json.loads(re.search(r"\{[\s\S]*\}", raw).group(0))
        print(f"ערכת תחום: {pack.get('label')} | " + " · ".join(f"{r['label']}={'/'.join(r['titles'])}" for r in pack["roles"]))
        ans = {"domains": [pack["label"]], "packs": {pack["label"]: pack}, "roles": [r["label"] for r in pack["roles"]]}
    ans.update({"status": "בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה", "locs": ["תל אביב", "גוש דן והמרכז"]})
    plan = build_search_plan({"cv_text": cv, "answers": ans}).to_dict()
    print(f"שאילתות ({len(plan['queries'])}): {plan['queries'][:14]}")
    raw_jobs = h.collect(plan, per_search=15, budget=10)
    jobs = h.dedupe(raw_jobs)
    print(f"\nנאספו {len(raw_jobs)} → {len(jobs)} שונות")
    why, kept = Counter(), []
    for j in jobs:
        w = "בכירה" if h.too_senior(j, plan) else "מתחום אחר" if h.off_field(j, plan) else "מפעיל/טכנאי" if h.hands_on(j, plan) else \
            "פוסט" if h.is_post(j) else ""
        why[w or "עברה"] += 1
        if w:
            print(f"  ✗ {w}: {j['title']} @ {j['company']}")
        else:
            kept.append(j)
    print(f"\nסינון: {dict(why)}")
    print("עברו (כותרות): " + " | ".join(j["title"] for j in kept[:40]))
    kept.sort(key=lambda j: -h.cheap_rank(j, plan, cv))
    print(f"\nדירוג {rate_n} מובילות:")
    for j, full in list(h.rating_slots(kept, rate_n, {}))[:rate_n]:
        if not full:
            print(f"  (בלי מודעה מלאה) {j['title']} @ {j['company']}"); continue
        if h.too_senior(j, plan):   # כמו ב-run: עם המודעה המלאה בודקים שוב שנות ניסיון
            print(f"  ✗ בכירה (מודעה מלאה: {h.years_phrase(j.get('description', ''))}) {j['title']} @ {j['company']}"); continue
        r = h.rate(j, cv, h.prefs_text(plan)) or {}
        if r and h.ai_too_senior(r, plan, j["title"]):
            print(f"  ✗ בכירה (הדירוג: {r.get('required_years')} שנים) {j['title']} @ {j['company']}"); continue
        print(f"  {r.get('fit')} | {j['title']} @ {j['company']} | wrong_field={r.get('wrong_field')} | למה: {r.get('reasons')} | חסר: {r.get('gaps')}")


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6)
