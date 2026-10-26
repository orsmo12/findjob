/**
 * Judgment Engine
 *
 * Receives raw items from domain specialists.
 * Scores each item against the user's profile, goals, and priorities.
 *
 * Architecture (Part 1, beta-readiness directive):
 *   Sources → Domain Specialists → Judgment Engine (scores only) → Explanation Engine → Weekly Brief / Explore & Expand
 *
 * This file is scoring-only. Every function below produces a number or a
 * structured FACT (a matched goal's text, a memory direction, a cluster
 * size) — nothing below writes a sentence a user reads. Prose authoring
 * (why_seeing / why_matters / action / why_this_week) lives in
 * explanation-engine.ts's buildExplanation(); ruleBased() packages its
 * computed facts into an ExplanationFacts object and delegates to it. The
 * import list enforces the split: this file imports nothing presentation-
 * related (no domain-label lookup, no i18n string table, no text-variant
 * picker) because it has nothing left to say with them.
 *
 * This product runs at zero cost: the default and only-required path is
 * deterministic, rule-based scoring. Every sub-score below is a function of
 * real inputs (profile, goals, priorities, memory, source signals, age) —
 * there is no Math.random() anywhere in this file. A product built on trust
 * cannot rank things by chance. If an operator chooses to set OPENAI_API_KEY,
 * judgments are produced by OpenAI instead — purely optional, never required,
 * and the rule-based path is what every real run uses without one.
 */

import type {
  JudgmentInput,
  JudgmentOutput,
  AttentionBudget,
  DomainPriority,
  LifeGoal,
  BoardItemCategory,
} from '@/types'
import {
  getDomainFeedbackStats,
  getSourceFeedbackStats,
  getCategoryFeedbackStats,
  getTopicFamiliarity,
  clampDelta,
} from '@/agents/memory-engine'
import { ageDays, recencyScore } from '@/lib/recency'
import { buildExplanation, GENERIC_ACTION_FALLBACK, type ExplanationFacts } from '@/agents/explanation-engine'

// ─── OpenAI judgment (optional, env-gated — off by default) ──────────────────

const JUDGMENT_PROMPT = (input: JudgmentInput) => `
You are the Judgment Engine for Life Board — a personal intelligence system.
Your job is to evaluate whether a piece of information is genuinely worth
surfacing to this specific user, and if so, generate the explanation cards.

USER PROFILE:
Name: ${input.user_profile.name}
Profession: ${input.user_profile.profession ?? 'Not specified'}
Location: ${input.user_profile.location ?? 'Not specified'}
Skills: ${input.user_profile.skills?.join(', ') ?? 'Not specified'}

DOMAIN PRIORITIES (1-10):
${input.priorities.map(p => `- ${p.domain}: ${p.score}`).join('\n')}

ACTIVE LIFE GOALS:
${input.goals.filter(g => g.active).map(g => `- ${g.text}`).join('\n')}

MEMORY — WHAT WE'VE LEARNED ABOUT THIS USER SO FAR:
${input.memory_context ?? 'No memory data yet — this is a new user.'}

RESPONSE LANGUAGE: Write why_seeing, why_matters, and action in ${input.lang === 'he' ? 'Hebrew' : 'English'}. Do not mix languages.

RAW ITEM:
Specialist: ${input.item.agent}
Domain: ${input.item.domain}
Title: ${input.item.title}
Content: ${input.item.content}
Source: ${input.item.source}

INSTRUCTIONS:
Evaluate this item and return a JSON object with exactly these fields:
{
  "should_surface": boolean,        // Is this worth showing at all?
  "lvs": number,                    // Life Value Score 0-100: how likely is this to genuinely help the user progress, make a better decision, or avoid missing something important?
  "relevance": number,              // 0-100: how closely does this match the user's profile and goals?
  "impact": number,                 // 0-100: how much could acting on this change the user's trajectory?
  "urgency": number,                // 0-100: how time-sensitive is this?
  "novelty": number,                // 0-100: is this new and non-obvious information?
  "attention_budget": "high" | "medium" | "low",  // high = act today, medium = this week, low = FYI
  "why_seeing": string,             // 1-2 sentences: why is this user seeing this specific item?
  "why_matters": string,            // 2-3 sentences: why does this matter for their life/goals?
  "action": string                  // Specific, concrete next step. Start with a verb.
}

Rules:
- LVS below 40: set should_surface to false
- Be ruthlessly honest. Don't surface things just because they're interesting.
- Weigh the memory section above: if the user has consistently marked items in this
  domain "not helpful", be more skeptical and raise the bar before surfacing; if they've
  consistently marked items "helpful", you can trust borderline items in this domain more.
- why_seeing must be personal — reference their specific situation
- action must be concrete and doable, not vague
- Return ONLY the JSON, no other text
`

