/**
 * Memory Engine
 *
 * Tracks user behavior and learns over time.
 * - Records feedback events (helpful / not helpful / dismissed)
 * - Identifies patterns in what the user engages with
 * - Adjusts domain priority weights automatically
 * - Surfaces learned patterns as memory events
 *
 * Dual-path persistence: every read AND write below goes to Supabase when
 * isSupabaseConfigured() is true, and falls back to an in-memory store
 * otherwise (or if a Supabase call fails). Supabase is treated as the
 * source of truth when configured — writes don't also shadow-write to the
 * in-memory store on success, so the two stores never silently disagree.
 */

import type { BoardItem, Domain, DomainPriority, MemoryEvent, MemoryEventType } from '@/types'
import { MOCK_PRIORITIES } from '@/lib/mock-data'
import { getDomainLabel } from '@/lib/domains'
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase'
import type { Lang } from '@/lib/i18n'

// ─── In-memory stores (fallback when Supabase isn't configured, or a call fails) ──

const memoryStore: MemoryEvent[] = []
const priorityStore: Record<string, DomainPriority[]> = {}

// ─── Domain priorities ───────────────────────────────────────────────────────
// Seeded from MOCK_PRIORITIES per user, then mutated as feedback
// accumulates. This is what makes "memory affects future scoring" real
// instead of cosmetic: the same priorities are read by /api/run-agents on
// every future run.

export async function getPriorities(userId: string): Promise<DomainPriority[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('domain_priorities')
        .select('*')
        .eq('user_id', userId)
      if (error) throw error
      if (data && data.length > 0) return data as DomainPriority[]

      // First call ever for this user (table empty) — seed from the same
      // defaults the in-memory path uses, so both modes start identically.
      const seeded = MOCK_PRIORITIES.map(({ id, ...rest }) => ({ ...rest, user_id: userId }))
      const { data: inserted, error: insertError } = await supabase
        .from('domain_priorities')
        .insert(seeded)
        .select('*')
      if (insertError) throw insertError
      return (inserted as DomainPriority[]) ?? MOCK_PRIORITIES.map(p => ({ ...p, user_id: userId }))
    } catch (err) {
      console.error('[memory-engine] Supabase domain_priorities read/seed failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  if (!priorityStore[userId]) {
    priorityStore[userId] = MOCK_PRIORITIES.map(p => ({ ...p, user_id: userId }))
  }
  return priorityStore[userId]
}

