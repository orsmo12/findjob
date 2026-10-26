"""
daily_assistant.py — סוכן העוזר הבוקרי.

הסוכן האחרון בפייפליין:
1. מייצר briefing בוקרי בעברית תקינה עם מונחי High-Tech באנגלית
2. שומר את כל תוצאות הריצה לזיכרון (WARM + COLD)
3. מדפיס סטטיסטיקות מצטברות
"""

import os
from datetime import date
from groq import Groq
from agent_core.state import CareerState
from agent_core.memory.manager import save_run_results, get_weekly_stats

_client = None

def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY לא מוגדר.")
        _client = Groq(api_key=api_key)
    return _client


def daily_assistant_node(state: CareerState) -> dict:
    filtered_jobs   = state.get("filtered_jobs", [])
    company_signals = state.get("company_signals", [])
    skill_gaps      = state.get("skill_gaps", [])
    raw_jobs        = state.get("raw_jobs", [])
    rounds          = state.get("iteration", 1)
    query_used      = state.get("search_query", "")

    today_he = date.today().strftime("%d/%m/%Y")
    days_he  = ["שני","שלישי","רביעי","חמישי","שישי","שבת","ראשון"]
    today_str= f"יום {days_he[date.today().weekday()]}, {today_he}"

    top_jobs      = sorted(filtered_jobs, key=lambda j: j["ats_score"], reverse=True)[:3]
    top_gap       = skill_gaps[0] if skill_gaps else None
    high_priority = [s for s in company_signals if s.get("apply_priority") == "high"]

    jobs_text = "\n".join([
        f"- [{j['ats_score']}%] {j['title']} @ {j['company']}\n  {j['url']}"
        for j in top_jobs
    ]) or "לא נמצאו התאמות חזקות היום."

    gap_text      = f"{top_gap['skill']}: {top_gap['reason']}" if top_gap else "לא זוהו פערים."
    priority_text = ", ".join([s["company"] for s in high_priority]) or "אין חברות בעדיפות גבוהה היום."

    prompt = f"""אתה עוזר קריירה אישי שכותב סיכום בוקר למחפש עבודה בתחום ה-High-Tech.
היום: {today_str}.

תוצאות החיפוש:
- נסרקו {len(raw_jobs)} משרות ב-{rounds} סבב/ים
- נמצאו {len(filtered_jobs)} התאמות טובות

המשרות המובילות:
{jobs_text}

פער הכישורים המרכזי לעבוד עליו:
{gap_text}

חברות בעדיפות גבוהה להגשה:
{priority_text}

כתוב סיכום בוקר קצר ומעורר השראה — עד 120 מילה.
כתוב בעברית תקינה ורהוטה. מונחי טכנולוגיה (TypeScript, Docker, AWS, Full-Stack וכד') — השאר באנגלית.
כלול: משפט סיכום תוצאות, פעולה אחת חשובה להיום, משפט סיום מעודד.
רק פסקאות רציפות — ללא נקודות תבליט."""

    summary = ""
    try:
        client = _get_client()
        print("[עוזר בוקרי] מייצר briefing...")
        response = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=220,
        )
        summary = response.choices[0].message.content.strip()
        print(f"[עוזר בוקרי] Briefing מוכן ({len(summary.split())} מילים)")
    except Exception as e:
        print(f"[עוזר בוקרי] שגיאת LLM: {e}")
        if top_jobs:
            best = top_jobs[0]
            summary = (
                f"בוקר טוב! נמצאו {len(filtered_jobs)} התאמות היום. "
                f"הטובה ביותר: {best['title']} ב-{best['company']} ({best['ats_score']}%). "
                f"הכישור המרכזי לפיתוח: {top_gap['skill'] if top_gap else 'המשך לבנות'}. קדימה!"
            )
        else:
            summary = (
                f"בוקר טוב! לא נמצאו התאמות חזקות היום לאחר {rounds} סבבי חיפוש. "
                f"שקול להרחיב את השאילתה. "
                f"המיקוד להיום: {top_gap['skill'] if top_gap else 'פורטפוליו'}."
            )

    # ── שמור לזיכרון ───────────────────────────────────────────────────────────
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
        "messages":      [f"עוזר בוקרי: Briefing מוכן עבור {today_str}"],
    }
