/**
 * Explanation Engine
 *
 * Architecture (Part 1, beta-readiness directive):
 *   Sources → Domain Specialists → Judgment Engine (scores only) → Explanation Engine → Weekly Brief / Explore & Expand
 *
 * judgment-engine.ts owns scoring ONLY: it computes relevance/impact/
 * urgency/novelty/actionability/confidence/fit/source_quality/LVS from real
 * inputs, and resolves which structured FACTS are true about this item
 * (matched goal text, matched skill, memory direction, cluster size, source
 * signals, category, age). It hands those facts to this file, which is the
 * only place in the product that turns facts into the prose a user reads
 * (why_seeing / why_matters / action / why_this_week). Nothing in this file
 * computes a score; nothing in judgment-engine.ts writes a sentence.
 *
 * Every explanation this file produces internally reasons through five
 * questions before it writes anything — not necessarily as separate visible
 * fields, but as the actual structure of the prose:
 *   1. What changed?        → buildWhatChanged()
 *   2. Why does it matter?  → buildWhyMatters() (category framing + goal)
 *   3. What opportunity?    → CATEGORY_REASONING[...].opportunity
 *   4. What risk?           → CATEGORY_REASONING[...].risk
 *   5. What action?         → buildAction()
 *
 * Hard rule (explicit product directive): never repeat domain names,
 * priority values, LVS values, or generic engagement metrics as if they
 * were the explanation. A real engagement number may appear once, as a
 * supporting clause after a substantive opening ("an active discussion on
 * r/X picked up 4.2K upvotes") — never as the entire sentence, and never as
 * "this matters because the score is high."
 */

import type { BoardItemCategory } from '@/types'
import type { Lang } from '@/lib/i18n'
import { getLifeDomainGroup } from '@/lib/domains'
import { pick, say, type Bi } from '@/lib/text-variants'

// ─── Input contract ─────────────────────────────────────────────────────────
// Everything here is a FACT already established elsewhere (Domain
// Specialist output, Judgment Engine matching/scoring, the cluster-
// synthesis stage) — this file never invents a number or a match, it only
// decides how to phrase facts that are already true.

export interface ExplanationFacts {
  domain: string
  category?: BoardItemCategory
  itemAgeDays: number | null
  clusterSize: number | null               // set only for a synthesized multi-source insight
  metadata?: Record<string, unknown>       // raw signals (stars/points/reactions/ups/comments) + type, straight from the source
  sourceName: string
  matchedGoalText?: string                 // the user's own goal text, when this item actually matches one
  matchedSkill?: string                    // the user's own listed skill, when this item actually mentions it
  memoryDirection: 'up' | 'down' | 'neutral' // sign of the memory delta already applied to relevance — never the raw number
  noveltyScore: number                     // 0-100, used only to choose a framing threshold, never printed
  agentWhyHint?: string                    // whyItMightMatter from the Domain Specialist that produced this item
  agentActionHint?: string                 // suggestedAngle from the Domain Specialist
}

export interface ExplanationResult {
  why_seeing: string
  why_matters: string
  action: string
  why_this_week: string
}

// ─── Shared fallback action (single source of truth — judgment-engine.ts's
// actionability scoring imports this same pair to recognize "no real angle
// was offered" rather than duplicating the literal strings in two files) ──
export const GENERIC_ACTION_FALLBACK: Bi = {
  he: 'עברו על הפריט והחליטו אם לפעול לפיו היום.',
  en: 'Review this item and decide whether to act on it today.',
}

// ─── Presentation helpers (pure facts → phrase, no scoring) ────────────────

function fmtCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(Math.round(n))
}

// Pulls one concrete engagement number out of metadata (GitHub stars, HN/YC
// points, Dev.to reactions, Reddit upvotes/comments). Returns null when the
// source genuinely carries no such signal — never a fabricated number
// standing in for a missing one.
function engagementSignal(metadata: Record<string, unknown> | undefined, lang: Lang): { value: number; label: string } | null {
  if (!metadata) return null
  const candidates: [string, string, string][] = [
    ['stars', 'כוכבים בגיטהאב', 'GitHub stars'],
    ['points', 'נקודות', 'points'],
    ['reactions', 'תגובות חיוביות', 'reactions'],
    ['ups', 'הצבעות חיוביות', 'upvotes'],
    ['comments', 'תגובות', 'comments'],
  ]
  for (const [key, he, en] of candidates) {
    const v = metadata[key]
    if (typeof v === 'number' && v > 0) return { value: v, label: lang === 'he' ? he : en }
  }
  return null
}

