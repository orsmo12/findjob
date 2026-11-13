"""
profile.py — המשתמש כמו שהסוכנים רואים אותו.

הכל נגזר מקורות החיים ומהשאלון של המשתמש. שום סוכן לא מחזיק ערכים קבועים
כמו "Junior Python Developer" או "Tel Aviv": יואב (strategist) בונה מכאן
תוכנית חיפוש, ודורון (hunter) מחפש רק לפיה.

קבצים (מחוץ ל-Git, ב-memory/):
  memory/profile.json  — {first, name, cv_text, answers{...}, team{...},
                          skip_reasons{...}, target_companies{added[], removed[]}}
  my_resume.txt        — גיבוי לקורות החיים אם אין profile.json
"""

from __future__ import annotations
import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILE_FILE = ROOT / "memory" / "profile.json"
RESUME_FILE = ROOT / "my_resume.txt"

# ── מילון: תשובות השאלון → פרמטרים לחיפוש ──────────────────────────────────────
ROLE_TITLES = {
    "Backend":       ["Backend Developer", "Backend Engineer", "Python Developer"],
    "Frontend":      ["Frontend Developer", "React Developer"],
    "Full-Stack":    ["Full Stack Developer"],
    "Data / BI":     ["Data Analyst", "BI Developer", "Data Engineer"],
    "AI / ML":       ["Machine Learning Engineer", "AI Engineer", "Computer Vision Engineer"],
    "QA ואוטומציה":  ["QA Automation Engineer"],
    "DevOps / Cloud": ["DevOps Engineer", "Cloud Engineer"],
    "סייבר":         ["Security Engineer", "Security Researcher"],
    "Embedded":      ["Embedded Software Engineer"],
}
# ── ערכות תחום: לכל תחום התפקידים שלו (תווית בעברית ← כותרות חיפוש), חיפושים בעברית ותחומי חברות ──
DOMAINS = {
    "פיתוח תוכנה": {"key": "software", "roles": None, "he_queries": []},   # None = ROLE_TITLES למעלה
    "הנדסת מכונות": {"key": "mechanical", "roles": {
        "תכנון מכני":            ["Mechanical Engineer", "Mechanical Design Engineer"],
        "ייצור ותהליכים":        ["Manufacturing Engineer", "Process Engineer"],
        "R&D ופיתוח מוצר":       ["R&D Mechanical Engineer", "Product Engineer"],
        "איכות":                 ["Quality Engineer"],
        "ניהול פרויקטים הנדסיים": ["Project Engineer"],
        "סימולציות ו-CAE":       ["Simulation Engineer", "CAE Engineer"],
        "אחזקה ותפעול":          ["Maintenance Engineer", "Reliability Engineer"],
        "מערכות ואינטגרציה":     ["Systems Engineer", "Integration Engineer"],
    }, "he_queries": ["מהנדס מכונות", "מהנדס מכונות ג'וניור", "מהנדס ייצור"]},
}
MECH_WORDS = ("solidworks", "autocad", "ansys", "catia", "creo", "inventor", "gd&t", "cnc", "mechanical engineering",
              "הנדסת מכונות", "תיכון מכני", "fea", "thermodynamics", "שרטוט")
SOFT_WORDS = ("python", "javascript", "react", "java", "sql", "developer", "node", "typescript", "git", "backend", "frontend")


STUDY_DEG = "סטודנט/ית לתואר"
PART = "משרה חלקית / משרת סטודנט"
OLD_STATUS = {"סטודנט/ית": (STUDY_DEG, ""), "בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה": ("סיימתי תואר", "לא עובד/ת כרגע"),
              "ג׳וניור עם ניסיון של עד שנתיים": ("", "עובד/ת בתחום"), "עובד/ת ומחפש/ת לעבור": ("", "עובד/ת בתחום"),
              "משתחרר/ת משירות": ("", "משתחרר/ת משירות"), "לא עובד/ת כרגע": ("", "לא עובד/ת כרגע")}


