/**
 * /api/career — Next.js route שמחבר ל-FastAPI Python.
 *
 * Next.js Frontend קורא לזה:
 *   POST /api/career  →  { query, location, resume, max_results }
 *
 * הroute מעביר ל-FastAPI:
 *   POST http://localhost:8001/career/search
 *
 * למה route ולא קריאה ישירה מה-Frontend?
 *   - CORS — Next.js server לא צריך CORS כמו browser
 *   - GROQ_API_KEY לא נחשף ל-client
 *   - אפשר להוסיף auth, rate-limit, logging בנקודה אחת
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API = process.env.CAREER_API_URL ?? 'http://localhost:8001'
const TIMEOUT_MS = 90_000   // פייפליין יכול לקחת עד 90 שניות

export const maxDuration = 90   // Vercel/Next.js timeout

export interface CareerSearchRequest {
  query:       string
  location?:   string
  resume:      string
  max_results?: number
}

export interface JobMatch {
  title:     string
  company:   string
  location:  string
  salary:    string
  url:       string
  ats_score: number
  source:    string
}

export interface CompanySignal {
  company:           string
  role:              string
  fit_score:         number
  company_stage:     string
  junior_friendly:   boolean
  apply_priority:    'high' | 'medium' | 'low'
  seniority_required: string
  culture_signal:    string
  url:               string
  scout_recommendation: string
}

export interface SkillGap {
  skill:             string
  reason:            string
  priority:          'high' | 'medium' | 'low'
  appears_in_n_jobs: number
}

export interface CareerSearchResponse {
  rounds:          number
  total_jobs:      number
  matched_jobs:    number
  scout_loops:     number
  critic_approved: boolean
  top_matches:     JobMatch[]
  company_signals: CompanySignal[]
  skill_gaps:      SkillGap[]
  daily_summary:   string
  messages:        string[]
}

// ── Health check (GET) ────────────────────────────────────────────────────────
export async function GET() {
  try {
    const res = await fetch(`${PYTHON_API}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`Python API returned ${res.status}`)
    const data = await res.json()
    return NextResponse.json({ ok: true, python_api: data })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Python Career API לא זמין. הרץ: uvicorn agent_core.api:app --port 8001' },
      { status: 503 }
    )
  }
}

// ── Career search (POST) ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: CareerSearchRequest

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON לא תקין' }, { status: 400 })
  }

  if (!body.resume?.trim()) {
    return NextResponse.json({ error: 'נדרש CV כטקסט' }, { status: 400 })
  }

  const payload = {
    query:       body.query       ?? 'Junior Python Developer',
    location:    body.location    ?? 'Tel Aviv',
    resume:      body.resume,
    max_results: body.max_results ?? 8,
  }

  try {
    const res = await fetch(`${PYTHON_API}/career/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json(
        { error: `שגיאת Python API: ${res.status}`, detail },
        { status: res.status }
      )
    }

    const data: CareerSearchResponse = await res.json()
    return NextResponse.json(data)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('timeout')) {
      return NextResponse.json(
        { error: 'הפייפליין לקח יותר מדי זמן (90 שניות). נסה שוב.' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: 'Python Career API לא זמין', detail: msg },
      { status: 503 }
    )
  }
}
