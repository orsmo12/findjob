/**
 * Weekly Snapshot store
 *
 * Product Stabilization directive: once a Weekly Brief is generated for a
 * given week, it must stay fixed for the rest of that week — hitting
 * Refresh must NOT reshuffle or rebuild the primary list. Only Explore &
 * Expand, profile/priority updates, feedback effects, and memory updates
 * are allowed to change between refreshes within the same week.
 *
 * Snapshots are keyed by user + week + language. Keying by language too
 * (not just user + week) means switching the UI language always produces a
 * fully-translated Weekly Brief instead of replaying whatever language it
 * happened to be generated in — switching language creates its own
 * snapshot the first time, which then itself stays fixed for the rest of
 * the week in that language. This keeps Directive #1 (stability) and
 * Directive #2 (no mixed-language content) both satisfied at once.
 *
 * Dual-path persistence: reads/writes go to Supabase's weekly_snapshots
 * table when isSupabaseConfigured() is true, and fall back to an in-memory
 * Map otherwise (or if a Supabase call fails) — same pattern as
 * memory-engine.ts.
 */

import type { BoardItem } from '@/types'
import type { Lang } from './i18n'
import { getWeekRange } from './week'
import { isSupabaseConfigured, getSupabase } from './supabase'

interface WeeklySnapshotEntry {
  weekStart: string
  lang: Lang
  items: BoardItem[]
  savedAt: string
}

// `${userId}::${weekStart}::${lang}` -> snapshot (fallback store)
const snapshotStore = new Map<string, WeeklySnapshotEntry>()

function mapKey(userId: string, weekStart: string, lang: Lang): string {
  return `${userId}::${weekStart}::${lang}`
}

/** The fixed primary Weekly Brief for this user+week+language, or null if
 * it hasn't been generated yet (new week, new language this week, or the
 * very first run ever). */
export async function getWeeklySnapshot(userId: string, weekStart: string, lang: Lang): Promise<BoardItem[] | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('weekly_snapshots')
        .select('items')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .eq('lang', lang)
        .maybeSingle()
      if (error) throw error
      if (data) return data.items as BoardItem[]
      return null // configured + reachable, genuinely no snapshot yet — don't fall through to in-memory
    } catch (err) {
      console.error('[weekly-snapshot] Supabase read failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  return snapshotStore.get(mapKey(userId, weekStart, lang))?.items ?? null
}

/** Saves this week's Weekly Brief. Only called the first time a given
 * user+week+language combination is generated — every later refresh
 * within the same week must call getWeeklySnapshot() instead, so the
 * brief stays fixed. */
export async function saveWeeklySnapshot(userId: string, weekStart: string, lang: Lang, items: BoardItem[]): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { error } = await supabase
        .from('weekly_snapshots')
        .upsert(
          { user_id: userId, week_start: weekStart, lang, items, saved_at: new Date().toISOString() },
          { onConflict: 'user_id,week_start,lang' }
        )
      if (error) throw error
      return
    } catch (err) {
      console.error('[weekly-snapshot] Supabase write failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  snapshotStore.set(mapKey(userId, weekStart, lang), { weekStart, lang, items, savedAt: new Date().toISOString() })
}

/** Stable content identity for a board item — used to keep Explore &
 * Expand from re-showing something already locked into the Weekly Brief
 * snapshot. Can't use BoardItem.id for this: every pipeline run assigns a
 * fresh crypto.randomUUID(), so the same real-world item gets a different
 * id on every refresh. */
export function snapshotItemKey(item: Pick<BoardItem, 'title' | 'source' | 'domain'>): string {
  return `${item.domain}::${item.source}::${item.title}`.toLowerCase()
}

/** Applies feedback directly to a snapshot item in place, if `itemId`
 * belongs to this week's frozen Weekly Brief for this user+language.
 * Without this, giving feedback on a primary card would appear to work in
 * the UI (client-side state updates immediately) but silently revert to
 * "no feedback" on the next refresh, since the snapshot returned would
 * still hold the original, feedback-less copy of that item. Returns true
 * if a matching item was found and updated. */
export async function applySnapshotFeedback(
  userId: string,
  lang: Lang,
  itemId: string,
  feedback: 'helpful' | 'not_helpful'
): Promise<boolean> {
  const weekStart = getWeekRange(new Date(), lang).start

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('weekly_snapshots')
        .select('items')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .eq('lang', lang)
        .maybeSingle()
      if (error) throw error
      if (!data) return false

      const items = data.items as BoardItem[]
      const item = items.find(i => i.id === itemId)
      if (!item) return false
      item.feedback = feedback

      const { error: updateError } = await supabase
        .from('weekly_snapshots')
        .update({ items })
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .eq('lang', lang)
      if (updateError) throw updateError
      return true
    } catch (err) {
      console.error('[weekly-snapshot] Supabase feedback update failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  const snap = snapshotStore.get(mapKey(userId, weekStart, lang))
  const item = snap?.items.find(i => i.id === itemId)
  if (!item) return false
  item.feedback = feedback
  return true
}
