"""
query_strategist.py — סוכן אסטרטגיית חיפוש.

גרסה 2: משתמש בפלט cv_parser (cv_profile) לבניית שאילתה מדויקת.
אם אין cv_profile — חוזר לניתוח ישיר של ה-CV.
"""

import os
import json
import re
from groq import Groq
from agent_core.state import CareerState

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY לא מוגדר.")
        _client = Groq(api_key=api_key)
    return _client


def query_strategist_node(state: CareerState) -> dict:
    """
    LangGraph node: מייצר שאילתת חיפוש חכמה.

    אם cv_profile קיים (מ-cv_parser_node) — בונה שאילתה מבוססת פרופיל.
    אחרת — מנתח CV ישירות.

    קורא:  cv_profile, resume_text, search_query (מקורי), onboarding_answers
    כותב: search_query (מיטבי), messages
    """
    cv_profile      = state.get("cv_profile")
    resume_text     = state.get("resume_text", "")
    original_query  = state.get("search_query", "")
    onboarding      = state.get("onboarding_answers", {})

    # ── מסלול מהיר: יש פרופיל AI ───────────────────────────────────────────
    if cv_profile and cv_profile.get("role_titles"):
        # בחר תפקיד ראשון מהפרופיל
        best_query = cv_profile["role_titles"][0]
        domain     = cv_profile.get("domain", "")
        seniority  = cv_profile.get("seniority", "junior")
        top_skills = cv_profile.get("top_skills", [])[:2]

        # שפר עם תשובות onboarding אם קיימות
        if onboarding.get("remote") == "מרחוק מלא":
            best_query += " Remote"
        elif onboarding.get("industry") and onboarding["industry"] != "לא משנה":
            best_query = f"{onboarding['industry']} {best_query}"

        reason = (
            f"{seniority} {domain} | כישורים: {', '.join(top_skills)}"
            if top_skills else f"{seniority} {domain}"
        )

        print(f"[אסטרטג] 🎯 מפרופיל CV: '{original_query}' → '{best_query}'")
        return {
            "search_query": best_query,
            "messages": [f"אסטרטג (פרופיל): '{best_query}' — {reason}"],
        }

    # ── מסלול AI: ניתוח CV ישיר ─────────────────────────────────────────────
    if not resume_text:
        return {"messages": ["אסטרטג: אין CV ואין פרופיל — שומר על שאילתה מקורית."]}

    prompt = f"""אתה אסטרטג חיפוש עבודה בשוק ה-High-Tech הישראלי.
נתח את ה-CV הבא וצור שאילתת חיפוש מיטבית.

CV:
{resume_text[:600]}

כללים:
- 2–4 מילים בלבד
- התאם לרמת הניסיון
- אל תכלול "Senior" / "Lead" אם המועמד הוא junior

החזר JSON בלבד:
{{"best_query": "...", "reason": "..."}}"""

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=150,
        )

        raw = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)

        if json_match:
            data = json.loads(json_match.group())
            best_query = data.get("best_query", original_query)
            reason     = data.get("reason", "")
            print(f"[אסטרטג] '{original_query}' → '{best_query}'")
            return {
                "search_query": best_query,
                "messages":     [f"אסטרטג (AI): '{best_query}' — {reason}"],
            }

    except Exception as e:
        print(f"[אסטרטג] שגיאה: {e}")

    return {"messages": [f"אסטרטג: שומר שאילתה מקורית '{original_query}'"]}
