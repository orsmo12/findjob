/**
 * Recency — single shared source of truth for "how old is this item" and
 * "is it still eligible for the board."
 *
 * Before this file, age/recency logic was duplicated in two places with
 * slightly different thresholds: judgment-engine.ts's `recencyScore()` (used
 * inside the LVS formula) and /api/run-agents's `ageDays()`/
 * `recencyEligibility()` (used to decide whether an item reaches the board
 * at all). Part 2 of the Judgment Engine rebuild calls for "one unified
 * recency system" — this module is that system. Both call sites now import
 * from here instead of keeping their own copy.
 */

export const FRESH_DAYS = 14
export const STALE_CUTOFF_DAYS = 30
// Relevance/impact threshold to keep a 14-30 day old item anyway, marked
// is_older so the UI flags it rather than presenting it as fresh.
export const EXCEPTIONAL_SCORE = 85

// Age in days for an ISO published_at date. Returns null for missing/
// unparseable dates — treated as "unknown," never punished, since some
// honest sources (e.g. "trending right now" snapshots) have no better
// timestamp to offer.
export function ageDays(publishedAt?: string): number | null {
  if (!publishedAt) return null
  const ts = new Date(publishedAt).getTime()
  return Number.isFinite(ts) ? (Date.now() - ts) / 86400000 : null
}

// 0-100 freshness score used inside the LVS formula. Deterministic — same
// publishedAt always produces the same score.
export function recencyScore(publishedAt?: string): number {
  const days = ageDays(publishedAt)
  if (days === null) return 50
  if (days <= 2) return 100
  if (days <= 7) return 90
  if (days <= 14) return 70
  if (days <= 30) return 35
  return 15
}

// Board-construction eligibility: items older than STALE_CUTOFF_DAYS never
// reach the board; items between FRESH_DAYS and STALE_CUTOFF_DAYS only
// survive if both relevance and impact clear EXCEPTIONAL_SCORE, and get
// flagged is_older either way.
export function recencyEligibility(item: { relevance: number; impact: number; published_at?: string }): { keep: boolean; isOlder: boolean } {
  const days = ageDays(item.published_at)
  if (days === null) return { keep: true, isOlder: false }
  if (days <= FRESH_DAYS) return { keep: true, isOlder: false }
  if (days <= STALE_CUTOFF_DAYS) {
    const exceptional = item.relevance >= EXCEPTIONAL_SCORE && item.impact >= EXCEPTIONAL_SCORE
    return { keep: exceptional, isOlder: exceptional }
  }
  return { keep: false, isOlder: false }
}