// Describes *what kind of thing* this item is using the source-type hint
// the pipeline already attaches — gives why_seeing a substantive subject to
// open with, so an engagement number (if any) always reads as support for a
// real description, never as the description itself.
function sourceKindPhrase(metadata: Record<string, unknown> | undefined, source: string, lang: Lang): string {
  const type = typeof metadata?.type === 'string' ? metadata.type : undefined
  switch (type) {
    case 'github':
      return lang === 'he' ? 'מאגר קוד שעולה בפופולריות' : 'a code repository gaining traction'
    case 'reddit':
      return lang === 'he' ? `דיון פעיל ב-${source}` : `an active discussion on ${source}`
    case 'paper':
      return lang === 'he' ? 'מאמר מחקר חדש' : 'a new research paper'
    case 'news':
    case 'article':
      return lang === 'he' ? `כתבה מ-${source}` : `a piece from ${source}`
    default:
      return lang === 'he' ? `עדכון מ-${source}` : `an update from ${source}`
  }
}

// Cluster-aware "what happened" phrasing — only used for a synthesized
// multi-source insight (clusterSize set). Its real signal is "N independent
// sources agree," not a single engagement number, so it gets its own
// framing instead of falling through to the single-item phrasing below.
// Deliberately does not restate the domain name — the card badge already
// shows it; repeating it here would be filler, not information.
const CLUSTER_WHAT_CHANGED: Bi[] = [
  { he: 'מקורות עצמאיים אחדים מצביעים על אותה מגמה השבוע — לא כתבה בודדת.', en: "Several independent sources are pointing at the same pattern this week — not a single story." },
  { he: 'זו לא כתבה בודדת — כמה מקורות שונים עוסקים באותה נקודה במקביל השבוע.', en: "This isn't one article — several separate sources are covering the same point in parallel this week." },
]

// ── 1. What changed? ────────────────────────────────────────────────────────
// Precedence: cluster convergence (strongest, most distinctive signal) →
// the Domain Specialist's own grounded hint → a substantive source-kind
// description with a real engagement number folded in as support → a plain
// freshness statement when no other signal exists. Engagement numbers never
// lead the sentence — they always follow a concrete subject.
function buildWhatChanged(facts: ExplanationFacts, lang: Lang): string {
  const seed = `${facts.domain}:${facts.sourceName}:${facts.itemAgeDays ?? ''}`

  if (facts.clusterSize) {
    return say(pick(CLUSTER_WHAT_CHANGED, seed), lang)
  }
  if (facts.agentWhyHint) {
    return facts.agentWhyHint
  }

  const signal = engagementSignal(facts.metadata, lang)
  const subjectPhrase = sourceKindPhrase(facts.metadata, facts.sourceName, lang)
  const recentlyBit = facts.itemAgeDays !== null && facts.itemAgeDays <= 2

  if (signal) {
    return lang === 'he'
      ? `${subjectPhrase} צבר ${fmtCompact(signal.value)} ${signal.label}${recentlyBit ? ' תוך יומיים' : ''} — סיגנל לעניין חריג.`
      : `${subjectPhrase} picked up ${fmtCompact(signal.value)} ${signal.label}${recentlyBit ? ' within two days' : ''} — a sign of unusually strong interest.`
  }
  return lang === 'he'
    ? `${subjectPhrase}${recentlyBit ? ' פורסם בימים האחרונים' : ' פורסם לאחרונה'}.`
    : `${subjectPhrase}${recentlyBit ? ' was published in the last couple of days' : ' was published recently'}.`
}

// Quotes the user's own goal or skill back to them, never a vague "matches
// your priorities." Empty string (not a filler sentence) when neither
// applies — silence is more honest than a templated non-answer.
function buildPersonalBit(facts: ExplanationFacts, lang: Lang): string {
  if (facts.matchedGoalText) {
    return lang === 'he'
      ? ` זה רלוונטי כי זה מתחבר למטרה שלך: "${facts.matchedGoalText}".`
      : ` It's relevant because it connects to your goal: "${facts.matchedGoalText}".`
  }
  if (facts.matchedSkill) {
    return lang === 'he'
      ? ` זה רלוונטי כי זה משלב ${facts.matchedSkill}, אחד הכישורים שציינת.`
      : ` It's relevant because it involves ${facts.matchedSkill}, one of the skills you listed.`
  }
  return ''
}

