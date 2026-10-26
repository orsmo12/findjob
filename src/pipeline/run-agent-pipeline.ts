/**
 * Pipeline orchestrator — the single entry point /api/run-agents calls.
 *
 * Full pipeline: Sources → RawItems → Agent Processing → CandidateItems →
 * JudgmentEngine → BoardItems → Feedback → Memory. This file implements
 * the middle of that: it decides, per active domain, whether items come
 * from one of the 4 real MVP agents (src/agents/*) or from the existing
 * generic fetch-and-judge path (src/agents/domain-agents.ts) —
 * then merges and dedupes everything into one CandidateItem[] so the
 * Judgment Engine can score real-agent and generic-agent items side by
 * side, fairly, in one pass.
 *
 * Why both paths exist: the product has 18 selectable domains in
 * onboarding/profile (kept exactly as-is, per the "don't rewrite the UI"
 * constraint), but only 4 of them — career, ai_tech, programming +
 * open_source, startups + entrepreneurship — are deepened into real,
 * multi-source, normalized/deduped/filtered agents for this validation
 * round (see domains.ts `mvpAgent` field). The rest keep working through
 * the pre-existing generic path rather than going dark or being faked.
 */

import type { RawItem as GenericRawItem } from '@/types'
import type { Lang } from '@/lib/i18n'
import { DOMAIN_REGISTRY, getMvpAgentForDomain, getDomainLabel, type MvpAgentId } from '@/lib/domains'
import { runDomainAgent } from '@/agents/domain-agents'
import { runAgent, type AgentDefinition, type CandidateItem } from '@/agents/base-agent'
import { developerOpportunitiesAgent } from '@/agents/developer-opportunities-agent'
import { aiTrendsAgent } from '@/agents/ai-trends-agent'
import { projectIdeasAgent } from '@/agents/project-ideas-agent'
import { careerSignalsAgent } from '@/agents/career-signals-agent'
import { marketSignalsAgent } from '@/agents/market-signals-agent'
import { dedupeBy } from '@/pipeline/dedupe-items'
import { synthesizeInsights } from '@/pipeline/synthesize-insights'
import { pick, say, cleanSourceName, type Bi } from '@/lib/text-variants'

const MVP_AGENTS: Record<MvpAgentId, AgentDefinition> = {
  dev_opportunities: developerOpportunitiesAgent,
  ai_trends: aiTrendsAgent,
  project_ideas: projectIdeasAgent,
  career_signals: careerSignalsAgent,
  market_signals: marketSignalsAgent,
}

const GENERIC_CATEGORY_BY_TYPE: Record<string, CandidateItem['category']> = {
  github: 'Build',
  article: 'Learn',
  paper: 'Learn',
  reddit: 'Trend',
  news: 'Trend',
  placeholder: 'Trend',
}

function numSignal(metadata: Record<string, unknown>, key: string): number | undefined {
  const v = metadata[key]
  return typeof v === 'number' && v > 0 ? v : undefined
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(Math.round(n))
}

// seedHash/pick/say/cleanSourceName/Bi now live in '@/lib/text-variants' —
// shared by this file, the 5 MVP agents, placementReason() in route.ts, and
// the cross-item synthesis stage, so every deterministic-variant text path
// in the product uses the exact same mechanism.

/**
 * whyItMightMatter/suggestedAngle for the generic domain-agent path (the
 * ~13 of 19 domains not deepened into one of the 5 MVP agents).
 *
 * Product Quality Audit finding (see conversation): this used to branch
 * only on source TYPE, with `suggestedAngle` a single fixed sentence per
 * type — so e.g. every Reddit-sourced item across Real Estate, Sports,
 * Travel, Health, Investing, Personal Finance and Cybersecurity produced
 * the *identical* "what to do next" string, differing only by which
 * numbers/domain name got substituted in. That's the concrete root cause
 * of generic-domain cards "feeling the same."
 *
 * Fix: (1) `domainLabel` is now the granular specialist label (e.g.
 * "Real Estate", "Personal Finance"), not the broader Life Domain group
 * name, so domains that share a group no longer collapse into identical
 * text. (2) Each branch offers 2 phrasings for whyItMightMatter and 2 for
 * suggestedAngle, chosen deterministically per item via `seed` (and a
 * different seed suffix for the action than for the matter-text, so the
 * two don't always covary). (3) `source` is cleaned of the internal
 * "(live)" marker before being quoted in a sentence.
 *
 * Still branches on the real source TYPE and still only quotes a real
 * numeric engagement signal when the source actually carries one (GitHub
 * stars/forks, HN points, Reddit upvotes/comments, Dev.to reactions) —
 * never a fabricated number when a source genuinely has none (arXiv
 * papers, plain RSS).
 */
