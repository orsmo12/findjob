/**
 * Step 2 of the pipeline: Sources → RawItems → [normalize] → ...
 *
 * Adapters already return a consistent shape, but raw text coming from
 * APIs/RSS is messy in small, predictable ways — stray whitespace, HTML
 * entities, inconsistent date formats. normalizeRawItem cleans that up so
 * downstream dedupe/judgment logic can compare titles/urls reliably.
 */

import type { RawItem } from '@/sources/types'

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ')
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function cleanText(s: string | undefined): string {
  if (!s) return ''
  return decodeBasicEntities(stripHtml(s)).replace(/\s+/g, ' ').trim()
}

function toIsoDate(s: string | undefined): string | undefined {
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export function normalizeRawItem(raw: RawItem): RawItem {
  return {
    ...raw,
    title: cleanText(raw.title) || raw.title,
    summary: cleanText(raw.summary),
    url: (raw.url || '').trim(),
    sourceName: (raw.sourceName || '').trim(),
    publishedAt: toIsoDate(raw.publishedAt) ?? raw.publishedAt,
    tags: Array.from(new Set((raw.tags ?? []).map(t => cleanText(t).toLowerCase()).filter(Boolean))),
  }
}

export function normalizeRawItems(items: RawItem[]): RawItem[] {
  return items.map(normalizeRawItem)
}
