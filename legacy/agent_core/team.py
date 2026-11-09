"""
team.py — מקור האמת לצוות הסוכנים של findjob.

כל סוכן מזוהה לפי key קבוע. השמות הם ברירת מחדל בלבד: המשתמש יכול לשנות
אותם באפליקציה, ולכן הקוד לעולם לא מסתמך על שם. התיעוד המלא: docs/AGENTS.md
"""

TEAM = {
    "strategist": {"name": "יואב",  "role": "יועץ אסטרטגי",  "office_seat": 0,
                   "schedule": "Sunday 07:00 + on profile change + every 10 skips",
                   "modules": ["manager", "query_strategist", "profile_agent"]},
    "hunter":     {"name": "דורון", "role": "צייד משרות",     "office_seat": 1,
                   "schedule": "daily 02:00 + on demand",
                   "modules": ["job_finder"]},
    "researcher": {"name": "גיל",   "role": "חוקר חברות",     "office_seat": 2,
                   "schedule": "when a job is saved",
                   "modules": ["market_scout", "linkedin_scout"]},
    "coach":      {"name": "מאיה",  "role": "מאמנת ראיונות",  "office_seat": 3,
                   "schedule": "when an application reaches screening/interview",
                   "modules": ["mentor"]},
    "linkedin":   {"name": "קובי",  "role": "מנהל LinkedIn",  "office_seat": 4,
                   "schedule": "daily 07:30 + Sunday + on shared post",
                   "modules": []},
    "assistant":  {"name": "שי",    "role": "עוזר אישי",      "office_seat": 5,
                   "schedule": "daily 07:45 + after research + 7 days after applying",
                   "modules": ["daily_assistant", "cover_letter"]},
}

AGENT_KEYS = tuple(TEAM)


def agent_of_module(module: str) -> str:
    """איזה סוכן אחראי על מודול קוד מסוים (לרישום תקציב ולוגים)."""
    for key, a in TEAM.items():
        if module in a["modules"]:
            return key
    return "assistant"