def normalize_answers(a: dict) -> dict:
    """מראה של normAns ב-onb_q.js. השאלון החדש: לימודים + עבודה (כל שילוב), היקף משרה, כמה תחומים.
    גוזר את השדות הישנים (status, track, domain) כדי שכל השאר ימשיך לעבוד, ומתרגם משתמשים ותיקים."""
    a = dict(a or {})
    if a.get("status") and not a.get("study") and not a.get("work"):
        st, wk = OLD_STATUS.get(a["status"], ("", ""))
        a.update({k: v for k, v in (("study", st), ("work", wk)) if v})
    if a.get("track") and not a.get("scope"):
        a["scope"] = {"משרת סטודנט חלקית": [PART], "משרה מלאה אחרי התואר": ["משרה מלאה"], "את שתיהן": ["משרה מלאה", PART]}.get(a["track"], [])
    if a.get("domain") and not a.get("domains"):
        a["domains"] = [a["domain"]]
    if a.get("pack") and not a.get("packs"):
        a["packs"] = {a["pack"].get("label", ""): a["pack"]}
    student = a.get("study") == STUDY_DEG or (not a.get("study") and a.get("status") == "סטודנט/ית")
    senior = a.get("exp") in ("3–5 שנים", "יותר מ-5 שנים", "יותר מ-10 שנים")
    if student:
        a["status"] = "סטודנט/ית"
    elif a.get("work") == "משתחרר/ת משירות":
        a["status"] = "משתחרר/ת משירות"
    elif a.get("work") == "עובד/ת בתחום":
        a["status"] = "עובד/ת ומחפש/ת לעבור" if senior else "ג׳וניור עם ניסיון של עד שנתיים"
    elif a.get("study") in ("סיימתי תואר", "לימודי הנדסאות או תעודה", "קורס או בוטקאמפ") or a.get("work") == "עובד/ת בתחום אחר":
        a["status"] = "בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה"
    elif a.get("work") == "לא עובד/ת כרגע":
        a["status"] = "לא עובד/ת כרגע"
    sc = a.get("scope") or []
    a["track"] = "את שתיהן" if len(sc) == 2 else "משרת סטודנט חלקית" if PART in sc else "משרה מלאה אחרי התואר" if sc else ""
    a["domains"] = [d for d in a.get("domains") or [] if d and d not in ("תחום אחר", "אחר")]
    a["domain"] = a["domains"][0] if a["domains"] else ""
    return a


def domain_of(profile: dict) -> str:
    """התחום הראשון: מה שבחרת בשאלון, אחרת מקורות החיים. ברירת מחדל: פיתוח תוכנה."""
    a = normalize_answers(profile.get("answers") or {})
    if a.get("domain"):
        return a["domain"]
    t = (profile.get("cv_text") or "").lower()
    m, sw = sum(w in t for w in MECH_WORDS), sum(w in t for w in SOFT_WORDS)
    return "הנדסת מכונות" if m >= 2 and m >= sw else "פיתוח תוכנה"


def role_titles(domain: str, pack: dict | None = None) -> dict[str, list[str]]:
    d = DOMAINS.get(domain)
    if d and d["roles"]:
        return d["roles"]
    if not d and pack and pack.get("roles"):  # תחום אחר: הערכה שיואב בנה מקורות החיים
        return {r["label"]: [t for t in r.get("titles") or [] if t][:3] for r in pack["roles"] if r.get("label")}
    return ROLE_TITLES


ROLE_SECTORS = {"AI / ML": ["ai"], "סייבר": ["cyber"], "Data / BI": ["data"], "DevOps / Cloud": ["devtools"],
                "Embedded": ["hardware"], "QA ואוטומציה": [], "Backend": [], "Frontend": [], "Full-Stack": []}
REGIONS = {
    "תל אביב":          ["Tel Aviv"],
    "גוש דן והמרכז":    ["Tel Aviv", "Ramat Gan", "Petah Tikva", "Herzliya", "Rehovot", "Rosh HaAyin", "Lod", "Yavne", "Airport City"],
    "השרון":            ["Herzliya", "Ra'anana", "Netanya", "Kfar Saba"],
    "ירושלים":          ["Jerusalem"],
    "חיפה והצפון":      ["Haifa", "Yokneam", "Migdal HaEmek", "Tefen", "Karmiel"],
    "באר שבע והדרום":   ["Beer Sheva"],
}
EXP_HAVE_YEARS = {"אין עדיין": 0, "פחות משנה": 0, "1–2 שנים": 1, "3–5 שנים": 3, "יותר מ-5 שנים": 5, "יותר מ-10 שנים": 10}   # כמה יש באמת
JUNIOR_HE = re.compile(r"ג['׳]?וניור|גוניור")
EXP_MAX_YEARS = {"אין עדיין": 1, "פחות משנה": 1, "1–2 שנים": 2, "3–5 שנים": 5, "יותר מ-5 שנים": None, "יותר מ-10 שנים": None}
# הניסיון קובע את הרמה, לא הלימודים: סטודנט עם 5 שנות ניסיון בתחום לא מחפש משרת ג׳וניור
EXP_LEVELS = {"3–5 שנים": ["mid"], "יותר מ-5 שנים": ["mid", "senior"], "יותר מ-10 שנים": ["mid", "senior"]}


