r"""
scheduler.py — מריץ את פייפליין Career Agents אוטומטית.

שתי אפשרויות הרצה:
  1. מיידי:        python scheduler.py --now
  2. מתוזמן:       python scheduler.py --schedule   (רץ כל יום ב-10:00)
  3. סטטיסטיקות:  python scheduler.py --stats

הגדרת cron (Linux/Mac):
  0 10 * * * cd /path/to/lifeboard && python scheduler.py --now >> logs/career.log 2>&1

הגדרת Windows Task Scheduler:
  - Program:   python
  - Arguments: C:\path\to\lifeboard\scheduler.py --now
  - Trigger:   Daily at 10:00
"""

import sys
import os
import argparse
from pathlib import Path
from datetime import datetime

# ── טען .env ──────────────────────────────────────────────────────────────────
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

# ── Resume של המשתמש ─────────────────────────────────────────────────────────
RESUME_FILE = project_root / "my_resume.txt"

# קורות החיים נטענים מ-my_resume.txt (מחוץ ל-Git). לעולם לא בקוד.
MY_RESUME = ""

def load_resume() -> str:
    from agent_core.profile import load_profile
    cv = (load_profile().get("cv_text") or "").strip()
    if cv:
        print("[Scheduler] CV נטען מהפרופיל")
        return cv
    if RESUME_FILE.exists():
        text = RESUME_FILE.read_text(encoding="utf-8").strip()
        if text:
            print(f"[Scheduler] CV נטען מקובץ: {RESUME_FILE.name}")
            return text
    raise SystemExit("[Scheduler] ❌ לא נמצא my_resume.txt — צור אותו בתיקיית הפרויקט עם קורות החיים שלך")


# ── הגדרות חיפוש ─────────────────────────────────────────────────────────────
def build_search_config() -> dict:
    """יואב: תוכנית החיפוש נבנית מקורות החיים ומהשאלון של המשתמש, לא מערכים קבועים."""
    from agent_core.profile import load_profile, build_search_plan
    plan = build_search_plan(load_profile())
    for line in plan.why:
        print(f"[יואב] {line}")
    return {
        "search_query": plan.queries()[0],
        "location":     plan.locations[0],
        "search_plan":  plan.to_dict(),
        "max_results":  12,
    }


TARGET_HOUR = 10   # זמן הרצה יומית


# ── הרצת הפייפליין ────────────────────────────────────────────────────────────
def run_pipeline():
    """מריץ את הפייפליין המלא ומחזיר תוצאות."""
    from agent_core.graph import career_graph
    from agent_core.memory.manager import get_context_for_agents

    ctx = get_context_for_agents()
    if ctx["total_runs"] > 0:
        print(f"[Scheduler] ריצה #{ctx['total_runs'] + 1} | "
              f"{ctx['total_jobs_seen']} משרות נסרקו עד כה | "
              f"חברות שנותחו: {ctx['seen_companies_count']}")
        if ctx["persistent_skill_gaps"]:
            print(f"[Scheduler] Skill gaps מצטברים: {', '.join(ctx['persistent_skill_gaps'])}")
    else:
        print("[Scheduler] ריצה ראשונה — מתחיל לבנות זיכרון")

    initial_state = {
        **build_search_config(),
        "resume_text":     load_resume(),
        "raw_jobs":        [],
        "filtered_jobs":   [],
        "company_signals": [],
        "skill_gaps":      [],
        "daily_summary":   "",
        "iteration":       0,
        "should_refine":   False,
        "refined_query":   None,
        "messages":        [],
        "scout_refinement":  None,
        "scout_loop_count":  0,
        "all_senior_only":   False,
        "critic_approved":   False,
    }

    print(f"\n[Scheduler] מתחיל ריצה — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 55)

    result = career_graph.invoke(initial_state)

    print("\n" + "=" * 55)
    print(f"סה\"כ: {result['iteration']} סבבי חיפוש")
    print(f"משרות חדשות שנמצאו: {len(result['filtered_jobs'])}")

    if result.get("daily_summary"):
        print("\n" + "━" * 55)
        print("  📋 סיכום בוקר")
        print("━" * 55)
        print(result["daily_summary"])
        print("━" * 55)

    _write_log(result)
    return result


def _write_log(result: dict):
    """שומר log של הריצה לקובץ."""
    logs_dir = project_root / "logs"
    logs_dir.mkdir(exist_ok=True)

    log_file = logs_dir / f"career_{datetime.now().strftime('%Y%m%d_%H%M')}.txt"
    lines = [
        f"ריצת Career Pipeline — {datetime.now().isoformat()}",
        f"משרות שנמצאו: {len(result.get('filtered_jobs', []))}",
        f"סבבי חיפוש: {result.get('iteration', 0)}",
        "",
        "=== סיכום בוקר ===",
        result.get("daily_summary", ""),
        "",
        "=== משרות מובילות ===",
    ]
    for j in sorted(result.get("filtered_jobs", []),
                    key=lambda x: x["ats_score"], reverse=True)[:5]:
        lines.append(f"[{j['ats_score']}%] {j['title']} @ {j['company']}")
        lines.append(f"  {j['url']}")

    lines += ["", "=== לוג הודעות ==="]
    lines += [f"• {m}" for m in result.get("messages", [])]

    log_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"[Scheduler] Log נשמר: logs/{log_file.name}")


# ── Scheduler פנימי (ריצה יומית) ─────────────────────────────────────────────
def run_scheduled():
    """לולאה שמחכה עד 10:00 ומריצה כל יום."""
    import time
    print(f"[Scheduler] מצב מתוזמן — ימתין עד {TARGET_HOUR:02d}:00 כל יום.")
    print("  לעצירה: Ctrl+C\n")

    while True:
        now = datetime.now()

        if now.hour == TARGET_HOUR and now.minute == 0:
            print(f"\n[Scheduler] ⏰ {now.strftime('%H:%M')} — מריץ פייפליין!")
            try:
                run_pipeline()
            except Exception as e:
                print(f"[Scheduler] שגיאה בריצה: {e}")
            time.sleep(60)   # מונע ריצה כפולה באותה דקה
        else:
            seconds_until = ((TARGET_HOUR - now.hour) % 24) * 3600 - now.minute * 60 - now.second
            if seconds_until < 0:
                seconds_until += 86400
            hours, rem = divmod(seconds_until, 3600)
            mins = rem // 60
            print(f"\r[Scheduler] ממתין... עוד {hours:02d}:{mins:02d} עד {TARGET_HOUR:02d}:00",
                  end="", flush=True)
            time.sleep(30)


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Career Pipeline Scheduler")
    parser.add_argument("--now",      action="store_true", help="הרץ עכשיו מיד")
    parser.add_argument("--schedule", action="store_true", help=f"הרץ כל יום ב-{TARGET_HOUR:02d}:00")
    parser.add_argument("--stats",    action="store_true", help="הצג סטטיסטיקות זיכרון")
    args = parser.parse_args()

    if args.stats:
        from agent_core.memory.manager import get_weekly_stats
        print(get_weekly_stats())
    elif args.now:
        run_pipeline()
    elif args.schedule:
        run_scheduled()
    else:
        run_pipeline()
