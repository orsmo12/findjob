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


def domain_of(profile: dict) -> str:
    """התחום: מה שבחרת בשאלון, אחרת מקורות החיים. ברירת מחדל: פיתוח תוכנה."""
    a = profile.get("answers") or {}
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
EXP_MAX_YEARS = {"אין עדיין": 1, "פחות משנה": 1, "1–2 שנים": 2, "3–5 שנים": 5, "יותר מ-5 שנים": None}


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

    extra_titles: list[str] = field(default_factory=list)  # תפקידים שיואב הציע ואישרת
    drop_queries: list[str] = field(default_factory=list)  # שאילתות שלא הביאו כלום (למידה)

    heads: list[str] = field(default_factory=list)  # הכותרת הראשית של כל תפקיד שבחרת
    area_cities: list[str] = field(default_factory=list)  # כל הערים באזורים שבחרת (לחברות יעד)
    domain: str = "פיתוח תוכנה"
    he_queries: list[str] = field(default_factory=list)   # חיפושים בעברית (בתחומים שמפרסמים הרבה בעברית)

    def queries(self, limit: int = 12) -> list[str]:
        """שילוב של כותרות ורמות: Junior / Student / Graduate / Entry level. אותו מבנה לכל תחום.
        סדר עדיפות: הכותרת הראשית של כל תפקיד, אחר כך Graduate, אחר כך שאר הכותרות, ואז Entry level."""
        heads = list(dict.fromkeys((self.heads or self.titles[:3]) + self.extra_titles))
        rest = [t for t in self.titles if t not in heads]
        jr = "junior" in self.levels or "entry" in self.levels
        st = "student" in self.levels and self.student_positions
        out = []
        for group in (heads, None, rest, "entry"):
            for t in (heads if group in (None, "entry") else group):
                if group is None:
                    out += [f"Graduate {t}"] if jr else []
                elif group == "entry":
                    out += [f"Entry Level {t}"] if jr else []
                else:
                    out += ([f"Student {t}"] if st else []) + ([f"Junior {t}"] if jr else []) + ([t] if "mid" in self.levels else [])
        if self.he_queries:  # אחרי הכותרות הראשיות, לפני השאר
            k = len(heads) * (1 + st)
            out = out[:k] + list(self.he_queries) + out[k:]
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
    asked = profile.get("answers", {}) or {}
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

    student_positions = status == "סטודנט/ית" and track in (None, "משרת סטודנט חלקית", "את שתיהן")
    if status == "סטודנט/ית" and track == "משרה מלאה אחרי התואר":
        levels = ["junior", "entry"]; why.append("מחפש משרה מלאה אחרי התואר: בלי משרות סטודנט")

    max_years = EXP_MAX_YEARS.get(exp, 2 if "mid" not in levels else None)

    domain = domain_of(profile)
    RT = role_titles(domain, a.get("pack"))
    roles = [r for r in (a.get("roles") or []) if r in RT] or (a.get("roles") or [] if RT is ROLE_TITLES else [])
    titles = [t for r in roles for t in RT.get(r, [])]
    heads = [RT[r][0] for r in roles if RT.get(r)]
    he_q = list((DOMAINS.get(domain) or {}).get("he_queries") or (a.get("pack") or {}).get("he_queries") or [])
    if domain != "פיתוח תוכנה":
        why.append(f"תחום: {domain}")
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

    return SearchPlan(titles=titles, levels=levels, max_years=max_years, locations=locations,
                      remote_only=remote_only, student_positions=student_positions,
                      prefer_size=prefer_size, prefer_sectors=prefer_sectors,
                      min_salary_month=sal, exclude_reasons=counts, why=why,
                      extra_titles=list(profile.get("extra_titles") or []), heads=heads, area_cities=area, domain=domain, he_queries=he_q, drop_queries=list(profile.get("drop_queries") or []))


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
    dkey = (DOMAINS.get(plan.domain) or {}).get("key", "other")
    for c in catalog:
        if c["name"].lower() in removed or dkey not in c.get("domains", ["software"]):
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