@dataclass
class SearchPlan:
    """מה דורון מחפש. נבנה רק מהפרופיל, ומוצג למשתמש בשקיפות."""
    titles: list[str]                 # כותרות לחיפוש באנגלית (כך מתפרסמות רוב המשרות)
    levels: list[str]                 # student / intern / junior / entry / mid / senior
    max_years: int | None             # מסנן משרות שדורשות יותר שנות ניסיון
    locations: list[str]
    remote_only: bool
    student_positions: bool           # לחפש גם משרות סטודנט
    prefer_size: list[str]            # startup / scaleup / enterprise
    prefer_sectors: list[str]
    min_salary_month: int | None      # מסנן רק משרות שפרסמו שכר נמוך ממנו
    exclude_reasons: dict = field(default_factory=dict)   # ממה שלמדנו מהדילוגים
    why: list[str] = field(default_factory=list)          # הסבר אנושי לכל החלטה
    have_years: int | None = None     # שנות הניסיון שיש למשתמש (לתקרת הציון כשהמודעה דורשת יותר)
    domains: list = field(default_factory=list)   # כל התחומים שבחר
    part_time: bool = False

    extra_titles: list[str] = field(default_factory=list)  # תפקידים שיואב הציע ואישרת
    drop_queries: list[str] = field(default_factory=list)  # שאילתות שלא הביאו כלום (למידה)

    heads: list[str] = field(default_factory=list)  # הכותרת הראשית של כל תפקיד שבחרת
    area_cities: list[str] = field(default_factory=list)  # כל הערים באזורים שבחרת (לחברות יעד)
    domain: str = "פיתוח תוכנה"
    he_queries: list[str] = field(default_factory=list)   # חיפושים בעברית (בתחומים שמפרסמים הרבה בעברית)
    exclude_words: list[str] = field(default_factory=list)  # כללי סינון שאישרת ("בלי .NET"): משרה שהמילה בכותרת שלה לא מוצגת
    learned_queries: list[str] = field(default_factory=list)  # חיפושים שיואב הוסיף מהמשרות ששמרת (ישיבה שבועית)

    def queries(self, limit: int = 12) -> list[str]:
        """שילוב של כותרות ורמות: Junior / Student / Graduate / Entry level. אותו מבנה לכל תחום.
        סדר עדיפות: הכותרת הראשית של כל תפקיד, אחר כך Graduate, אחר כך שאר הכותרות, ואז Entry level."""
        heads = list(dict.fromkeys((self.heads or self.titles[:3]) + self.extra_titles))
        rest = [t for t in self.titles if t not in heads]
        jr = "junior" in self.levels or "entry" in self.levels
        st = "student" in self.levels and self.student_positions
        mid = "mid" in self.levels
        st_inline = st and not mid   # עם ניסיון בתחום (סטודנט שעובד, למשל 3–5 שנים): משרות סטודנט רק כתוספת בסוף
        out, st_tail = [], []
        for group in (heads, None, rest, "entry"):
            for t in (heads if group in (None, "entry") else group):
                if group is None:
                    out += [f"Graduate {t}"] if jr else []
                elif group == "entry":
                    out += [f"Entry Level {t}"] if jr else []
                else:
                    out += ([f"Student {t}"] if st_inline else []) + ([f"Junior {t}"] if jr else []) + ([t] if mid else [])
                    st_tail += [f"Student {t}"] if st and not st_inline and group is heads else []
        # אחרי הכותרות הראשיות: שאילתות שנלמדו, עברית, ואז (סטודנט עם ניסיון) משרות סטודנט לתפקידים הראשיים, ורק אז השאר
        k = len(heads) * (1 + st_inline)
        he = [q for q in self.he_queries if jr or not JUNIOR_HE.search(q)]   # "ג׳וניור" בעברית רק למי שמחפש ג׳וניור
        out = out[:k] + list(self.learned_queries) + he + st_tail + out[k:]
        drop = {q.lower() for q in self.drop_queries}
        seen, uniq = set(), []
        for q in out:
            if q.lower() not in seen and q.lower() not in drop:
                seen.add(q.lower()); uniq.append(q)
        return uniq[:limit]

    def to_dict(self) -> dict:
        d = asdict(self); d["queries"] = self.queries(); return d