// Used by onboarding (and the profile page) to persist the user's chosen
// domains + priority scores — a real write path, not a no-op, so onboarding
// selections actually drive what /api/run-agents fetches next.
export async function setPriorities(userId: string, list: DomainPriority[]): Promise<DomainPriority[]> {
  const stamped = list.map(p => ({ ...p, user_id: userId }))

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const rows = stamped.map(({ id, ...rest }) => rest) // let Postgres own the id; conflict target is (user_id, domain)
      const { data, error } = await supabase
        .from('domain_priorities')
        .upsert(rows, { onConflict: 'user_id,domain' })
        .select('*')
      if (error) throw error
      return (data as DomainPriority[]) ?? stamped
    } catch (err) {
      console.error('[memory-engine] Supabase domain_priorities upsert failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  priorityStore[userId] = stamped
  return priorityStore[userId]
}

async function adjustPriority(userId: string, domain: Domain, delta: number): Promise<number> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('domain_priorities')
        .select('score')
        .eq('user_id', userId)
        .eq('domain', domain)
        .maybeSingle()
      if (error) throw error
      if (data) {
        const newScore = Math.max(1, Math.min(10, data.score + delta))
        const { error: updateError } = await supabase
          .from('domain_priorities')
          .update({ score: newScore })
          .eq('user_id', userId)
          .eq('domain', domain)
        if (updateError) throw updateError
        return newScore
      }
    } catch (err) {
      console.error('[memory-engine] Supabase priority adjust failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  const list = priorityStore[userId] ?? (priorityStore[userId] = MOCK_PRIORITIES.map(p => ({ ...p, user_id: userId })))
  const p = list.find(x => x.domain === domain)
  if (!p) return 5
  p.score = Math.max(1, Math.min(10, p.score + delta))
  return p.score
}

// ─── Record an event ─────────────────────────────────────────────────────────

export async function recordEvent(
  userId: string,
  type: MemoryEventType,
  opts: {
    domain?: Domain
    itemId?: string
    description: string
    meta?: Record<string, unknown>
  }
): Promise<MemoryEvent> {
  const event: MemoryEvent = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    domain: opts.domain,
    item_id: opts.itemId,
    description: opts.description,
    meta: opts.meta ?? {},
    created_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { error } = await supabase.from('memory_events').insert(event)
      if (error) throw error
      return event // Supabase is the source of truth now — don't also write to memoryStore
    } catch (err) {
      console.error('[memory-engine] Supabase memory_events insert failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  memoryStore.push(event)
  return event
}

// ─── Record item feedback ─────────────────────────────────────────────────────

// Narrowed on purpose: /api/feedback may not always have a full BoardItem to
// hand back (real pipeline items get a fresh id every run and aren't kept
// server-side anywhere) — only these fields are actually read below, so
// callers can pass a client-supplied subset instead of requiring a full
// BoardItem lookup to succeed first.
type FeedbackItem = Pick<BoardItem, 'id' | 'title' | 'domain' | 'agent' | 'lvs' | 'source' | 'category'>

export async function recordFeedback(
  userId: string,
  item: FeedbackItem,
  feedback: 'helpful' | 'not_helpful',
  lang: Lang = 'en'
): Promise<void> {
  const type: MemoryEventType = feedback === 'helpful' ? 'helpful' : 'not_helpful'
  const description = lang === 'he'
    ? `"${item.title.slice(0, 60)}…" סומן כ${feedback === 'helpful' ? 'מועיל' : 'לא מועיל'}.`
    : `"${item.title.slice(0, 60)}…" was marked ${feedback === 'helpful' ? 'helpful' : 'not helpful'}.`

  await recordEvent(userId, type, {
    domain: item.domain,
    itemId: item.id,
    description,
    // source + category recorded alongside agent/lvs so feedback can drive
    // source-level and category-level adjustments (getSourceFeedbackStats /
    // getCategoryFeedbackStats below), not just domain-level ones.
    meta: { agent: item.agent, lvs: item.lvs, source: item.source, category: item.category },
  })

  // After 3 not_helpful events in a domain, suggest lowering priority
  await maybeTriggerPriorityAdjustment(userId, item.domain, feedback, lang)
}

// ─── Shared event read (used by every stats/summary function below) ─────────
// The single read path every other function in this file goes through, so
// "writes go to Supabase but reads stay in-memory" can't happen again by
// accident — there's exactly one place that decides where events come from.

const MEMORY_EVENTS_FETCH_CAP = 2000 // generous for a single-user beta; not a hard product limit

async function allMemoryEventsForUser(userId: string): Promise<MemoryEvent[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('memory_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MEMORY_EVENTS_FETCH_CAP)
      if (error) throw error
      if (data) return data as MemoryEvent[]
    } catch (err) {
      console.error('[memory-engine] Supabase memory_events read failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  return memoryStore.filter(e => e.user_id === userId)
}

// ─── Detect priority drift ────────────────────────────────────────────────────

async function maybeTriggerPriorityAdjustment(
  userId: string,
  domain: Domain,
  feedback: 'helpful' | 'not_helpful',
  lang: Lang = 'en'
): Promise<void> {
  const events = await allMemoryEventsForUser(userId)
  const recentEvents = events.filter(
    e => e.domain === domain &&
    Date.now() - new Date(e.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
  )

  const notHelpful = recentEvents.filter(e => e.type === 'not_helpful').length
  const helpful    = recentEvents.filter(e => e.type === 'helpful').length
  const domainLabel = getDomainLabel(domain, lang)

  // Fire every 3rd cumulative event in a direction, not just once past the
  // threshold, so repeated feedback keeps nudging the score.
  if (notHelpful > 0 && notHelpful % 3 === 0) {
    const newScore = await adjustPriority(userId, domain, -1)
    await recordEvent(userId, 'priority_adjusted', {
      domain,
      description: lang === 'he'
        ? `פריטי ${domainLabel} נדחו שוב ושוב — העדיפות הופחתה ל-${newScore}/10.`
        : `${domainLabel} items ignored repeatedly — priority lowered to ${newScore}/10.`,
      meta: { reason: 'repeated_not_helpful', count: notHelpful, new_score: newScore },
    })
  } else if (helpful > 0 && helpful % 3 === 0) {
    const newScore = await adjustPriority(userId, domain, +1)
    await recordEvent(userId, 'priority_adjusted', {
      domain,
      description: lang === 'he'
        ? `פריטי ${domainLabel} סומנו כמועילים שוב ושוב — העדיפות הועלתה ל-${newScore}/10.`
        : `${domainLabel} items consistently helpful — priority raised to ${newScore}/10.`,
      meta: { reason: 'repeated_helpful', count: helpful, new_score: newScore },
    })
  }
}

// ─── Per-domain feedback stats ────────────────────────────────────────────────
// Lighter-touch signal than the priority store: used by the Judgment Engine to
// nudge an individual item's score up/down immediately, before any threshold
// is crossed.

export async function getDomainFeedbackStats(
  userId: string,
  domain: Domain
): Promise<{ helpful: number; notHelpful: number }> {
  const events = (await allMemoryEventsForUser(userId)).filter(e => e.domain === domain)
  return {
    helpful: events.filter(e => e.type === 'helpful').length,
    notHelpful: events.filter(e => e.type === 'not_helpful').length,
  }
}

// Source-level signal: liking several GitHub-sourced items should raise
// trust in GitHub generally, disliking several generic-RSS news items
// should lower trust in that feed — independent of which domain they fell
// under. Read by the Judgment Engine to nudge source_quality per item.
export async function getSourceFeedbackStats(
  userId: string,
  sourceName: string
): Promise<{ helpful: number; notHelpful: number }> {
  const events = (await allMemoryEventsForUser(userId)).filter(e => e.meta?.source === sourceName)
  return {
    helpful: events.filter(e => e.type === 'helpful').length,
    notHelpful: events.filter(e => e.type === 'not_helpful').length,
  }
}

// Category-level signal: liking several "Build" cards should make the
// Judgment Engine more confident about future Build-category items
// (mostly produced by ProjectIdeasAgent/DeveloperOpportunitiesAgent);
// liking "Career" cards does the same for CareerSignalsAgent output, etc.
export async function getCategoryFeedbackStats(
  userId: string,
  category: string
): Promise<{ helpful: number; notHelpful: number }> {
  const events = (await allMemoryEventsForUser(userId)).filter(e => e.meta?.category === category)
  return {
    helpful: events.filter(e => e.type === 'helpful').length,
    notHelpful: events.filter(e => e.type === 'not_helpful').length,
  }
}

// ─── Get memory context for Judgment Engine ───────────────────────────────────
// Returns a brief string summarizing what the memory engine has learned
// to augment the Judgment Engine's prompt.

export async function getMemoryContext(userId: string): Promise<string> {
  const events = await allMemoryEventsForUser(userId)

  if (events.length === 0) {
    return 'No memory data yet — this is a new user.'
  }

  const helpful    = events.filter(e => e.type === 'helpful').length
  const notHelpful = events.filter(e => e.type === 'not_helpful').length
  const patterns   = events.filter(e => e.type === 'pattern_learned').map(e => e.description)

  const domainCounts: Record<string, { helpful: number; not_helpful: number }> = {}
  for (const e of events) {
    if (!e.domain) continue
    if (!domainCounts[e.domain]) domainCounts[e.domain] = { helpful: 0, not_helpful: 0 }
    if (e.type === 'helpful')     domainCounts[e.domain].helpful++
    if (e.type === 'not_helpful') domainCounts[e.domain].not_helpful++
  }

  const domainLines = Object.entries(domainCounts)
    .map(([d, c]) => `  - ${d}: ${c.helpful} helpful, ${c.not_helpful} not helpful`)
    .join('\n')

  return `
Memory summary:
- Total feedback: ${helpful} helpful, ${notHelpful} not helpful
- Domain breakdown:
${domainLines}
- Learned patterns: ${patterns.length > 0 ? patterns.join('; ') : 'None yet'}
`.trim()
}

// ─── Get all memory events for UI ─────────────────────────────────────────────

export async function getMemoryEvents(userId: string): Promise<MemoryEvent[]> {
  const events = await allMemoryEventsForUser(userId)
  return [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50)
}

// ─── Surfaced item history ────────────────────────────────────────────────────
// Tracks every item the board has ever shown the user, independent of
// feedback. This is the raw signal the Judgment Engine's novelty score needs
// ("recent board history," "topic similarity," "previously surfaced items")
// and the seed data the Weekly Brief snapshot system's dedup reads from.

interface SurfacedRecord {
  user_id: string
  key: string // stable identity for "is this the same item again" — see surfaceKey()
  item_id: string // BoardItem.id at the time it was surfaced — back-reference only, not identity (ids are regenerated each run)
  title: string
  domain: Domain
  source: string
  category?: string
  surfaced_at: string
}

const surfacedStore: SurfacedRecord[] = []
const SURFACED_HISTORY_LIMIT = 500 // per user — oldest trimmed first, prevents unbounded growth

// BoardItem.id is a fresh crypto.randomUUID() on every pipeline run, so it
// can't be used to recognize "this is the same story as last week." A
// source_url is stable across runs when the source provides one; when it
// doesn't (e.g. a CoinGecko trending snapshot with no per-item URL), fall
// back to source+title, which is stable enough for honest near-duplicate
// detection without overclaiming precision.
function surfaceKey(input: { title: string; source: string; source_url?: string }): string {
  return input.source_url || `${input.source}::${input.title.toLowerCase().trim()}`
}

export async function recordSurfaced(userId: string, items: BoardItem[]): Promise<void> {
  const now = new Date().toISOString()
  const rows: SurfacedRecord[] = items.map(item => ({
    user_id: userId,
    key: surfaceKey({ title: item.title, source: item.source, source_url: item.source_url }),
    item_id: item.id,
    title: item.title,
    domain: item.domain,
    source: item.source,
    category: item.category,
    surfaced_at: now,
  }))

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { error } = await supabase.from('surfaced_history').insert(rows)
      if (error) throw error

      // Best-effort trim beyond SURFACED_HISTORY_LIMIT. A Postgres table can
      // hold far more than 500 rows safely — this is only here so Supabase
      // mode's novelty behavior stays comparable to in-memory mode's, not
      // because Postgres needs the cap. Never blocks the write above.
      try {
        const { data: keep } = await supabase
          .from('surfaced_history')
          .select('id')
          .eq('user_id', userId)
          .order('surfaced_at', { ascending: false })
          .limit(SURFACED_HISTORY_LIMIT)
        const keepIds = (keep ?? []).map((r: { id: string }) => r.id)
        if (keepIds.length === SURFACED_HISTORY_LIMIT) {
          await supabase
            .from('surfaced_history')
            .delete()
            .eq('user_id', userId)
            .not('id', 'in', `(${keepIds.join(',')})`)
        }
      } catch {
        // Trim is best-effort only.
      }
      return
    } catch (err) {
      console.error('[memory-engine] Supabase surfaced_history insert failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  surfacedStore.push(...rows)
  const forUser = surfacedStore.filter(r => r.user_id === userId)
  if (forUser.length > SURFACED_HISTORY_LIMIT) {
    let toDrop = forUser.length - SURFACED_HISTORY_LIMIT
    for (let i = 0; i < surfacedStore.length && toDrop > 0; i++) {
      if (surfacedStore[i].user_id === userId) {
        surfacedStore.splice(i, 1)
        i--
        toDrop--
      }
    }
  }
}

async function fetchSurfacedHistorySince(userId: string, cutoffMs: number): Promise<SurfacedRecord[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase()!
      const { data, error } = await supabase
        .from('surfaced_history')
        .select('*')
        .eq('user_id', userId)
        .gte('surfaced_at', new Date(cutoffMs).toISOString())
      if (error) throw error
      if (data) return data as SurfacedRecord[]
    } catch (err) {
      console.error('[memory-engine] Supabase surfaced_history read failed, using in-memory:', err)
      // fall through to in-memory below
    }
  }

  return surfacedStore.filter(r => r.user_id === userId && new Date(r.surfaced_at).getTime() >= cutoffMs)
}

// ─── Topic similarity (novelty signal) ───────────────────────────────────────
// Dependency-free "is this basically the same story again" check: tokenize
// titles, drop stopwords/short tokens, compare as sets via Jaccard
// similarity. No embeddings, no API call — this product has no paid-API
// budget, and this is good enough to catch near-duplicate headlines across
// sources/domains.

const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are',
  'with', 'at', 'by', 'from', 'this', 'that', 'it', 'as', 'be', 'your', 'you',
  'how', 'what', 'why', 'new', 'will', 'can', 'into', 'than', 'over', 'now',
])

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !TITLE_STOPWORDS.has(t))
  )
}

