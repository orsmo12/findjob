'use client'

import { useState, useMemo } from 'react'
import { BoardCard } from '@/components/board/BoardCard'
import type { BoardItem, BoardStats, AttentionBudget, DomainPriority } from '@/types'
import { clsx } from 'clsx'
import { useLanguage } from '@/lib/language-context'
import { formatItemCount } from '@/lib/i18n'
import { getDomainIcon, getDomainLabel, getDomainColorClasses } from '@/lib/domains'
import type { WeekInfo } from '@/lib/week'

type Filter = 'all' | AttentionBudget

interface BoardPageProps {
  items: BoardItem[]
  // Read-only here — only used for the "distinct sources scanned" tally in
  // the research-status line below. Explore & Expand itself now renders
  // from its own page (ExplorePage.tsx); this page no longer owns or
  // mutates the secondary layer.
  secondaryItems: BoardItem[]
  stats: BoardStats
  priorities: DomainPriority[]
  // Run state + the actual week this brief was generated for now live in
  // AppShell (shared with ExplorePage, since both render from the same
  // /api/run-agents response) and are passed down read-only.
  week: WeekInfo
  running: boolean
  lastRun: Date | null
  initialLoading: boolean
  onFeedback: (itemId: string, feedback: 'helpful' | 'not_helpful') => Promise<void>
  onRefresh: (force?: boolean) => void
}