def load_profile() -> dict:
    """הפרופיל השמור. אם עדיין אין — רק קורות החיים מהקובץ."""
    if PROFILE_FILE.exists():
        return json.loads(PROFILE_FILE.read_text(encoding="utf-8"))
    cv = RESUME_FILE.read_text(encoding="utf-8").strip() if RESUME_FILE.exists() else ""
    return {"first": "", "name": "", "cv_text": cv, "answers": {}}


def save_profile(p: dict) -> None:
    PROFILE_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_FILE.write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")


# ── אותות מקורות החיים: ברירות מחדל עד שהשאלון עונה (השאלון תמיד גובר) ─────────
CITY_REGION = {
    "givatayim": "גוש דן והמרכז", "גבעתיים": "גוש דן והמרכז", "ramat gan": "גוש דן והמרכז", "רמת גן": "גוש דן והמרכז",
    "tel aviv": "תל אביב", "תל אביב": "תל אביב", "holon": "גוש דן והמרכז", "חולון": "גוש דן והמרכז",
    "bat yam": "גוש דן והמרכז", "petah tikva": "גוש דן והמרכז", "פתח תקווה": "גוש דן והמרכז", "bnei brak": "גוש דן והמרכז",
    "herzliya": "השרון", "הרצליה": "השרון", "ra'anana": "השרון", "netanya": "השרון", "kfar saba": "השרון",
    "jerusalem": "ירושלים", "ירושלים": "ירושלים", "haifa": "חיפה והצפון", "חיפה": "חיפה והצפון",
    "beer sheva": "באר שבע והדרום", "באר שבע": "באר שבע והדרום",
}
SKILL_ROLES = [  # (מילים בקורות החיים, תפקיד)
    (("react", "vue", "angular", "html", "css"), "Frontend"),
    (("backend", "back-end", "full-stack", "full stack", "socket.io", "node", "express", "fastapi", "django", "flask", "spring", "sql"), "Backend"),
    (("opencv", "tensorflow", "keras", "pytorch", "machine learning", "deep learning", "langgraph", "llm"), "AI / ML"),
    (("docker", "kubernetes", "aws", "gcp", "terraform"), "DevOps / Cloud"),
    (("selenium", "playwright", "cypress", "qa"), "QA ואוטומציה"),
]


def cv_signals(cv: str) -> dict:
    """חילוץ דטרמיניסטי וזהיר מקורות החיים. מחזיר רק מה שכתוב במפורש."""
    t = (cv or "").lower()
    out: dict = {}
    head = t[:400]
    for city, region in CITY_REGION.items():
        if city in head:
            out["locs"] = [region]; break
    if re.search(r"\bstudent\b|סטודנט", t) and re.search(r"(20\d\d)\s*[–-]\s*(present|current|היום|כיום)", t):
        out["status"] = "סטודנט/ית"
    roles = [] if sum(w in t for w in MECH_WORDS) >= 2 else [role for words, role in SKILL_ROLES if sum(w in t for w in words) >= 2]
    if "Frontend" in roles and "Backend" in roles:
        roles = ["Full-Stack"] + [r for r in roles if r not in ("Frontend", "Backend")]
    if roles:
        out["roles"] = roles
    return out