async function judgeWithOpenAI(input: JudgmentInput): Promise<JudgmentOutput | null> {
  if (!process.env.OPENAI_API_KEY) return null

  try {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: JUDGMENT_PROMPT(input) }],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return null

    return JSON.parse(raw) as JudgmentOutput
  } catch (err) {
    console.error('[JudgmentEngine] OpenAI error:', err)
    return null
  }
}

// ─── Rule-based judgment (the zero-cost default — what every real run uses) ──

function priorityScore(domain: string, priorities: DomainPriority[]): number {
  const p = priorities.find(x => x.domain === domain)
  return p ? p.score : 5
}

function goalMatchScore(title: string, content: string, goals: LifeGoal[]): number {
  const text = (title + ' ' + content).toLowerCase()
  let matches = 0
  for (const goal of goals.filter(g => g.active)) {
    const keywords = goal.text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    if (keywords.some(kw => text.includes(kw))) matches++
  }
  return Math.min(matches * 25, 100)
}

// Same matching logic as goalMatchScore, but returns the actual goals that
// matched (not just a count) so explanation text can quote the user's own
// goal back to them — e.g. "מתחבר למטרה שלך: \"...\"" — instead of a vague
// "matches your active goals" with no specifics.
function matchingGoals(title: string, content: string, goals: LifeGoal[]): LifeGoal[] {
  const text = (title + ' ' + content).toLowerCase()
  return goals.filter(g => {
    if (!g.active) return false
    const keywords = g.text.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    return keywords.some(kw => text.includes(kw))
  })
}

// ── New scoring dimensions ──────────────────────────────────────────────────
// Real agents (src/agents/*-agent.ts) attach hints onto the generic RawItem's
// `metadata` field when the pipeline wraps a CandidateItem for
// judgment — category, why_it_might_matter, suggested_angle, confidence_hint,
// source_quality_hint, plus raw engagement signals (stars/points/reactions/
// comments) copied straight from the source. None of these are required:
// generic-domain-agent items that don't set them just get sensible,
// documented defaults below — never a random number standing in for a
// missing signal.

function confidenceScore(metadata: Record<string, unknown> | undefined): number {
  const hint = typeof metadata?.confidence_hint === 'number' ? metadata.confidence_hint : undefined
  if (hint !== undefined) return Math.max(0, Math.min(1, hint))
  return 0.6
}

function sourceQualityScore(metadata: Record<string, unknown> | undefined): number {
  const hint = typeof metadata?.source_quality_hint === 'number' ? metadata.source_quality_hint : undefined
  if (hint !== undefined) return Math.max(0, Math.min(100, hint * 10)) // hint is 1-10
  return 60
}

// "Decision influence" component of Impact: how much external validation
// does this item already carry (GitHub stars, HN points, Dev.to reactions,
// comment counts)? Log-scaled so a 50-star repo and a 5000-star repo don't
// score 100x apart — the difference between "some traction" and "a lot of
// traction" matters less than the difference between "none" and "some."
// Sources with no engagement metric at all (Fed/SEC press releases,
// CoinGecko trending) get a flat neutral-low value rather than being
// punished for a signal they were never going to have.
function tractionScore(metadata: Record<string, unknown> | undefined): number {
  const keys = ['stars', 'points', 'reactions', 'comments']
  const strongest = Math.max(0, ...keys.map(k => (typeof metadata?.[k] === 'number' ? (metadata[k] as number) : 0)))
  if (strongest <= 0) return 30
  return Math.min(100, Math.round(Math.log10(1 + strongest) * 40))
}

// Per-category baseline for "how much could acting on this change the
// user's trajectory" (opportunity creation / risk avoidance), reflecting
// what each category structurally tends to be: Career and Build items
// usually carry a concrete opportunity; Market/Trend items are framed as
// risk-awareness signals; Learn/Research are valuable but rarely
// trajectory-changing on their own.
const CATEGORY_IMPACT_WEIGHT: Record<BoardItemCategory, number> = {
  Career: 85,
  Build: 75,
  Tool: 65,
  Market: 70,
  Trend: 70,
  Learn: 55,
  Research: 60,
}
const DEFAULT_CATEGORY_IMPACT_WEIGHT = 55

