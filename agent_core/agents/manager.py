"""
manager.py — המנהל: סוכן ראשון ואחרון בפייפליין.

אחריות כפולה:
1. פתיחה: מנתח בקשה, מגדיר אסטרטגיית חיפוש, מזמן סוכנים
2. סגירה: מרכז ממצאים, מייצר בריף יומי, שומר לזיכרון

ממזג: query_strategist.py + daily_assistant.py
"""

import os
import json
import re
from datetime import date
from groq import Groq  # noqa: F401 (type hints)
from agent_core.llm_router import router_client
from agent_core.state import CareerState
from agent_core.memory.manager import save_run_results, get_weekly_stats

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY לא מוגדר.")
        _client = router_client("strategist", "judge")  # הנתב בוחר מודל ושומר על המכסה
    return _client


# ── שלב א׳: פתיחה — אסטרטגיית חיפוש ─────────────────────────────────────────

def manager_open_node(state: CareerState) -> dict:
    """
    LangGraph node: שלב פתיחה של המנהל.
    מגדיר שאילתת חיפוש מיטבית לפי cv_profile או ניתוח ישיר.
    """
    cv_profile     = state.get("cv_profile")
    resume_text    = state.get("resume_text", "")
    original_query = state.get("search_query", "")
    onboarding     = state.get("onboarding_answers", {})

    # מסלול מהיר: יש פרופיל AI
    if cv_profile and cv_profile.get("role_titles"):
        best_query = cv_profile["role_titles"][0]
        domain     = cv_profile.get("domain", "")
        seniority  = cv_profile.get("seniority", "junior")
        top_skills = cv_profile.get("top_skills", [])[:2]

        if onboarding.get("remote") == "מרחוק מלא":
            best_query += " Remote"
        elif onboarding.get("industry") and onboarding["industry"] != "לא משנה":
            best_query = f"{onboarding['industry']} {best_query}"

        reason = (
            f"{seniority} {domain} | כישורים: {', '.join(top_skills)}"
            if top_skills else f"{seniority} {domain}"
        )

        print(f"[מנהל-פתיחה] 🎯 מפרופיל CV: '{original_query}' → '{best_query}'")
        return {
            "search_query": best_query,
            "messages": [f"מנהל (פתיחה): '{best_query}' — {reason}"],
        }

    # מסלול AI: ניתוח CV ישיר
    if not resume_text:
        return {"messages": ["מנהל: אין CV ואין פרופיל — שומר שאילתה מקורית."]}

    prompt = f"""אתה מנהל אסטרטגיית חיפוש עבודה בשוק ה-High-Tech הישראלי.
נתח את ה-CV הבא וצור שאילתת חיפוש מיטבית.

CV:
{resume_text[:600]}

כללים:
- 2–4 מילות מפתח בלבד
- התאם לרמת הניסיון (junior/mid/senior)
- אל תכלול "Senior" / "Lead" אם המועמד הוא junior

החזר JSON בלבד:
{{"best_query": "...", "reason": "..."}}"""

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="routed",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=150,
        )
        raw = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            data       = json.loads(json_match.group())
            best_query = data.get("best_query", original_query)
            reason     = data.get("reason", "")
            print(f"[מנהל-פתיחה] '{original_query}' → '{best_query}'")
            return {
                "search_query": best_query,
                "messages":     [f"מנהל (AI): '{best_query}' — {reason}"],
            }
    except Exception as e:
        print(f"[מנהל-פתיחה] שגיאה: {e}")

    return {"messages": [f"מנהל: שומר שאילתה מקורית '{original_query}'"]}


# ── שלב ב׳: סגירה — בריף יומי ─────────────────────────────────────────────────

def manager_close_node(state: CareerState) -> dict:
    """
    LangGraph node: שלב סגירה של המנהל.
    מרכז ממצאים ומייצר בריף יומי.
    """
    filtered_jobs   = state.get("filtered_jobs", [])
    company_signals = state.get("company_signals", [])
    skill_gaps      = state.get("skill_gaps", [])
    raw_jobs        = state.get("raw_jobs", [])
    rounds          = state.get("iteration", 1)
    query_used      = state.get("search_query", "")

    today_he  = date.today().strftime("%d/%m/%Y")
    days_he   = ["שני","שלישי","רביעי","חמישי","שישי","שבת","ראשון"]
    today_str = f"יום {days_he[date.today().weekday()]}, {today_he}"

    top_jobs      = sorted(filtered_jobs, key=lambda j: j["ats_score"], reverse=True)[:3]
    top_gap       = skill_gaps[0] if skill_gaps else None
    high_priority = [s for s in company_signals if s.get("apply_priority") == "high"]

    jobs_text = "\n".join([
        f"- [{j['ats_score']}%] {j['title']} @ {j['company']}\n  {j['url']}"
        for j in top_jobs
    ]) or "לא נמצאו התאמות חזקות היום."

    gap_text      = f"{top_gap['skill']}: {top_gap['reason']}" if top_gap else "לא זוהו פערים."
    priority_text = ", ".join([s["company"] for s in high_priority]) or "אין חברות בעדיפות גבוהה."

    prompt = f"""אתה מנהל קריירה אישי שכותב סיכום יומי למחפש עבודה בתחום ה-High-Tech.
היום: {today_str}.

תוצאות החיפוש:
- נסרקו {len(raw_jobs)} משרות ב-{rounds} סבב/ים
- נמצאו {len(filtered_jobs)} התאמות טובות

המשרות המובילות:
{jobs_text}

פער הכישורים המרכזי:
{gap_text}

חברות בעדיפות גבוהה:
{priority_text}

כתוב בריף יומי קצר ומניע לפעולה — עד 120 מילה.
כתוב בעברית תקינה. מונחי טק (TypeScript, Docker, AWS, Full-Stack) — השאר באנגלית.
כלול: משפט סיכום, פעולה אחת להיום, משפט סיום מעודד.
ללא נקודות תבליט."""

    summary = ""
    try:
        client = _get_client()
        print("[מנהל-סגירה] מייצר בריף יומי...")
        response = client.chat.completions.create(
            model="routed",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=220,
        )
        summary = response.choices[0].message.content.strip()
        print(f"[מנהל-סגירה] בריף מוכן ({len(summary.split())} מילים)")
    except Exception as e:
        print(f"[מנהל-סגירה] שגיאת LLM: {e}")
        if top_jobs:
            best    = top_jobs[0]
            summary = (
                f"בוקר טוב! נמצאו {len(filtered_jobs)} התאמות היום. "
                f"הטובה ביותר: {best['title']} ב-{best['company']} ({best['ats_score']}%). "
                f"המיקוד: {top_gap['skill'] if top_gap else 'פורטפוליו'}. קדימה!"
            )
        else:
            summary = (
                f"בוקר טוב! לא נמצאו התאמות חזקות לאחר {rounds} סבבים. "
                f"שקול להרחיב את השאילתה. "
                f"המיקוד: {top_gap['skill'] if top_gap else 'פורטפוליו'}."
            )

    # שמור לזיכרון
    save_run_results(
        jobs            = filtered_jobs,
        company_signals = company_signals,
        skill_gaps      = skill_gaps,
        summary         = summary,
        query_used      = query_used,
    )
    print("\n" + get_weekly_stats())

    return {
        "daily_summary": summary,
        "messages":      [f"מנהל (סגירה): בריף מוכן עבור {today_str}"],
    }