def build_search_plan(profile: dict) -> SearchPlan:
    """יואב: מתרגם את השאלון לתוכנית חיפוש. דטרמיניסטי, בלי AI, וניתן להסבר."""
    asked = normalize_answers(profile.get("answers", {}) or {})
    from_cv = cv_signals(profile.get("cv_text", ""))
    a = {**from_cv, **{k: v for k, v in asked.items() if v}}     # השאלון גובר על קורות החיים
    why: list[str] = []
    src = lambda key: " (מקורות החיים, אפשר לשנות בשאלון)" if key in from_cv and key not in asked else ""

    status, exp, track = a.get("status"), a.get("exp"), a.get("track")
    if status == "סטודנט/ית":
        levels = ["student", "intern", "junior"]
        why.append("סטודנט: משרות סטודנט, התמחויות וג׳וניור" + src("status"))
    elif status in ("בוגר/ת טרי/ה, מחפש/ת עבודה ראשונה", "משתחרר/ת משירות"):
        levels = ["junior", "entry"]; why.append("עבודה ראשונה: ג׳וניור ו-Entry level")
    elif status == "ג׳וניור עם ניסיון של עד שנתיים":
        levels = ["junior"]; why.append("ג׳וניור עם ניסיון")
    elif exp in ("3–5 שנים", "יותר מ-5 שנים"):
        levels = ["mid"]; why.append(f"ניסיון של {exp}: משרות ללא תווית ג׳וניור")
    else:
        levels = ["junior", "entry"]; why.append("ברירת מחדל עד שתענה על המצב התעסוקתי: ג׳וניור")

    student_positions = status == "סטודנט/ית" and track in (None, "", "משרת סטודנט חלקית", "את שתיהן")
    part_time = PART in (a.get("scope") or [])
    if part_time and status != "סטודנט/ית":
        why.append("מחפש גם משרה חלקית")
    if status == "סטודנט/ית" and track == "משרה מלאה אחרי התואר":
        levels = ["junior", "entry"]; why.append("מחפש משרה מלאה: בלי משרות סטודנט")
    if exp in EXP_LEVELS:   # ניסיון רב גובר על "סטודנט" / "עבודה ראשונה"
        levels = list(EXP_LEVELS[exp]) + (["student"] if student_positions else [])
        why.append(f"ניסיון של {exp} בתחום: " + ("משרות ביניים ובכירות" if "senior" in levels else "משרות ביניים, בלי תווית ג׳וניור"))

    max_years = EXP_MAX_YEARS.get(exp, 2 if "mid" not in levels else None)
    have_years = EXP_HAVE_YEARS.get(exp)   # לא ענה על שנות ניסיון: לפי המצב התעסוקתי
    if have_years is None and "mid" not in levels:
        have_years = 1 if status == "ג׳וניור עם ניסיון של עד שנתיים" else 0

    domains = a.get("domains") or [domain_of(profile)]
    domain = domains[0]
    packs = a.get("packs") or {}
    RT: dict = {}
    he_q: list = []
    for d in domains:   # כמה תחומים: איחוד התפקידים והחיפושים בעברית
        for k, v in role_titles(d, packs.get(d)).items():
            RT.setdefault(k, v)
        he_q += list((DOMAINS.get(d) or {}).get("he_queries") or (packs.get(d) or {}).get("he_queries") or [])
    for r in a.get("custom_roles") or []:   # תפקידים שהמשתמש כתב בעצמו ("אחר"), אחרי שיואב תרגם לשמות במודעות
        if r.get("label") and r.get("titles"):
            RT[r["label"]] = [t for t in r["titles"] if t][:3]
    he_q = list(dict.fromkeys(he_q + list(a.get("custom_he") or [])))
    if domains == ["פיתוח תוכנה"] and not a.get("custom_roles"):
        RT = ROLE_TITLES
    roles = [r for r in (a.get("roles") or []) if r in RT]
    titles = list(dict.fromkeys(t for r in roles for t in RT.get(r, [])))
    heads = [RT[r][0] for r in roles if RT.get(r)]
    if part_time and status != "סטודנט/ית" and he_q:
        he_q.append(he_q[0] + " משרה חלקית")
    if domains != ["פיתוח תוכנה"]:
        why.append("תחומים: " + ", ".join(domains) if len(domains) > 1 else f"תחום: {domain}")
    if not titles:
        first = next(iter(RT.values()), ["Software Engineer"])
        titles = first[:2] if RT is not ROLE_TITLES else ["Software Engineer", "Software Developer"]
        heads = titles[:1]
        why.append(f"עוד לא בחרת תפקידים: חיפוש כללי של {titles[0]}")
    else:
        why.append("תפקידים: " + ", ".join(roles) + src("roles"))

    # עיר מרכזית אחת לכל אזור: החיפוש כבר כולל רדיוס סביבה, וערים סמוכות רק מחזירות את אותן משרות
    # עיר מרכזית אחת לכל אזור גיאוגרפי: החיפוש כולל רדיוס, ולכן תל אביב כבר מכסה את גוש דן והשרון
    HUB = {"תל אביב": "Tel Aviv", "גוש דן והמרכז": "Tel Aviv", "השרון": "Tel Aviv"}
    locs = list(dict.fromkeys(HUB.get(r) or REGIONS[r][0] for r in (a.get("locs") or []) if REGIONS.get(r)))
    area = list(dict.fromkeys(c for r in (a.get("locs") or []) for c in REGIONS.get(r, [])))
    other_loc = str(a.get("locs_other") or "").strip() if "אחר" in (a.get("locs") or []) else ""
    if other_loc:   # עיר או אזור שהמשתמש כתב בעצמו
        locs.append(other_loc[:40])
    locations = list(dict.fromkeys(locs)) or ["Israel"]
    remote_only = a.get("mode") == "מהבית"
    if profile.get("extra_titles"):
        why.append("תפקידים שאישרת מההצעות: " + ", ".join(profile["extra_titles"]))
    why.append("אזורים: " + (", ".join(a.get("locs")) if a.get("locs") else "כל הארץ") + src("locs") + (" · עבודה מהבית בלבד" if remote_only else ""))

    prio = a.get("prio") or []
    prefer_size = (["startup", "scaleup"] if "סטארט-אפ קטן" in prio else []) + (["enterprise"] if "חברה גדולה ויציבה" in prio else [])
    prefer_sectors = sorted({s for r in roles for s in ROLE_SECTORS.get(r, [])} | ({"ai"} if "טכנולוגיות מעניינות" in prio else set()))
    if prefer_size: why.append("גודל חברה מועדף: " + ", ".join(prefer_size))

    sal = {"עד ₪12K": None, "₪12–16K": 12000, "₪16–20K": 16000, "₪20–25K": 20000, "₪25K ומעלה": 25000}.get(a.get("salary"))

    skips = profile.get("skip_reasons", {}) or {}
    counts: dict[str, int] = {}
    for r in skips.values():
        counts[r] = counts.get(r, 0) + 1
    if counts.get("בכירה מדי", 0) >= 2 and max_years and max_years > 1:
        max_years -= 1; why.append("דילגת על משרות בכירות: מחמיר בסינון שנות ניסיון")

    excl = [str(w).strip() for w in (asked.get("exclude") or []) if str(w).strip()][:12]
    if excl:
        why.append("לא להציג משרות עם: " + ", ".join(excl))

    return SearchPlan(titles=titles, levels=levels, max_years=max_years, locations=locations,
                      remote_only=remote_only, student_positions=student_positions,
                      prefer_size=prefer_size, prefer_sectors=prefer_sectors,
                      min_salary_month=sal, exclude_reasons=counts, why=why, have_years=have_years,
                      extra_titles=list(profile.get("extra_titles") or []), heads=heads, area_cities=area, domain=domain, he_queries=he_q, drop_queries=list(profile.get("drop_queries") or []), exclude_words=excl,
                      learned_queries=list(profile.get("learned_queries") or []),
                      domains=domains, part_time=part_time)


