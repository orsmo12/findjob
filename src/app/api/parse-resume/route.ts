/**
 * /api/parse-resume — מעלה קובץ קורות חיים ומחזיר טקסט.
 * 
 * POST /api/parse-resume  (multipart/form-data, שדה "file")
 * מחזיר: { text: string }
 */

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'לא נשלח קובץ' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const bytes  = new Uint8Array(buffer)
    const name   = file.name.toLowerCase()

    // ── טקסט פשוט / Markdown ─────────────────────────────────────────────
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      const text = new TextDecoder('utf-8').decode(bytes)
      return NextResponse.json({ text: text.slice(0, 8000) })
    }

    // ── PDF ───────────────────────────────────────────────────────────────
    if (name.endsWith('.pdf')) {
      // נסה לחלץ טקסט מ-PDF באמצעות Python API
      const PYTHON_API = process.env.CAREER_API_URL ?? 'http://localhost:8001'
      try {
        const pf = new FormData()
        pf.append('file', new Blob([bytes], { type: 'application/pdf' }), file.name)
        const res = await fetch(`${PYTHON_API}/career/parse-resume`, {
          method: 'POST',
          body:   pf,
          signal: AbortSignal.timeout(20_000),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.text) return NextResponse.json({ text: data.text })
        }
      } catch { /* fallthrough */ }

      // Fallback: חלץ ASCII גולמי (עובד לחלק מה-PDFs)
      const rawText = Array.from(bytes)
        .map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : ' ')
        .join('')
        .replace(/\s{3,}/g, '\n')
        .trim()
        .slice(0, 6000)
      
      if (rawText.length > 200) {
        return NextResponse.json({ text: rawText })
      }
      return NextResponse.json({ 
        text: '',
        error: 'לא הצלחתי לחלץ טקסט מה-PDF. נסה להדביק את הטקסט ישירות.' 
      })
    }

    // ── Word (docx) ───────────────────────────────────────────────────────
    if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const PYTHON_API = process.env.CAREER_API_URL ?? 'http://localhost:8001'
      try {
        const pf = new FormData()
        pf.append('file', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), file.name)
        const res = await fetch(`${PYTHON_API}/career/parse-resume`, {
          method: 'POST',
          body:   pf,
          signal: AbortSignal.timeout(20_000),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.text) return NextResponse.json({ text: data.text })
        }
      } catch { /* fallthrough */ }

      return NextResponse.json({ 
        text: '',
        error: 'נדרש שרת Python לחילוץ קובץ Word. נסה PDF או הדבק טקסט.' 
      })
    }

    return NextResponse.json({ error: `פורמט לא נתמך: ${file.name}` }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
