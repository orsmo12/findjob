/**
 * Domain Registry
 *
 * Single source of truth for every domain Life Board can track. Adding a
 * brand-new domain in the future is just adding one entry to
 * DOMAIN_REGISTRY below — no other file needs to change. Icons, colors,
 * bilingual labels, default priority, and free discovery sources for that
 * domain all live in one place.
 *
 * Sources are restricted to genuinely free, no-key, no-paid-tier endpoints:
 * Hacker News (public Firebase API), GitHub Search API (unauthenticated),
 * arXiv (public API), Dev.to (public API), Reddit (public JSON feeds), and
 * public RSS feeds. No OpenAI, no paid service, no signup required.
 */

import type { Lang } from './i18n'

// ─── Color system ─────────────────────────────────────────────────────────────
// Tailwind needs literal class strings to appear somewhere in source to
// generate the CSS for them — so this table spells every class out fully.
// Picking a color for a domain is just picking a key into this table.

export type ColorName =
  | 'blue' | 'purple' | 'sky' | 'orange' | 'emerald' | 'amber' | 'red'
  | 'teal' | 'slate' | 'fuchsia' | 'rose' | 'pink' | 'green' | 'cyan'
  | 'lime' | 'zinc' | 'gray' | 'yellow'

export interface ColorClasses {
  bg: string           // soft icon/badge background
  text: string          // accent text
  border: string         // hover border
  ring: string            // focus ring
  dot: string              // status dot
  borderStrong: string      // always-visible card border (domain differentiation)
  soft: string               // gradient wash, e.g. for top-pick/premium card treatment
}

export const COLOR_CLASSES: Record<ColorName, ColorClasses> = {
  blue:     { bg: 'bg-blue-50',     text: 'text-blue-600',     border: 'border-blue-200',     ring: 'ring-blue-200',     dot: 'bg-blue-500',     borderStrong: 'border-blue-300',     soft: 'from-blue-50/60' },
  purple:   { bg: 'bg-purple-50',   text: 'text-purple-600',   border: 'border-purple-200',   ring: 'ring-purple-200',   dot: 'bg-purple-500',   borderStrong: 'border-purple-300',   soft: 'from-purple-50/60' },
  sky:      { bg: 'bg-sky-50',      text: 'text-sky-600',      border: 'border-sky-200',      ring: 'ring-sky-200',      dot: 'bg-sky-500',      borderStrong: 'border-sky-300',      soft: 'from-sky-50/60' },
  orange:   { bg: 'bg-orange-50',   text: 'text-orange-600',   border: 'border-orange-200',   ring: 'ring-orange-200',   dot: 'bg-orange-500',   borderStrong: 'border-orange-300',   soft: 'from-orange-50/60' },
  emerald:  { bg: 'bg-emerald-50',  text: 'text-emerald-600',  border: 'border-emerald-200',  ring: 'ring-emerald-200',  dot: 'bg-emerald-500',  borderStrong: 'border-emerald-300',  soft: 'from-emerald-50/60' },
  amber:    { bg: 'bg-amber-50',    text: 'text-amber-600',    border: 'border-amber-200',    ring: 'ring-amber-200',    dot: 'bg-amber-500',    borderStrong: 'border-amber-300',    soft: 'from-amber-50/60' },
  red:      { bg: 'bg-red-50',      text: 'text-red-600',      border: 'border-red-200',      ring: 'ring-red-200',      dot: 'bg-red-500',      borderStrong: 'border-red-300',      soft: 'from-red-50/60' },
  teal:     { bg: 'bg-teal-50',     text: 'text-teal-600',     border: 'border-teal-200',     ring: 'ring-teal-200',     dot: 'bg-teal-500',     borderStrong: 'border-teal-300',     soft: 'from-teal-50/60' },
  slate:    { bg: 'bg-slate-100',   text: 'text-slate-600',    border: 'border-slate-200',    ring: 'ring-slate-200',    dot: 'bg-slate-500',    borderStrong: 'border-slate-300',    soft: 'from-slate-50/60' },
  fuchsia:  { bg: 'bg-fuchsia-50',  text: 'text-fuchsia-600',  border: 'border-fuchsia-200',  ring: 'ring-fuchsia-200',  dot: 'bg-fuchsia-500',  borderStrong: 'border-fuchsia-300',  soft: 'from-fuchsia-50/60' },
  rose:     { bg: 'bg-rose-50',     text: 'text-rose-600',     border: 'border-rose-200',     ring: 'ring-rose-200',     dot: 'bg-rose-500',     borderStrong: 'border-rose-300',     soft: 'from-rose-50/60' },
  pink:     { bg: 'bg-pink-50',     text: 'text-pink-600',     border: 'border-pink-200',     ring: 'ring-pink-200',     dot: 'bg-pink-500',     borderStrong: 'border-pink-300',     soft: 'from-pink-50/60' },
  green:    { bg: 'bg-green-50',    text: 'text-green-600',    border: 'border-green-200',    ring: 'ring-green-200',    dot: 'bg-green-500',    borderStrong: 'border-green-300',    soft: 'from-green-50/60' },
  cyan:     { bg: 'bg-cyan-50',     text: 'text-cyan-600',     border: 'border-cyan-200',     ring: 'ring-cyan-200',     dot: 'bg-cyan-500',     borderStrong: 'border-cyan-300',     soft: 'from-cyan-50/60' },
  lime:     { bg: 'bg-lime-50',     text: 'text-lime-700',     border: 'border-lime-200',     ring: 'ring-lime-200',     dot: 'bg-lime-500',     borderStrong: 'border-lime-300',     soft: 'from-lime-50/60' },
  zinc:     { bg: 'bg-zinc-100',    text: 'text-zinc-600',     border: 'border-zinc-200',     ring: 'ring-zinc-200',     dot: 'bg-zinc-500',     borderStrong: 'border-zinc-300',     soft: 'from-zinc-50/60' },
  gray:     { bg: 'bg-gray-100',    text: 'text-gray-600',     border: 'border-gray-200',     ring: 'ring-gray-200',     dot: 'bg-gray-400',     borderStrong: 'border-gray-300',     soft: 'from-gray-50/60' },
  yellow:   { bg: 'bg-yellow-50',   text: 'text-yellow-700',   border: 'border-yellow-200',   ring: 'ring-yellow-200',   dot: 'bg-yellow-500',   borderStrong: 'border-yellow-300',   soft: 'from-yellow-50/60' },
}

