import { NextRequest, NextResponse } from 'next/server'
import { MOCK_ITEMS, MOCK_STATS } from '@/lib/mock-data'
import { CURRENT_USER_ID } from '@/lib/constants'
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase'
import type { AttentionBudget } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const budget = searchParams.get('budget') as AttentionBudget | 'all' | null
  const mock   = searchParams.get('mock') !== 'false'

  // ── Mock mode ───────────────────────────────────────────────────────────────
  if (mock || !isSupabaseConfigured()) {
    let items = [...MOCK_ITEMS].filter(i => !i.dismissed)

    if (budget && budget !== 'all') {
      items = items.filter(i => i.attention_budget === budget)
    }

    // Sort by LVS descending
    items.sort((a, b) => b.lvs - a.lvs)

    return NextResponse.json({ items, stats: MOCK_STATS })
  }

  // ── Supabase mode ──────────────────────────────────────────────────────────
  // Single fixed user, no login — query directly by CURRENT_USER_ID rather
  // than deriving identity from a session/JWT (there is no session yet).
  try {
    const supabase = getSupabase()!

    let query = supabase
      .from('board_items')
      .select('*')
      .eq('user_id', CURRENT_USER_ID)
      .eq('dismissed', false)
      .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
      .order('lvs', { ascending: false })

    if (budget && budget !== 'all') {
      query = query.eq('attention_budget', budget)
    }

    const { data: items, error } = await query
    if (error) throw error

    return NextResponse.json({ items, stats: MOCK_STATS })
  } catch (err) {
    console.error('[/api/board] Supabase read failed, falling back to mock:', err)

    let items = [...MOCK_ITEMS].filter(i => !i.dismissed)
    if (budget && budget !== 'all') {
      items = items.filter(i => i.attention_budget === budget)
    }
    items.sort((a, b) => b.lvs - a.lvs)

    return NextResponse.json({ items, stats: MOCK_STATS })
  }
}
