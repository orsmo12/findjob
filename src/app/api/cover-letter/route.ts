/**
 * /api/cover-letter — Next.js route שמחבר ל-FastAPI Python.
 *
 * POST /api/cover-letter  →  { job_title, company, job_description, resume, language?, tone? }
 *
 * הroute מעביר ל-Python FastAPI:
 *   POST http://localhost:8001/career/cover-letter
 *
 * הפרדה: Claude/Groq API key לא נחשפים לclient
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API = process.env.CAREER_API_URL ?? 'http://localhost:8001'
const TIMEOUT_MS = 60_000

export const maxDuration = 60

export interface CoverLetterRequest {
  job_title:       string
  company:         string
  job_description: string
  resume:          string
  language?:       'he' | 'en'
  tone?:           'professional' | 'friendly' | 'confident'
}

export interface CoverLetterResponse {
  letter:      string
  from_cache:  boolean
  tokens_used: number
  model:       string
  cache_key:   string
}

export async function POST(request: NextRequest) {
  let body: CoverLetterRequest

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON לא תקין' }, { status: 400 })
  }

  if (!body.resume?.trim()) {
    return NextResponse.json({ error: 'נדרש CV כטקסט (resume)' }, { status: 400 })
  }
  if (!body.job_title?.trim() || !body.company?.trim()) {
    return NextResponse.json({ error: 'נדרש job_title ו-company' }, { status: 400 })
  }

  const payload = {
    job_title:       body.job_title,
    company:         body.company,
    job_description: body.job_description ?? '',
    resume:          body.resume,
    language:        body.language        ?? 'he',
    tone:            body.tone            ?? 'professional',
  }

  try {
    const res = await fetch(`${PYTHON_API}/career/cover-letter`, {
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

    const data: CoverLetterResponse = await res.json()
    return NextResponse.json(data)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('timeout')) {
      return NextResponse.json(
        { error: 'הכנת מכתב המוטיבציה לקחה יותר מדי זמן. נסה שוב.' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: 'Python Career API לא זמין', detail: msg },
      { status: 503 }
    )
  }
}
