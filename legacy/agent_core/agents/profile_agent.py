"""
profile_agent.py — פרופיל: סוכן ניתוח CV ו-LinkedIn.

אחריות:
1. מנתח CV ומייצר cv_profile (JSON מובנה)
2. סורק פרופיל LinkedIn של המועמד (אם קיים)
3. מזהה פערי כישורים ביחס לשוק
4. מייצר תובנות השוואתיות
"""

import os
import json
import re
from groq import Groq  # noqa: F401 (type hints)
from agent_core.llm_router import router_client
from agent_core.state import CareerState

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY לא מוגדר.")
        _client = router_client("strategist", "judge")  # הנתב בוחר מודל ושומר על המכסה
    return _client


CV_PROFILE_SCHEMA = {
    "seniority":       "junior | mid | senior | lead | staff",
    "domain":          "Frontend | Backend | Full-Stack | DevOps | Data | Mobile | QA | ...",
    "years_exp":       "מספר שנות ניסיון משוער",
    "top_skills":      ["skill1", "skill2", "skill3"],
    "frameworks":      ["framework1", "framework2"],
    "company_fit":     ["startup", "scale-up", "enterprise"],
    "salary_range_ils": {"min": 0, "max": 0},
    "role_titles":     ["title1", "title2"],
    "search_keywords": ["keyword1", "keyword2", "keyword3"],
    "smart_questions": ["שאלה חכמה 1 לראיון", "שאלה חכמה 2"],
    "strengths":       ["חוזק 1", "חוזק 2"],
    "growth_areas":    ["תחום לצמיחה 1", "תחום לצמיחה 2"],
    "linkedin_signals": [],
}


def profile_agent_node(state: CareerState) -> dict:
    """LangGraph node: מנתח CV ומייצר פרופיל AI."""
    resume_text  = state.get("resume_text", "")
    linkedin_url = state.get("linkedin_url", "")
    onboarding   = state.get("onboarding_answers", {})

    # אם כבר יש פרופיל — דלג
    if state.get("cv_profile") and state["cv_profile"].get("role_titles"):
        print("[פרופיל] ✓ פרופיל קיים — מדלג ניתוח")
        return {"messages": ["פרופיל: שימוש בפרופיל קיים"]}

    if not resume_text:
        print("[פרופיל] אין CV — מדלג")
        return {"messages": ["פרופיל: אין CV להניתוח"]}

    print(f"[פרופיל] מנתח CV ({len(resume_text)} תווים)...")
    cv_profile = _analyze_cv(resume_text, onboarding)

    if linkedin_url:
        linkedin_signals = _analyze_linkedin(linkedin_url, cv_profile)
        cv_profile["linkedin_signals"] = linkedin_signals
        print(f"[פרופיל] LinkedIn: {len(linkedin_signals)} תובנות")

    skill_gaps = _compute_initial_skill_gaps(cv_profile)

    print(f"[פרופיל] ✓ פרופיל: {cv_profile.get('seniority')} {cv_profile.get('domain')}")

    return {
        "cv_profile": cv_profile,
        "skill_gaps": skill_gaps,
        "messages":   [f"פרופיל: {cv_profile.get('seniority')} {cv_profile.get('domain')} | "
                       f"{', '.join(cv_profile.get('role_titles', [])[:2])}"],
    }