const FALLBACK_COLOR: ColorClasses = COLOR_CLASSES.gray

// ─── Source configs (free, no-key only) ────────────────────────────────────────

export type SourceConfig =
  | { type: 'hn'; keywords: string[] }
  | { type: 'reddit'; subreddits: string[] }
  | { type: 'github_search'; query: string }
  | { type: 'arxiv'; query: string }
  | { type: 'devto'; tag: string }
  | { type: 'rss'; url: string; label: string }
  | { type: 'coingecko' } // Free, no-key trending-search endpoint — see src/sources/adapters/coingecko-source.ts

// ─── Domain definition ─────────────────────────────────────────────────────────

// The 4 active MVP agent ids. A domain tagged with one of these runs through
// the new real source-driven pipeline (src/pipeline + src/agents) instead of
// the generic fetch-and-judge path. Domains with no mvpAgent are not
// being de-supported — they stay fully selectable in onboarding/profile and
// still produce real board items via the existing generic agent path. They're
// simply not part of the narrow, deeply-built MVP yet (see planned-agents.ts).
// 'market_signals' is the 5th, experimental agent — see market-signals-agent.ts.
export type MvpAgentId = 'dev_opportunities' | 'ai_trends' | 'project_ideas' | 'career_signals' | 'market_signals'

export interface DomainDef {
  id: string
  icon: string
  color: ColorName
  label: { en: string; he: string }
  defaultPriority: number // 1-10, suggested starting score
  sources: SourceConfig[]
  mvpAgent?: MvpAgentId
  // Marks a domain as secondary/experimental — kept out of the main MVP
  // focus (students/junior devs/developers/AI builders/career signals) and
  // surfaced with extra care. Currently only true for 'market_signals'.
  experimental?: boolean
}

const AI_TECH_KEYWORDS = [
  'ai', 'llm', 'gpt', 'openai', 'anthropic', 'claude', 'gemini', 'copilot',
  'machine learning', 'neural', 'transformer', 'agent', 'model', 'inference',
]

// ─── The registry ──────────────────────────────────────────────────────────────
// This list is a starter set, not a ceiling — add an entry here and the rest
// of the app (icons, colors, labels, sidebar, board, onboarding, agents)
// picks it up automatically. Nothing elsewhere is hardcoded to this list.

