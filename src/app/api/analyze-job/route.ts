/**
 * /api/analyze-job — מנתח התאמה למשרה לפי URL.
 * 
 * POST /api/analyze-job  { url: string }
 * מחזיר: { analysis: string }
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_API = process.env.CAREER_API_URL ?? 'http://localhost:8001'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  let body: { url?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON לא תקין' }, { status: 400 })
  }

  if (!body.url?.trim()) {
    return NextResponse.json({ error: 'נדרש URL של משרה' }, { status: 400 })
  }

  // נסה Python API
  try {
    const res = await fetch(`${PYTHON_API}/career/analyze-job`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: body.url }),
      signal:  AbortSignal.timeout(25_000),
    })
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({ analysis: data.analysis ?? data.result ?? 'ניתוח הושלם' })
    }
  } catch { /* fallthrough */ }

  // Fallback — ניתוח בסיסי מה-URL
  const url = body.url
  const domain = (() => {
    try { return new URL(url).hostname.replace('www.', '') } 
    catch { return url }
  })()

  const isLinkedIn = domain.includes('linkedin')
  const isIndeed   = domain.includes('indeed')
  
  const analysis = [
    `🔗 נמצא: ${domain}`,
    '',
    isLinkedIn ? '💼 משרת LinkedIn — מומלץ לשלוח בקשה גם דרך אתר החברה.' :
    isIndeed   ? '🔍 משרת Indeed — בדוק פרטים נוספים באתר החברה המקורי.' :
                 '🌐 אתר חברה — זהו קישור ישיר למשרה.',
    '',
    '📋 לניתוח מעמיק הרץ את הפייפליין המלא עם ה-CV שלך.',
  ].join('\n')

  return NextResponse.json({ analysis })
}
