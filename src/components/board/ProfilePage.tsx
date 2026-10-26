'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { DomainPriority, LifeGoal } from '@/types'
import { useLanguage } from '@/lib/language-context'
import { DOMAIN_REGISTRY, getDomainIcon, getDomainLabel, getDomainColorClasses, sourceLabel, groupDomainsByLifeDomain } from '@/lib/domains'

interface ProfilePageProps {
  priorities: DomainPriority[]
  onPrioritiesChange: (p: DomainPriority[]) => void
  goals: LifeGoal[]
}

export function ProfilePage({ priorities, onPrioritiesChange, goals }: ProfilePageProps) {
  const { lang, t } = useLanguage()
  const [saved, setSaved] = useState(false)

  function adjustPriority(domain: string, delta: number) {
    onPrioritiesChange(priorities.map(p =>
      p.domain === domain
        ? { ...p, score: Math.max(1, Math.min(10, p.score + delta)) }
        : p
    ))
  }

  // Lets the user turn any registry domain on/off right from the profile —
  // the same mechanism onboarding uses, so "choose any domain" isn't a
  // one-time setup step. Falls back to creating a fresh priority entry if
  // one somehow doesn't exist yet for a domain (shouldn't happen since
  // mock-data seeds every registry domain, but keeps this resilient).
  function toggleActive(domainId: string) {
    const exists = priorities.some(p => p.domain === domainId)
    if (exists) {
      onPrioritiesChange(priorities.map(p => p.domain === domainId ? { ...p, active: !p.active } : p))
    } else {
      const def = DOMAIN_REGISTRY.find(d => d.id === domainId)
      onPrioritiesChange([
        ...priorities,
        { id: crypto.randomUUID(), user_id: 'mock', domain: domainId, score: def?.defaultPriority ?? 5, active: true },
      ])
    }
  }

  async function handleSave() {
    try {
      await fetch('/api/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priorities }),
      })
    } catch {
      // Best-effort persistence in mock mode — UI already reflects the change.
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const priorityByDomain = new Map(priorities.map(p => [p.domain, p]))

  // The full specialist list (active + inactive, for the "+ Add" rows too)
  // grouped under its Life Domain — mirrors the Sidebar and the Onboarding
  // picker so a specialist is never presented as a flat, unstructured list
  // anywhere in the product. Within each group, active specialists sort to
  // the top by score, same ordering as before the regrouping.
  const allGroupedDomains = groupDomainsByLifeDomain(DOMAIN_REGISTRY.map(d => d.id))
    .map(({ group, domainIds }) => ({
      group,
      domainIds: [...domainIds].sort((a, b) => {
        const pa = priorityByDomain.get(a)
        const pb = priorityByDomain.get(b)
        const aActive = pa?.active ?? false
        const bActive = pb?.active ?? false
        if (aActive !== bActive) return aActive ? -1 : 1
        return (pb?.score ?? 0) - (pa?.score ?? 0)
      }),
    }))

  const activeDomainDefs = priorities
    .filter(p => p.active)
    .map(p => DOMAIN_REGISTRY.find(d => d.id === p.domain))
    .filter((d): d is NonNullable<typeof d> => !!d)

  const sourceEntries = Array.from(
    new Set(activeDomainDefs.flatMap(d => d.sources.map(sourceLabel)))
  ).sort()

  // Same grouping used in the Sidebar — broad Life Domains rolled
  // up from the granular registry domains, so Profile and Sidebar agree on
  // structure instead of presenting two different taxonomies.
  const groupedDomains = groupDomainsByLifeDomain(activeDomainDefs.map(d => d.id))

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Topbar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-5 py-3 flex items-center">
        <span className="text-[14.5px] font-semibold text-gray-900">{t('profile.title')}</span>
        <button
          onClick={handleSave}
          className="ms-auto text-[12px] px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 transition-colors"
        >
          {saved ? t('profile.saved') : t('profile.save')}
        </button>
      </div>

      <div className="p-5 max-w-lg">

        {/* Identity */}
        <Section title={t('profile.identity')}>
          {[
            { label: t('profile.name'),       value: t('sidebar.userName') },
            { label: t('profile.age'),        value: '28' },
            { label: t('profile.profession'), value: t('profile.professionValue') },
            { label: t('profile.skills'),     value: t('profile.skillsValue') },
            { label: t('profile.location'),   value: t('profile.locationValue') },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-[12px] text-gray-400 min-w-[100px]">{r.label}</span>
              <span className="text-[13px] font-medium text-gray-900">{r.value}</span>
            </div>
          ))}
        </Section>

        {/* Life Domains — the broad groups (Career / Technology /
            Business / ... ) the granular priorities below roll up into.
            Mirrors the Sidebar grouping so the two surfaces agree. */}
        <Section title={t('profile.lifeDomains')} subtitle={t('profile.lifeDomainsSub')}>
          {groupedDomains.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-gray-400">{t('profile.noActiveSources')}</div>
          ) : (
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {groupedDomains.map(({ group, domainIds }) => {
                const colors = getDomainColorClasses(group.color)
                return (
                  <span
                    key={group.id}
                    className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] font-semibold', colors.bg, colors.text)}
                  >
                    <span>{group.icon}</span>
                    <span>{group.label[lang]}</span>
                    <span className="opacity-60 font-medium">· {domainIds.length}</span>
                  </span>
                )
              })}
            </div>
          )}
        </Section>

        {/* Domain Priorities — each score gets a 10-segment visual scale
            (color shifts gray → amber → emerald as it climbs) with
            Irrelevant/Extremely important anchor labels, so 0-10 is legible
            at a glance instead of requiring the reader to parse a number. */}
        <Section title={t('profile.domainPriorities')} subtitle={t('profile.domainPrioritiesSub')}>
          {allGroupedDomains.map(({ group, domainIds }) => (
            <div key={group.id}>
              {/* Group header — same Life Domain grouping as the Sidebar and
                  Onboarding picker, so this management surface doesn't present
                  specialists as a flat, unstructured list either. */}
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 bg-gray-50/60">
                <span className="text-[11px] leading-none">{group.icon}</span>
                <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wide">{group.label[lang]}</span>
              </div>
              {domainIds.map(id => {
                const p = priorityByDomain.get(id)
                if (!p || !p.active) {
                  return (
                    <div key={id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0 opacity-50 hover:opacity-90 transition-opacity">
                      <span className="text-base w-5 text-center">{getDomainIcon(id)}</span>
                      <span className="text-[12.5px] text-gray-500 flex-1">{getDomainLabel(id, lang)}</span>
                      <button
                        onClick={() => toggleActive(id)}
                        className="text-[11px] px-2.5 py-1 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        {t('profile.addDomain')}
                      </button>
                    </div>
                  )
                }
                return (
                  <div key={id} className="flex flex-col gap-1.5 px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-base w-5 text-center flex-shrink-0">{getDomainIcon(id)}</span>
                      <span className="text-[12.5px] font-medium text-gray-700 flex-1 truncate">
                        {getDomainLabel(id, lang)}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => adjustPriority(id, -1)}
                          className="w-6 h-6 rounded border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-xs transition-colors"
                        >−</button>
                        <span className={clsx(
                          'text-[12px] font-bold w-5 text-center',
                          p.score >= 8 ? 'text-emerald-600' : p.score >= 5 ? 'text-amber-600' : 'text-rose-500'
                        )}>{p.score}</span>
                        <button
                          onClick={() => adjustPriority(id, +1)}
                          className="w-6 h-6 rounded border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-xs transition-colors"
                        >+</button>
                        <button
                          onClick={() => toggleActive(id)}
                          title={t('profile.remove')}
                          className="w-6 h-6 rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-xs transition-colors"
                        >✕</button>
                      </div>
                    </div>

                    {/* Visual scale: 10 discrete segments, filled left-to-right
                        (or right-to-left in RTL, automatically, since this is a
                        flex row laid out in logical document order) up to the
                        score, color-coded by tier. */}
                    <div className="flex items-center gap-2 ps-8">
                      <div className="flex-1 flex gap-[3px]">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            className={clsx(
                              'h-[7px] flex-1 rounded-full transition-colors',
                              i < p.score
                                ? p.score >= 8 ? 'bg-emerald-500' : p.score >= 5 ? 'bg-amber-500' : 'bg-rose-400'
                                : 'bg-gray-100'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between ps-8 text-[9.5px] text-gray-300 font-medium">
                      <span>{t('profile.priorityScaleLow')}</span>
                      <span>{t('profile.priorityScaleHigh')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </Section>

        {/* Active Goals */}
        <Section title={t('profile.activeGoals')}>
          {goals.map(g => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-green-500 text-sm">✓</span>
              <span className="text-[12.5px] text-gray-800">{g.text}</span>
              <span className="ms-auto text-[9.5px] text-gray-400">{getDomainLabel(g.domain, lang)}</span>
            </div>
          ))}
          <div className="px-4 py-2.5">
            <button className="text-[12px] text-indigo-500 hover:text-indigo-700 transition-colors">
              {t('profile.addGoal')}
            </button>
          </div>
        </Section>

        {/* Data Sources — derived live from the registry's active domains,
            so this list can never drift out of sync with what domain-agents.ts
            actually fetches. */}
        <Section title={t('profile.dataSources')} subtitle={t('profile.dataSourcesSub')}>
          {sourceEntries.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-gray-400">{t('profile.noActiveSources')}</div>
          ) : (
            sourceEntries.map(label => (
              <div key={label} className="flex items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-sm me-2 text-green-500">✓</span>
                <span className="text-[12.5px] text-gray-700">{label}</span>
                <span className="ms-auto text-[11px] text-green-600 font-medium">{t('profile.connected')}</span>
              </div>
            ))
          )}
        </Section>

      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
      <div className="px-4 py-3 border-b border-gray-50 flex items-baseline gap-2">
        <span className="text-[12.5px] font-semibold text-gray-900">{title}</span>
        {subtitle && <span className="text-[11px] text-gray-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}
