/**
 * Hacker News adapter — public Firebase API, no key, no rate-limit auth.
 * https://github.com/HackerNews/API
 */

import type { RawItem } from '@/sources/types'
import type { Lang } from '@/lib/i18n'

const HN_BASE = 'https://hacker-news.firebaseio.com/v0'

interface HNStory {
  id: number
  title?: string
  url?: string
  score?: number
  descendants?: number
  time?: number
  type?: string
  by?: string
}

async function fetchHNStory(id: number, signal: AbortSignal): Promise<HNStory | null> {
  try {
    const res = await fetch(`${HN_BASE}/item/${id}.json`, { signal })
    if (!res.ok) return null
    return (await res.json()) as HNStory
  } catch {
    return null
  }
}

export interface HackerNewsParams {
  keywords: string[]
  limit?: number
  listEndpoint?: 'topstories' | 'newstories' | 'beststories'
  scanCount?: number // how many of the list to inspect — bigger = more thorough, slower
  // Controls the language of the app-generated "N points, M comments"
  // summary sentence below. The story title itself is external content and
  // is passed through untouched regardless of lang.
  lang?: Lang
}

export async function fetchHackerNews(params: HackerNewsParams): Promise<RawItem[]> {
  const { keywords, limit = 5, listEndpoint = 'topstories', scanCount = 60, lang = 'en' } = params
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const idsRes = await fetch(`${HN_BASE}/${listEndpoint}.json`, { signal: controller.signal })
    if (!idsRes.ok) return []
    const ids: number[] = await idsRes.json()
    const stories = await Promise.all(ids.slice(0, scanCount).map(id => fetchHNStory(id, controller.signal)))

    const lowerKeywords = keywords.map(k => k.toLowerCase())
    const matches = stories
      .filter((s): s is HNStory => !!s && s.type === 'story' && !!s.title)
      .filter(s => lowerKeywords.length === 0 || lowerKeywords.some(kw => s.title!.toLowerCase().includes(kw)))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit)

    return matches.map(s => ({
      id: `hn-${s.id}`,
      title: s.title!,
      summary: lang === 'he'
        ? `${s.score ?? 0} נקודות, ${s.descendants ?? 0} תגובות ב-Hacker News.`
        : `${s.score ?? 0} points, ${s.descendants ?? 0} comments on Hacker News.`,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      sourceName: 'Hacker News',
      sourceType: 'api' as const,
      publishedAt: s.time ? new Date(s.time * 1000).toISOString() : new Date().toISOString(),
      author: s.by,
      tags: lowerKeywords.filter(kw => s.title!.toLowerCase().includes(kw)),
      rawScoreSignals: { points: s.score ?? 0, comments: s.descendants ?? 0 },
      metadata: { hn_id: s.id },
    }))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