function genericExplanation(
  metadata: Record<string, unknown>,
  type: string | undefined,
  rawSource: string,
  domainLabel: string,
  lang: Lang,
  seed: string
): { whyItMightMatter: string; suggestedAngle: string } {
  const source = cleanSourceName(rawSource)
  const stars = numSignal(metadata, 'stars')
  const forks = numSignal(metadata, 'forks')
  const points = numSignal(metadata, 'points')
  const ups = numSignal(metadata, 'ups')
  const comments = numSignal(metadata, 'comments')
  const reactions = numSignal(metadata, 'reactions')

  const resolve = (whyVariants: readonly Bi[], actionVariants: readonly Bi[]) => ({
    whyItMightMatter: say(pick(whyVariants, seed), lang),
    suggestedAngle: say(pick(actionVariants, `${seed}:action`), lang),
  })

  switch (type) {
    case 'github': {
      const starsPart = stars !== undefined
        ? (lang === 'he' ? `${fmtNum(stars)} כוכבים בגיטהאב` : `${fmtNum(stars)} GitHub stars`)
        : (lang === 'he' ? 'תנופה בגיטהאב' : 'momentum on GitHub')
      const forksPart = forks !== undefined
        ? (lang === 'he' ? ` ו-${fmtNum(forks)} פיצולים` : ` and ${fmtNum(forks)} forks`)
        : ''
      return resolve(
        [
          {
            he: `שווה להבין אילו בעיות הכלים בתחום ${domainLabel} פותרים כיום — המאגר הזה כבר צובר ${starsPart}${forksPart}.`,
            en: `Worth understanding what problems ${domainLabel} tooling is solving right now — this repo is already picking up ${starsPart}${forksPart}.`,
          },
          {
            he: `הצצה מוקדמת לכיוון שאליו הכלים בתחום ${domainLabel} מתפתחים — פרויקט קוד פתוח שצבר ${starsPart}${forksPart} בזמן קצר יחסית.`,
            en: `An early look at where ${domainLabel} tooling is heading — an open-source project that's already picked up ${starsPart}${forksPart} in a short window.`,
          },
        ],
        [
          {
            he: `בדקו את ה-README והדוגמאות, ושקלו לתת כוכב כדי לעקוב אחרי ההתפתחות שלו בתחום ${domainLabel}.`,
            en: `Skim the README and examples, and consider starring it to track how it develops in ${domainLabel}.`,
          },
          {
            he: `עברו על הקוד ובדקו אם הוא פותר בעיה שרלוונטית לעבודה שלכם בתחום ${domainLabel}.`,
            en: `Look through the code and check whether it solves a problem relevant to your work in ${domainLabel}.`,
          },
        ]
      )
    }
    case 'reddit': {
      const upsPart = ups !== undefined
        ? (lang === 'he' ? `${fmtNum(ups)} הצבעות` : `${fmtNum(ups)} upvotes`)
        : (lang === 'he' ? 'עניין אמיתי' : 'real interest')
      const commentsPart = comments !== undefined
        ? (lang === 'he' ? ` ו-${fmtNum(comments)} תגובות` : ` and ${fmtNum(comments)} comments`)
        : ''
      return resolve(
        [
          {
            he: `קריאה ישירה על מה שהקהילה בתחום ${domainLabel} בפועל מתמודדת איתו כרגע — הדיון הזה ב-${source} מושך עניין אורגני אמיתי (${upsPart}${commentsPart}).`,
            en: `A direct read on what the ${domainLabel} community is actually dealing with right now — this ${source} thread is drawing real organic interest (${upsPart}${commentsPart}).`,
          },
          {
            he: `שווה להכיר לפני שזה הופך לנושא מדובר בתחום ${domainLabel} — השרשור הזה ב-${source} כבר מושך תשומת לב (${upsPart}${commentsPart}).`,
            en: `Worth knowing before it becomes a widely-discussed topic in ${domainLabel} — this ${source} thread is already drawing attention (${upsPart}${commentsPart}).`,
          },
        ],
        [
          {
            he: `קראו את התגובות המובילות ב-${source} לפני שמחליטים אם זה רלוונטי לכם בתחום ${domainLabel}.`,
            en: `Read the top comments on ${source} before deciding whether this applies to your ${domainLabel} situation.`,
          },
          {
            he: `עברו על הדיון ובדקו אם מישהו מהקהילה נתקל במצב דומה בתחום ${domainLabel}.`,
            en: `Skim the discussion and see whether anyone in the community has faced a similar situation in ${domainLabel}.`,
          },
        ]
      )
    }
    case 'paper':
      return resolve(
        [
          {
            he: `מאמר מחקר טרי בנושא ${domainLabel} שעדיין לא הספיק לעבור סקירה רחבה — איתות מוקדם ששווה להכיר לפני שהוא הופך למיינסטרים.`,
            en: `A fresh ${domainLabel} research paper that hasn't had time to be widely reviewed yet — an early signal worth knowing before it goes mainstream.`,
          },
          {
            he: `פרסום אקדמי חדש בתחום ${domainLabel}, ממקור ראשוני ולא מסונן — שווה הצצה לפני שהוא מתורגם לכתבות פופולריות.`,
            en: `A new academic publication in ${domainLabel}, straight from the primary source — worth a look before it gets filtered through popular coverage.`,
          },
        ],
        [
          {
            he: `קראו את התקציר ובדקו אם המתודולוגיה רלוונטית לעבודה שלכם בתחום ${domainLabel}.`,
            en: `Read the abstract and check whether the methodology is relevant to your work in ${domainLabel}.`,
          },
          {
            he: `עברו על המסקנות העיקריות ושאלו אם הן משנות משהו בהבנה שלכם על ${domainLabel}.`,
            en: `Skim the key findings and ask whether they shift your understanding of ${domainLabel}.`,
          },
        ]
      )
    case 'article': {
      const reactionsPart = reactions !== undefined
        ? (lang === 'he' ? `${fmtNum(reactions)} לייקים` : `${fmtNum(reactions)} reactions`)
        : (lang === 'he' ? 'תגובות חיוביות' : 'real reactions')
      const commentsPart = comments !== undefined
        ? (lang === 'he' ? ` ו-${fmtNum(comments)} תגובות` : ` and ${fmtNum(comments)} comments`)
        : ''
      return resolve(
        [
          {
            he: `סביר שיחסוך לכם זמן מחקר בתחום ${domainLabel} — מאמר שהקהילה ב-${source} כבר מצאה שימושי (${reactionsPart}${commentsPart}).`,
            en: `Likely to save you research time in ${domainLabel} — a piece the ${source} community already vouched for as useful (${reactionsPart}${commentsPart}).`,
          },
          {
            he: `קונקרטי מספיק שהקהל שעוקב אחרי ${domainLabel} ב-${source} בפועל התעסק בו (${reactionsPart}${commentsPart}) — בדרך כלל סימן לתוכן ממשי, לא כללי.`,
            en: `Concrete enough that the ${domainLabel} audience on ${source} actually engaged with it (${reactionsPart}${commentsPart}) — usually a sign of real substance, not generic advice.`,
          },
        ],
        [
          {
            he: `קראו אותה ושמרו את הטכניקה המרכזית לשימוש מאוחר יותר בתחום ${domainLabel}.`,
            en: `Read it and note the core technique for later use in ${domainLabel}.`,
          },
          {
            he: `עברו עליה במהירות ובדקו אם יש בה רעיון אחד שאפשר לאמץ מיד בתחום ${domainLabel}.`,
            en: `Skim it for one idea you could put to use right away in ${domainLabel}.`,
          },
        ]
      )
    }
    case 'news': {
      if (points !== undefined) {
        const commentsPart = comments !== undefined
          ? (lang === 'he' ? ` ו-${fmtNum(comments)} תגובות` : ` and ${fmtNum(comments)} comments`)
          : ''
        return resolve(
          [
            {
              he: `שווה להכיר לפני שזה הופך למיינסטרים בתחום ${domainLabel} — קהילת המפתחים כבר מתייחסת לזה ברצינות (${fmtNum(points)} נקודות${commentsPart}).`,
              en: `Worth knowing before it goes mainstream in ${domainLabel} — developers are already taking it seriously (${fmtNum(points)} points${commentsPart}).`,
            },
            {
              he: `לא עמדת שוליים בתחום ${domainLabel} — דיון חי ב-Hacker News על הנושא הזה (${fmtNum(points)} נקודות${commentsPart}) ששווה לגבש לגביו דעה משלכם.`,
              en: `Not a fringe take in ${domainLabel} — a live Hacker News discussion on this (${fmtNum(points)} points${commentsPart}) worth forming your own view on.`,
            },
          ],
          [
            {
              he: `קראו את הדיון בתגובות — לרוב שם נמצאת הזווית הביקורתית על ${domainLabel}.`,
              en: `Read the comment thread — that's usually where the critical take on ${domainLabel} lives.`,
            },
            {
              he: `עברו על הכתבה ועל כמה תגובות מובילות לפני שמגבשים דעה על ${domainLabel}.`,
              en: `Skim the piece and a few top comments before forming a view on ${domainLabel}.`,
            },
          ]
        )
      }
      return resolve(
        [
          {
            he: `עדכון מ-${source} בתחום ${domainLabel} — שווה הצצה לפני שהמידע הזה מתפשט בלי שתכירו אותו ממקור ראשון.`,
            en: `An update from ${source} in ${domainLabel} — worth a look before this spreads without you having seen it firsthand.`,
          },
          {
            he: `עדכון טרי מ-${source} בתחום ${domainLabel} — אין כאן עדיין מדד מספרי, אבל זה ממוקד וטרי.`,
            en: `A fresh update from ${source} in ${domainLabel} — no numeric signal yet, but it's targeted and current.`,
          },
        ],
        [
          {
            he: `קראו את הכתבה המלאה כדי להבין את ההקשר לפני שמחליטים אם היא רלוונטית לתחום ${domainLabel}.`,
            en: `Read the full piece to get the context before deciding if it's relevant to ${domainLabel}.`,
          },
          {
            he: `עברו על הפרטים ובדקו אם יש כאן משהו שדורש מעקב בתחום ${domainLabel}.`,
            en: `Look over the details and check whether this needs follow-up in ${domainLabel}.`,
          },
        ]
      )
    }
    default:
      return resolve(
        [
          {
            he: `עדכון חדש מ-${source} בתחום ${domainLabel} — שווה הצצה כדי לדעת אם יש כאן משהו שדורש תשומת לב.`,
            en: `A new update from ${source} in ${domainLabel} — worth a glance to see if it needs your attention.`,
          },
          {
            he: `פריט חדש מ-${source} בתחום ${domainLabel} — בדקו במהירות אם הוא משנה משהו במה שאתם עוקבים אחריו.`,
            en: `A new item from ${source} in ${domainLabel} — a quick check to see if it changes anything you're tracking.`,
          },
        ],
        [
          {
            he: `בדקו את הפריט ושקלו אם הוא דורש פעולה מצדכם בתחום ${domainLabel}.`,
            en: `Review this and consider whether it calls for action in ${domainLabel}.`,
          },
          {
            he: `עברו עליו ושאלו אם הוא משנה משהו במה שאתם עושים בתחום ${domainLabel}.`,
            en: `Look it over and ask whether it changes anything in how you approach ${domainLabel}.`,
          },
        ]
      )
  }
}