export function BoardPage({ items, secondaryItems, stats, priorities, week, running, lastRun, initialLoading, onFeedback, onRefresh }: BoardPageProps) {
  const { lang, t } = useLanguage()
  const [filter,  setFilter]  = useState<Filter>('all')
  const [showResearchDetail, setShowResearchDetail] = useState(false)

  const locale = lang === 'he' ? 'he-IL' : 'en-US'
  const activePriorities = [...priorities].filter(p => p.active).sort((a, b) => b.score - a.score)

  // Real count of distinct sources actually present across both layers —
  // never a fabricated number, just a tally of what's already on the board.
  const sourcesScanned = useMemo(
    () => new Set([...items, ...secondaryItems].map(i => i.source)).size,
    [items, secondaryItems]
  )

  // Counts per budget
  const counts = {
    all:    items.length,
    high:   items.filter(i => i.attention_budget === 'high').length,
    medium: items.filter(i => i.attention_budget === 'medium').length,
    low:    items.filter(i => i.attention_budget === 'low').length,
  }

  const visible = filter === 'all' ? items : items.filter(i => i.attention_budget === filter)

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Topbar — secondary metadata (date, active-domains pulse, last-run
          time) collapses progressively below sm/md so a phone-width topbar
          never overflows or wraps; the refresh action always stays visible
          since it's the one thing every breakpoint needs (Part 8). */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-white via-white to-indigo-50/40 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-5 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <span className="text-[14.5px] font-semibold text-gray-900">{t('board.title')}</span>
          <span className="text-[11.5px] text-gray-400 ms-2 hidden sm:inline">
            {new Date().toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-gray-400">{t('board.domainsActive', { n: activePriorities.length })}</span>
          </div>
          {lastRun && (
            <span className="hidden md:inline text-[11px] text-gray-400">
              {t('board.lastRun', { time: lastRun.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
            </span>
          )}
          <button
            onClick={() => onRefresh()}
            disabled={running}
            className="text-[12px] px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50 font-medium flex-shrink-0"
          >
            {running ? t('board.running') : t('board.refresh')}
          </button>
          {/* Dev/admin-only escape hatch (Product Stabilization directive,
              FIX REQUIRED #4) — bypasses the Weekly Snapshot and rebuilds
              it from scratch. Deliberately NOT the normal Refresh action
              and styled distinctly (amber) so it's never mistaken for it.
              Stripped from production builds entirely. */}
          {process.env.NODE_ENV !== 'production' && (
            <button
              onClick={() => onRefresh(true)}
              disabled={running}
              title="Dev only: bypasses the Weekly Snapshot and rebuilds the Weekly Brief from scratch"
              className="text-[11px] px-2.5 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 font-medium flex-shrink-0"
            >
              ⚠ Regenerate Brief (dev)
            </button>
          )}
        </div>
      </div>

      {/* Trust bar — scrolls horizontally instead of wrapping/clipping on
          narrow phone widths (Part 8); unchanged on desktop since nothing
          there is wide enough to actually trigger the scroll. */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-gradient-to-r from-indigo-50 to-violet-50/60 border-b border-indigo-100/70 text-[11px] text-gray-500 overflow-x-auto whitespace-nowrap">
        <span className="flex items-center gap-1 cursor-help" title={t('tooltip.trustScore')}><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t('trust.score')} <strong className="text-gray-800">{stats.trust_score}%</strong></span>
        <span className="text-gray-300">·</span>
        <span className="cursor-help" title={t('tooltip.noiseRate')}>{t('trust.noise')} <strong className="text-gray-800">{stats.noise_rate}%</strong></span>
        <span className="text-gray-300">·</span>
        <span>{t('trust.itemsToday')} <strong className="text-gray-800">{stats.items_today}</strong></span>
        <span className="text-gray-300">·</span>
        <span>{t('trust.filteredOut')} <strong className="text-gray-800">{stats.filtered_today}</strong></span>
        <span className="ms-auto text-gray-500">
          {t('trust.actedOnWeek')} <strong className="text-gray-800">{stats.acted_on_week}</strong>
        </span>
      </div>

      {/* Attention budget filter */}
      <div className="flex items-center gap-0 bg-white border-b border-gray-100 px-4 sm:px-5 overflow-x-auto">
        {(['all', 'high', 'medium', 'low'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-[11.5px] font-medium border-b-2 transition-all flex-shrink-0',
              filter === f
                ? 'text-indigo-700 border-indigo-600'
                : 'text-gray-500 border-transparent hover:text-gray-800'
            )}
          >
            {f !== 'all' && (
              <span className={clsx('w-1.5 h-1.5 rounded-full', {
                'bg-red-500': f === 'high',
                'bg-amber-500': f === 'medium',
                'bg-green-500': f === 'low',
              })} />
            )}
            {t(`filter.${f}`)}
            <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">
              {counts[f]}
            </span>
          </button>
        ))}
        <span className="ms-auto hidden sm:inline text-[11px] text-gray-400 pb-0.5 flex-shrink-0">
          {t('filter.filteredToday', { n: stats.filtered_today })}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">

        {/* Research status — compact one-line summary (real counts: distinct
            sources + active domains actually behind the current board, not
            a fabricated number) instead of a large always-on per-domain
            grid. Click "Show details" to expand the same per-domain detail
            as before. */}
        <div className="flex items-center gap-2 mb-5 bg-white border border-gray-100 rounded-xl px-3.5 py-2.5">
          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', running ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')} />
          <span className="text-[11.5px] text-gray-600 font-medium">
            {running
              ? t('research.statusLineRunning', { sources: sourcesScanned, domains: activePriorities.length })
              : t('research.statusLine', { sources: sourcesScanned, domains: activePriorities.length })}
          </span>
          {activePriorities.length > 0 && (
            <button
              onClick={() => setShowResearchDetail(v => !v)}
              className="ms-auto text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
            >
              {showResearchDetail ? t('research.collapse') : t('research.expand')}
            </button>
          )}
        </div>

        {showResearchDetail && activePriorities.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-5">
            {activePriorities.map(p => {
              const colors = getDomainColorClasses(p.domain)
              const count = items.filter(i => i.domain === p.domain).length
              return (
                <div key={p.domain} className="bg-white border border-gray-100 rounded-xl p-2.5 text-center hover:shadow-sm transition-shadow">
                  <div className={clsx('w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-base mb-1.5', colors.bg)}>
                    {getDomainIcon(p.domain)}
                  </div>
                  <div className="text-[11px] font-semibold text-gray-800 mb-1 truncate">{getDomainLabel(p.domain, lang)}</div>
                  <div className="inline-flex items-center gap-1 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    {t('agentStatus.running')}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">{formatItemCount(count, lang)}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Weekly Brief — the primary layer, framed as a briefing (week
            range + generated date), not a feed: see src/lib/week.ts. Given
            a deliberately strong gradient treatment so the primary layer
            visually anchors the page — this is the one section that
            should read as "important," everything else recedes by
            comparison rather than competing for the same attention. */}
        <div className="relative mb-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-5 sm:px-6 py-5 shadow-lg shadow-indigo-300/40 ring-1 ring-white/10 overflow-hidden">
          {/* Purely decorative glow — gives the one section that should
              visually anchor the page a touch of depth/premium polish
              without adding any new copy or i18n keys (Part 8). */}
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />

          <div className="relative flex items-baseline gap-2 flex-wrap">
            <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">{t('important.title')}</h2>
            <span className="text-[12px] text-indigo-100 font-medium">
              {initialLoading ? t('important.loading') : t('important.subtitle', { n: visible.length })}
            </span>
          </div>
          <p className="relative text-[12px] text-indigo-100 mt-1.5 leading-relaxed">{t('important.tagline')}</p>
          <p className="relative text-[13.5px] text-white font-bold mt-2">
            {week.label} <span className="text-indigo-200 font-normal">· {week.generated_label}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
          {initialLoading ? (
            // Neutral shimmer placeholders — deliberately not shaped like
            // real cards with fake titles/scores, so nothing here can be
            // mistaken for actual data while the real board is still loading.
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-100" />
                <div className="p-3.5 space-y-2.5">
                  <div className="h-2.5 w-20 bg-gray-100 rounded-full" />
                  <div className="h-3.5 w-4/5 bg-gray-100 rounded" />
                  <div className="h-3 w-full bg-gray-50 rounded" />
                  <div className="h-3 w-2/3 bg-gray-50 rounded" />
                </div>
              </div>
            ))
          ) : visible.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">
              {t('important.empty')}
            </div>
          ) : (
            visible.map(item => (
              <BoardCard
                key={item.id}
                item={item}
                onFeedback={onFeedback}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