// Impact = Opportunity creation/Risk avoidance (category) + Domain
// importance (the user's own priority score) + Source authority (source
// quality) + Decision influence (agent confidence + external traction).
// Deliberately NOT derived from relevance — a highly relevant item can be
// low-impact (a nice-to-know), and a less personally-relevant item can
// still be high-impact (a major shift in a domain the user cares about).
// Collapsing the two would hide that distinction from the user.
function impactScore(opts: {
  domainPriority: number // 1-10
  sourceQuality: number  // 0-100
  category?: BoardItemCategory
  confidence: number     // 0-1
  metadata?: Record<string, unknown>
}): number {
  const categoryWeight = opts.category
    ? (CATEGORY_IMPACT_WEIGHT[opts.category] ?? DEFAULT_CATEGORY_IMPACT_WEIGHT)
    : DEFAULT_CATEGORY_IMPACT_WEIGHT
  const traction = tractionScore(opts.metadata)

  return Math.round(
    (opts.domainPriority / 10) * 25 +
    opts.sourceQuality          * 0.20 +
    categoryWeight              * 0.30 +
    opts.confidence * 100       * 0.10 +
    traction                    * 0.15
  )
}

// Real-word phrases that signal "act within a narrow window," used by
// urgencyScore below. Deterministic substring match — no model call needed
// to detect "deadline" or "this week."
const URGENCY_KEYWORDS = [
  'today', 'this week', 'breaking', 'just announced', 'announced',
  'launches', 'launching', 'deadline', 'closing', 'limited', 'urgent',
  'now live', 'live now', 'last chance', 'released today',
]

function keywordUrgencyBoost(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase()
  let hits = 0
  for (const kw of URGENCY_KEYWORDS) if (text.includes(kw)) hits++
  return Math.min(20, hits * 8)
}

// Urgency = explicit urgency hint from the pipeline (itself derived from
// real signals, never random — see candidateToGenericRawItem in
// run-agents/route.ts) + freshness boost (a brand-new item has a wider
// "act before this is stale" window) + urgency-language detection in the
// title/content.
function urgencyScore(opts: {
  metadataHint?: number
  ageDaysValue: number | null
  title: string
  content: string
}): number {
  const base = opts.metadataHint !== undefined ? Math.max(0, Math.min(100, opts.metadataHint)) : 50
  const freshnessBoost =
    opts.ageDaysValue === null ? 0 :
    opts.ageDaysValue <= 1 ? 20 :
    opts.ageDaysValue <= 3 ? 12 :
    opts.ageDaysValue <= 7 ? 5 : 0
  const keywordBoost = keywordUrgencyBoost(opts.title, opts.content)

  return Math.max(0, Math.min(100, Math.round(base * 0.6 + freshnessBoost + keywordBoost * 0.4)))
}

// Novelty = the inverse of "have we shown this user something like this
// before." Backed by the Memory Engine's surfaced-item history and title
// similarity (getTopicFamiliarity), not a guess: an exact repeat scores
// near-zero, a close near-duplicate scores low, and a genuinely new topic
// starts from a high baseline.
async function noveltyScore(
  userId: string,
  item: { title: string; domain: string; source: string; source_url?: string }
): Promise<number> {
  const { seenBefore, similarCount, mostSimilar } = await getTopicFamiliarity(userId, item)
  if (seenBefore) return 10

  let score = 90
  score -= Math.round(mostSimilar * 50)
  score -= Math.min(30, similarCount * 8)
  return Math.max(5, Math.min(95, score))
}

// Action verbs a genuinely concrete suggested action tends to start with or
// contain. Used to detect "presence of a clear action" without resorting to
// a length-based proxy (a long sentence isn't necessarily more actionable
// than a short, sharp one).
const ACTION_VERB_PATTERN = /\b(read|try|build|review|explore|apply|learn|study|test|run|install|clone|star|fork|compare|update|fix|implement|watch|join|register|submit|prepare|practice|contribute|write|publish|launch|deploy|investigate|research|schedule|enroll|sign up|reach out|follow up|skim|note|scan|verify)\b/i

// Generic catch-all actions (used as a default when no agent-suggested
// angle exists) never count as a "clear" action for scoring purposes, even
// though they're shown to the user as a fallback.
const GENERIC_ACTION_FALLBACKS = new Set([
  GENERIC_ACTION_FALLBACK.en.toLowerCase(),
  GENERIC_ACTION_FALLBACK.he.toLowerCase(),
])

