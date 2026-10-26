"""
mentor.py — מנטור: ייעוץ קריירה, מכתבי מועמדות, ומעקב פניות.

ממזג: mentor.py קיים + cover_letter logic
"""

import os
import re
import json
import hashlib
from typing import Optional
from groq import Groq
from agent_core.state import CareerState

_groq_client = None
_anthropic_client = None
_cover_letter_cache: dict[str, str] = {}


def _get_groq() -> Groq:
    global _groq_client
    if _groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY לא מוגדר.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        try:
            import anthropic
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if api_key:
                _anthropic_client = anthropic.Anthropic(api_key=api_key)
        except ImportError:
            pass
    return _anthropic_client


def mentor_node(state: CareerState) -> dict:
    """LangGraph node: מנטור — ייעוץ + מכתבים + הכנה לראיון."""
    filtered_jobs   = state.get("filtered_jobs", [])
    cv_profile      = state.get("cv_profile", {})
    skill_gaps      = state.get("skill_gaps", [])
    resume_text     = state.get("resume_text", "")
    company_signals = state.get("company_signals", [])

    results = {}

    # 1. העשר פערי כישורים
    if cv_profile and skill_gaps:
        enriched_gaps = _enrich_skill_gaps(skill_gaps, cv_profile)
        results["skill_gaps"] = enriched_gaps
        print(f"[מנטור] פערי כישורים: {len(enriched_gaps)} מזוהים")

    # 2. מכתבי מועמדות למשרות Top-3
    if filtered_jobs and resume_text and cv_profile:
        top_jobs = sorted(filtered_jobs, key=lambda j: j["ats_score"], reverse=True)[:3]
        cover_letters = {}
        for job in top_jobs:
            if job.get("ats_score", 0) >= 70:
                letter = _generate_cover_letter(job, cv_profile, resume_text)
                if letter:
                    cover_letters[job["url"]] = letter
                    print(f"[מנטור] מכתב: {job['title']} @ {job['company']}")
        if cover_letters:
            results["cover_letters"] = cover_letters

    # 3. הכנה לראיון
    if filtered_jobs and cv_profile:
        best_job = max(filtered_jobs, key=lambda j: j.get("ats_score", 0))
        if best_job.get("ats_score", 0) >= 65:
            interview_prep = _prepare_interview(best_job, cv_profile)
            results["interview_prep"] = interview_prep
            print(f"[מנטור] הכנה לראיון: {best_job['title']}")

    # 4. insight שבועי
    career_insight = _generate_career_insight(cv_profile, skill_gaps, company_signals)
    results["career_insight"] = career_insight

    msg_parts = []
    if "cover_letters" in results: msg_parts.append(f"{len(results['cover_letters'])} מכתבי מועמדות")
    if "interview_prep" in results: msg_parts.append("הכנה לראיון")
    if results.get("skill_gaps"): msg_parts.append(f"{len(results['skill_gaps'])} פערי כישורים")

    results["messages"] = [f"מנטור: {' | '.join(msg_parts) or 'ניתוח הושלם'}"]
    return results


def _generate_cover_letter(job: dict, cv_profile: dict, resume_text: str) -> Optional[str]:
    cache_key = hashlib.sha256(
        f"{job['url']}|{cv_profile.get('seniority')}|{resume_text[:100]}".encode()
    ).hexdigest()
    if cache_key in _cover_letter_cache:
        print(f"[מנטור] cache hit: {job['title']}")
        return _cover_letter_cache[cache_key]

    prompt = _build_cover_letter_prompt(job, cv_profile, resume_text)

    # נסה Claude claude-opus-4-5
    anthropic = _get_anthropic()
    if anthropic:
        try:
            response = anthropic.messages.create(
                model="claude-opus-4-5",
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            letter = response.content[0].text.strip()
            _cover_letter_cache[cache_key] = letter
            return letter
        except Exception as e:
            print(f"[מנטור] Claude שגיאה: {e} — עובר ל-Groq")

    # Groq fallback
    try:
        client = _get_groq()
        response = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=600,
        )
        letter = response.choices[0].message.content.strip()
        _cover_letter_cache[cache_key] = letter
        return letter
    except Exception as e:
        print(f"[מנטור] Groq שגיאה: {e}")
        return None


def _build_cover_letter_prompt(job: dict, cv_profile: dict, resume_text: str) -> str:
    seniority  = cv_profile.get("seniority", "junior")
    domain     = cv_profile.get("domain", "Full-Stack")
    top_skills = cv_profile.get("top_skills", [])
    strengths  = cv_profile.get("strengths", [])
    return f"""כתוב מכתב מועמדות בעברית למשרה הבאה.

משרה: {job.get('title', '')} ב-{job.get('company', '')}
תיאור: {job.get('description', '')[:400]}

פרופיל המועמד: {seniority} {domain}
כישורים מרכזיים: {', '.join(top_skills[:4])}
חוזקות: {', '.join(strengths[:2]) if strengths else 'נכונות ללמוד'}

קטע מה-CV:
{resume_text[:300]}

כתוב מכתב מועמדות:
- 3 פסקאות: פתיחה + התאמה + סגירה
- עד 200 מילה
- מקצועי ואישי
- בעברית תקינה
- ללא ניסוח "אני מבקש/ת להציג עצמי"
- הדגש התאמה ספציפית למשרה"""


