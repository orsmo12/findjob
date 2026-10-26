'use client'

import { useMemo } from 'react'
import { BoardCard } from '@/components/board/BoardCard'
import type { BoardItem } from '@/types'
import { useLanguage } from '@/lib/language-context'

interface ExplorePageProps {
  // Secondary layer only — AppShell's `secondaryItems`. This page never
  // touches the primary Weekly Brief (`items`), and never mutates this
  // array directly; feedback goes back up through `onFeedback`.
  items: BoardItem[]
  onFeedback: (itemId: string, feedback: 'helpful' | 'not_helpful') => Promise<void>
  // AppShell's `initialLoading` — true only for the window between mount
  // and the first /api/run-agents response settling.
  loading: boolean
  running: boolean
  lastRun: Date | null
  onRefresh: (force?: boolean) => void
}

export function ExplorePage({ items, onFeedback, loading, running, lastRun, onRefresh }: ExplorePageProps) {
  const { lang, t } = useLanguage()
  const locale = lang === 'he' ? 'he-IL' : 'en-US'

  // Group secondary items by why they're here (near miss / goal match /
  // learning / trend / everything else) instead of one undifferentiated
  // grid — moved here verbatim from BoardPage's old "Explore & Expand"
  // section (Part 4 directive: own nav destination, not a buried section).
  // Bucket + per-bucket copy come from the server (route.ts); a missing
  // explore_bucket (mock mode, or a response from before this field
  // existed) falls back to 'more' so nothing silently disappears.
  const exploreShelves = useMemo(() => {
    const order: NonNullable<BoardItem['explore_bucket']>[] = ['near_miss', 'goal_match', 'learning', 'trend', 'more']
    const groups: Record<string, BoardItem[]> = { near_miss: [], goal_match: [], learning: [], trend: [], more: [] }
    for (const item of items) {
      groups[item.explore_bucket ?? 'more'].push(item)
    }
    return order
      .map(bucket => ({ bucket, items: groups[bucket] }))
      .filter(shelf => shelf.items.length > 0)
  }, [items])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Topbar mirrors BoardPage's, titled for Explore & Expand specifically
          (own nav destination now, not a section header inside My Board). */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-white via-white to-indigo-50/40 backdrop-blur-sm border-b border-gray-100 px-4 sm:px-5 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <span className="text-[14.5px] font-semibold text-gray-900">{t('explore.title')}</span>
          <span className="text-[11.5px] text-gray-400 ms-2 hidden sm:inline">{t('explore.subtitleCount', { n: items.length })}</span>
        </div>
        <div className="ms-auto flex items-center gap-2">
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
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-[12px] text-gray-500 mb-5 leading-relaxed max-w-2xl">{t('explore.pageIntro')}</p>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-[12.5px] animate-pulse">{t('explore.loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-[12.5px]">{t('explore.empty')}</div>
        ) : (
          <div className="space-y-6">
            {exploreShelves.map(shelf => (
              <div key={shelf.bucket}>
                <div className="flex items-baseline gap-2 mb-2.5">
                  <h3 className="text-[12px] font-bold text-gray-700">{t(`explore.bucket.${shelf.bucket}`)}</h3>
                  <span className="text-[10.5px] text-gray-400">{t(`explore.bucket.${shelf.bucket}.sub`)}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">
                    {shelf.items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {shelf.items.map(item => (
                    <BoardCard
                      key={item.id}
                      item={item}
                      onFeedback={onFeedback}
                      secondary
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