export const DOMAIN_REGISTRY: DomainDef[] = [
  {
    id: 'career', icon: '💼', color: 'blue',
    label: { en: 'Career', he: 'קריירה' }, defaultPriority: 8,
    sources: [{ type: 'hn', keywords: ['hiring', 'who is hiring', 'job', 'remote work', 'salary'] }],
    mvpAgent: 'career_signals',
  },
  {
    id: 'ai_tech', icon: '🤖', color: 'purple',
    label: { en: 'AI / Tech', he: 'AI וטכנולוגיה' }, defaultPriority: 9,
    sources: [
      { type: 'hn', keywords: AI_TECH_KEYWORDS },
      { type: 'rss', url: 'https://techcrunch.com/feed/', label: 'TechCrunch' },
    ],
    mvpAgent: 'ai_trends',
  },
  {
    id: 'programming', icon: '💻', color: 'sky',
    label: { en: 'Programming', he: 'תכנות' }, defaultPriority: 7,
    sources: [
      { type: 'github_search', query: 'topic:programming' },
      { type: 'devto', tag: 'programming' },
    ],
    mvpAgent: 'dev_opportunities',
  },
  {
    id: 'startups', icon: '🚀', color: 'orange',
    label: { en: 'Startups', he: 'סטארטאפים' }, defaultPriority: 6,
    sources: [
      { type: 'rss', url: 'https://www.ycombinator.com/blog/rss', label: 'Y Combinator' },
      { type: 'hn', keywords: ['startup', 'funding', 'raised', 'seed round', 'series a', 'y combinator'] },
    ],
    mvpAgent: 'project_ideas',
  },
  {
    id: 'investing', icon: '📈', color: 'emerald',
    label: { en: 'Investing', he: 'השקעות' }, defaultPriority: 8,
    sources: [{ type: 'reddit', subreddits: ['investing', 'stocks'] }],
  },
  {
    // Experimental, secondary domain — deliberately NOT named "trading" or
    // "investment recommendations." Surfaces market research signals worth
    // looking into; never a buy/sell call, price target, or portfolio
    // suggestion. Every card in this domain carries a visible non-advice
    // disclaimer (see BoardCard.tsx / market-signals-agent.ts). Kept out of
    // the core MVP focus — low default priority, experimental: true.
    id: 'market_signals', icon: '📊', color: 'teal',
    label: { en: 'Market Signals (Experimental)', he: 'סיגנלי שוק (ניסיוני)' }, defaultPriority: 3,
    sources: [
      { type: 'coingecko' },
      { type: 'rss', url: 'https://www.federalreserve.gov/feeds/press_all.xml', label: 'Federal Reserve' },
      { type: 'rss', url: 'https://www.sec.gov/news/pressreleases.rss', label: 'SEC Press Releases' },
      { type: 'hn', keywords: ['stock market', 'federal reserve', 'interest rates', 'inflation', 'sec filing', 'earnings', 'ipo', 'crypto', 'bitcoin', 'etf', 'recession'] },
    ],
    mvpAgent: 'market_signals',
    experimental: true,
  },
  {
    id: 'real_estate', icon: '🏠', color: 'amber',
    label: { en: 'Real Estate', he: 'נדל״ן' }, defaultPriority: 7,
    sources: [{ type: 'reddit', subreddits: ['realestate', 'RealEstateInvesting'] }],
  },
  {
    id: 'sports', icon: '⚽', color: 'red',
    label: { en: 'Sports', he: 'ספורט' }, defaultPriority: 2,
    sources: [{ type: 'reddit', subreddits: ['sports', 'soccer'] }],
  },
  {
    id: 'travel', icon: '✈️', color: 'teal',
    label: { en: 'Travel', he: 'טיולים' }, defaultPriority: 4,
    sources: [{ type: 'reddit', subreddits: ['travel', 'solotravel'] }],
  },
  {
    id: 'cars', icon: '🚗', color: 'slate',
    label: { en: 'Cars', he: 'רכבים' }, defaultPriority: 4,
    sources: [{ type: 'reddit', subreddits: ['cars', 'whatcarshouldIbuy'] }],
  },
  {
    id: 'gaming', icon: '🎮', color: 'fuchsia',
    label: { en: 'Gaming', he: 'גיימינג' }, defaultPriority: 4,
    sources: [{ type: 'reddit', subreddits: ['gaming', 'pcgaming'] }],
  },
  {
    id: 'health_fitness', icon: '💪', color: 'rose',
    label: { en: 'Health & Fitness', he: 'בריאות וכושר' }, defaultPriority: 6,
    sources: [{ type: 'reddit', subreddits: ['Fitness', 'health'] }],
  },
  {
    id: 'entrepreneurship', icon: '🧭', color: 'pink',
    label: { en: 'Entrepreneurship', he: 'יזמות' }, defaultPriority: 6,
    sources: [{ type: 'reddit', subreddits: ['Entrepreneur', 'smallbusiness'] }],
    mvpAgent: 'project_ideas',
  },
  {
    id: 'personal_finance', icon: '💰', color: 'green',
    label: { en: 'Personal Finance', he: 'פיננסים אישיים' }, defaultPriority: 6,
    sources: [{ type: 'reddit', subreddits: ['personalfinance', 'financialindependence'] }],
  },
  {
    id: 'education', icon: '📚', color: 'cyan',
    label: { en: 'Education', he: 'חינוך ולמידה' }, defaultPriority: 7,
    sources: [
      { type: 'devto', tag: 'education' },
      { type: 'reddit', subreddits: ['education'] },
    ],
  },
  {
    id: 'science', icon: '🔬', color: 'lime',
    label: { en: 'Science', he: 'מדע' }, defaultPriority: 5,
    sources: [{ type: 'arxiv', query: '(cat:physics.gen-ph OR cat:q-bio.NC OR cat:astro-ph.GA OR cat:cond-mat.mtrl-sci)' }],
  },
  {
    id: 'cybersecurity', icon: '🛡️', color: 'zinc',
    label: { en: 'Cybersecurity', he: 'אבטחת מידע' }, defaultPriority: 5,
    sources: [
      { type: 'hn', keywords: ['security', 'vulnerability', 'breach', 'cve', 'exploit', 'ransomware'] },
      { type: 'reddit', subreddits: ['cybersecurity', 'netsec'] },
    ],
  },
  {
    id: 'open_source', icon: '🧩', color: 'gray',
    label: { en: 'Open Source', he: 'קוד פתוח' }, defaultPriority: 5,
    sources: [
      { type: 'github_search', query: 'topic:open-source' },
      { type: 'hn', keywords: ['open source', 'open-source'] },
    ],
    mvpAgent: 'dev_opportunities',
  },
  {
    id: 'local_events', icon: '📍', color: 'yellow',
    label: { en: 'Local Events', he: 'אירועים מקומיים' }, defaultPriority: 3,
    sources: [], // No free, no-key, location-aware event API exists — honest gap, not faked.
  },
]

