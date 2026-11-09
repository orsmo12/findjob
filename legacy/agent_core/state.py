"""
state.py — הלוח המשותף של כל סוכני Life Board.

גרסה 2: הוספת cv_profile ו-onboarding_answers.
"""

from typing import TypedDict, Annotated, List, Optional
import operator


class JobResult(TypedDict):
    """משרה בודדת שנמצאה."""
    title:       str
    company:     str
    location:    str
    salary:      str
    url:         str
    description: str
    ats_score:   int   # 0-100
    source:      str   # "linkedin" | "indeed" | "glassdoor" | "google" | "alljobs"


class CareerState(TypedDict):
    """
    State משותף שעובר בין כל סוכני הקריירה.

    ── קלט (נקבע פעם אחת) ──────────────────────────────────────
    search_query      שאילתת החיפוש הנוכחית
    location          מיקום ("Tel Aviv" / "Remote" / "Israel")
    resume_text       ה-CV כטקסט רגיל
    max_results       כמה משרות לשלוף לכל מקור
    onboarding_answers תשובות המשתמש לשאלות ה-Smart Onboarding

    ── פלטי CV Parser (חדש) ─────────────────────────────────────
    cv_profile        פרופיל AI של המועמד:
                       {seniority, domain, top_skills, frameworks,
                        company_fit, salary_range_ils, role_titles,
                        search_keywords, smart_questions, analysis_notes}

    ── פלטי Job Finder ─────────────────────────────────────────
    raw_jobs          כל המשרות שנמצאו (לפני סינון)
    filtered_jobs     משרות אחרי סינון ATS

    ── פלטי Scout ──────────────────────────────────────────────
    company_signals   סיגנלי גיוס לכל חברה
    scout_refinement  שאילתה חדשה מהסקאוט (אם ביקש)
    scout_loop_count  כמה פעמים הסקאוט חזר (מקס' 2)
    all_senior_only   האם כל החברות הן Senior-only?

    ── פלטי Mentor ─────────────────────────────────────────────
    skill_gaps        פערי כישורים שזוהו
    critic_approved   האם הקריטיק אישר?

    ── פלטי Daily Assistant ────────────────────────────────────
    daily_summary     סיכום בוקר בעברית

    ── שליטה של המתזמר ─────────────────────────────────────────
    iteration         כמה סבבי חיפוש היו (מקס' 3)
    should_refine     האם לחפש שוב?
    refined_query     שאילתה מחודדת
    messages          לוג מלא (כל סוכן מוסיף)
    """

    # ── קלט ──────────────────────────────────────────────────────
    search_query:       str
    location:           str
    resume_text:        str
    max_results:        int
    onboarding_answers: dict   # {"remote": "היברידי", "company_size": "סטארטאפ", ...}

    # ── CV Parser (חדש) ───────────────────────────────────────────
    cv_profile: Optional[dict]
    # מבנה:
    # {
    #   "seniority": "junior" | "mid" | "senior",
    #   "seniority_years": int,
    #   "domain": "backend" | "frontend" | "fullstack" | "ml" | "devops" | "data",
    #   "top_skills": List[str],
    #   "frameworks": List[str],
    #   "languages": List[str],
    #   "company_fit": "startup" | "enterprise" | "both",
    #   "salary_range_ils": {"min": int, "max": int},
    #   "search_keywords": List[str],
    #   "role_titles": List[str],
    #   "smart_questions": List[dict],
    #   "analysis_notes": str
    # }

    # ── Job Finder ────────────────────────────────────────────────
    raw_jobs:      Annotated[List[JobResult], operator.add]
    filtered_jobs: Annotated[List[JobResult], operator.add]

    # ── Scout ─────────────────────────────────────────────────────
    company_signals:  Annotated[List[dict], operator.add]
    scout_refinement: Optional[str]
    scout_loop_count: int
    all_senior_only:  bool

    # ── Mentor ────────────────────────────────────────────────────
    skill_gaps:      Annotated[List[dict], operator.add]
    critic_approved: bool

    # ── Daily Assistant ───────────────────────────────────────────
    daily_summary: str

    # ── מתזמר ─────────────────────────────────────────────────────
    iteration:     int
    should_refine: bool
    refined_query: Optional[str]
    messages:      Annotated[List[str], operator.add]
