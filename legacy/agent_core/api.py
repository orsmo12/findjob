"""
api.py — FastAPI server: גשר בין Next.js Frontend לפייפליין Python.

הפעלה:
    uvicorn agent_core.api:app --reload --port 8001

מה Next.js שולח:
    POST /career/search  →  { query, location, resume, max_results }
    POST /career/cover-letter → { job_title, company, job_description, resume }
    GET  /budget/report  →  דוח תקציב יומי

מה מוחזר:
    { rounds, matched_jobs, top_matches, company_signals, skill_gaps,
      daily_summary, critic_approved, scout_loops, messages }
"""

import os
import sys
import asyncio
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, AsyncGenerator

from agent_core.graph import career_graph

app = FastAPI(
    title="Life Board Career API",
    description="AI-powered career agent pipeline — LangGraph + Groq + Claude",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query:       str | None = Field(default=None, description="ריק = לפי תוכנית החיפוש מהפרופיל")
    location:    str | None = Field(default=None, description="ריק = לפי תוכנית החיפוש מהפרופיל")
    resume:      str = Field(default="",                        description="CV כטקסט")
    max_results: int = Field(default=8,                         ge=1, le=30)


class JobMatch(BaseModel):
    title:     str
    company:   str
    location:  str
    salary:    str
    url:       str
    ats_score: int
    source:    str


class CompanySignal(BaseModel):
    company:          str
    role:             str = ""
    fit_score:        int = 0
    company_stage:    str = "unknown"
    junior_friendly:  bool = False
    apply_priority:   str = "medium"
    seniority_required: str = "unknown"
    culture_signal:   str = ""
    url:              str = ""
    scout_recommendation: str = "wait"


class SkillGap(BaseModel):
    skill:    str
    reason:   str
    priority: str
    appears_in_n_jobs: int = 0


class SearchResponse(BaseModel):
    rounds:          int
    total_jobs:      int
    matched_jobs:    int
    scout_loops:     int
    critic_approved: bool
    top_matches:     list[JobMatch]
    company_signals: list[CompanySignal]
    skill_gaps:      list[SkillGap]
    daily_summary:   str
    messages:        list[str]


class CoverLetterRequest(BaseModel):
    job_title:       str = Field(..., description="שם התפקיד")
    company:         str = Field(..., description="שם החברה")
    job_description: str = Field(default="", description="תיאור המשרה")
    resume:          str = Field(..., description="CV כטקסט")
    language:        str = Field(default="he",           description="he / en")
    tone:            str = Field(default="professional", description="professional / friendly / confident")
    model:           str = Field(default="claude-haiku-4-5", description="claude model (רק עם ENABLE_CLAUDE=1)")


class CoverLetterResponse(BaseModel):
    letter:      str
    from_cache:  bool
    tokens_used: int
    model:       str
    cache_key:   str


# ── עזרים ─────────────────────────────────────────────────────────────────────

def _build_initial_state(req: SearchRequest) -> dict:
    from agent_core.profile import load_profile, build_search_plan
    plan = build_search_plan(load_profile())
    return {
        "search_plan":     plan.to_dict(),
        "search_query":    req.query or plan.queries()[0],
        "location":        req.location or plan.locations[0],
        "resume_text":     req.resume,
        "max_results":     req.max_results,
        "raw_jobs":        [],
        "filtered_jobs":   [],
        "company_signals": [],
        "scout_refinement": None,
        "scout_loop_count": 0,
        "all_senior_only":  False,
        "skill_gaps":      [],
        "critic_approved": False,
        "daily_summary":   "",
        "iteration":       0,
        "should_refine":   False,
        "refined_query":   None,
        "messages":        [],
    }


def _build_response(result: dict) -> SearchResponse:
    top_matches = sorted(
        result.get("filtered_jobs", []),
        key=lambda j: j["ats_score"],
        reverse=True,
    )[:5]

    def safe_job(j: dict) -> JobMatch:
        return JobMatch(
            title=j.get("title", ""),
            company=j.get("company", ""),
            location=j.get("location", ""),
            salary=j.get("salary", ""),
            url=j.get("url", ""),
            ats_score=j.get("ats_score", 0),
            source=j.get("site", j.get("source", "unknown")),
        )

    def safe_signal(s: dict) -> CompanySignal:
        return CompanySignal(
            company=s.get("company", ""),
            role=s.get("role", ""),
            fit_score=int(s.get("fit_score", 0)),
            company_stage=s.get("company_stage", "unknown"),
            junior_friendly=bool(s.get("junior_friendly", False)),
            apply_priority=s.get("apply_priority", "medium"),
            seniority_required=s.get("seniority_required", "unknown"),
            culture_signal=s.get("culture_signal", ""),
            url=s.get("url", ""),
            scout_recommendation=s.get("scout_recommendation", "wait"),
        )

    def safe_gap(g: dict) -> SkillGap:
        return SkillGap(
            skill=g.get("skill", ""),
            reason=g.get("reason", ""),
            priority=g.get("priority", "medium"),
            appears_in_n_jobs=int(g.get("appears_in_n_jobs", 0)),
        )

    return SearchResponse(
        rounds=result.get("iteration", 1),
        total_jobs=len(result.get("raw_jobs", [])),
        matched_jobs=len(result.get("filtered_jobs", [])),
        scout_loops=result.get("scout_loop_count", 0),
        critic_approved=bool(result.get("critic_approved", False)),
        top_matches=[safe_job(j) for j in top_matches],
        company_signals=[safe_signal(s) for s in result.get("company_signals", [])],
        skill_gaps=[safe_gap(g) for g in result.get("skill_gaps", [])],
        daily_summary=result.get("daily_summary", ""),
        messages=result.get("messages", []),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """בדיקת חיות — Next.js קורא לזה לפני שמציג את טופס החיפוש."""
    return {"status": "ok", "service": "Life Board Career API", "version": "2.1.0"}


@app.post("/career/search", response_model=SearchResponse)
def career_search(req: SearchRequest):
    """הרץ את פייפליין הקריירה המלא וחזור עם תוצאות."""
    if not req.resume.strip():
        raise HTTPException(status_code=400, detail="נדרש CV. שלח resume בגוף הבקשה.")

    try:
        result = career_graph.invoke(_build_initial_state(req))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"שגיאת pipeline: {str(e)}")

    return _build_response(result)


@app.post("/career/stream")
async def career_stream(req: SearchRequest):
    """
    הרץ את הפייפליין עם Server-Sent Events.
    """
    if not req.resume.strip():
        raise HTTPException(status_code=400, detail="נדרש CV.")

    async def event_generator() -> AsyncGenerator[str, None]:
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

        try:
            yield sse({"type": "progress", "step": "start",
                       "message": "🚀 מתחיל פייפליין..."})

            loop   = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: career_graph.invoke(_build_initial_state(req))
            )

            yield sse({"type": "progress", "step": "job_finder",
                       "message": f"🔍 נמצאו {len(result.get('filtered_jobs', []))} התאמות"})
            yield sse({"type": "progress", "step": "linkedin_scout",
                       "message": f"🏢 נותחו {len(result.get('company_signals', []))} חברות"})
            yield sse({"type": "progress", "step": "mentor",
                       "message": f"📚 זוהו {len(result.get('skill_gaps', []))} פערי כישורים"})

            response = _build_response(result)
            yield sse({"type": "complete", "result": response.model_dump()})

        except Exception as e:
            yield sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/career/cover-letter", response_model=CoverLetterResponse)