// Actionability = presence of a clear action (a real, agent-suggested,
// verb-led angle — not just sentence length) + opportunity window (a
// freshly published item has more runway to act on before it's stale) +
// action confidence (the agent's own confidence carries over: a
// low-confidence candidate's suggested action is itself less trustworthy).
function actionabilityScore(opts: {
  suggestedAngle?: string
  confidence: number
  ageDaysValue: number | null
}): number {
  const angle = opts.suggestedAngle?.trim()
  const isGeneric = !!angle && GENERIC_ACTION_FALLBACKS.has(angle.toLowerCase())
  const hasAngle = !!angle && !isGeneric
  const hasVerb = hasAngle && ACTION_VERB_PATTERN.test(angle!)

  const presence = !hasAngle ? 40 : hasVerb ? 85 : 65

  const window =
    opts.ageDaysValue === null ? 60 :
    opts.ageDaysValue <= 7 ? 75 :
    opts.ageDaysValue <= 14 ? 55 : 35

  const actionConfidence = Math.round(opts.confidence * 100)

  return Math.round(presence * 0.45 + window * 0.30 + actionConfidence * 0.25)
}

function skillFitScore(skills: string[] | undefined, text: string): number {
  if (!skills || skills.length === 0) return 50
  const hits = skills.filter(s => text.includes(s.toLowerCase())).length
  if (hits === 0) return 35
  return Math.min(100, 50 + Math.round((hits / skills.length) * 50))
}

function professionFitScore(profession: string | undefined, text: string): number {
  if (!profession) return 50
  return text.includes(profession.toLowerCase()) ? 90 : 50
}

// Fit = Skills (does the item mention what the user says they know) +
// Profession (does it mention their stated role) + Goals (existing
// goalMatchScore) + Domain priorities. Note: this product's data model has
// no separate stored "interests" field distinct from domain priority — the
// onboarding flow captures interest *as* a domain priority score. Rather
// than fabricate a second, fake "interests" number, domain priority is
// documented here as serving both roles.
function fitScore(opts: {
  domainPriority: number
  skills?: string[]
  profession?: string
  goalMatch: number
  title: string
  content: string
}): number {
  const text = `${opts.title} ${opts.content}`.toLowerCase()
  const skillScore = skillFitScore(opts.skills, text)
  const professionScoreValue = professionFitScore(opts.profession, text)
  const domainScore = (opts.domainPriority / 10) * 100 // doubles as the "interests" signal — see note above

  return Math.round(
    skillScore           * 0.30 +
    professionScoreValue * 0.15 +
    opts.goalMatch        * 0.30 +
    domainScore           * 0.25
  )
}

