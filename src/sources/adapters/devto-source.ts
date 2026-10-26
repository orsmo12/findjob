/**
 * Dev.to adapter — public Forem API, no key.
 * https://developers.forem.com/api
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

interface DevToArticle {
  id: number
  title: string
  description?: string
  url: string
  published_at?: string
  user?: { name?: string }
  tag_list?: string[]
  positive_reactions_count?: number
  comments_count?: number
}

export interface DevToParams {
  tag: string
  limit?: number
  top?: number // days window for the "top" ranking endpoint, omit for "latest by tag"
  // Only used for the "no description provided" fallback below — an
  // article's own description (when it has one) is external content and is
  // passed through untouched regardless of lang.
  lang?: Lang
}

export async function fetchDevToArticles(params: DevToParams): Promise<RawItem[]> {
  const { tag, limit = 6, top, lang = 'en' } = params
  const qs = new URLSearchParams({ tag, per_page: String(limit) })
  if (top) qs.set('top', String(top))

  const res = await fetchWithTimeout(`https://dev.to/api/articles?${qs.toString()}`)
  if (!res) return []

  try {
    const articles = (await res.json()) as DevToArticle[]
    return articles.slice(0, limit).map(a => ({
      id: `devto-${a.id}`,
      title: a.title,
      summary: a.description || (lang === 'he' ? 'לא סופק תיאור.' : 'No description provided.'),
      url: a.url,
      sourceName: 'Dev.to',
      sourceType: 'api' as const,
      publishedAt: a.published_at || new Date().toISOString(),
      author: a.user?.name,
      tags: a.tag_list ?? [],
      rawScoreSignals: { reactions: a.positive_reactions_count ?? 0, comments: a.comments_count ?? 0 },
      metadata: {},
    }))
  } catch {
    return []
  }
}
