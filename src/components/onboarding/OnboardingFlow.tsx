'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import type { DomainPriority } from '@/types'
import { useLanguage } from '@/lib/language-context'
import { DOMAIN_REGISTRY, getDomainIcon, getDomainLabel, getDomainColorClasses, groupDomainsByLifeDomain } from '@/lib/domains'

type Tier = 'low' | 'medium' | 'high'

const TIER_SCORE: Record<Tier, number> = { low: 3, medium: 6, high: 9 }

function defaultTier(defaultPriority: number): Tier {
  if (defaultPriority >= 8) return 'high'
  if (defaultPriority >= 5) return 'medium'
  return 'low'
}

interface OnboardingFlowProps {
  onComplete: (priorities: DomainPriority[], goalText: string, primaryDomain?: string) => void
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { lang, t } = useLanguage()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [tier, setTier] = useState<Record<string, Tier>>(() =>
    Object.fromEntries(DOMAIN_REGISTRY.map(d => [d.id, defaultTier(d.defaultPriority)]))
  )
  const [goalText, setGoalText] = useState('')
  const [touched, setTouched] = useState(false)

  const selectedIds = useMemo(() => DOMAIN_REGISTRY.filter(d => selected[d.id]).map(d => d.id), [selected])

  // Directive: "Specialists help discovery. Domains organize life." — every
  // specialist in the registry is shown grouped under its Life Domain (the
  // same 8 top-level groups used in the Sidebar/Profile), instead of a flat
  // 19-tile grid with no structure. Computed once over the *full* registry
  // (not just selected ids), since this is the picker that builds the
  // selection in the first place.
  const allGroupedDomains = useMemo(
    () => groupDomainsByLifeDomain(DOMAIN_REGISTRY.map(d => d.id)),
    []
  )

  function toggleDomain(id: string) {
    setSelected(s => ({ ...s, [id]: !s[id] }))
  }

  function setDomainTier(id: string, tr: Tier) {
    setTier(t2 => ({ ...t2, [id]: tr }))
  }

  function handleSubmit() {
    if (selectedIds.length === 0) {
      setTouched(true)
      return
    }
    const priorities: DomainPriority[] = DOMAIN_REGISTRY.map((d, i) => {
      const isActive = !!selected[d.id]
      return {
        id: String(i + 1),
        user_id: 'mock',
        domain: d.id,
        score: isActive ? TIER_SCORE[tier[d.id]] : d.defaultPriority,
        active: isActive,
      }
    })
    onComplete(priorities, goalText, selectedIds[0])
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-2xl shadow-xl my-8">
        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-gray-50">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-indigo-200">
              LB
            </div>
            <span className="text-[15px] font-semibold text-gray-900 tracking-tight">{t('onboarding.welcomeTitle')}</span>
          </div>
          <p className="text-[13px] text-gray-500 leading-relaxed">{t('onboarding.welcomeSub')}</p>
        </div>

        <div className="px-7 py-6 space-y-7">
          {/* Interests */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-[13px] font-semibold text-gray-900">{t('onboarding.interestsTitle')}</h2>
              {selectedIds.length > 0 && (
                <span className="text-[11px] text-indigo-500 font-medium">{t('onboarding.selectedCount', { n: selectedIds.length })}</span>
              )}
            </div>
            <p className="text-[11.5px] text-gray-400 mb-3">{t('onboarding.interestsSub')}</p>
            <div className="space-y-4">
              {allGroupedDomains.map(({ group, domainIds }) => (
                <div key={group.id}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[12px] leading-none">{group.icon}</span>
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{group.label[lang]}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {domainIds.map(id => {
                      const isOn = !!selected[id]
                      const colors = getDomainColorClasses(id)
                      return (
                        <button
                          key={id}
                          onClick={() => toggleDomain(id)}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-xl border text-[12.5px] font-medium transition-all text-start',
                            isOn
                              ? clsx(colors.bg, colors.text, colors.border, 'shadow-sm ring-1', colors.ring)
                              : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                          )}
                        >
                          <span className="text-base flex-shrink-0">{getDomainIcon(id)}</span>
                          <span className="truncate">{getDomainLabel(id, lang)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {touched && selectedIds.length === 0 && (
              <p className="text-[11.5px] text-red-500 mt-2">{t('onboarding.selectAtLeastOne')}</p>
            )}
          </div>

          {/* Priority per selected domain */}
          {selectedIds.length > 0 && (
            <div>
              <h2 className="text-[13px] font-semibold text-gray-900 mb-3">{t('onboarding.priorityTitle')}</h2>
              <div className="space-y-1.5">
                {selectedIds.map(id => {
                  const d = DOMAIN_REGISTRY.find(x => x.id === id)!
                  return (
                    <div key={id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50/70">
                      <span className="text-base flex-shrink-0">{getDomainIcon(id)}</span>
                      <span className="text-[12.5px] text-gray-700 flex-1 truncate">{getDomainLabel(id, lang)}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(['low', 'medium', 'high'] as Tier[]).map(tr => (
                          <button
                            key={tr}
                            onClick={() => setDomainTier(id, tr)}
                            className={clsx(
                              'text-[10.5px] font-semibold px-2 py-1 rounded-md border transition-colors',
                              tier[id] === tr
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
                            )}
                          >
                            {t(`onboarding.${tr}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Optional goal */}
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900 mb-1">
              {t('onboarding.goalTitle')} <span className="text-[11px] text-gray-400 font-normal">({t('onboarding.goalOptional')})</span>
            </h2>
            <input
              type="text"
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              placeholder={t('onboarding.goalPlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-[13px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-gray-50 flex items-center justify-end">
          <button
            onClick={handleSubmit}
            className="text-[13px] font-medium px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-sm shadow-indigo-200 transition-all"
          >
            {t('onboarding.getStarted')}
          </button>
        </div>
      </div>
    </div>
  )
}