def _analyze_cv(resume_text: str, onboarding: dict) -> dict:
    schema_str = json.dumps(CV_PROFILE_SCHEMA, ensure_ascii=False, indent=2)
    onboarding_ctx = ""
    if onboarding:
        items = [f"{k}: {v}" for k, v in onboarding.items() if v]
        if items:
            onboarding_ctx = f"\nהעדפות המועמד:\n" + "\n".join(items)

    prompt = f"""אתה מנתח CV מומחה לשוק ה-High-Tech הישראלי.
נתח את ה-CV הבא ומלא את הסכמה המבוקשת.

CV:
{resume_text[:2000]}
{onboarding_ctx}

החזר JSON בדיוק בפורמט הבא (בלי טקסט נוסף):
{schema_str}

כללים:
- seniority: junior=0-2 שנים, mid=2-5, senior=5-10, lead/staff=10+
- salary_range_ils: בשקלים ברוטו לחודש
- role_titles: תפקידים ריאליים בשוק
- search_keywords: 2-4 מילות חיפוש לכל כניסה
- אל תמציא מידע שלא קיים ב-CV"""

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="routed",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=800,
        )
        raw = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            profile = json.loads(json_match.group())
            for field in ["seniority", "domain", "top_skills", "role_titles"]:
                if field not in profile:
                    profile[field] = CV_PROFILE_SCHEMA[field]
            if "linkedin_signals" not in profile:
                profile["linkedin_signals"] = []
            return profile
    except Exception as e:
        print(f"[פרופיל] שגיאת LLM: {e}")

    return {
        "seniority":        "junior",
        "domain":           "Full-Stack",
        "years_exp":        "0-2",
        "top_skills":       ["JavaScript", "Python"],
        "frameworks":       ["React"],
        "company_fit":      ["startup"],
        "salary_range_ils": {"min": 12000, "max": 18000},
        "role_titles":      ["Junior Developer", "Full-Stack Developer"],
        "search_keywords":  ["Junior Developer", "Full-Stack"],
        "smart_questions":  ["מה קצב הצמיחה הטיפוסי לתפקיד?"],
        "strengths":        ["נכונות ללמוד"],
        "growth_areas":     ["ניסיון Production"],
        "linkedin_signals": [],
    }


def _analyze_linkedin(linkedin_url: str, cv_profile: dict) -> list:
    seniority = cv_profile.get("seniority", "junior")
    domain    = cv_profile.get("domain", "")
    prompt = f"""בהתבסס על פרופיל LinkedIn: {linkedin_url}
המועמד הוא {seniority} {domain}.
צור 3 תובנות LinkedIn שיעזרו בחיפוש העבודה.
החזר JSON: {{"signals": ["תובנה 1", "תובנה 2", "תובנה 3"]}}"""
    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="routed",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=200,
        )
        raw = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group()).get("signals", [])
    except Exception as e:
        print(f"[פרופיל] שגיאת LinkedIn: {e}")
    return [f"עדכן פרופיל LinkedIn בכישורי {domain}"]


def _compute_initial_skill_gaps(cv_profile: dict) -> list:
    domain    = cv_profile.get("domain", "")
    seniority = cv_profile.get("seniority", "junior")
    skills    = set(cv_profile.get("top_skills", []) + cv_profile.get("frameworks", []))

    EXPECTED_SKILLS = {
        "Frontend":    ["React", "TypeScript", "CSS", "Testing", "Performance"],
        "Backend":     ["Node.js", "Python", "SQL", "API Design", "Docker"],
        "Full-Stack":  ["React", "Node.js", "TypeScript", "SQL", "Git"],
        "DevOps":      ["Docker", "Kubernetes", "CI/CD", "AWS", "Terraform"],
        "Data":        ["Python", "SQL", "Machine Learning", "Pandas", "Spark"],
        "Mobile":      ["React Native", "TypeScript", "iOS", "Android", "Testing"],
        "QA":          ["Selenium", "Jest", "Cypress", "Python", "API Testing"],
    }
    SENIOR_SKILLS = {
        "senior": ["System Design", "Mentoring", "Architecture"],
        "lead":   ["System Design", "Team Leadership", "OKRs", "Hiring"],
        "mid":    ["Code Review", "Testing", "Documentation"],
    }

    gaps = []
    expected = EXPECTED_SKILLS.get(domain, EXPECTED_SKILLS.get("Full-Stack", []))
    for skill in expected:
        if not any(skill.lower() in s.lower() for s in skills):
            gaps.append({
                "skill":    skill,
                "priority": "high" if len(gaps) < 2 else "medium",
                "reason":   f"נדרש ל-{domain} {seniority}",
            })
            if len(gaps) >= 4:
                break

    for skill in SENIOR_SKILLS.get(seniority, []):
        if not any(skill.lower() in s.lower() for s in skills):
            gaps.append({
                "skill":    skill,
                "priority": "medium",
                "reason":   f"נדרש לרמת {seniority}",
            })
            if len(gaps) >= 6:
                break

    return gaps
