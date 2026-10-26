'use client'

import { useState, useCallback } from 'react'
import { LVSRing } from './LVSRing'
import type { BoardItem, AttentionBudget, BoardItemCategory } from '@/types'
import { clsx } from 'clsx'
import { useLanguage } from '@/lib/language-context'
import { getDomainLabel, getDomainColorClasses, getLifeDomainGroup } from '@/lib/domains'
import { formatPublished, sourceActionLabel } from '@/lib/i18n'
import { cleanSourceName } from '@/lib/text-variants'

// ─── Budget badge ─────────────────────────────────────────────────────────────
const BUDGET_STYLES: Record<AttentionBudget, string> = {
  high:   'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-green-50 text-green-700',
}

// ─── Category badge ───────────────────────────────────────────────────────────
// Additive, optional — only set by the real-agent pipeline (and the
// metadata-hint path it feeds through judgment-engine.ts). Older items
// without a category just skip rendering this badge.
const CATEGORY_STYLES: Record<BoardItemCategory, string> = {
  Learn:    'bg-sky-50 text-sky-700',
  Build:    'bg-violet-50 text-violet-700',
  Career:   'bg-rose-50 text-rose-700',
  Tool:     'bg-teal-50 text-teal-700',
  Trend:    'bg-orange-50 text-orange-700',
  Market:   'bg-amber-50 text-amber-700',
  Research: 'bg-indigo-50 text-indigo-700',
}

const CATEGORY_ICONS: Record<BoardItemCategory, string> = {
  Learn: '📘',
  Build: '🛠️',
  Career: '🎯',
  Tool: '🔧',
  Trend: '📈',
  Market: '📊',
  Research: '🔬',
}

const STRIPE_STYLES: Record<AttentionBudget, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-green-500',
}

// ─── Sub-score ring ───────────────────────────────────────────────────────────
function SubScore({ label, value }: { label: string; value: number }) {
  const r    = 11
  const circ = 2 * Math.PI * r
  const fill = (value / 100) * circ
  const color = value >= 80 ? '#16a34a' : value >= 55 ? '#d97706' : '#dc2626'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div style={{ width: 30, height: 30, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={30} height={30} viewBox="0 0 30 30" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={15} cy={15} r={r} fill="none" stroke="#e5e7eb" strokeWidth={2} />
          <circle cx={15} cy={15} r={r} fill="none" stroke={color} strokeWidth={2}
            strokeDasharray={`${fill.toFixed(1)} ${circ.toFixed(1)}`} strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 9, fontWeight: 700, position: 'relative', zIndex: 1 }}>{value}</span>
      </div>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.3px', color: '#6b7280', fontWeight: 600 }}>{label}</span>
    </div>
  )
}

// ─── BoardCard ────────────────────────────────────────────────────────────────
interface BoardCardProps {
  item: BoardItem
  onFeedback: (itemId: string, feedback: 'helpful' | 'not_helpful') => Promise<void>
  // Explore & Expand renders through this same component — just with a
  // visually quieter treatment (no top-pick gradient, lighter border) so it
  // reads as secondary-but-alive rather than identical to the Weekly Brief.
  // Content, expand/collapse, feedback and links behave identically either way.
  secondary?: boolean
}

