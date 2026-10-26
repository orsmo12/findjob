/**
 * Shared deterministic text-variation helpers.
 *
 * Zero-cost product constraint: there is no LLM call and no Math.random()
 * anywhere in the candidate-generation path. To still avoid every item
 * reading like a copy-pasted template, each item deterministically picks
 * one of a small set of pre-written phrasings based on a hash of its own
 * content — same item, same inputs, same output every render (so a
 * refresh doesn't make text flicker); different items land on different
 * variants because their hash differs.
 *
 * Originally implemented once, privately, inside run-agent-pipeline.ts
 * (the generic-domain explanation path). Extracted here so the 5 MVP
 * agents, placementReason() in route.ts, and the cross-item synthesis
 * stage can all reuse the exact same mechanism instead of re-implementing
 * a hash function per file.
 */

import type { Lang } from './i18n'

export type Bi = { he: string; en: string }

/** Tiny deterministic string hash (not cryptographic — just needs to be stable and cheap). */
export function seedHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

/** Deterministically pick one element of `variants` based on `seed`. */
export function pick<T>(variants: readonly T[], seed: string): T {
  return variants[seedHash(seed) % variants.length]
}

/** Resolve a bilingual string pair for the current language. */
export function say(e: Bi, lang: Lang): string {
  return lang === 'he' ? e.he : e.en
}

/**
 * Some source adapters append "(live)" to a source name for the research
 * status line's own bookkeeping (e.g. "Hacker News (live)"). That suffix
 * belongs in status UI, not inside a sentence the user reads on a card —
 * strip it before the name is woven into generated copy.
 */
export function cleanSourceName(source: string): string {
  return source.replace(/\s*\(live\)\s*$/i, '').trim()
}
