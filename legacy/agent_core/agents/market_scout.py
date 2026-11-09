"""
market_scout.py — חוקר שוק: מחקר עומק חברות ו-LinkedIn intelligence.

אחריות:
1. סורק LinkedIn לפוסטים רלוונטיים (hiring, tech, company news)
2. מנתח חברות מועדפות (size, culture, tech stack, growth signals)
3. מזהה אנשי קשר רלוונטיים
4. מייצר intelligence report לכל חברה בעדיפות גבוהה

מבוסס על: linkedin_scout.py מורחב
"""

import os
import json
import re
import time
from datetime import datetime
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
        _client = router_client("researcher", "judge")  # הנתב בוחר מודל ושומר על המכסה
    return _client


def market_scout_node(state: CareerState) -> dict:
    """LangGraph node: מחקר שוק ו-LinkedIn intelligence."""
    filtered_jobs = state.get("filtered_jobs", [])
    cv_profile    = state.get("cv_profile", {})
    search_query  = state.get("search_query", "")
    onboarding    = state.get("onboarding_answers", {})

    if not filtered_jobs:
        print("[חוקר שוק] אין משרות לחקור")
        return {"company_signals": [], "messages": ["חוקר שוק: אין משרות לחקור"]}

    print(f"[חוקר שוק] מנתח {len(filtered_jobs)} חברות...")
    companies = {}
    for job in filtered_jobs:
        name = job.get("company", "")
        if name and name not in companies:
            companies[name] = job
        if len(companies) >= 8:
            break

    linkedin_posts = _scrape_linkedin_posts(search_query, cv_profile)
    company_signals = []
    for company_name, job in companies.items():
        signal = _analyze_company(company_name, job, cv_profile, onboarding, linkedin_posts)
        company_signals.append(signal)
        time.sleep(0.3)

    priority_order = {"high": 0, "medium": 1, "low": 2}
    company_signals.sort(key=lambda s: priority_order.get(s.get("apply_priority", "low"), 2))

    high_priority = [s for s in company_signals if s.get("apply_priority") == "high"]
    print(f"[חוקר שוק] ✓ {len(company_signals)} חברות | {len(high_priority)} בעדיפות גבוהה")

    return {
        "company_signals": company_signals,
        "messages": [f"חוקר שוק: {len(company_signals)} חברות, {len(high_priority)} בעדיפות גבוהה"],
    }


def _scrape_linkedin_posts(search_query: str, cv_profile: dict) -> list:
    # הוסר: גלישה ב-LinkedIn עם ה-cookies שלך. פוסטים יגיעו מחיפוש ציבורי (קובי) או משיתוף שלך.
    return []

def _analyze_company(company_name, job, cv_profile, onboarding, linkedin_posts) -> dict:
    seniority   = cv_profile.get("seniority", "junior")
    domain      = cv_profile.get("domain", "Full-Stack")
    top_skills  = cv_profile.get("top_skills", [])
    ats_score   = job.get("ats_score", 0)
    job_title   = job.get("title", "")
    job_url     = job.get("url", "")

    relevant_posts = [p["text"] for p in linkedin_posts if company_name.lower() in p["text"].lower()][:3]
    posts_ctx = "\n".join(relevant_posts) if relevant_posts else "אין מידע LinkedIn"
    pref_remote = onboarding.get("remote", "")

    prompt = f"""אתה חוקר שוק ה-High-Tech הישראלי. נתח את החברה: "{company_name}"

תפקיד המועמד: {seniority} {domain}
משרה פתוחה: {job_title} (ATS: {ats_score}%)
כישורים: {', '.join(top_skills[:3])}
פורמט עבודה מועדף: {pref_remote or 'לא משנה'}

מידע LinkedIn:
{posts_ctx}

ספק ניתוח בפורמט JSON:
{{
  "company_size": "startup | scale-up | enterprise",
  "growth_stage": "early | growth | mature | decline",
  "tech_stack_match": "high | medium | low",
  "culture_signals": ["אות תרבות 1", "אות תרבות 2"],
  "hiring_urgency": "high | medium | low",
  "apply_priority": "high | medium | low",
  "priority_reason": "סיבה קצרה לעדיפות",
  "contact_strategy": "כיצד לגשת לחברה",
  "red_flags": [],
  "talking_points": ["נקודת שיחה רלוונטית לראיון"]
}}

apply_priority = high אם: ATS >= 75% וגם growth_stage != decline"""

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="routed",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=400,
        )
        raw = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            signal = json.loads(json_match.group())
            signal["company"]   = company_name
            signal["job_title"] = job_title
            signal["job_url"]   = job_url
            signal["ats_score"] = ats_score
            return signal
    except Exception as e:
        print(f"[חוקר שוק] שגיאת ניתוח {company_name}: {e}")

    return {
        "company":          company_name,
        "job_title":        job_title,
        "job_url":          job_url,
        "ats_score":        ats_score,
        "company_size":     "unknown",
        "growth_stage":     "unknown",
        "tech_stack_match": "medium",
        "culture_signals":  [],
        "hiring_urgency":   "medium",
        "apply_priority":   "high" if ats_score >= 75 else "medium",
        "priority_reason":  f"ATS {ats_score}%",
        "contact_strategy": "הגש דרך אתר החברה",
        "red_flags":        [],
        "talking_points":   [],
    }