// ─── Life Domains (the only top-level structure users see) ────────────────────
// This is the product's real information architecture. A user never sees
// "AI Agent," "Programming Agent," or any of the granular DOMAIN_REGISTRY
// ids directly — they see one of these 7 named Life Domains, or Custom.
// Internally, each Life Domain is staffed by one or more "specialists"
// (the granular DOMAIN_REGISTRY entries below, e.g. ai_tech, programming,
// career), and each specialist pulls from named sources (GitHub, Hacker
// News, arXiv, CoinGecko, RSS, Reddit, ...). Sources are not agents and
// agents are not domains — the pipeline is Source → Specialist → Domain →
// Judgment Engine → Memory Engine → Weekly Brief / Explore & Expand.
// Any domain not explicitly mapped below falls into the dynamic "Custom"
// catch-all group rather than being hidden or throwing.

export type LifeDomainGroupId =
  | 'career_business' | 'technology' | 'investing_finance' | 'real_estate'
  | 'sports' | 'travel' | 'health_fitness' | 'custom'

export interface LifeDomainGroupDef {
  id: LifeDomainGroupId
  icon: string
  color: ColorName
  label: { en: string; he: string }
}

export const LIFE_DOMAIN_GROUPS: LifeDomainGroupDef[] = [
  { id: 'career_business',    icon: '💼', color: 'blue',   label: { en: 'Career & Business',     he: 'קריירה ועסקים' } },
  { id: 'technology',         icon: '🤖', color: 'purple', label: { en: 'Technology',             he: 'טכנולוגיה' } },
  { id: 'investing_finance',  icon: '📈', color: 'green',  label: { en: 'Investing & Finance',    he: 'השקעות ופיננסים' } },
  { id: 'real_estate',        icon: '🏠', color: 'orange', label: { en: 'Real Estate',            he: 'נדל״ן' } },
  { id: 'sports',             icon: '⚽', color: 'sky',    label: { en: 'Sports',                 he: 'ספורט' } },
  { id: 'travel',             icon: '✈️', color: 'teal',   label: { en: 'Travel',                 he: 'טיולים' } },
  { id: 'health_fitness',     icon: '💪', color: 'rose',   label: { en: 'Health & Fitness',       he: 'בריאות וכושר' } },
  { id: 'custom',             icon: '🧩', color: 'gray',   label: { en: 'Custom',                 he: 'מותאם אישית' } },
]

