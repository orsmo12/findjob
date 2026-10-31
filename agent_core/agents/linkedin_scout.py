"""
linkedin_scout.py — סוכן מודיעין חברות עם Scout Loop.

לכל חברה במשרות המסוננות, הסוכן:
1. שולף סיגנלי גיוס מתיאור המשרה
2. מעריך התאמה לפרופיל המועמד בעזרת LLM
3. מסמן חברות שמגייסות ג'וניורים בפועל

Scout Loop — חידוש:
  אם כל החברות הן Senior-only → הסוכן מייצר שאילתה מחודדת
  ושולח חזרה ל-job_finder (עד 2 פעמים).
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
        _client = router_client("researcher", "judge")  # הנתב בוחר מודל ושומר על המכסה
    return _client


def _count_company_appearances(jobs: list, company: str) -> int:
    return sum(1 for j in jobs if j.get("company", "").lower() == company.lower())


def _build_refined_query(original_query: str, loop_count: int) -> str:
    """בונה שאילתה מחודדת יותר ל-Junior כשהסקאוט מזהה רק Senior."""
    junior_variants = [
        f"Entry Level {original_query.replace('Junior ', '').replace('Senior ', '')}",
        f"Graduate {original_query.replace('Junior ', '').replace('Senior ', '')} Internship",
        f"Junior Developer Graduate",
    ]
    return junior_variants[min(loop_count, len(junior_variants) - 1)]


def linkedin_scout_node(state: CareerState) -> dict:
    """
    LangGraph node: מעשיר חברות במידע מודיעיני + Scout Loop.

    קורא:  filtered_jobs, raw_jobs, resume_text, search_query, scout_loop_count
    כותב: company_signals, messages, scout_refinement, all_senior_only
    """
    filtered_jobs   = state.get("filtered_jobs", [])
    raw_jobs        = state.get("raw_jobs", [])
    search_query    = state.get("search_query", "")
    scout_loop_count = state.get("scout_loop_count", 0)

    if not filtered_jobs:
        return {
            "company_signals":  [],
            "scout_refinement": None,
            "all_senior_only":  False,
            "messages":         ["סקאוט: אין חברות לניתוח."],
        }

    # חברות ייחודיות בלבד
    seen, unique_companies = set(), []
    for job in filtered_jobs:
        company = job.get("company", "")
        if company and company not in seen:
            seen.add(company)
            unique_companies.append(job)

    print(f"[סקאוט] מנתח {len(unique_companies)} חברות"
          f"{f' (לולאה {scout_loop_count+1})' if scout_loop_count else ''}...")

    signals = []

    for job in unique_companies[:5]:
        company      = job.get("company", "לא ידוע")
        title        = job.get("title", "")
        description  = job.get("description", "")[:600]
        ats_score    = job.get("ats_score", 0)
        active_roles = _count_company_appearances(raw_jobs, company)

        prompt = f"""אתה יועץ קריירה המתמחה בשוק ה-High-Tech הישראלי.
נתח את מודעת העבודה הבאה והחזר דוח מודיעין על החברה.

חברה: {company}
תפקיד: {title}
תיאור המשרה:
{description}

רקע המועמד: סטודנט למדעי המחשב (שנה ג'), ניסיון בפרויקטי Python/React/AI, ללא ניסיון תעסוקתי עדיין.

החזר JSON בלבד (ללא הסבר):
{{
  "company_stage": "startup|scaleup|enterprise",
  "tech_stack_match": "high|medium|low",
  "junior_friendly": true או false,
  "culture_signal": "משפט אחד על תרבות החברה לפי תיאור המשרה",
  "fit_score": 0-100,
  "apply_priority": "high|medium|low",
  "seniority_required": "junior|mid|senior",
  "scout_recommendation": "apply|skip|wait"
}}"""

        try:
            client   = _get_client()
            response = client.chat.completions.create(
                model="routed",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=280,
            )

            raw        = response.choices[0].message.content.strip()
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            data       = json.loads(json_match.group()) if json_match else {}

            signal = {
                "company":            company,
                "role":               title,
                "ats_score":          ats_score,
                "active_roles_found": active_roles,
                "url":                job.get("url", ""),
                **data,
            }
            signals.append(signal)

            priority = data.get("apply_priority", "?").upper()
            fit      = data.get("fit_score", "?")
            seniority = data.get("seniority_required", "?")
            junior   = "✓ ג'וניור OK" if data.get("junior_friendly") else "✗ סניור בלבד"
            print(f"[סקאוט] {company}: עדיפות={priority}, התאמה={fit}%, {junior} ({seniority})")

        except Exception as e:
            print(f"[סקאוט] שגיאה בניתוח {company}: {e}")
            signals.append({
                "company":            company,
                "role":               title,
                "ats_score":          ats_score,
                "active_roles_found": active_roles,
                "url":                job.get("url", ""),
                "apply_priority":     "medium",
                "junior_friendly":    None,
                "seniority_required": "unknown",
                "error":              str(e),
            })

    # ── Scout Loop: האם כל החברות הן Senior-only? ─────────────────────────────
    junior_friendly_count = sum(
        1 for s in signals
        if s.get("junior_friendly") is True
        or s.get("seniority_required") in ("junior", "mid")
    )
    all_senior = junior_friendly_count == 0 and len(signals) > 0

    scout_refinement = None
    if all_senior and scout_loop_count < 2:
        scout_refinement = _build_refined_query(search_query, scout_loop_count)
        print(f"\n[סקאוט] ⚠️  כל {len(signals)} החברות דורשות ניסיון בכיר.")
        print(f"[סקאוט] 🔄 שולח חזרה לחיפוש עם שאילתה מחודדת: '{scout_refinement}'")
    elif all_senior:
        print(f"[סקאוט] ⚠️  רוב החברות בכירות — הגענו למגבלת הלולאה. ממשיך.")

    high_priority = [s for s in signals if s.get("apply_priority") == "high"]

    msgs = [
        f"סקאוט: נותחו {len(signals)} חברות.",
        f"סקאוט: {len(high_priority)} יעדים בעדיפות גבוהה.",
    ]
    if scout_refinement:
        msgs.append(f"סקאוט: חוזר לחיפוש — '{scout_refinement}'")

    return {
        "company_signals":  signals,
        "scout_refinement": scout_refinement,
        "all_senior_only":  all_senior and scout_loop_count >= 2,
        "messages":         msgs,
    }
