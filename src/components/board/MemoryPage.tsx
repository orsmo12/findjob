'use client'

import { useState, useEffect, useCallback } from 'react'
import { clsx } from 'clsx'
import { useLanguage } from '@/lib/language-context'
import { formatTimeAgo } from '@/lib/i18n'
import { getDomainLabel } from '@/lib/domains'
import type { MemoryEvent } from '@/types'
import type { MemorySummary, MemorySummaryEntry } from '@/agents/memory-engine'

const TYPE_META: Record<string, { icon: string; key: string; color: string }> = {
  acted_on:          { icon: '✅', key: 'memory.type.actedOn',         color: 'bg-green-50 text-green-700' },
  helpful:           { icon: '👍', key: 'memory.type.helpful',        color: 'bg-blue-50 text-blue-700' },
  not_helpful:       { icon: '👎', key: 'memory.type.notHelpful',     color: 'bg-red-50 text-red-600' },
  dismissed:         { icon: '✕',  key: 'memory.type.dismissed',      color: 'bg-gray-100 text-gray-500' },
  priority_adjusted: { icon: '↕',  key: 'memory.type.priorityAdjusted', color: 'bg-amber-50 text-amber-700' },
  pattern_learned:   { icon: '💡', key: 'memory.type.patternLearned',  color: 'bg-purple-50 text-purple-700' },
}

// One row in a "By domain / By source / By category" ranking-impact list —
// shared between the three sections since they're all MemorySummaryEntry[].
function ImpactRow({ entry }: { entry: MemorySummaryEntry }) {
  const positive = entry.delta > 0
  const neutral = entry.delta === 0
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[12px] text-gray-700 truncate">{entry.label}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10.5px] text-gray-400">
          👍 {entry.helpful} · 👎 {entry.notHelpful}
        </span>
        <span className={clsx(
          'text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[36px] text-center',
          neutral ? 'bg-gray-100 text-gray-500' : positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
        )}>
          {entry.delta > 0 ? '+' : ''}{entry.delta}
        </span>
      </div>
    </div>
  )
}

function ImpactSection({ title, entries, t }: { title: string; entries: MemorySummaryEntry[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
      {entries.length === 0 ? (
        <p className="text-[11.5px] text-gray-400 italic">{t('memory.rankingImpact.empty')}</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {entries.slice(0, 6).map(e => <ImpactRow key={e.key} entry={e} />)}
        </div>
      )}
    </div>
  )
}

export function MemoryPage() {
  const { lang, t } = useLanguage()
  const [events, setEvents] = useState<MemoryEvent[]>([])
  const [summary, setSummary] = useState<MemorySummary | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Real data from the engine that actually drives ranking — not the static
  // mock list. lang is in the query string because event descriptions and
  // domain labels in the summary are generated server-side, already
  // localized (same pattern as /api/run-agents).
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/memory?lang=${lang}`)
      const data = await res.json()
      setEvents(data.events ?? [])
      setSummary(data.summary ?? null)
    } catch (err) {
      console.error('Memory load error:', err)
    } finally {
      setLoaded(true)
    }
  }, [lang])

  useEffect(() => { load() }, [load])

  const helpful      = events.filter(e => e.type === 'helpful').length
  const notHelpful    = events.filter(e => e.type === 'not_helpful').length
  // "Patterns" = real priority_adjusted events, the one MemoryEventType the
  // engine actually emits on its own (pattern_learned is a reserved type for
  // future use, never fired today) — this keeps the stat honest instead of
  // always reading 0 or showing a fabricated number.
  const rulesLearned = events.filter(e => e.type === 'priority_adjusted').length

  const isEmpty = loaded && events.length === 0

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Topbar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-5 py-3 flex items-center">
        <span className="text-[14.5px] font-semibold text-gray-900">{t('memory.title')}</span>
        <span className="ms-3 text-[11.5px] text-gray-400">{t('memory.subtitle')}</span>
      </div>

      <div className="p-5 max-w-2xl">

        {isEmpty ? (
          <div className="bg-white border border-gray-100 rounded-xl p-6 text-center mb-6">
            <p className="text-[13px] font-semibold text-gray-800 mb-1">{t('memory.empty.title')}</p>
            <p className="text-[12.5px] text-gray-500 leading-relaxed max-w-sm mx-auto">{t('memory.empty.body')}</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: t('memory.stats.helpful'),    value: helpful,      sub: t('memory.stats.helpfulSub'),    accent: 'border-t-emerald-400' },
                { label: t('memory.stats.notHelpful'), value: notHelpful,   sub: t('memory.stats.notHelpfulSub'), accent: 'border-t-red-400' },
                { label: t('memory.stats.patterns'),   value: rulesLearned, sub: t('memory.stats.patternsSub'),   accent: 'border-t-purple-400' },
              ].map(s => (
                <div key={s.label} className={clsx('bg-white border border-gray-100 rounded-xl p-3 border-t-[3px]', s.accent)}>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{s.label}</div>
                  <div className="text-2xl font-bold text-gray-900 tracking-tight">{s.value}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Ranking impact — "how it changed rankings", the part Part 3
                explicitly requires and the old mock-only page never showed.
                Same clampDelta() numbers the Judgment Engine itself reads,
                via getMemorySummary — not a separate estimate. */}
            {summary && summary.totalFeedback > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6">
                <p className="text-[12px] font-bold text-gray-800 mb-0.5">{t('memory.rankingImpact')}</p>
                <p className="text-[11px] text-gray-400 mb-3">{t('memory.rankingImpact.sub')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ImpactSection title={t('memory.rankingImpact.domains')}    entries={summary.domains}    t={t} />
                  <ImpactSection title={t('memory.rankingImpact.sources')}    entries={summary.sources}    t={t} />
                  <ImpactSection title={t('memory.rankingImpact.categories')} entries={summary.categories} t={t} />
                </div>
              </div>
            )}

            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t('memory.recentEvents')}</h2>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6">
              {events.map((e, i) => {
                const meta = TYPE_META[e.type] ?? { icon: '•', key: '', color: 'bg-gray-100 text-gray-500' }
                return (
                  <div
                    key={e.id}
                    className={clsx(
                      'flex items-start gap-3 p-3.5',
                      i < events.length - 1 && 'border-b border-gray-50'
                    )}
                  >
                    <span className="text-base mt-0.5 flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={clsx('text-[9.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide', meta.color)}>
                          {meta.key ? t(meta.key) : e.type}
                        </span>
                        {e.domain && (
                          <span className="text-[9.5px] text-gray-400">{getDomainLabel(e.domain, lang)}</span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-gray-800 leading-relaxed">{e.description}</p>
                      <p className="text-[10.5px] text-gray-400 mt-1">{formatTimeAgo(e.created_at, lang)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* How it works */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
          <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-2">{t('memory.howItWorks')}</p>
          <ul className="space-y-1.5">
            {[
              t('memory.bullet1'),
              t('memory.bullet2'),
              t('memory.bullet3'),
              t('memory.bullet4'),
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-gray-600">
                <span className="text-indigo-300 mt-0.5">→</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