// Maps each granular DOMAIN_REGISTRY specialist into the one Life Domain
// the user actually sees it under. Career/Jobs/Startups/Entrepreneurship ->
// Career & Business; AI/Programming/Open Source/Science/Cybersecurity/
// Education -> Technology; Markets/Economy/Personal Finance -> Investing &
// Finance; etc. Anything not listed here (cars, gaming, local_events, and
// any future ad-hoc specialist) reads as "custom" via the fallback below
// rather than being force-fit into one of the 7 named domains.
const DOMAIN_TO_GROUP: Record<string, LifeDomainGroupId> = {
  career: 'career_business',
  startups: 'career_business',
  entrepreneurship: 'career_business',

  ai_tech: 'technology',
  programming: 'technology',
  open_source: 'technology',
  science: 'technology',
  cybersecurity: 'technology',
  education: 'technology',

  investing: 'investing_finance',
  personal_finance: 'investing_finance',
  market_signals: 'investing_finance',

  real_estate: 'real_estate',

  sports: 'sports',

  travel: 'travel',

  health_fitness: 'health_fitness',

  // Everything else (cars, gaming, local_events, and any future ad-hoc
  // specialist) reads as "custom" via the fallback below rather than
  // being force-fit into one of the 7 named domains.
}

export function getLifeDomainGroupId(domainId: string): LifeDomainGroupId {
  return DOMAIN_TO_GROUP[domainId] ?? 'custom'
}

export function getLifeDomainGroup(domainId: string): LifeDomainGroupDef {
  const id = getLifeDomainGroupId(domainId)
  return LIFE_DOMAIN_GROUPS.find(g => g.id === id) ?? LIFE_DOMAIN_GROUPS[LIFE_DOMAIN_GROUPS.length - 1]
}

// Groups the *active* domains (from DomainPriority[]-derived ids) under
// their Life Domain, dropping empty groups — used by Profile / Sidebar to
// show "Technology (3) · Career (1)" instead of a flat list.
export function groupDomainsByLifeDomain(domainIds: string[]): { group: LifeDomainGroupDef; domainIds: string[] }[] {
  const byGroup = new Map<LifeDomainGroupId, string[]>()
  for (const id of domainIds) {
    const groupId = getLifeDomainGroupId(id)
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), id])
  }
  return LIFE_DOMAIN_GROUPS
    .filter(g => byGroup.has(g.id))
    .map(g => ({ group: g, domainIds: byGroup.get(g.id)! }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getDomain(id: string): DomainDef {
  return DOMAIN_REGISTRY.find(d => d.id === id) ?? {
    id, icon: '📌', color: 'gray',
    label: { en: id, he: id },
    defaultPriority: 5,
    sources: [],
  }
}

export function getDomainLabel(id: string, lang: Lang): string {
  return getDomain(id).label[lang]
}

export function getDomainIcon(id: string): string {
  return getDomain(id).icon
}

export function getDomainColorClasses(idOrColor: string): ColorClasses {
  // Accepts either a domain id or a raw color name for flexibility.
  if (idOrColor in COLOR_CLASSES) return COLOR_CLASSES[idOrColor as ColorName]
  const domain = DOMAIN_REGISTRY.find(d => d.id === idOrColor)
  return domain ? COLOR_CLASSES[domain.color] : FALLBACK_COLOR
}

// Internal specialist label for a granular domain (e.g. "Programming
// Specialist" / "מומחה תכנות") — never a top-level UI label. Used only in
// low-visibility internal contexts (Sidebar tooltips, backend prompt
// text). Cards and primary navigation must show the Life Domain (see
// getLifeDomainGroup) and source name instead — never this.
export function specialistLabel(domainId: string, lang: Lang): string {
  const d = getDomain(domainId)
  return lang === 'he' ? `מומחה ${d.label.he}` : `${d.label.en} Specialist`
}

// Which real MVP agent (if any) owns this domain. Used by the pipeline to
// decide whether an active domain runs through the new agent pipeline
// (src/agents + src/pipeline) or the generic fetch-and-judge path.
export function getMvpAgentForDomain(domainId: string): MvpAgentId | undefined {
  return getDomain(domainId).mvpAgent
}

// Human-readable label for a single source config — used by the Profile
// page's Data Sources panel so it always reflects what's actually wired up
// in domain-agents.ts instead of a hand-maintained, easily-stale list.
export function sourceLabel(s: SourceConfig): string {
  switch (s.type) {
    case 'hn':            return 'Hacker News'
    case 'reddit':         return `Reddit (${s.subreddits.map(sr => `r/${sr}`).join(', ')})`
    case 'github_search':   return 'GitHub Search'
    case 'arxiv':             return 'arXiv'
    case 'devto':              return 'Dev.to'
    case 'rss':                  return s.label
    case 'coingecko':              return 'CoinGecko'
  }
}
