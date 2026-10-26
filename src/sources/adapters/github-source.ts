/**
 * GitHub adapter — unauthenticated Search API, no key.
 * https://docs.github.com/en/rest/search
 *
 * Unauthenticated rate limit is low (10 req/min) — callers should keep the
 * number of distinct queries per pipeline run small.
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

interface GitHubRepo {
  full_name: string
  html_url: string
  description?: string
  stargazers_count?: number
  forks_count?: number
  pushed_at?: string
  language?: string
  topics?: string[]
}

export interface GitHubSearchParams {
  query: string
  limit?: number
  sinceDays?: number   // only repos created/pushed within this window
  sort?: 'stars' | 'updated'
  // Only used for the "no description provided" fallback below — a repo's
  // own description (when it has one) is external content and is passed
  // through untouched regardless of lang.
  lang?: Lang
}

export async function fetchGitHubRepos(params: GitHubSearchParams): Promise<RawItem[]> {
  const { query, limit = 6, sinceDays = 21, sort = 'stars', lang = 'en' } = params
  const since = new Date(Date.now() - sinceDays * 24 * 3600000).toISOString().slice(0, 10)
  const q = `${query} created:>${since}`

  const res = await fetchWithTimeout(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=desc&per_page=${limit}`,
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LifeBoard-App' } }
  )
  if (!res) return []

  try {
    const data = await res.json()
    const repos = (data.items ?? []) as GitHubRepo[]
    return repos.slice(0, limit).map(r => ({
      id: `github-${r.full_name}`,
      title: r.full_name,
      summary: r.description || (lang === 'he' ? 'לא סופק תיאור.' : 'No description provided.'),
      url: r.html_url,
      sourceName: 'GitHub',
      sourceType: 'api' as const,
      publishedAt: r.pushed_at || new Date().toISOString(),
      tags: [...(r.topics ?? []), r.language].filter((t): t is string => !!t),
      rawScoreSignals: { stars: r.stargazers_count ?? 0, forks: r.forks_count ?? 0 },
      metadata: { language: r.language },
    }))
  } catch {
    return []
  }
}