def _prepare_interview(job: dict, cv_profile: dict) -> dict:
    seniority  = cv_profile.get("seniority", "junior")
    domain     = cv_profile.get("domain", "Full-Stack")
    top_skills = cv_profile.get("top_skills", [])
    prompt = f"""הכן תשתית הכנה לראיון עבור:
משרה: {job.get('title')} ב-{job.get('company')}
רמה: {seniority} {domain}
כישורים: {', '.join(top_skills[:3])}

החזר JSON:
{{
  "likely_questions": [{{"question": "שאלה 1", "type": "technical", "tip": "עצה"}}],
  "star_stories": [{{"situation": "מצב", "task": "משימה", "action": "פעולה", "result": "תוצאה", "use_for": "לאיזה שאלה"}}],
  "questions_to_ask": ["שאלה לשאול את המראיין"],
  "research_checklist": ["מה לחקור על החברה"]
}}"""
    try:
        client = _get_groq()
        response = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600,
        )
        raw = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            prep = json.loads(json_match.group())
            prep["job_title"] = job.get("title", "")
            prep["company"]   = job.get("company", "")
            return prep
    except Exception as e:
        print(f"[מנטור] שגיאת interview prep: {e}")
    return {
        "job_title": job.get("title", ""),
        "company":   job.get("company", ""),
        "likely_questions":  [],
        "star_stories":      [],
        "questions_to_ask":  ["מה קצב הצמיחה לתפקיד זה?"],
        "research_checklist": ["מוצרי החברה", "גיוס אחרון", "tech blog"],
    }


def _enrich_skill_gaps(skill_gaps: list, cv_profile: dict) -> list:
    LEARNING_RESOURCES = {
        "React":         {"resource": "react.dev", "time": "2 שבועות", "type": "docs"},
        "TypeScript":    {"resource": "typescriptlang.org", "time": "1 שבוע", "type": "docs"},
        "Docker":        {"resource": "docker.com/101-tutorial", "time": "1 שבוע", "type": "tutorial"},
        "AWS":           {"resource": "aws.amazon.com/training/free", "time": "3 שבועות", "type": "course"},
        "System Design": {"resource": "system-design-primer (GitHub)", "time": "4 שבועות", "type": "book"},
        "Testing":       {"resource": "vitest.dev / jest.io", "time": "1 שבוע", "type": "docs"},
        "SQL":           {"resource": "sqlbolt.com", "time": "1 שבוע", "type": "interactive"},
        "Node.js":       {"resource": "nodejs.org/learn", "time": "2 שבועות", "type": "docs"},
        "Python":        {"resource": "python.org/doc", "time": "2 שבועות", "type": "docs"},
        "CI/CD":         {"resource": "GitHub Actions docs", "time": "3 ימים", "type": "docs"},
    }
    enriched = []
    for gap in skill_gaps:
        skill    = gap.get("skill", "")
        learning = LEARNING_RESOURCES.get(skill, {
            "resource": f"YouTube / Udemy: '{skill} tutorial'",
            "time":     "1-2 שבועות",
            "type":     "video",
        })
        enriched.append({
            **gap,
            "learning_resource": learning.get("resource", ""),
            "estimated_time":    learning.get("time", ""),
            "resource_type":     learning.get("type", ""),
        })
    return enriched


def _generate_career_insight(cv_profile: dict, skill_gaps: list, company_signals: list) -> str:
    seniority = cv_profile.get("seniority", "junior")
    domain    = cv_profile.get("domain", "Full-Stack")
    top_skill = cv_profile.get("top_skills", ["JavaScript"])[0]
    top_gap   = skill_gaps[0]["skill"] if skill_gaps else "פורטפוליו"
    high_pri  = [s["company"] for s in company_signals if s.get("apply_priority") == "high"]
    company_ctx = f"חברות בעדיפות: {', '.join(high_pri[:2])}" if high_pri else ""

    prompt = f"""כתוב insight קריירה קצר בעברית — 2-3 משפטים בלבד.

פרופיל: {seniority} {domain}
כישור מוביל: {top_skill}
פער לסגור: {top_gap}
{company_ctx}

המלצה: מה הצעד החכם ביותר להיום/לשבוע הזה?
פסקה קצרה, ישירה, מעשית."""

    try:
        client = _get_groq()
        response = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=120,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return f"המיקוד הנכון עכשיו: חזק את {top_skill} ועבוד על {top_gap}. צעד קטן כל יום."
