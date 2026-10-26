/**
 * Agent layer — shared contract for the 4 active MVP agents.
 *
 * Pipeline this file implements (per agent):
 *   Sources → RawItems → normalize → dedupe → filter → CandidateItems
 *
 * A concrete agent (developer-opportunities-agent.ts, ai-trends-agent.ts,
 * project-ideas-agent.ts, career-signals-agent.ts) just declares:
 *   - which source jobs to run (2-3 adapter calls with specific params)
 *   - how to turn one normalized RawItem into a CandidateItem (or null to
 *     drop it as irrelevant/noisy)
 *
 * runAgent() does the rest: fetch all jobs in parallel, normalize, dedupe,
 * map to candidates, drop nulls. This is what makes an agent "real" per
 * the product definition — it pulls from multiple live sources, normalizes,
 * dedupes, filters, and produces CandidateItems rather than fabricating
 * results.
 */

import type { RawItem } from '@/sources/types'
import type { BoardItemCategory } from '@/types'
import type { Lang } from '@/lib/i18n'
import { normalizeRawItems } from '@/pipeline/normalize-items'
import { dedupeItems } from '@/pipeline/dedupe-items'

export interface CandidateSourceLink {
  label: string
  url: string
}

export interface CandidateItem {
  id: string
  title: string
  summary: string
  url: string
  sourceLinks: CandidateSourceLink[]
  agentId: string
  domain: string
  category: BoardItemCategory
  tags: string[]
  whyItMightMatter: string
  suggestedAngle: string
  rawSignals: Record<string, number>
  confidence: number          // 0-1, agent's own confidence this is worth surfacing
  sourceName: string
  sourceReliability: number   // 1-10, carried from the SourceDescriptor that produced it
  publishedAt?: string
}

export interface AgentSourceJob {
  sourceId: string             // matches a SourceDescriptor id in source-registry.ts
  fetch(): Promise<RawItem[]>
}

export interface AgentDefinition {
  id: string
  name: { en: string; he: string }
  domain: string
  goal: string                 // one sentence: what is this agent trying to surface, and for whom
  // lang is forwarded here too — most jobs ignore it (their fetch call
  // builds RawItems from external content with no app-generated wrapper
  // text), but a job that does synthesize a title/summary itself (e.g.
  // CoinGecko's trending-coin sentence in market-signals-agent.ts) needs
  // it at fetch time, not just in toCandidate below.
  getJobs(lang: Lang): AgentSourceJob[]
  // lang controls the language of any app-generated text (whyItMightMatter,
  // suggestedAngle) — must never leave the UI mixed-language. Original
  // source titles are passed through untouched regardless of lang.
  toCandidate(raw: RawItem, sourceReliability: number, lang: Lang): CandidateItem | null
}

const SOURCE_RELIABILITY: Record<string, number> = {
  'Hacker News': 9,
  GitHub: 9,
  arXiv: 9,
  'Dev.to': 8,
  'Federal Reserve': 10,
  CoinGecko: 6,
}

function reliabilityFor(sourceName: string): number {
  return SOURCE_RELIABILITY[sourceName] ?? 6 // generic RSS / unknown sources default to medium
}

/**
 * Runs one agent end-to-end: Sources → RawItems → normalize → dedupe →
 * filter → CandidateItems. Jobs run in parallel and a single failing
 * source never takes the whole agent down — each adapter already
 * fails soft (returns []) on network/timeout errors.
 */
export async function runAgent(agent: AgentDefinition, lang: Lang = 'en'): Promise<CandidateItem[]> {
  const jobs = agent.getJobs(lang)

  const results = await Promise.all(
    jobs.map(async job => {
      try {
        return await job.fetch()
      } catch {
        return []
      }
    })
  )

  const allRaw = results.flat()
  const normalized = normalizeRawItems(allRaw)
  const deduped = dedupeItems(normalized)

  // Anti-hallucination noise filter: every candidate must trace back to a
  // real source — a title that reads like a real headline, a real http(s)
  // URL, and a real source name. Anything missing one of these is dropped
  // before it ever reaches toCandidate, rather than risk a fabricated-
  // looking card making it onto the board.
  const filtered = deduped.filter(item =>
    item.title &&
    item.title.length >= 8 &&
    item.url &&
    /^https?:\/\//i.test(item.url) &&
    item.sourceName && item.sourceName.trim().length > 0
  )

  const candidates = filtered
    .map(item => agent.toCandidate(item, reliabilityFor(item.sourceName), lang))
    .filter((c): c is CandidateItem => c !== null)

  return candidates
}