function genericToCandidate(item: GenericRawItem, lang: Lang): CandidateItem {
  const metadata = item.metadata ?? {}
  const type = typeof metadata.type === 'string' ? metadata.type : undefined
  const urgency = typeof metadata.urgency === 'number' ? metadata.urgency : 50

  const rawSignals: Record<string, number> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'number') rawSignals[key] = value
  }

  // Explanation text uses the granular specialist label (e.g. "Real
  // Estate", "Personal Finance") rather than the broader Life Domain group
  // name — this is what lets Investing and Personal Finance (both grouped
  // under "Investing & Finance" on the card badge) read as genuinely
  // different in the explanation body. This does NOT change the visible
  // card badge, which BoardCard.tsx computes independently via
  // getLifeDomainGroup() and always shows the group, never the specialist
  // (Part 1: specialists are an internal implementation detail the badge
  // never shows) — only the prose inside why_matters/action gets more
  // specific. `seed` ties the deterministic text-variant pick to this
  // exact item, so the same item reads the same way on every reload.
  const domainLabel = getDomainLabel(item.domain, lang)
  const seed = `${item.domain}:${item.title}:${item.source_url ?? ''}`
  const { whyItMightMatter, suggestedAngle } = genericExplanation(metadata, type, item.source, domainLabel, lang, seed)

  return {
    id: `generic-${item.domain}-${item.source_url ?? item.title}`,
    title: item.title,
    summary: item.content,
    url: item.source_url ?? '',
    sourceLinks: [{ label: item.source, url: item.source_url ?? '' }],
    agentId: `generic:${item.domain}`,
    domain: item.domain,
    category: (type && GENERIC_CATEGORY_BY_TYPE[type]) || 'Trend',
    tags: [],
    whyItMightMatter,
    suggestedAngle,
    rawSignals,
    confidence: Math.max(0.1, Math.min(1, urgency / 100)),
    sourceName: item.source,
    sourceReliability: 6,
    publishedAt: item.published_at,
  }
}

