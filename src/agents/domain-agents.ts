/**
 * Domain Agents
 *
 * Registry-driven dispatcher: every domain in '@/lib/domains' declares its
 * own list of free, no-key discovery sources (Hacker News, GitHub Search
 * API, arXiv, Dev.to, Reddit public JSON, public RSS feeds). This file
 * knows how to fetch each source TYPE generically — it has no hardcoded
 * per-domain logic, so adding a new domain to the registry is enough to
 * give it a working agent. No OpenAI, no paid service, no signup.
 *
 * As of the real-agent-pipeline refactor, the actual fetch logic for HN,
 * GitHub, arXiv, Dev.to, and RSS lives once in `src/sources/adapters/*`
 * and is shared with the new MVP agents (src/agents/*-agent.ts) — this
 * file is now a thin adapter that calls those same functions and maps
 * their output into the generic `RawItem` shape (types/index.ts) that
 * `runDomainAgent`/`runAllAgents` have always returned, so every existing
 * caller (the /api/run-agents route, the Judgment Engine) keeps working
 * unchanged. Reddit has no dedicated adapter yet (still 'planned' in the
 * source registry) and is fetched inline below as before.
 *
 * Every fetcher times out at 8s and never throws — a failed or empty
 * source just means fewer live items; runDomainAgent() falls back to a
 * single honest placeholder item so a tracked domain never looks broken.
 */

import type { RawItem } from '@/types'
import type { RawItem as SourceRawItem } from '@/sources/types'
import type { Lang } from '@/lib/i18n'
import { DOMAIN_REGISTRY, type DomainDef, type SourceConfig } from '@/lib/domains'
import { fetchHackerNews } from '@/sources/adapters/hacker-news-source'
import { fetchGitHubRepos } from '@/sources/adapters/github-source'
import { fetchDevToArticles } from '@/sources/adapters/devto-source'
import { fetchArxivPapers } from '@/sources/adapters/arxiv-source'
import { fetchRSSFeed } from '@/sources/adapters/rss-source'

// ─── Shared fetch helper (still needed for Reddit, which has no adapter yet) ──

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

function baseItem(domain: DomainDef, lang: Lang): Pick<RawItem, 'agent' | 'domain'> {
  return {
    agent: lang === 'he' ? `סוכן ${domain.label.he}` : `${domain.label.en} Agent`,
    domain: domain.id,
  }
}

// ─── Adapter output → generic RawItem mapping ─────────────────────────────────
// Keeps the generic shape's "urgency" metadata convention (0-100, roughly
// derived from each source's own engagement signal) so judgment-engine.ts's
// existing ruleBased() scoring needs no changes for these domains.

function urgencyFor(item: SourceRawItem): number {
  switch (item.sourceName) {
    case 'Hacker News': return Math.min(100, Math.round((item.rawScoreSignals.points ?? 0) / 2))
    case 'GitHub':       return Math.min(100, Math.round((item.rawScoreSignals.stars ?? 0) / 20))
    case 'Dev.to':        return Math.min(100, Math.round((item.rawScoreSignals.reactions ?? 0) / 2))
    case 'arXiv':           return 35
    default:                   return 30 // generic RSS feeds
  }
}

function typeFor(item: SourceRawItem): string {
  switch (item.sourceName) {
    case 'Hacker News': return 'news'
    case 'GitHub':       return 'github'
    case 'Dev.to':        return 'article'
    case 'arXiv':           return 'paper'
    default:                   return 'news' // generic RSS feeds
  }
}

function toGeneric(item: SourceRawItem, domain: DomainDef, lang: Lang): RawItem {
  const title = item.sourceName === 'GitHub' && typeof item.rawScoreSignals.stars === 'number'
    ? lang === 'he'
      ? `${item.title} — ${item.rawScoreSignals.stars}★ במגמה`
      : `${item.title} — ${item.rawScoreSignals.stars}★ trending`
    : item.title

  return {
    ...baseItem(domain, lang),
    title,
    content: item.summary,
    source: `${item.sourceName} (live)`,
    source_url: item.url,
    published_at: item.publishedAt || new Date().toISOString(),
    metadata: { urgency: urgencyFor(item), type: typeFor(item), ...item.rawScoreSignals },
  }
}

// ─── Reddit public JSON feeds (no key, custom User-Agent required) ──────────
// No dedicated adapter yet — kept inline (source registry marks it 'planned').

