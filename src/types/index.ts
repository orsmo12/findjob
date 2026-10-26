// ─── User & Profile ───────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  name: string
  email: string
  age?: number
  location?: string
  profession?: string
  skills?: string[]
  created_at: string
  updated_at: string
}

export interface DomainPriority {
  id: string
  user_id: string
  domain: Domain
  score: number // 1–10
  active: boolean
}

// Domain is intentionally an open string type, backed by the domain
// registry in '@/lib/domains' (id/icon/color/label/sources per domain).
// This is what lets the product support unlimited future domains without
// touching this file again — add an entry to DOMAIN_REGISTRY, not here.
export type Domain = string

// ─── Life Goals ───────────────────────────────────────────────────────────────

export interface LifeGoal {
  id: string
  user_id: string
  text: string
  domain: Domain
  active: boolean
  created_at: string
}

// ─── Board Items ──────────────────────────────────────────────────────────────

export type AttentionBudget = 'high' | 'medium' | 'low'

// Also open — derived per-domain via agentLabel() in '@/lib/domains'.
export type AgentName = string

// Card category — the answer to "what kind of useful thing is this?" for
// the focused dev/student/AI-builder MVP. Optional + additive so older
// BoardItems (or generic/broad domains that don't bother classifying) keep
// working without one. 'Market' is the experimental Market Signals domain's
// category (research signal, never advice); 'Research' covers other
// non-Learn research-style items that don't fit the original 5.
export type BoardItemCategory = 'Learn' | 'Build' | 'Career' | 'Tool' | 'Trend' | 'Market' | 'Research'

export interface BoardItemSourceLink {
  label: string
  url: string
}

export interface BoardItem {
  id: string
  user_id: string
  agent: AgentName
  domain: Domain
  title: string
  // Judgment Engine outputs
  why_seeing: string       // Why am I seeing this?
  why_matters: string      // Why does it matter?
  action: string           // Recommended action
  // Scores
  lvs: number              // Life Value Score 0–100
  relevance: number
  impact: number
  urgency: number
  novelty: number
  // Metadata
  attention_budget: AttentionBudget
  source: string
  source_url?: string
  raw_content?: string     // Original scraped content
  // ── New, additive pipeline fields (all optional — never required by
  // existing consumers like BoardCard, /api/board, mock-data) ──────────
  category?: BoardItemCategory       // Learn | Build | Career | Tool | Trend | Market | Research
  confidence?: number                // 0-1: how sure the agent/judgment is in this item
  // fit_explanation retired (Part 1, beta-readiness directive): its job is
  // now absorbed into why_matters's risk clause, produced by the
  // Explanation Engine. Field left here, optional, only so any stale
  // persisted record that still has it keeps compiling.
  fit_explanation?: string
  source_links?: BoardItemSourceLink[] // Every source that supports this item, not just one
  // ── Recency (additive, optional — board-construction concern in
  // /api/run-agents, not required by mock data or older callers) ────────
  published_at?: string              // ISO date of the original source item, for age display
  is_older?: boolean                 // true if outside the normal freshness window but kept due to unusually high relevance/impact — UI must mark this clearly
  // ── Weekly Brief framing (additive, optional) ─────────────────────────
  why_this_week?: string             // 1 sentence: why this specific item earned a slot in *this* week's brief
  // ── Placement explanation (additive, optional) ────────────────────────
  // Why THIS item sits where it does relative to every other item this run
  // considered — distinct from why_seeing/why_matters (which explain why it
  // was surfaced at all). Set for both primary (Weekly Brief) and secondary
  // (Explore & Expand) items; for secondary items this is what answers
  // "why didn't this make the Weekly Brief?" (Part 5 requirement).
  placement_reason?: string
  // ── Explore & Expand grouping (additive, optional) ────────────────────
  // Which shelf this item belongs on within the secondary layer, so the UI
  // can present "near misses," "learning opportunities," and "emerging
  // trends" as distinct, legible groups instead of one undifferentiated
  // grid. Unset for primary (Weekly Brief) items — grouping only matters
  // for the secondary layer. See explore_bucket() in /api/run-agents.
  explore_bucket?: 'near_miss' | 'goal_match' | 'learning' | 'trend' | 'more'
  // State
  feedback?: 'helpful' | 'not_helpful' | null
  dismissed: boolean
  created_at: string
}

// ─── Agent raw item (before judgment) ────────────────────────────────────────

export interface RawItem {
  agent: AgentName
  domain: Domain
  title: string
  content: string
  source: string
  source_url?: string
  published_at?: string
  metadata?: Record<string, unknown>
}

// ─── Judgment Engine ─────────────────────────────────────────────────────────

export interface JudgmentInput {
  item: RawItem
  user_profile: UserProfile
  priorities: DomainPriority[]
  goals: LifeGoal[]
  memory_context?: string // Summary from the Memory Engine of what's been learned so far
  lang?: 'en' | 'he'      // UI language — generated why_seeing/why_matters/action/why_this_week text must match it
}

export interface JudgmentOutput {
  should_surface: boolean
  lvs: number
  relevance: number
  impact: number
  urgency: number
  novelty: number
  attention_budget: AttentionBudget
  why_seeing: string
  why_matters: string
  action: string
  // ── New, additive scoring dimensions for the real agent pipeline ─────
  // (optional so the OpenAI judgment path and any caller that doesn't
  // care about them keeps compiling unchanged)
  actionability?: number   // 0-100: how concrete/doable is the suggested action?
  confidence?: number      // 0-1: how sure are we this judgment is accurate?
  source_quality?: number  // 0-100: reliability of the underlying source(s)
  fit_score?: number       // 0-100: how well this fits a student/developer/AI-builder
  category?: BoardItemCategory
  // fit_explanation retired — see BoardItem's fit_explanation comment above.
  fit_explanation?: string
  why_this_week?: string
}

// ─── Memory Engine ───────────────────────────────────────────────────────────

export type MemoryEventType =
  | 'acted_on'
  | 'helpful'
  | 'not_helpful'
  | 'dismissed'
  | 'priority_adjusted'
  | 'pattern_learned'

export interface MemoryEvent {
  id: string
  user_id: string
  type: MemoryEventType
  domain?: Domain
  item_id?: string
  description: string
  meta?: Record<string, unknown>
  created_at: string
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface BoardStats {
  items_today: number
  filtered_today: number
  acted_on_week: number
  domains_active: number
  trust_score: number
  noise_rate: number
}