export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a)
  const tb = titleTokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  const union = ta.size + tb.size - intersection
  return union === 0 ? 0 : intersection / union
}

// Jaccard similarity above this is treated as "the same story" for novelty
// purposes. Tuned conservatively — short, generic-word-heavy titles still
// need real overlap before two items count as duplicates of each other.
export const TOPIC_SIMILARITY_THRESHOLD = 0.34

// How "familiar" a candidate item is, based on what the board has already
// shown this user. judgment-engine.ts's noveltyScore() inverts this signal:
// seen-before or highly-similar items score low novelty; genuinely new
// topics score high.
export async function getTopicFamiliarity(
  userId: string,
  item: { title: string; domain: Domain; source: string; source_url?: string },
  withinDays = 30
): Promise<{ seenBefore: boolean; similarCount: number; mostSimilar: number }> {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000
  const history = await fetchSurfacedHistorySince(userId, cutoff)

  const key = surfaceKey(item)
  const seenBefore = history.some(r => r.key === key)

  let similarCount = 0
  let mostSimilar = 0
  for (const r of history) {
    if (r.domain !== item.domain) continue
    const sim = titleSimilarity(r.title, item.title)
    if (sim > mostSimilar) mostSimilar = sim
    if (sim >= TOPIC_SIMILARITY_THRESHOLD) similarCount++
  }

  return { seenBefore, similarCount, mostSimilar }
}