export function BoardCard({ item, onFeedback, secondary = false }: BoardCardProps) {
  const { lang, t } = useLanguage()
  const [expanded,  setExpanded]  = useState(false)
  const [feedback,  setFeedback]  = useState(item.feedback ?? null)
  const [loading,   setLoading]   = useState(false)

  const handleFeedback = useCallback(async (type: 'helpful' | 'not_helpful') => {
    const next = feedback === type ? null : type
    setFeedback(next as typeof feedback)
    if (!next) return
    setLoading(true)
    try {
      await onFeedback(item.id, next)
    } finally {
      setLoading(false)
    }
  }, [feedback, item.id, onFeedback])

  // Card badge shows the Life Domain group (Career & Business / Technology /
  // Investing & Finance / ...), never the granular internal specialist
  // (e.g. "AI / Tech", "Programming") — per the product directive
  // "Specialists help discovery. Domains organize life." The specific
  // specialist is still one hover away (title attribute below) so it isn't
  // hidden entirely, just no longer the headline label every card leads with.
  const domainGroup = getLifeDomainGroup(item.domain)
  const domainLabel = domainGroup.label[lang]
  const domainColors = getDomainColorClasses(domainGroup.color)
  const specialistName = getDomainLabel(item.domain, lang)

  // Items the Judgment Engine scored highest (LVS >= 80, same threshold
  // LVSRing already uses for its "green" tier) get a visibly stronger
  // card treatment — this is the "make important items stand out"
  // requirement, expressed as a border/shadow/background shift rather
  // than a new badge, so no extra copy or i18n key is needed. Explore &
  // Expand cards (secondary) never get this premium treatment — they
  // should read as secondary, even for an individually high-LVS item.
  const isTopPick = !secondary && item.lvs >= 80

  // Card border/background is keyed off the item's own Life Domain color
  // (domainColors), not a universal indigo/emerald scheme — this is what
  // restores visible differentiation between e.g. a Technology card and a
  // Real Estate card. Weekly Brief top picks additionally get a subtle
  // domain-tinted gradient wash ("premium"); Explore & Expand gets the
  // lighter/default border weight ("secondary but still alive").
  const cardShellClasses = expanded
    ? clsx('bg-white shadow-md', domainColors.borderStrong)
    : isTopPick
    ? clsx('bg-gradient-to-b to-white shadow-sm hover:shadow-md', domainColors.soft, domainColors.borderStrong)
    : secondary
    ? clsx('bg-white/80 shadow-none hover:shadow-sm', domainColors.border)
    : clsx('bg-white shadow-sm hover:shadow-md', domainColors.borderStrong)

  return (
    <div
      className={clsx(
        'flex flex-col border rounded-2xl overflow-hidden transition-all duration-150',
        cardShellClasses
      )}
    >
      {/* Attention stripe */}
      <div className={clsx('h-1', STRIPE_STYLES[item.attention_budget])} />

      {/* Main body */}
      <div
        className="p-3.5 cursor-pointer select-none flex-1"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-2.5">
          {/* Domain icon (Life Domain group icon, not the specialist's) */}
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5', domainColors.bg)}>
            {domainGroup.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500" title={specialistName}>
                {domainLabel}
              </span>
              {item.category && (
                <span className={clsx('text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full', CATEGORY_STYLES[item.category])}>
                  {CATEGORY_ICONS[item.category]} {t(`category.${item.category}`)}
                </span>
              )}
              <span
                className={clsx('text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full cursor-help', BUDGET_STYLES[item.attention_budget])}
                title={t('tooltip.attentionBudget')}
              >
                {t(`budget.${item.attention_budget}`)}
              </span>
              {item.source_links && item.source_links.length > 1 && (
                <span
                  className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 cursor-help"
                  title={t('tooltip.multiSource')}
                >
                  🔗 {t('card.multiSource', { n: item.source_links.length })}
                </span>
              )}
              {/* Collapsed-card meta: source name + age in one compact line,
                  per the simplified-card spec (Domain/category, Title,
                  summary, Attention/LVS, Source + age, Expand) — replaces
                  the date-only badge that used to omit the source name. */}
              <span className="text-[10.5px] text-gray-500 font-medium">
                {cleanSourceName(item.source)}
                {item.published_at && <> · {formatPublished(item.published_at, lang)}</>}
              </span>
              {item.is_older && (
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500" title={t('card.olderItem')}>
                  ⏳ {t('card.olderItem')}
                </span>
              )}
            </div>
            <p className="text-[14.5px] font-semibold text-gray-900 leading-snug mb-1">
              {item.title}
            </p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed">
              {item.why_seeing}
            </p>
          </div>

          {/* LVS + toggle — compact ("sm") in the collapsed card per the
              simplified-card spec: collapsed shows the attention badge +
              this single LVS number, not the full labeled ring (that
              stays full-size only inside the expanded panel, alongside
              the 4 sub-score rings). */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <LVSRing score={item.lvs} size="sm" />
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="text-gray-400 hover:text-gray-700 text-xs px-1 py-0.5 rounded hover:bg-gray-100 transition-colors"
            >
              {expanded ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 p-3.5">
          {/* Why this week — ties the card back to the weekly-brief framing
              instead of reading like a timeless feed item */}
          {item.why_this_week && (
            <div className="bg-amber-50/70 border border-amber-100 rounded-lg p-2.5 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">{t('card.whyThisWeek')}</p>
              <p className="text-[12.5px] text-gray-800 leading-relaxed">{item.why_this_week}</p>
            </div>
          )}

          {/* Market Signals disclaimer — always visible, never collapsible,
              on every item in the experimental research-signal domain */}
          {item.category === 'Market' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mb-3 flex items-start gap-2">
              <span className="text-sm flex-shrink-0">⚠️</span>
              <p className="text-[12px] text-red-700 font-medium leading-relaxed">{t('market.disclaimer')}</p>
            </div>
          )}

          {/* Placement reason — Part 5/6 requirement: every item (primary or
              secondary) explains why it sits where it does this run, not
              just why it was surfaced at all. Visually muted/secondary
              since why_seeing/why_matters are the headline explanations. */}
          {item.placement_reason && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 mb-3 flex items-start gap-2">
              <span className="text-[11px] flex-shrink-0">📍</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1 cursor-help inline-block" title={t('tooltip.placementReason')}>{t('card.placementReason')}</p>
                <p className="text-[12px] text-gray-600 leading-relaxed">{item.placement_reason}</p>
              </div>
            </div>
          )}

          {/* Why it matters + sub-scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <div className="bg-indigo-50/60 rounded-lg p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-1">{t('card.whyMatters')}</p>
              <p className="text-[12.5px] text-gray-800 leading-relaxed">{item.why_matters}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">{t('card.subScores')}</p>
              <div className="flex gap-2 flex-wrap">
                <SubScore label={t('card.relevance')} value={item.relevance} />
                <SubScore label={t('card.impact')}    value={item.impact} />
                <SubScore label={t('card.urgency')}   value={item.urgency} />
                <SubScore label={t('card.novelty')}   value={item.novelty} />
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg p-2.5 flex items-center justify-between mb-3 cursor-pointer hover:from-indigo-500 hover:to-violet-500 transition-colors">
            <span className="text-[12.5px] font-medium">→ {item.action}</span>
            <span className="text-[10.5px] text-indigo-100 ms-2 flex-shrink-0">{t('card.recommended')}</span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            {item.source_links && item.source_links.length > 1 ? (
              <span className="text-[11.5px] text-gray-500 flex items-center gap-1 flex-wrap">
                <span className="font-semibold text-gray-500">{t('card.sources')}:</span>
                {item.source_links.map((link, i) => (
                  <span key={i} className="flex items-center">
                    {link.url ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-blue-600 font-medium hover:underline"
                      >
                        {sourceActionLabel(link.label, lang)} ↗
                      </a>
                    ) : (
                      <span>{link.label}</span>
                    )}
                    {i < item.source_links!.length - 1 && <span className="text-gray-300 mx-1">·</span>}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-[11.5px] text-gray-500">
                {item.source_url ? (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-600 font-medium hover:underline"
                  >
                    📡 {sourceActionLabel(item.source, lang)} ↗
                  </a>
                ) : (
                  <>📡 {item.source}</>
                )}
              </span>
            )}
            <div className="flex gap-1.5">
              <button
                onClick={e => { e.stopPropagation(); handleFeedback('helpful') }}
                disabled={loading}
                className={clsx(
                  'text-[11.5px] px-2 py-1 rounded border transition-all',
                  feedback === 'helpful'
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {t('card.helpful')}
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleFeedback('not_helpful') }}
                disabled={loading}
                className={clsx(
                  'text-[11.5px] px-2 py-1 rounded border transition-all',
                  feedback === 'not_helpful'
                    ? 'bg-red-50 text-red-600 border-red-300'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {t('card.notHelpful')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
