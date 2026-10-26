/**
 * Source layer types.
 *
 * Every adapter in `src/sources/adapters/*` returns the same shape —
 * `RawItem` — regardless of whether the underlying API is Hacker News,
 * GitHub, arXiv, Dev.to, or a generic RSS feed. That's what lets the
 * agent layer (`src/agents/*`) stay source-agnostic: an agent just lists
 * which adapters+params it wants, and gets back a uniform array.
 *
 * `SourceDescriptor` is the catalog entry type used by
 * `source-registry.ts` to document *every* source that's been
 * researched, not just the ones wired up today. Most entries are
 * `implementationStatus: 'planned'` — that's the point: a wide, honest
 * catalog of what's possible, with a small, real, active subset.
 */

export type SourceType = 'api' | 'rss' | 'scrape' | 'manual'

export interface RawItem {
  id: string                          // stable id, derived from url/title — used for dedupe
  title: string
  summary: string
  url: string
  sourceName: string                  // human-readable, e.g. "Hacker News"
  sourceType: SourceType
  publishedAt?: string                // ISO date string
  author?: string
  tags: string[]
  rawContent?: string                 // full text/body if the adapter has it
  rawScoreSignals: Record<string, number> // e.g. { points: 340, comments: 88, stars: 1200 }
  metadata?: Record<string, unknown>
}

export interface SourceAdapter<TParams = unknown> {
  id: string
  fetch(params: TParams): Promise<RawItem[]>
}

export type SourceDifficulty   = 'easy' | 'medium' | 'hard'
export type SourceLegalRisk    = 'low' | 'medium' | 'high'
export type SourceImplStatus   = 'active' | 'planned' | 'disabled'
export type SourcePriority     = 'high' | 'medium' | 'low'

/**
 * One catalog entry. Fields mirror what a real engineering team would
 * want recorded before integrating a source — not just "does it work"
 * but "should we depend on it, and how much."
 */
export interface SourceDescriptor {
  id: string
  name: string
  website: string
  domains: string[]                   // free-text domain/topic tags this source serves
  type: SourceType
  official: boolean                   // official API vs. unofficial/community wrapper
  enabled: boolean                    // is this source currently allowed to run at all
  free: boolean
  requiresApiKey: boolean
  freeTierLimits?: string
  rateLimitNotes?: string
  reliabilityScore: number            // 1-10, subjective but documented
  difficulty: SourceDifficulty
  legalRisk: SourceLegalRisk
  implementationStatus: SourceImplStatus
  priority: SourcePriority
  provides: string[]                  // what kind of useful items this source yields
  agents: string[]                    // which agent ids should/do use this source
  notes: string
}