async function ruleBased(input: JudgmentInput): Promise<JudgmentOutput> {
  const { item, priorities, goals, user_profile } = input
  const lang = input.lang === 'he' ? 'he' : 'en'

  const domainPriority = priorityScore(item.domain, priorities)              // 1–10
  const goalMatch      = goalMatchScore(item.title, item.content, goals)     // 0–100
  const matchedGoals   = matchingGoals(item.title, item.content, goals)

  // Single shared age computation — reused for recency, urgency,
  // actionability, and the why-this-week explanation below, instead of
  // each one recomputing "how old is this" independently.
  const itemAgeDays = ageDays(item.published_at)

  // ── Relevance ────────────────────────────────────────────────────────
  let relevance = Math.round((domainPriority / 10) * 60 + goalMatch * 0.4)

  // Past "helpful"/"not_helpful" feedback in this domain nudges relevance
  // directly, so the effect is visible on the very next agent run — not
  // just after a priority-score threshold is crossed. clampDelta() is the
  // exact same function the Memory page uses to display "how this changed
  // rankings," so the number shown there is literally this number.
  const { helpful, notHelpful } = await getDomainFeedbackStats(user_profile.id, item.domain)
  const memoryDelta = clampDelta(helpful, notHelpful)
  relevance = Math.max(0, Math.min(100, relevance + memoryDelta))

  // ── Category (drives Impact's category weight + why_matters framing) ──
  const category = typeof item.metadata?.category === 'string' ? (item.metadata.category as BoardItemCategory) : undefined

  // ── Source quality + category confidence, each nudged by memory ───────
  const { helpful: srcHelpful, notHelpful: srcNotHelpful } = await getSourceFeedbackStats(user_profile.id, item.source)
  const sourceDelta = clampDelta(srcHelpful, srcNotHelpful)
  const sourceQuality = Math.max(0, Math.min(100, sourceQualityScore(item.metadata) + sourceDelta))

  let confidence = confidenceScore(item.metadata)
  if (category) {
    const { helpful: catHelpful, notHelpful: catNotHelpful } = await getCategoryFeedbackStats(user_profile.id, category)
    const categoryDelta = clampDelta(catHelpful, catNotHelpful, 0.04, 0.2)
    confidence = Math.max(0, Math.min(1, confidence + categoryDelta))
  }

  // ── The five real, deterministic dimensions (no Math.random anywhere) ──
  const impact = impactScore({ domainPriority, sourceQuality, category, confidence, metadata: item.metadata })

  const urgencyHint = typeof item.metadata?.urgency === 'number' ? item.metadata.urgency as number : undefined
  const urgency = urgencyScore({ metadataHint: urgencyHint, ageDaysValue: itemAgeDays, title: item.title, content: item.content })

  const novelty = await noveltyScore(user_profile.id, {
    title: item.title, domain: item.domain, source: item.source, source_url: item.source_url,
  })

  const suggestedAngleHint = typeof item.metadata?.suggested_angle === 'string' ? item.metadata.suggested_angle as string : undefined
  const actionability = actionabilityScore({ suggestedAngle: suggestedAngleHint, confidence, ageDaysValue: itemAgeDays })

  const fit = fitScore({
    domainPriority,
    skills: user_profile.skills,
    profession: user_profile.profession,
    goalMatch,
    title: item.title,
    content: item.content,
  })

  const recency = recencyScore(item.published_at)

  // LVS = weighted average across 9 dimensions. Recency added (and the rest
  // re-weighted to make room for it) so the board favors what's current —
  // a card from today and an identical-quality card from two months ago
  // should not score the same.
  const lvs = Math.round(
    relevance       * 0.22 +
    impact          * 0.18 +
    urgency         * 0.08 +
    novelty         * 0.08 +
    actionability   * 0.14 +
    confidence*100  * 0.09 +
    sourceQuality   * 0.05 +
    fit             * 0.06 +
    recency         * 0.10
  )

  const budget: AttentionBudget =
    lvs >= 80 ? 'high' : lvs >= 60 ? 'medium' : 'low'

  // ── Facts handed to the Explanation Engine ─────────────────────────────
  // Everything from here down is a structured FACT, not a sentence — this
  // function computes scores and resolves matches; explanation-engine.ts's
  // buildExplanation() is the only place that turns these facts into the
  // prose a user reads (why_seeing / why_matters / action / why_this_week).
  const whyItMightMatterHint = typeof item.metadata?.why_it_might_matter === 'string' ? item.metadata.why_it_might_matter as string : undefined
  const matchedSkill = user_profile.skills?.find(s => `${item.title} ${item.content}`.toLowerCase().includes(s.toLowerCase()))

  // Set only by the cross-item synthesis stage (synthesize-insights.ts) on
  // the one synthesized CandidateItem per qualifying cluster — never on the
  // original member items, which keep their normal single-item framing.
  const clusterSize = typeof item.metadata?.cluster_size === 'number' && (item.metadata.cluster_size as number) >= 2
    ? (item.metadata.cluster_size as number)
    : null

  const facts: ExplanationFacts = {
    domain: item.domain,
    category,
    itemAgeDays,
    clusterSize,
    metadata: item.metadata,
    sourceName: item.source,
    matchedGoalText: matchedGoals[0]?.text,
    matchedSkill,
    memoryDirection: memoryDelta > 0 ? 'up' : memoryDelta < 0 ? 'down' : 'neutral',
    noveltyScore: novelty,
    agentWhyHint: whyItMightMatterHint,
    agentActionHint: suggestedAngleHint,
  }
  const explanation = buildExplanation(facts, lang)

  return {
    should_surface: lvs >= 40,
    lvs,
    relevance,
    impact,
    urgency,
    novelty,
    attention_budget: budget,
    why_seeing: explanation.why_seeing,
    why_matters: explanation.why_matters,
    action: explanation.action,
    actionability,
    confidence,
    source_quality: sourceQuality,
    fit_score: fit,
    category,
    why_this_week: explanation.why_this_week,
    // fit_explanation intentionally omitted — retired field. Its job (why
    // this item fits the user) is now absorbed into why_matters's risk
    // clause, produced inside explanation-engine.ts's buildWhyMatters().
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export async function judge(input: JudgmentInput): Promise<JudgmentOutput> {
  // Try OpenAI first, fall back to rule-based
  const aiResult = await judgeWithOpenAI(input)
  if (aiResult) return aiResult
  return await ruleBased(input)
}