async function fetchReddit(subreddits: string[], domain: DomainDef, lang: Lang): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    subreddits.map(async sub => {
      const res = await fetchWithTimeout(
        `https://www.reddit.com/r/${sub}/top.json?limit=5&t=day&raw_json=1`,
        { headers: { 'User-Agent': 'LifeBoardApp/1.0' } }
      )
      if (!res) return [] as RawItem[]
      const data = await res.json()
      const children = (data?.data?.children ?? []) as Array<{ data: any }>
      return children
        .filter(c => !c.data?.over_18)
        .slice(0, 4)
        .map(c => {
          const d = c.data
          return {
            ...baseItem(domain, lang),
            title: d.title,
            content: lang === 'he'
              ? `${d.ups ?? 0} הצבעות, ${d.num_comments ?? 0} תגובות ב-r/${sub}.`
              : `${d.ups ?? 0} upvotes, ${d.num_comments ?? 0} comments on r/${sub}.`,
            source: `Reddit r/${sub} (live)`,
            source_url: d.url?.startsWith('http') ? d.url : `https://reddit.com${d.permalink}`,
            published_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),
            // ups/comments copied as real numeric signals (not just embedded
            // in the content string) so the explanation generator can quote
            // them directly — same convention toGeneric() already uses for
            // HN/GitHub/Dev.to/arXiv/RSS (see ...item.rawScoreSignals above).
            metadata: { urgency: Math.min(100, Math.round((d.ups ?? 0) / 5)), type: 'reddit', ups: d.ups ?? 0, comments: d.num_comments ?? 0 },
          } as RawItem
        })
    })
  )
  return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

async function fetchFromSource(domain: DomainDef, source: SourceConfig, lang: Lang): Promise<RawItem[]> {
  switch (source.type) {
    case 'hn': {
      const items = await fetchHackerNews({ keywords: source.keywords, limit: 5, scanCount: 50, lang })
      return items.map(i => toGeneric(i, domain, lang))
    }
    case 'reddit':
      return fetchReddit(source.subreddits, domain, lang)
    case 'github_search': {
      const items = await fetchGitHubRepos({ query: source.query, limit: 5, sinceDays: 14, sort: 'stars', lang })
      return items.map(i => toGeneric(i, domain, lang))
    }
    case 'arxiv': {
      const items = await fetchArxivPapers({ query: source.query, limit: 5 })
      return items.map(i => toGeneric(i, domain, lang))
    }
    case 'devto': {
      const items = await fetchDevToArticles({ tag: source.tag, limit: 5, top: 7, lang })
      return items.map(i => toGeneric(i, domain, lang))
    }
    case 'rss': {
      const items = await fetchRSSFeed({ url: source.url, label: source.label, limit: 5, lang })
      return items.map(i => toGeneric(i, domain, lang))
    }
    default:
      return []
  }
}

function placeholderItem(domain: DomainDef, lang: Lang): RawItem {
  const label = domain.label[lang]
  return {
    ...baseItem(domain, lang),
    title: lang === 'he' ? `אין כרגע סיגנלים חיים בנושא ${label}` : `No live ${label} signals right now`,
    content: domain.sources.length === 0
      ? (lang === 'he'
          ? `גילוי חי בנושא ${label} עדיין לא מחובר — הדבר ידרוש API מבוסס-מיקום או בתשלום, וזה בניגוד לעקרונות המוצר. התחום מוכן לעקוב ברגע שיהיה מקור חינמי מתאים.`
          : `Live discovery for ${label} isn't wired up yet — it would need a location-aware or paid API, which this product avoids. This domain is ready to track the moment a free source exists.`)
      : (lang === 'he'
          ? `כל המקורות החינמיים המוגדרים לנושא ${label} לא החזירו תוצאות בהפעלה הזו. ההודעה הזו שומרת על התחום גלוי במקום להיראות שבור — נסו לרענן בקרוב.`
          : `All free sources configured for ${label} returned nothing on this run. This placeholder keeps the domain visible instead of looking broken — try refreshing again shortly.`),
    source: 'Life Board',
    published_at: new Date().toISOString(),
    metadata: { urgency: 20, type: 'placeholder' },
  }
}

export async function runDomainAgent(domain: DomainDef, lang: Lang = 'en'): Promise<RawItem[]> {
  if (domain.sources.length === 0) return [placeholderItem(domain, lang)]
  const settled = await Promise.allSettled(domain.sources.map(s => fetchFromSource(domain, s, lang)))
  const items = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  return items.length > 0 ? items.slice(0, 8) : [placeholderItem(domain, lang)]
}

/**
 * Runs the agent for every active domain in parallel. `activeDomainIds`
 * should come from the user's live DomainPriority list (active: true) —
 * pass undefined only as a safety fallback (e.g. before onboarding ever
 * ran), in which case domains above a modest default-priority threshold
 * are used instead of running all 18 unconditionally.
 */
export async function runAllAgents(activeDomainIds?: string[], lang: Lang = 'en'): Promise<RawItem[]> {
  const domains = activeDomainIds
    ? DOMAIN_REGISTRY.filter(d => activeDomainIds.includes(d.id))
    : DOMAIN_REGISTRY.filter(d => d.defaultPriority >= 6)

  const results = await Promise.allSettled(domains.map(d => runDomainAgent(d, lang)))
  const items: RawItem[] = []
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    } else {
      console.error(`[${domains[i].id}] agent failed:`, result.reason)
    }
  }
  return items
}
