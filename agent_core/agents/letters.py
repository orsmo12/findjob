"""
letters.py — שי, העוזר האישי: מכתב פנייה לכל משרה ששמרת.

כללים:
  - רק עובדות שכתובות בקורות החיים. אין מספרים, ציונים, חברות או טכנולוגיות שלא שם.
  - בדיקת מקור בקוד: כל שם באנגלית וכל מספר במכתב חייבים להופיע בקורות החיים או במודעה.
    אם הבדיקה נכשלת, כותבים מחדש פעם אחת. אם שוב נכשל, המשפטים הבעייתיים נמחקים.
  - שפת המכתב כשפת המודעה (אנגלית או עברית).
  - שי לא שולח כלום. המכתב מחכה לך באפליקציה, אתה מעתיק ומגיש.
"""
from __future__ import annotations
import re

from agent_core.llm_router import chat
from agent_core import activity as act

PROMPT = """Write a short cover letter (110-160 words) for this job, in {lang}.

STRICT RULES:
- Use ONLY facts written in the CV below. Do not invent experience, numbers, grades, employers, dates or technologies.
- Mention 2-3 concrete things from the CV that match what the ad asks for.
- No clichés ("I am writing to express", "passionate", "dynamic"). Sound like a real, direct person.
- Do not mention salary, age or location.
- Start with a greeting, end with the candidate's name: {name}.
- Output only the letter text.

CV:
{cv}

JOB: {title} at {company}
AD:
{ad}"""

NUM = re.compile(r"\d[\d.,%+]*")
LATIN = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-]{2,}")
COMMON = {"i", "hi", "dear", "hello", "the", "and", "for", "with", "you", "your", "team", "dear", "hello", "hiring", "manager", "best", "regards",
          "thank", "thanks", "would", "love", "about", "this", "that", "have", "from", "role", "position", "company",
          "work", "working", "built", "build", "projects", "project", "experience", "student", "sincerely", "looking",
          "forward", "hearing", "also", "which", "where", "when", "into", "using", "used", "both", "like", "will",
          "can", "our", "their", "they", "are", "was", "were", "has", "had", "not", "but", "its", "it's", "i'm", "i've",
          "i'd", "my", "me", "more", "most", "very", "well", "what", "how", "why", "who", "all", "any", "each", "such",
          "than", "then", "there", "these", "those", "through", "over", "under", "between", "while", "real", "time",
          "able", "learn", "learning", "quickly", "independent", "independently", "excited", "interested", "apply",
          "applying", "opportunity", "chance", "contribute", "skills", "solutions", "systems", "system", "software",
          "development", "developer", "engineer", "engineering", "end", "full", "stack", "full-stack", "end-to-end"}


def ad_language(ad: str) -> str:
    heb = len(re.findall(r"[֐-׿]", ad))
    return "Hebrew" if heb > len(ad) * 0.3 else "English"


def _names(text: str) -> list[str]:
    """מילים שהן כנראה שמות: טכנולוגיות, חברות, מוסדות. מילה רגילה באותיות קטנות לא נבדקת."""
    out = []
    for sent in re.split(r"(?<=[.!?:\n])\s+", text):
        for i, w in enumerate(LATIN.findall(sent)):
            w = w.strip(".-,")
            if not w:
                continue
            inner_caps = any(c.isupper() for c in w[1:]) or any(c in w for c in "+#") or any(c.isdigit() for c in w)
            if inner_caps or (w[0].isupper() and i > 0 and w.lower() not in COMMON):
                out.append(w)
    return out


def unsupported(letter: str, cv: str, ad: str, company: str, name: str) -> list[str]:
    """מה במכתב לא מופיע בקורות החיים או במודעה."""
    src = (cv + " " + ad + " " + company + " " + name).lower()
    bad = [w for w in _names(letter) if w.lower() not in src]
    bad += [n.strip(".,") for n in NUM.findall(letter) if n.strip(".,") and n.strip(".,") not in src]
    return sorted(set(bad))


def _drop_bad_sentences(letter: str, bad: list[str]) -> str:
    parts = re.split(r"(?<=[.!?])\s+", letter)
    return " ".join(p for p in parts if not any(b in p for b in bad)).strip()


def write_letter(cv: str, job: dict, name: str) -> dict:
    ad = job.get("ad") or job.get("desc") or ""
    lang = ad_language(ad) if ad else "English"
    prompt = PROMPT.format(lang=lang, name=name or "", cv=cv[:5000], title=job["title"], company=job["co"], ad=ad[:3500] or "(no description)")
    act.log("assistant", f"כותב מכתב פנייה ל-{job['co']} ({'אנגלית' if lang == 'English' else 'עברית'}, כשפת המודעה)")
    text = chat("assistant", "cover_letter", [{"role": "user", "content": prompt}], tier="write", max_tokens=1500)
    bad = unsupported(text, cv, ad, job["co"], name)
    if bad:
        act.log("assistant", f"בבדיקת מקור מצאתי פרטים שלא כתובים אצלך ({', '.join(bad[:3])}). כותב מחדש.")
        fix = prompt + f"\n\nYour previous draft mentioned things NOT in the CV or ad: {', '.join(bad)}. Rewrite without them."
        text = chat("assistant", "cover_letter_retry", [{"role": "user", "content": fix}], tier="write", max_tokens=1500)
        bad = unsupported(text, cv, ad, job["co"], name)
        if bad:
            act.log("assistant", "עדיין היו פרטים לא מבוססים. מחקתי את המשפטים האלה.")
            text = _drop_bad_sentences(text, bad)
    return {"text": text.strip(), "lang": lang, "checked": not unsupported(text, cv, ad, job["co"], name)}