def cover_letter(req: CoverLetterRequest):
    """
    כתוב מכתב מוטיבציה עם Claude (או Groq כ-fallback).
    Cache מקומי: אותה משרה + CV → לא מבזבז tokens.
    """
    from agent_core.agents.cover_letter import generate_cover_letter
    if not req.resume.strip():
        raise HTTPException(status_code=400, detail="נדרש CV")
    try:
        result = generate_cover_letter(
            job_title=req.job_title,
            company=req.company,
            job_description=req.job_description,
            resume_text=req.resume,
            language=req.language,
            tone=req.tone,
            model=req.model,
        )
        return CoverLetterResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/budget/report")
def budget_status():
    """
    דוח תקציב Groq יומי.
    מחזיר: { tokens_used, tokens_budget, percent_used, status, by_agent }
    """
    try:
        from agent_core.budget_guard import get_report
        return get_report()
    except Exception as e:
        return {"error": str(e), "tokens_used": 0, "status": "unknown"}


@app.get("/team")
def team():
    """צוות הסוכנים: key, שם ברירת מחדל, תפקיד ותזמון. המקור: agent_core/team.py"""
    from agent_core.team import TEAM
    return TEAM


@app.get("/plan")
def search_plan():
    """תוכנית החיפוש וחברות היעד, כפי שיואב גזר מהפרופיל. מוצג למשתמש בשקיפות."""
    from agent_core.profile import load_profile, build_search_plan, select_targets
    prof = load_profile()
    plan = build_search_plan(prof)
    return {"plan": plan.to_dict(), "targets": select_targets(plan, prof)}