// ─── Memory → score delta (single shared formula) ─────────────────────────────
// Both the Judgment Engine (to actually nudge relevance/source_quality/
// confidence) and the Memory page (to show the user "how it changed
// rankings") need the exact same number, not two formulas that happen to
// agree today. Defining it once here and importing it into
// judgment-engine.ts is what makes the Memory page's displayed delta
// literally true rather than a cosmetic estimate.

const MEMORY_DELTA_SCALE = 4
const MEMORY_DELTA_CAP = 20

export function clampDelta(
  helpful: number,
  notHelpful: number,
  scale: number = MEMORY_DELTA_SCALE,
  cap: number = MEMORY_DELTA_CAP
): number {
  const raw = (helpful - notHelpful) * scale
  return Math.max(-cap, Math.min(cap, raw))
}

// ─── Memory summary for the Memory page ───────────────────────────────────────
// What was learned (helpful/not-helpful counts), why (it's just accumulated
// feedback), and how it changed rankings (delta, via the shared formula
// above) — the three things the Memory page surfaces, per domain, per
// source, and per category. Computed on the fly from memory_events (no
// separate persisted summary table) so there's exactly one aggregation
// formula in both Supabase mode and in-memory mode.

export interface MemorySummaryEntry {
  key: string
  label: string
  helpful: number
  notHelpful: number
  delta: number
}