function buildMemoryNote(facts: ExplanationFacts, lang: Lang): string {
  if (facts.memoryDirection === 'up') {
    return lang === 'he'
      ? ' פריטים כאלה היו מועילים לך בעבר, ולכן המשקל שלו הועלה.'
      : " Items like this have been helpful to you before, so it's weighted higher."
  }
  if (facts.memoryDirection === 'down') {
    return lang === 'he'
      ? ' סימנת בעבר פריטים דומים כ"לא מועילים", ולכן המשקל שלו הופחת.'
      : " You've marked similar items not helpful before, so it's weighted lower."
  }
  return ''
}

// ── 2-4. Why does it matter? / opportunity / risk ───────────────────────────
// Each category gets a real opportunity clause AND a real risk clause — the
// product directive explicitly requires both, internally, even though the
// UI shows one continuous paragraph rather than two labeled fields. This
// also absorbs what used to be the separate, now-retired fit_explanation
// field ("Categorized as X for the Y track") — that sentence restated
// metadata the badge already shows and explained nothing; the risk clause
// replaces it inside the same card slot instead of adding a new one.
const CATEGORY_REASONING: Partial<Record<BoardItemCategory, { opportunity: Bi; risk: Bi }>> = {
  Career: {
    opportunity: { he: 'זו הזדמנות תעסוקתית קונקרטית, לא רק מידע כללי על התחום.', en: 'This is a concrete career opportunity, not just general background on the field.' },
    risk: { he: 'הזדמנויות כאלה נסגרות — מי שפועל לפיהן ראשון נהנה מהיתרון.', en: 'Windows like this close — whoever acts on it first gets the advantage.' },
  },
  Build: {
    opportunity: { he: 'זה נותן לך תבנית קונקרטית שאפשר להתחיל לבנות ממנה כבר היום.', en: "It's a concrete template you could start building from today." },
    risk: { he: 'אם זה יישאר רק "לקרוא על זה מתישהו", תצטרכו לבנות מאפס כשהפער יהיה כואב יותר.', en: "Leave it as 'read about it someday' and you'll be building from scratch later, when the gap costs more." },
  },
  Tool: {
    opportunity: { he: 'זה כלי שיכול לחסוך לך זמן עבודה ממשי אם תאמץ אותו.', en: 'It could save you real working time if you adopt it.' },
    risk: { he: 'העלות האמיתית היא לא לנסות — זה הזמן שאתם ממשיכים לאבד לדרך האיטית יותר.', en: "The real cost is not trying it — that's the time you keep losing to the slower way of doing this." },
  },
  Market: {
    opportunity: { he: 'זה סיגנל שכדאי לעקוב אחריו ולחקור — לא קריאה לפעולה פיננסית.', en: "It's a signal worth tracking and researching — not a call to financial action." },
    risk: { he: 'איתות בודד פועל לשני הכיוונים — להתעלם ממנו מסוכן בדיוק כמו לתת לו יותר מדי משקל.', en: 'A single signal cuts both ways — ignoring it is just as risky as overweighting it.' },
  },
  Trend: {
    opportunity: { he: 'זה מצביע על כיוון שמתחזק, ושווה להכיר אותו מוקדם ולא אחרי שכולם כבר מדברים עליו.', en: "It points to a direction that's gaining strength — worth knowing early, before everyone else is talking about it." },
    risk: { he: 'מגמות מוקדמות יכולות גם להתפוגג — שווה לעקוב, לא להתחייב על בסיס איתות אחד.', en: 'Early trends can also fizzle out — worth watching, not worth committing to on one signal alone.' },
  },
  Learn: {
    opportunity: { he: 'זה מעמיק את ההבנה שלך בנושא שאתה בכל מקרה עוקב אחריו.', en: "It deepens your understanding of a topic you're already tracking." },
    risk: { he: 'הסיכון כאן לא דחוף — הוא להישאר מאחור בהקשר שתצטרכו בהמשך.', en: "The risk here isn't urgent — it's falling behind on context you'll need later." },
  },
  Research: {
    opportunity: { he: 'זה מקור ראשוני שכדאי להכיר לפני שמסתמכים על פרשנות של אחרים.', en: "It's a primary source worth knowing firsthand before relying on someone else's interpretation of it." },
    risk: { he: 'הסתמכות רק על סיכומים של אחרים עלולה להחמיץ הסתייגות מתודולוגית שמשנה את המסקנה.', en: 'Relying only on secondhand summaries risks missing a methodological caveat that changes the conclusion.' },
  },
}
const DEFAULT_REASONING = {
  opportunity: { he: 'זה יכול להשפיע על החלטות קרובות בתחום הזה.', en: 'It could influence upcoming decisions in this area.' },
  risk: { he: 'הסיכון העיקרי הוא לפספס את החלון הזה ולגלות אותו רק כשהוא כבר לא רלוונטי.', en: 'The main risk is missing this window and only noticing it once it no longer applies.' },
}

