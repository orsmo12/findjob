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

PROMPT = """Write a short, tailored cover letter for this specific job, in {lang}. 80-120 words. Exactly 3 short paragraphs.

Paragraph 1 (1-2 sentences): what in THIS ad caught the candidate's interest — name the team/product/problem from the ad,
  and say what they are (e.g. "a third-year CS student at HIT"). No generic opening.
Paragraph 2 (2-3 sentences): the ONE or TWO strongest matches between a concrete CV project and a concrete requirement
  in the ad. Say what was built and with what, briefly. Show, don't list skills.
Paragraph 3 (1 sentence): a simple, confident closing (a short call to talk). Then the name: {name}.

STRICT RULES:
- Use ONLY facts written in the CV. Do not invent experience, numbers, grades, employers, dates or technologies.
- Do not repeat the job title in full, do not restate the whole ad, do not list more than 3 technologies.
- Banned: "I am writing to", "I am excited to apply", "aligns directly", "passionate", "dynamic", "solid foundation",
  "I believe I would be a great fit", "Thank you for your time and consideration".
- No salary, age or location. Greeting: "Hi {company} team," (English) or "שלום לצוות {company}," (Hebrew).
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


GREET = re.compile(r"^\s*((dear|hi|hello)\b[^\n.!?]{0,90}?,|(שלום|לכבוד)[^\n.!?]{0,70}?,)\s*", re.I)
SIGN = re.compile(r"(best regards|kind regards|warm regards|regards|sincerely|בברכה|תודה רבה)\s*,?", re.I)


def _sentences(p: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", p.strip()) if s]


def _paragraphs(body: str) -> list[str]:
    """פסקאות הגוף. אם המודל החזיר הכל בגוש אחד, מחלקים לפתיחה, אמצע וסגירה כמו במכתב אמיתי."""
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n|\n", body) if p.strip()]
    if len(paras) != 1:
        return paras
    s = _sentences(paras[0])
    if len(s) < 4:
        return paras
    first, rest = [s[0]], s[1:]
    while rest and len(" ".join(first).split()) < 18:
        first.append(rest.pop(0))
    last = [rest.pop()] if len(rest) > 2 else []
    mid, out = [], [" ".join(first)]
    for x in rest:                       # אמצע ארוך מתחלק לשתי פסקאות
        mid.append(x)
        if len(" ".join(mid).split()) > 70 and len(rest) > 3:
            out.append(" ".join(mid)); mid = []
    if mid:
        out.append(" ".join(mid))
    return out + ([" ".join(last)] if last else [])


def split_letter(text: str) -> tuple[str, str]:
    """(פנייה, גוף). החתימה ושם הכותב יורדים: shape_letter מוסיף אותם מחדש בצורה קבועה."""
    t = (text or "").replace("\r", "").strip().strip('"').strip()
    g = GREET.match(t)
    greet = g.group(1).strip() if g else ""
    body = t[g.end():] if g else t
    tail = list(SIGN.finditer(body))
    if tail and tail[-1].start() > len(body) * 0.6:
        body = body[:tail[-1].start()]
    return greet, body.strip()


def shape_letter(text: str, company: str, name: str, lang: str = "English") -> str:
    """מכתב רציני תמיד באותו מבנה: פנייה, 3-4 פסקאות עם שורה ריקה ביניהן, ברכה, שם בשורה נפרדת."""
    greet, body = split_letter(text)
    he = lang == "Hebrew"
    greet = greet or (f"שלום לצוות {company}," if he else f"Dear {company} team,")
    sign = "בברכה," if he else "Best regards,"
    parts = [greet, "\n\n".join(_paragraphs(body)), sign + ("\n" + name if name else "")]
    return "\n\n".join(p for p in parts if p).strip()


def _drop_bad_sentences(letter: str, bad: list[str]) -> str:
    """מוחק רק משפטי גוף עם פרט לא מבוסס. הפנייה, החתימה והפסקאות נשמרות."""
    greet, body = split_letter(letter)
    keep = []
    for p in _paragraphs(body):
        s = [x for x in _sentences(p) if not any(b in x for b in bad)]
        if s:
            keep.append(" ".join(s))
    return ((greet + "\n\n") if greet else "") + "\n\n".join(keep)


def write_letter(cv: str, job: dict, name: str) -> dict:
    ad = job.get("ad") or job.get("desc") or ""
    lang = ad_language(ad) if ad else "English"
    prompt = PROMPT.format(lang=lang, name=name or "", cv=cv[:5000], title=job["title"], company=job["co"], ad=ad[:3500] or "(no description)")
    act.log("assistant", f"כותב מכתב פנייה ל-{job['co']} ({'אנגלית' if lang == 'English' else 'עברית'}, כשפת המודעה)")
    text = chat("assistant", "cover_letter", [{"role": "user", "content": prompt}], tier="write", max_tokens=1500)
    if len(text.split()) > 150:  # ארוך מדי: מבקשים לקצר פעם אחת
        act.log("assistant", f"המכתב יצא {len(text.split())} מילים. מקצר ל-120.")
        text = chat("assistant", "cover_letter_shorten", [{"role": "user", "content": prompt + "\n\nYOUR DRAFT (too long — rewrite it to under 120 words, same facts):\n" + text}],
                    tier="write", max_tokens=1200)
    bad = unsupported(text, cv, ad + " " + job["title"], job["co"], name)
    if bad:
        act.log("assistant", f"בבדיקת מקור מצאתי פרטים שלא כתובים אצלך ({', '.join(bad[:3])}). כותב מחדש.")
        fix = prompt + f"\n\nYour previous draft mentioned things NOT in the CV or ad: {', '.join(bad)}. Rewrite without them."
        text = chat("assistant", "cover_letter_retry", [{"role": "user", "content": fix}], tier="write", max_tokens=1500)
        bad = unsupported(text, cv, ad + " " + job["title"], job["co"], name)
        if bad:
            act.log("assistant", "עדיין היו פרטים לא מבוססים. מחקתי את המשפטים האלה.")
            text = _drop_bad_sentences(text, bad)
    text = shape_letter(text, job["co"], name, lang)
    return {"text": text, "lang": lang, "v": 3, "checked": not unsupported(text, cv, ad + " " + job["title"], job["co"], name)}