# ── חברות יעד ──────────────────────────────────────────────────────────────────
CATALOG_FILE = ROOT / "data" / "companies.json"


def load_catalog() -> list[dict]:
    return json.loads(CATALOG_FILE.read_text(encoding="utf-8"))["companies"]


def select_targets(plan: SearchPlan, profile: dict, catalog: list[dict] | None = None, limit: int = 25) -> list[dict]:
    """יואב: בוחר חברות יעד מהקטלוג לפי התוכנית. המשתמש יכול להוסיף ולהסיר בפרופיל."""
    catalog = catalog if catalog is not None else load_catalog()
    tc = profile.get("target_companies", {}) or {}
    removed = {c.lower() for c in tc.get("removed", [])}
    region_cities = {c.lower() for c in (plan.area_cities or plan.locations)}
    scored = []
    dkeys = {(DOMAINS.get(d) or {}).get("key", "other") for d in (plan.domains or [plan.domain])}   # כל התחומים שבחר
    for c in catalog:
        if c["name"].lower() in removed or not dkeys & set(c.get("domains", ["software"])):
            continue
        s, why = 0, []
        if plan.prefer_sectors and set(c.get("sectors", [])) & set(plan.prefer_sectors):
            s += 3; why.append("בתחום שבחרת")
        if plan.prefer_size and c.get("size") in plan.prefer_size:
            s += 2; why.append({"startup": "סטארט-אפ", "scaleup": "חברה צומחת", "enterprise": "חברה גדולה ויציבה"}[c["size"]])
        if region_cities == {"israel"} or c.get("city", "").lower() in region_cities or plan.remote_only:
            s += 1
        else:
            s -= 2
        if c.get("hires_juniors") and set(plan.levels) & {"student", "intern", "junior", "entry"}:
            s += 2; why.append("מגייסת ג׳וניורים או סטודנטים")
        scored.append({**c, "score": s, "why": why or ["מתאימה לתפקידים שבחרת"]})
    scored.sort(key=lambda x: -x["score"])
    picked = [c for c in scored if c["score"] > 0][:limit]
    for name in tc.get("added", []):
        if name.lower() not in {p["name"].lower() for p in picked}:
            picked.insert(0, {"name": name, "why": ["הוספת בעצמך"], "score": 99})
    return picked
