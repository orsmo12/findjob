/**
 * Planned (inactive) agents.
 *
 * These describe future domains the architecture can support — Investing,
 * Real Estate, Sports, Health, Travel, Personal Finance, and others — but
 * that are intentionally NOT built deeply right now. The active MVP stays
 * narrow (4 agents, see base-agent.ts + the 4 concrete agent files) so it
 * can be validated with real student/developer users first.
 *
 * This file is descriptive only — it is not imported by the pipeline or
 * the UI. It exists so the next person extending Life Board can see what
 * was already considered and why, instead of re-deciding from scratch.
 * Turning one of these into a real agent means: write a concrete
 * AgentDefinition (see developer-opportunities-agent.ts for the pattern),
 * register its sources in source-registry.ts as 'active', and add an
 * mvpAgent mapping in domains.ts for the relevant domain(s).
 */

export interface PlannedAgent {
  id: string
  label: { en: string; he: string }
  domains: string[]
  status: 'planned'
  rationale: string
}

export const PLANNED_AGENTS: PlannedAgent[] = [
  {
    id: 'investing_signals',
    label: { en: 'Investing Signals Agent', he: 'סוכן איתותי השקעות' },
    domains: ['investing'],
    status: 'planned',
    rationale: 'Needs careful source vetting (market data APIs are mostly paid or rate-limited) and carries higher responsibility given financial stakes — out of scope for the validation MVP.',
  },
  {
    id: 'real_estate_signals',
    label: { en: 'Real Estate Agent', he: 'סוכן נדל"ן' },
    domains: ['real_estate'],
    status: 'planned',
    rationale: 'No strong free/no-key API found yet beyond Reddit discussion; needs more source research before it can be "real" per the agent definition.',
  },
  {
    id: 'sports_digest',
    label: { en: 'Sports Agent', he: 'סוכן ספורט' },
    domains: ['sports'],
    status: 'planned',
    rationale: 'Not part of the target user segments (students/developers/AI builders) for this validation round.',
  },
  {
    id: 'health_fitness_agent',
    label: { en: 'Health & Fitness Agent', he: 'סוכן בריאות וכושר' },
    domains: ['health_fitness'],
    status: 'planned',
    rationale: 'Outside the focused MVP segment; would also need more careful judgment-quality review given personal health stakes.',
  },
  {
    id: 'travel_agent',
    label: { en: 'Travel Agent', he: 'סוכן טיולים' },
    domains: ['travel'],
    status: 'planned',
    rationale: 'Not part of the target user segments for this validation round.',
  },
  {
    id: 'personal_finance_agent',
    label: { en: 'Personal Finance Agent', he: 'סוכן פיננסים אישיים' },
    domains: ['personal_finance'],
    status: 'planned',
    rationale: 'Adjacent to investing — same "needs careful source vetting before it counts as real" concern.',
  },
  {
    id: 'general_life_agent',
    label: { en: 'General Life Agent', he: 'סוכן חיים כלליים' },
    domains: ['local_events', 'cars', 'gaming', 'education', 'science', 'cybersecurity'],
    status: 'planned',
    rationale: 'Broad catch-all domains kept selectable in onboarding (the generic agent path still serves them) but not deepened into a dedicated real agent yet.',
  },
]

export function getPlannedAgentForDomain(domainId: string): PlannedAgent | undefined {
  return PLANNED_AGENTS.find(a => a.domains.includes(domainId))
}
