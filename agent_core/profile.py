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
ROLE_SECTORS = {"AI / ML": ["ai"], "סייבר": ["cyber"], "Data / BI": ["data"], "DevOps / Cloud": ["devtools"],
                "Embedded": ["hardware"], "QA ואוטומציה": [], "Backend": [], "Frontend": [], "Full-Stack": []}
REGIONS = {
    "תל אביב":          ["Tel Aviv"],
    "גוש דן והמרכז":    ["Tel Aviv", "Ramat Gan", "Petah Tikva", "Herzliya"],
    "השרון":            ["Herzliya", "Ra'anana", "Netanya", "Kfar Saba"],
    "ירושלים":          ["Jerusalem"],
    "חיפה והצפון":      ["Haifa", "Yokneam"],
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

    def queries(self, limit: int = 6) -> list[str]:
        out = []
        for t in self.titles:
            if "student" in self.levels and self.student_positions:
                out.append(f"Student {t}")
            if "junior" in self.levels or "entry" in self.levels:
                out.append(f"Junior {t}")
            if "mid" in self.levels:
                out.append(t)
        seen, uniq = set(), []
        for q in out:
            if q.lower() not in seen:
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
    roles = [role for words, role in SKILL_ROLES if sum(w in t for w in words) >= 2]
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

    roles = a.get("roles") or []
    titles = [t for r in roles for t in ROLE_TITLES.get(r, [])]
    if not titles:
        titles = ["Software Engineer", "Software Developer"]
        why.append("עוד לא בחרת תפקידים: חיפוש כללי של Software Engineer")
    else:
        why.append("תפקידים: " + ", ".join(roles) + src("roles"))

    locs = [c for r in (a.get("locs") or []) for c in REGIONS.get(r, [])]
    locations = list(dict.fromkeys(locs)) or ["Israel"]
    remote_only = a.get("mode") == "מהבית"
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
                      min_salary_month=sal, exclude_reasons=counts, why=why)


# ── חברות יעד ──────────────────────────────────────────────────────────────────
CATALOG_FILE = ROOT / "data" / "companies.json"


def load_catalog() -> list[dict]:
    return json.loads(CATALOG_FILE.read_text(encoding="utf-8"))["companies"]


def select_targets(plan: SearchPlan, profile: dict, catalog: list[dict] | None = None, limit: int = 25) -> list[dict]:
    """יואב: בוחר חברות יעד מהקטלוג לפי התוכנית. המשתמש יכול להוסיף ולהסיר בפרופיל."""
    catalog = catalog if catalog is not None else load_catalog()
    tc = profile.get("target_companies", {}) or {}
    removed = {c.lower() for c in tc.get("removed", [])}
    region_cities = {c.lower() for c in plan.locations}
    scored = []
    for c in catalog:
        if c["name"].lower() in removed:
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