export interface MemorySummary {
  domains: MemorySummaryEntry[]
  sources: MemorySummaryEntry[]
  categories: MemorySummaryEntry[]
  totalFeedback: number
}

export async function getMemorySummary(userId: string, lang: Lang = 'en'): Promise<MemorySummary> {
  const events = (await allMemoryEventsForUser(userId)).filter(
    e => e.type === 'helpful' || e.type === 'not_helpful'
  )

  function aggregate(keyFn: (e: MemoryEvent) => string | undefined) {
    const map = new Map<string, { helpful: number; notHelpful: number }>()
    for (const e of events) {
      const key = keyFn(e)
      if (!key) continue
      if (!map.has(key)) map.set(key, { helpful: 0, notHelpful: 0 })
      const entry = map.get(key)!
      if (e.type === 'helpful') entry.helpful++
      else entry.notHelpful++
    }
    return map
  }

  const domainMap   = aggregate(e => e.domain)
  const sourceMap   = aggregate(e => (e.meta?.source as string | undefined))
  const categoryMap = aggregate(e => (e.meta?.category as string | undefined))

  const toEntries = (
    map: Map<string, { helpful: number; notHelpful: number }>,
    labelFn: (key: string) => string
  ): MemorySummaryEntry[] =>
    [...map.entries()]
      .map(([key, c]) => ({
        key,
        label: labelFn(key),
        helpful: c.helpful,
        notHelpful: c.notHelpful,
        delta: clampDelta(c.helpful, c.notHelpful),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {
    domains: toEntries(domainMap, key => getDomainLabel(key as Domain, lang)),
    sources: toEntries(sourceMap, key => key),
    categories: toEntries(categoryMap, key => key),
    totalFeedback: events.length,
  }
}
