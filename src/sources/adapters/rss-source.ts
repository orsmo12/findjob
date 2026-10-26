/**
 * Generic RSS 2.0 adapter — works against any public RSS feed (engineering
 * blogs, AI newsletters, etc.) with no key. Intentionally simple regex
 * parsing rather than a full XML parser, to avoid adding a dependency.
 */

import type { RawItem } from '@/sources/types'
import type { Lang } from '@/lib/i18n'

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    if (!res.ok) return null
    return res
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function stripCdataAndTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function parseRSSItems(xml: string): { title: string; link: string; pubDate: string; description: string }[] {
  const items: { title: string; link: string; pubDate: string; description: string }[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml))) {
    const block = m[1]
    const title = stripCdataAndTags((block.match(/<title>([\s\S]*?)<\/title>/) ?? ['', ''])[1])
    const link = stripCdataAndTags((block.match(/<link>([\s\S]*?)<\/link>/) ?? ['', ''])[1])
    const pubDate = stripCdataAndTags((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? ['', ''])[1])
    const description = stripCdataAndTags((block.match(/<description>([\s\S]*?)<\/description>/) ?? ['', ''])[1]).slice(0, 280)
    items.push({ title, link, pubDate, description })
  }
  return items
}

export interface RSSParams {
  url: string
  label: string  // human-readable feed name, e.g. "OpenAI Blog"
  limit?: number
  // Only used for the "Latest from {label}" fallback below — a feed's own
  // description (when present) is external content and is passed through
  // untouched regardless of lang.
  lang?: Lang
}

export async function fetchRSSFeed(params: RSSParams): Promise<RawItem[]> {
  const { url, label, limit = 5, lang = 'en' } = params
  const res = await fetchWithTimeout(url)
  if (!res) return []

  try {
    const xml = await res.text()
    const items = parseRSSItems(xml)
    return items.slice(0, limit).map(it => ({
      id: `rss-${label}-${it.link || it.title}`,
      title: it.title,
      summary: it.description || (lang === 'he' ? `העדכון האחרון מ-${label}.` : `Latest from ${label}.`),
      url: it.link,
      sourceName: label,
      sourceType: 'rss' as const,
      publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      tags: [],
      rawScoreSignals: {},
      metadata: { feedUrl: url },
    }))
  } catch {
    return []
  }
}
