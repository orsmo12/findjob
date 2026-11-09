# legacy: הגרסה הראשונה של findjob (לא בשימוש)

כאן נמצא הקוד מהגרסה הראשונה, כשהסוכנים רצו כגרף LangGraph מאחורי שרת FastAPI:
`agent_core/graph.py`, `agent_core/api.py`, `agent_core/state.py`, `agent_core/team.py`, הסוכנים הישנים ב-`agent_core/agents/`,
`scheduler.py` והמסמך `ARCHITECTURE.md` שמתאר את המבנה ההוא.

היום הסוכנים רצים כעבודות Python מתוזמנות ב-GitHub Actions (`scripts/nightly.py`, `scripts/assistant_job.py`),
ומעבירים עבודה זה לזה דרך טבלת `agent_tasks` ב-Supabase. הקוד כאן נשמר כתיעוד ולא מורץ; ייבוא שלו כנראה לא יעבוד
בלי להחזיר אותו למקומו.

# legacy: the first version of findjob (not used)

The first version orchestrated the agents with LangGraph behind a FastAPI server. In production they now run as
scheduled Python jobs on GitHub Actions and hand work to each other through an `agent_tasks` table in Supabase.
This folder is kept for reference only and is not executed.
