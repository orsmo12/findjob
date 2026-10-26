/**
 * Step 4 of the pipeline: ... → normalize → [dedupe] → filter → CandidateItems
 *
 * The same story routinely shows up from multiple sources (e.g. a GitHub
 * repo gets posted to Hacker News the same week it trends on GitHub
 * itself). Dedupe by normalized URL first, then by normalized lowercase
 * title as a fallback for cases where the URL differs (utm params,
 * http vs https, trailing slash) but it's clearly the same item.
 */

import type { RawItem } from '@/sources/types'

export function normalizeUrl(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    u.search = ''
    u.hash = ''
    let s = u.toString().toLowerCase()
    if (s.endsWith('/')) s = s.slice(0, -1)
    return s.replace(/^https?:\/\//, '')
  } catch {
    return url.trim().toLowerCase()
  }
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Generic version of the same url-then-title dedupe strategy, for any
 * shape that has a url and a title — used by the pipeline to dedupe
 * CandidateItems coming from both the real agents and the generic domain
 * agent path before they're sent to the Judgment Engine together.
 */
export function dedupeBy<T extends { url: string; title: string }>(items: T[]): T[] {
  const seenUrls = new Set<string>()
  const seenTitles = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const urlKey = normalizeUrl(item.url)
    const titleKey = normalizeTitle(item.title)

    if (urlKey && seenUrls.has(urlKey)) continue
    if (titleKey && seenTitles.has(titleKey)) continue

    if (urlKey) seenUrls.add(urlKey)
    if (titleKey) seenTitles.add(titleKey)
    result.push(item)
  }

  return result
}

export function dedupeItems(items: RawItem[]): RawItem[] {
  return dedupeBy(items)
}
