"""
prep.py — מאיה, המאמנת: שאלות הכנה לכל משרה ששמרת, לפי המודעה וקורות החיים.

כללים:
  - שאלה נשענת על דרישה שכתובה במודעה (או שאלת בסיס: מוטיבציה, פרויקט).
  - הרמז לתשובה מפנה רק לדברים שכתובים בקורות החיים. בדיקה בקוד, כמו אצל שי.
  - לא מבטיחים "אלה השאלות שישאלו". אלה שאלות סבירות להתכונן אליהן.
"""
from __future__ import annotations
import json
import re

from agent_core.llm_router import chat
from agent_core import activity as act

LATIN = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-]{2,}")

PROMPT = """Prepare a candidate for a first interview / screening for this job. Write in Hebrew; keep technology names in English.
Create 5 likely questions:
- 3 based on concrete requirements written in the AD (quote the requirement in "tag", in English, 1-3 words)
- 1 motivation question about this company/role (tag "מוטיבציה")
- 1 about a project from the CV (tag "פרויקט")
For each, "hint": 1-2 Hebrew sentences on how to build the answer, pointing ONLY to things written in the CV.
If the CV has nothing relevant for a requirement, say honestly in the hint how to address the gap (learning, related experience).

CV:
{cv}

JOB: {title} at {company}
AD:
{ad}

Return JSON only: {{"questions": [{{"tag": "...", "q": "...", "hint": "..."}}]}}"""


def prepare(cv: str, job: dict) -> dict:
    ad = job.get("ad") or job.get("desc") or ""
    raw = chat("coach", "interview_prep", [{"role": "user", "content": PROMPT.format(
        cv=cv[:4000], title=job["title"], company=job["co"], ad=ad[:3500] or "(no description)")}],
        tier="write", max_tokens=2500)
    m = re.search(r"\{.*\}", raw or "", re.S)
    try:
        qs = (json.loads(m.group(0)) if m else {}).get("questions") or []
    except ValueError:
        qs = []
    src = (cv + " " + ad + " " + job["co"] + " " + job["title"]).lower()
    out = []
    for q in qs[:6]:
        text = f"{q.get('q', '')} {q.get('hint', '')}"
        names = [w.strip(".-,") for w in LATIN.findall(text)]
        if all(n.lower() in src for n in names if n[0].isupper() or any(c.isupper() for c in n[1:])):
            out.append({"tag": str(q.get("tag", ""))[:30], "q": str(q.get("q", ""))[:220], "h": str(q.get("hint", ""))[:400]})
    act.log("coach", f"הכנתי {len(out[:5])} שאלות ל-{job['co']} לפי הדרישות במודעה"
            + (f" (זרקתי {len(qs[:6]) - len(out)} עם פרטים שלא כתובים אצלך)" if len(qs[:6]) > len(out) else ""))
    return {"questions": out[:5]}
