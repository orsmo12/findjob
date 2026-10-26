import { NextRequest, NextResponse } from 'next/server'
import { recordFeedback } from '@/agents/memory-engine'
import { applySnapshotFeedback } from '@/lib/weekly-snapshot'
import { MOCK_ITEMS } from '@/lib/mock-data'
import { CURRENT_USER_ID } from '@/lib/constants'
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase'
import type { Lang } from '@/lib/i18n'
import type { BoardItemCategory } from '@/types'

interface FeedbackBody {
  itemId: string
  feedback: 'helpful' | 'not_helpful'
  lang?: Lang
  // Real, pipeline-generated board items get a fresh crypto.randomUUID() on
  // every /api/run-agents call, so they're never in MOCK_ITEMS — the client
  // already holds the full item in its own state, so it sends the handful
  // of fields the Memory Engine actually needs as a fallback. Without this,
  // feedback on any non-mock item 404'd here (pre-existing bug, fixed
  // alongside the lang-threading work this route needed anyway).
  domain?: string
  title?: string
  source?: string
  category?: BoardItemCategory
  agent?: string
  lvs?: number
}

export async function POST(request: NextRequest) {
  const body = await request.json() as FeedbackBody
  const { itemId, feedback, lang = 'en' } = body

  if (!itemId || !['helpful', 'not_helpful'].includes(feedback)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Find item (mock mode) — if not present, fall back to the fields the
  // client sent for this run's real board item.
  const mockItem = MOCK_ITEMS.find(i => i.id === itemId)
  if (mockItem) {
    mockItem.feedback = feedback
  }

  // If this card belongs to the current week's frozen Weekly Brief
  // snapshot, update it there too — otherwise feedback would appear to
  // work in the UI (client state updates immediately) but silently revert
  // to "no feedback" on the next refresh, since the snapshot returned
  // would still hold the original copy. No-op if itemId isn't a primary
  // item this week (e.g. it's an Explore & Expand item, or mock mode).
  await applySnapshotFeedback(CURRENT_USER_ID, lang, itemId, feedback)

  const item = mockItem ?? {
    id: itemId,
    title: body.title ?? '',
    domain: body.domain ?? 'general',
    agent: body.agent ?? 'general',
    lvs: body.lvs ?? 0,
    source: body.source ?? 'unknown',
    category: body.category,
  }

  if (!mockItem && !body.domain) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Record in memory engine
  await recordFeedback(CURRENT_USER_ID, item, feedback, lang)

  // Also update the persisted board_items row, when one exists (real
  // pipeline runs insert one per item; mock-mode items never do).
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { error } = await supabase
        .from('board_items')
        .update({ feedback })
        .eq('id', itemId)
      if (error) throw error
    } catch (err) {
      console.error('[/api/feedback] Supabase board_items update failed:', err)
    }
  }

  return NextResponse.json({ ok: true, feedback })
}
