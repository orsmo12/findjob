/**
 * /api/run-pipeline — מריץ את פייפליין 5 הסוכנים.
 * 
 * POST /api/run-pipeline  →  מעביר ל-FastAPI /career/search
 * מחזיר: PipelineResult עם filtered_jobs, career_insight, cv_profile ועוד
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API = process.env.CAREER_API_URL ?? 'http://localhost:8001'
const TIMEOUT_MS = 120_000

export const maxDuration = 120

export async function POST(request: NextRequest) {
  // קבל resume_text ו-query מה-body (אם נשלחו), אחרת השתמש בברירות מחדל
  let body: Record<string, unknown> = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text)
  } catch { /* אין body — זה בסדר */ }

  const payload = {
    query:       body.query       ?? 'Software Developer',
    location:    body.location    ?? 'Tel Aviv',
    resume:      body.resume      ?? body.resume_text ?? '',
    max_results: body.max_results ?? 10,
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

    const data = await res.json()

    // מפה את תגובת /career/search לפורמט PipelineResult שה-frontend מצפה לו
    return NextResponse.json({
      filtered_jobs:    data.top_matches    ?? [],
      company_signals:  data.company_signals ?? [],
      skill_gaps:       data.skill_gaps      ?? [],
      daily_summary:    data.daily_summary   ?? '',
      career_insight:   data.career_insight  ?? '',
      cv_profile:       data.cv_profile      ?? null,
      cover_letters:    data.cover_letters   ?? {},
      interview_prep:   data.interview_prep  ?? null,
      messages:         data.messages        ?? [],
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('abort') || msg.includes('timeout')) {
      return NextResponse.json(
        { error: 'הפייפליין לקח יותר מדי זמן. נסה שוב.' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      {
        error: 'Python Career API לא זמין',
        detail: msg,
        // החזר תוצאה ריקה תקינה כדי שה-UI לא יקרוס
        filtered_jobs: [],
        daily_summary: 'הפייפליין אינו זמין כרגע — הרץ את שרת Python.',
        career_insight: '',
      },
      { status: 503 }
    )
  }
}