/**
 * Runs the full agent layer for whatever domains are currently active,
 * and returns a single deduped CandidateItem[] ready for the Judgment
 * Engine. Each real MVP agent only runs once even if multiple active
 * domains map to it (e.g. both 'startups' and 'entrepreneurship' map to
 * project_ideas).
 */
export async function runAgentPipeline(activeDomainIds?: string[], lang: Lang = 'en'): Promise<CandidateItem[]> {
  const domains = activeDomainIds
    ? DOMAIN_REGISTRY.filter(d => activeDomainIds.includes(d.id))
    : DOMAIN_REGISTRY.filter(d => d.defaultPriority >= 6)

  const mvpAgentIds = new Set<MvpAgentId>()
  const genericDomains = []
  for (const domain of domains) {
    const mvpAgentId = getMvpAgentForDomain(domain.id)
    if (mvpAgentId) {
      mvpAgentIds.add(mvpAgentId)
    } else {
      genericDomains.push(domain)
    }
  }

  const [mvpResults, genericResults] = await Promise.all([
    Promise.allSettled(Array.from(mvpAgentIds).map(id => runAgent(MVP_AGENTS[id], lang))),
    Promise.allSettled(genericDomains.map(d => runDomainAgent(d, lang))),
  ])

  const mvpCandidates = mvpResults.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  const genericCandidates = genericResults
    .flatMap(r => (r.status === 'fulfilled' ? r.value : []))
    .map(item => genericToCandidate(item, lang))

  const deduped = dedupeBy([...mvpCandidates, ...genericCandidates])

  // Cross-item synthesis: CandidateItems → topic clustering → insight
  // synthesis → (downstream) Judgment Engine. Groups of 2+ related items
  // discussing the same underlying pattern get ONE additional synthesized
  // insight candidate appended (aggregating their source links); the
  // original member candidates are NOT removed — they stay in the stream
  // (with a small confidence discount, since they're now redundant with a
  // stronger combined signal) so they remain real, independently-judged
  // candidates that can still surface in Explore & Expand. See
  // synthesize-insights.ts for the clustering/synthesis logic itself.
  const synthesized = synthesizeInsights(deduped, lang)

  // Anti-hallucination validation: every candidate that reaches the real
  // pipeline must point at a real, direct http(s) source — this is also
  // what quietly drops domain-agents.ts's "no live signals right now"
  // placeholder (it has no source URL by design) instead of letting it
  // masquerade as a real card. Mock/demo data never goes through this
  // function at all (see MOCK_MODE short-circuit in /api/run-agents).
  // Synthesized insight candidates carry a real lead-member URL/sourceName
  // (see synthesize-insights.ts), so they pass this same check honestly —
  // no special-casing needed here.
  return synthesized.filter(c => !!c.url && /^https?:\/\//i.test(c.url) && !!c.sourceName?.trim())
}
