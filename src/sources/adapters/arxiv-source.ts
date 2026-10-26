/**
 * arXiv adapter — public Atom API, no key.
 * https://info.arxiv.org/help/api/index.html
 */

import type { RawItem } from '@/sources/types'

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

function parseArxivEntries(xml: string): { title: string; link: string; published: string; summary: string; authors: string[] }[] {
  const entries: { title: string; link: string; published: string; summary: string; authors: string[] }[] = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(xml))) {
    const block = m[1]
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) ?? ['', ''])[1].trim().replace(/\s+/g, ' ')
    const link = (block.match(/<id>([\s\S]*?)<\/id>/) ?? ['', ''])[1].trim()
    const published = (block.match(/<published>([\s\S]*?)<\/published>/) ?? ['', ''])[1].trim()
    const summary = (block.match(/<summary>([\s\S]*?)<\/summary>/) ?? ['', ''])[1].trim().replace(/\s+/g, ' ').slice(0, 280)
    const authors = Array.from(block.matchAll(/<name>([\s\S]*?)<\/name>/g)).map(a => a[1].trim())
    entries.push({ title, link, published, summary, authors })
  }
  return entries
}

export interface ArxivParams {
  query: string
  limit?: number
}

export async function fetchArxivPapers(params: ArxivParams): Promise<RawItem[]> {
  const { query, limit = 5 } = params
  const res = await fetchWithTimeout(
    `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`
  )
  if (!res) return []

  try {
    const xml = await res.text()
    const entries = parseArxivEntries(xml)
    return entries.slice(0, limit).map(e => ({
      id: `arxiv-${e.link.split('/').pop() ?? e.link}`,
      title: e.title,
      summary: e.summary,
      url: e.link,
      sourceName: 'arXiv',
      sourceType: 'api' as const,
      publishedAt: e.published || new Date().toISOString(),
      author: e.authors[0],
      tags: ['paper', 'research'],
      rawScoreSignals: {},
      metadata: { authors: e.authors },
    }))
  } catch {
    return []
  }
}
