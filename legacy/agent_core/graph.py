"""
graph.py — מתזמר LangGraph לסוכני Career של Life Board.

גרסה 3: ארכיטקטורת 5 סוכנים.

  [START]
     ↓
  manager_open    ← אסטרטגיית חיפוש
     ↓
  profile_agent   ← ניתוח CV + cv_profile + פערי כישורים ראשוניים
     ↓
  job_finder      (LinkedIn Playwright + Indeed/Glassdoor JobSpy + AllJobs)
     ↓  ↑ (refine loop, מקס' 3x)
     ↓
  parallel_dispatch
     ├──→ market_scout  (חוקר שוק: חברות + LinkedIn intel)
     │         ↓
     │      fan_in ←────┐
     │                  │
     └──→ mentor  ───────┘
     ↓
  manager_close   ← בריף יומי + שמירה לזיכרון
     ↓
  [END]
"""

from langgraph.graph import StateGraph, END
from agent_core.state import CareerState
from agent_core.agents.manager       import manager_open_node, manager_close_node
from agent_core.agents.profile_agent import profile_agent_node
from agent_core.agents.job_finder    import job_finder_node
from agent_core.agents.market_scout  import market_scout_node
from agent_core.agents.mentor        import mentor_node


def refine_query_node(state: CareerState) -> dict:
    """Job Refinement Loop — מחדד שאילתה כשנמצאו מעט תוצאות."""
    cv_profile = state.get("cv_profile")
    original   = state.get("search_query", "")
    iteration  = state.get("iteration", 1)

    if cv_profile and cv_profile.get("role_titles"):
        titles  = cv_profile["role_titles"]
        idx     = min(iteration, len(titles) - 1)
        refined = titles[idx]
    else:
        refinements = [
            original.replace("Junior ", "").replace("Senior ", ""),
            original.split()[0] + " Engineer",
            original.split()[0] + " Developer",
        ]
        refined = refinements[min(iteration - 1, len(refinements) - 1)]

    print(f"[מתזמר] חידוד שאילתה (סבב {iteration}): '{original}' → '{refined}'")
    return {"refined_query": refined, "messages": [f"שאילתה חודדה: '{refined}'"]}


def parallel_dispatch_node(state: CareerState) -> dict:
    jobs_count = len(state.get("filtered_jobs", []))
    print(f"[Fan-out] 🚀 מפעיל חוקר שוק + מנטור במקביל על {jobs_count} משרות...")
    return {"messages": [f"Fan-out: מפעיל חוקר שוק ומנטור על {jobs_count} משרות"]}


def fan_in_node(state: CareerState) -> dict:
    signals = state.get("company_signals", [])
    gaps    = state.get("skill_gaps", [])
    letters = state.get("cover_letters", {})
    print(f"[Fan-in] ✅ {len(signals)} חברות | {len(gaps)} פערי כישורים | {len(letters)} מכתבים")
    return {"messages": [f"Fan-in: {len(signals)} חברות, {len(gaps)} פערים, {len(letters)} מכתבים."]}


def route_after_job_finder(state: CareerState) -> str:
    if state.get("should_refine") and state.get("iteration", 0) < 3:
        return "refine"
    return "fanout"


def build_career_graph():
    graph = StateGraph(CareerState)

    # 5 סוכנים
    graph.add_node("manager_open",      manager_open_node)
    graph.add_node("profile_agent",     profile_agent_node)
    graph.add_node("job_finder",        job_finder_node)
    graph.add_node("market_scout",      market_scout_node)
    graph.add_node("mentor",            mentor_node)
    graph.add_node("manager_close",     manager_close_node)

    # עזרי מתזמר
    graph.add_node("refine_query",      refine_query_node)
    graph.add_node("parallel_dispatch", parallel_dispatch_node)
    graph.add_node("fan_in",            fan_in_node)

    # זרימה ראשית
    graph.set_entry_point("manager_open")
    graph.add_edge("manager_open",  "profile_agent")
    graph.add_edge("profile_agent", "job_finder")

    # לולאת חידוד
    graph.add_conditional_edges(
        "job_finder",
        route_after_job_finder,
        {"refine": "refine_query", "fanout": "parallel_dispatch"},
    )
    graph.add_edge("refine_query", "job_finder")

    # Fan-out מקביל
    graph.add_edge("parallel_dispatch", "market_scout")
    graph.add_edge("parallel_dispatch", "mentor")

    # Fan-in
    graph.add_edge("market_scout", "fan_in")
    graph.add_edge("mentor",       "fan_in")

    # סגירה
    graph.add_edge("fan_in",        "manager_close")
    graph.add_edge("manager_close", END)

    return graph.compile()


career_graph = build_career_graph()