function buildWhyMatters(facts: ExplanationFacts, lang: Lang): string {
  const reasoning = (facts.category && CATEGORY_REASONING[facts.category]) ?? DEFAULT_REASONING
  const opportunity = say(reasoning.opportunity, lang)
  const risk = say(reasoning.risk, lang)
  const goalClause = facts.matchedGoalText
    ? (lang === 'he' ? ` מתחבר ישירות למטרה שלך: "${facts.matchedGoalText}".` : ` It connects directly to your goal: "${facts.matchedGoalText}".`)
    : ''
  return `${opportunity} ${risk}${goalClause}`
}

// ── 5. What action? ──────────────────────────────────────────────────────────
// Prefers the Domain Specialist's own verb-led suggestion (it has direct
// knowledge of the source — "star the repo," "read the abstract" — that
// this engine doesn't reconstruct); falls back to one honest generic
// instruction only when no real angle was offered.
function buildAction(facts: ExplanationFacts, lang: Lang): string {
  return facts.agentActionHint || say(GENERIC_ACTION_FALLBACK, lang)
}

// ── Why this week ────────────────────────────────────────────────────────────
// Weekly-brief framing: every item that earns a slot should say *why this
// week specifically*, built from real, varying signals (freshness, measured
// traction or novelty, a matched goal, cluster convergence) — never a fixed
// template with a raw score swapped in.
function buildWhyThisWeek(facts: ExplanationFacts, lang: Lang): string {
  const reasons: string[] = []
  reasons.push(
    facts.itemAgeDays !== null && facts.itemAgeDays <= 2
      ? (lang === 'he' ? 'הוא חדש וטרי' : "it's brand new")
      : facts.itemAgeDays !== null && facts.itemAgeDays <= 7
        ? (lang === 'he' ? 'הוא התפרסם השבוע' : 'it was published this week')
        : (lang === 'he' ? 'הוא עדיין ברף גבוה וממשיך להיות רלוונטי' : "it's still clearing a high bar and staying relevant")
  )

  if (facts.clusterSize) {
    reasons.push(lang === 'he'
      ? `${facts.clusterSize} מקורות נפרדים מצביעים על אותה מגמה באופן עצמאי`
      : `${facts.clusterSize} separate sources are independently pointing at the same pattern`)
  }

  const signal = engagementSignal(facts.metadata, lang)
  if (signal) {
    reasons.push(lang === 'he'
      ? `קיבל תאוצה חריגה (${fmtCompact(signal.value)} ${signal.label})`
      : `it picked up unusual traction (${fmtCompact(signal.value)} ${signal.label})`)
  } else if (facts.noveltyScore >= 70) {
    reasons.push(lang === 'he' ? 'מביא זווית שעוד לא ראית' : "it brings an angle you haven't seen yet")
  }

  if (facts.matchedGoalText) {
    reasons.push(lang === 'he'
      ? `מתחבר ישירות למטרה שלך "${facts.matchedGoalText}"`
      : `it connects directly to your goal "${facts.matchedGoalText}"`)
  }

  const joiner = lang === 'he' ? ', ו' : ', and '
  return lang === 'he'
    ? `נכנס לתקציר השבוע כי ${reasons.join(joiner)}.`
    : `Entered this week's brief because ${reasons.join(joiner)}.`
}

// ─── Public interface ────────────────────────────────────────────────────────
// The single entry point judgment-engine.ts calls once scoring is done.
// `getLifeDomainGroup`/lang resolution lives here, not in judgment-engine —
// the domain LABEL (as opposed to the raw domain id used for scoring/
// matching) is a presentation concern, and this function deliberately does
// not weave it into any sentence below (see file header: don't repeat
// domain names — the card badge already shows it).
export function buildExplanation(facts: ExplanationFacts, lang: Lang): ExplanationResult {
  // Resolving the group here keeps a single call site that would need it if
  // a future variant wants domain-aware phrasing — currently unused by
  // design, kept only as a documented hook, not dead weight that grows.
  void getLifeDomainGroup

  const whatChanged = buildWhatChanged(facts, lang)
  const personalBit = buildPersonalBit(facts, lang)
  const memoryNote = buildMemoryNote(facts, lang)

  return {
    why_seeing: `${whatChanged}${personalBit}${memoryNote}`,
    why_matters: buildWhyMatters(facts, lang),
    action: buildAction(facts, lang),
    why_this_week: buildWhyThisWeek(facts, lang),
  }
}
