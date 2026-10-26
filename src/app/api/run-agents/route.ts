import { NextRequest, NextResponse } from 'next/server'
import { runAgentPipeline } from '@/pipeline/run-agent-pipeline'
import { judge } from '@/agents/judgment-engine'
import { getPriorities, getMemoryContext, recordSurfaced } from '@/agents/memory-engine'
import { getMockGoals, getMockItems } from '@/lib/mock-data'
import { specialistLabel } from '@/lib/domains'
import { getWeekRange, formatGeneratedLabel } from '@/lib/week'
import { recencyEligibility } from '@/lib/recency'
import { getWeeklySnapshot, saveWeeklySnapshot, snapshotItemKey } from '@/lib/weekly-snapshot'
import { getProfile } from '@/lib/profile-store'
import { CURRENT_USER_ID } from '@/lib/constants'
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase'
import type { Lang } from '@/lib/i18n'
import type { BoardItem, RawItem, BoardItemSourceLink, LifeGoal } from '@/types'
import type { CandidateItem } from '@/agents/base-agent'
import { getLifeDomainGroup } from '@/lib/domains'
import { pick, say, type Bi } from '@/lib/text-variants'
import { developerOpportunitiesAgent } from '@/agents/developer-opportunities-agent'
import { aiTrendsAgent } from '@/agents/ai-trends-agent'
import { projectIdeasAgent } from '@/agents/project-ideas-agent'
import { careerSignalsAgent } from '@/agents/career-signals-agent'
import { marketSignalsAgent } from '@/agents/market-signals-agent'

export const maxDuration = 30 // seconds

// The primary layer is a "Weekly Brief," not a real-time feed: a small,
// curated set of the most important things from the last 7 days, never
// more than 15 and never fewer than 5 (backfilling from the next-best
// candidates if the strict quality bar alone doesn't reach 5 — an empty
// or near-empty weekly brief would break the product's core promise more
// than a slightly-lower-bar item would). Everything else that still
// cleared should_surface + recency goes to the secondary "Explore &
// Expand" layer instead of being dropped or crowding the primary feed.
const MAIN_BOARD_MIN = 5
const MAIN_BOARD_MAX = 15
const PRIMARY_LVS_THRESHOLD = 55 // bar for a primary "weekly brief" slot — stricter than the should_surface floor (40)
const SECONDARY_CAP = 24 // "Explore & Expand" is bounded too — still curated, just a deeper second layer

// Friendly display names for the 5 real MVP agents. Generic domain-agent
// candidates use agentId `generic:<domain>` (see run-agent-pipeline.ts) and
// fall back to the existing per-domain specialist label instead. This is a
// backend-only field (BoardItem.agent is never rendered by BoardCard — the
// card shows Domain + Source, per Part 1), kept for logging/debugging only.
const AGENT_LABELS: Record<string, { en: string; he: string }> = {
  dev_opportunities: developerOpportunitiesAgent.name,
  ai_trends: aiTrendsAgent.name,
  project_ideas: projectIdeasAgent.name,
  career_signals: careerSignalsAgent.name,
  market_signals: marketSignalsAgent.name,
}

function agentDisplayName(candidate: CandidateItem, lang: Lang): string {
  if (AGENT_LABELS[candidate.agentId]) return AGENT_LABELS[candidate.agentId][lang]
  return candidate.agentId.startsWith('generic:') ? specialistLabel(candidate.domain, lang) : candidate.agentId
}

// Part 5 rebuild: Explore & Expand should read as distinct, legible shelves
// — "near misses," "learning opportunities," "emerging trends" — not one
// undifferentiated grid. Bucketed from data the run already computed (the
// gap to the Weekly Brief bar, and the category the agent/judgment already
// assigned) rather than inventing a new signal. Precedence: an item that
// barely missed the cut is more useful to flag as "almost made it" than as
// a generic Learn/Trend item, so near_miss is checked first.
const NEAR_MISS_GAP = 15 // LVS points below PRIMARY_LVS_THRESHOLD still counts as "almost made it"

function exploreBucket(item: BoardItem, goals: LifeGoal[]): NonNullable<BoardItem['explore_bucket']> {
  const gap = PRIMARY_LVS_THRESHOLD - item.lvs
  if (gap > 0 && gap <= NEAR_MISS_GAP) return 'near_miss'
  if (goals.some(g => g.active && g.domain === item.domain)) return 'goal_match'
  if (item.category === 'Learn') return 'learning'
  if (item.category === 'Trend') return 'trend'
  return 'more'
}

// Part 5/6: every item must be able to answer "why is it placed where it
// is," not just "why was it surfaced at all" (why_seeing/why_matters cover
// that, and why_this_week covers "why this week" — see judgment-engine.ts).
// This answers the narrower, structural question of Weekly Brief vs.
// Explore & Expand specifically. Secondary items reuse the same
// explore_bucket the UI already groups shelves by, so the placement text
// an item shows and the shelf it lands on can never disagree with each
// other.
//
// Expanded from the original 7 fixed sentences (1 per case, identical
// wording for every item that landed in a given case) to 2 deterministic
// variants per case, each grounded in the actual run: the item's own LVS
// score, its Life Domain group, the real point-gap to the Weekly Brief
// threshold (near_miss), or the actual matched goal text (goal_match) —
// rather than a generic templated sentence repeated across every item in
// the bucket.
function placementReason(
  item: BoardItem,
  isPrimary: boolean,
  bucket: NonNullable<BoardItem['explore_bucket']> | null,
  goals: LifeGoal[],
  lang: Lang
): string {
  const domainLabel = getLifeDomainGroup(item.domain).label[lang]
  const seed = `${item.domain}:${item.title}:placement`

  if (isPrimary) {
    if (item.lvs >= PRIMARY_LVS_THRESHOLD) {
      const variants: readonly Bi[] = [
        {
          he: `אחד הפריטים החזקים ביותר שנבדקו השבוע בתחום ${domainLabel} — נבחר לתקציר השבוע ולא לגילוי והרחבה.`,
          en: `One of the strongest ${domainLabel} items reviewed this week — placed in the Weekly Brief rather than Explore & Expand.`,
        },
        {
          he: `מדורג בין הפריטים המובילים בתחום ${domainLabel} השבוע — זו הסיבה שהוא בתקציר השבוע ולא בגילוי והרחבה.`,
          en: `This ranked among this week's top ${domainLabel} items — that's why it's in the Weekly Brief rather than Explore & Expand.`,
        },
      ]
      return say(pick(variants, seed), lang)
    }
    const backfillVariants: readonly Bi[] = [
      {
        he: `תקציר השבוע בתחום ${domainLabel} היה דליל מהרגיל הפעם, אז הפריט הזה נכלל כדי לשמור על מינימום פריטים שמשתלם לקרוא.`,
        en: `This week's ${domainLabel} brief had fewer strong candidates than usual, so this item was included to keep the brief at a worthwhile minimum.`,
      },
      {
        he: `לא עבר את הסף הרגיל הפעם, אבל נכלל כדי שתקציר השבוע בתחום ${domainLabel} לא יישאר ריק מדי.`,
        en: `It didn't clear the usual bar this time, but was included so this week's ${domainLabel} brief wouldn't end up too thin.`,
      },
    ]
    return say(pick(backfillVariants, seed), lang)
  }

  switch (bucket) {
    case 'near_miss': {
      const variants: readonly Bi[] = [
        {
          he: `היה קרוב מאוד לכניסה לתקציר השבוע — איתות מוקדם שעדיין צריך קצת יותר אימות.`,
          en: `Came very close to making this week's brief — an early signal that still needs a bit more validation.`,
        },
        {
          he: `ממש מתחת לסף השבועי — קרוב, אבל לא קרוב מספיק לתקציר השבוע הפעם.`,
          en: `Just under this week's bar — close, but not quite close enough for the Weekly Brief this time.`,
        },
      ]
      return say(pick(variants, seed), lang)
    }
    case 'goal_match': {
      const matchedGoal = goals.find(g => g.active && g.domain === item.domain)
      const goalText = matchedGoal?.text ?? domainLabel
      const variants: readonly Bi[] = [
        {
          he: `רלוונטי למטרה שהגדרתם — "${goalText}" — אך לא דחוף מספיק כדי לתפוס מקום בתקציר השבוע. שווה לעקוב.`,
          en: `Relevant to a goal you've set — "${goalText}" — but not urgent enough to take a slot in this week's brief. Worth keeping an eye on.`,
        },
        {
          he: `קשור ישירות למטרה "${goalText}" שהגדרתם, גם אם הדחיפות שלו לא הצדיקה מקום בתקציר השבוע.`,
          en: `Connects directly to your goal "${goalText}", even though its urgency didn't earn it a spot in this week's brief.`,
        },
      ]
      return say(pick(variants, seed), lang)
    }
    case 'learning': {
      const variants: readonly Bi[] = [
        {
          he: `שימושי ללמידה והעמקה בתחום ${domainLabel}, אך בעדיפות נמוכה יותר מבחינת דחיפות לעומת תקציר השבוע.`,
          en: `Useful for learning and going deeper in ${domainLabel}, but lower urgency than what made this week's brief.`,
        },
        {
          he: `מתאים יותר לקריאת רקע בתחום ${domainLabel} מאשר לפעולה דחופה השבוע — לכן הוא כאן ולא בתקציר.`,
          en: `Better suited to background reading in ${domainLabel} than urgent action this week — that's why it's here and not in the brief.`,
        },
      ]
      return say(pick(variants, seed), lang)
    }
    case 'trend': {
      const variants: readonly Bi[] = [
        {
          he: `מגמה מוקדמת שכדאי להכיר בתחום ${domainLabel}, אך עדיין לא ברמת הביטחון הדרושה לתקציר השבוע.`,
          en: `An early ${domainLabel} trend worth knowing about, but not yet at the confidence level the Weekly Brief requires.`,
        },
        {
          he: `איתות מגמה בתחום ${domainLabel} ששווה לעקוב אחריו, לפני שהוא בשל מספיק לתקציר השבוע.`,
          en: `A ${domainLabel} trend signal worth tracking, before it's mature enough for the Weekly Brief.`,
        },
      ]
      return say(pick(variants, seed), lang)
    }
    default: {
      const variants: readonly Bi[] = [
        {
          he: `דורג מתחת לפריטים שתפסו מקום בתקציר השבוע — עדיין רלוונטי לתחום ${domainLabel}, רק לא בראש סדר העדיפויות כרגע.`,
          en: `Ranked below the items that took a slot in this week's brief — still relevant to ${domainLabel}, just not top of the list right now.`,
        },
        {
          he: `נחת בגילוי והרחבה בתחום ${domainLabel} הפעם, ולא בתקציר השבוע.`,
          en: `Landed in Explore & Expand for ${domainLabel} this time, not the Weekly Brief.`,
        },
      ]
      return say(pick(variants, seed), lang)
    }
  }
}

/**
 * Wraps a CandidateItem back into the generic RawItem shape the Judgment
 * Engine already knows how to score — with the pipeline's extra context
 * (category, why it might matter, suggested action, confidence, source
 * reliability) stuffed into `metadata`, which judgment-engine.ts now reads
 * as optional hints (actionabilityScore/confidenceScore/etc.). This is what
 * lets real-agent candidates and generic-agent candidates be judged side by
 * side through one unchanged `judge()` call.
 */
function candidateToGenericRawItem(candidate: CandidateItem, lang: Lang): RawItem {
  return {
    agent: agentDisplayName(candidate, lang),
    domain: candidate.domain,
    title: candidate.title,
    content: candidate.summary,
    source: candidate.sourceName,
    source_url: candidate.url,
    published_at: candidate.publishedAt,
    metadata: {
      ...candidate.rawSignals,
      urgency: candidate.rawSignals.urgency ?? Math.round(candidate.confidence * 100),
      category: candidate.category,
      why_it_might_matter: candidate.whyItMightMatter,
      suggested_angle: candidate.suggestedAngle,
      confidence_hint: candidate.confidence,
      source_quality_hint: candidate.sourceReliability,
    },
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Language is sent by the client (AppShell/BoardPage) so every piece of
  // generated text — agent labels, judgment explanations, why_this_week —
  // comes back in the UI's current language instead of always English.
  let lang: Lang = 'en'
  // Dev/admin escape hatch only (Product Stabilization directive): normal
  // Refresh must never set this. When true, this call bypasses the Weekly
  // Snapshot and rebuilds + overwrites it. See BoardPage.tsx's dev-only
  // "Regenerate Weekly Brief" control — there is no other caller that sets
  // this flag.
  let force = false
  try {
    const body = await request.json()
    if (body?.lang === 'he') lang = 'he'
    if (body?.force === true) force = true
  } catch {
    // No JSON body sent — default to English rather than failing the request.
  }

  const now = new Date()
  const week = {
    ...getWeekRange(now, lang),
    generated_at: now.toISOString(),
    generated_label: formatGeneratedLabel(now, lang),
  }

  // Mock mode short-circuit: real agents should not fake results, so when
  // MOCK_MODE is explicitly on, skip the pipeline entirely and return the
  // curated demo dataset instead of running (or faking) real agents.
  if (process.env.MOCK_MODE === 'true') {
    const items = getMockItems(lang)
    return NextResponse.json({
      ok: true,
      mock_mode: true,
      items_collected: items.length,
      items_surfaced: items.length,
      items_filtered: 0,
      elapsed_ms: 0,
      items,
      secondary_items: [],
      week,
    })
  }

  try {
    // 1. Get user priorities (feedback-adjusted, or set during onboarding)
    //    + memory summary first, so the agent run only fetches domains the
    //    user actually has active.
    const [priorities, memoryContext] = await Promise.all([
      getPriorities(CURRENT_USER_ID),
      getMemoryContext(CURRENT_USER_ID),
    ])
    const activeDomainIds = priorities.filter(p => p.active).map(p => p.domain)

    // 2. Run the real pipeline: Sources → RawItems → Agent Processing →
    //    CandidateItems. Domains mapped to one of the 4 MVP agents go
    //    through the new multi-source pipeline; everything else still goes
    //    through the existing generic domain-agent path — both come back as
    //    CandidateItems, deduped together.
    const candidates: CandidateItem[] = await runAgentPipeline(activeDomainIds, lang)
    console.log(`[RunAgents] ${candidates.length} candidates collected across ${activeDomainIds.length} active domains`)

    // 3. User profile — dual-path (Supabase row when configured, in-memory
    //    default otherwise), see src/lib/profile-store.ts.
    const userProfile = await getProfile(CURRENT_USER_ID)

    const rawItems = candidates.map(c => candidateToGenericRawItem(c, lang))
    const goals = getMockGoals(lang)

    const judgmentResults = await Promise.allSettled(
      rawItems.map(item =>
        judge({
          item,
          user_profile: userProfile,
          priorities,
          goals,
          memory_context: memoryContext,
          lang,
        })
      )
    )

    // 4. Build board items from judgment outputs. Recency eligibility is
    //    applied right here, before anything is split into primary/
    //    secondary — an item that's too stale shouldn't show up in either
    //    layer, and a 14-30 day item kept for exceptional relevance/impact
    //    gets is_older set so the UI marks it clearly either way.
    const allBoardItems: BoardItem[] = []
    for (const [i, result] of judgmentResults.entries()) {
      if (result.status !== 'fulfilled') {
        console.error(`[Judgment] failed for item ${i}:`, result.reason)
        continue
      }

      const judgment = result.value
      if (!judgment.should_surface) continue

      const raw = rawItems[i]
      const candidate = candidates[i]

      const { keep, isOlder } = recencyEligibility({
        relevance: judgment.relevance,
        impact: judgment.impact,
        published_at: raw.published_at,
      })
      if (!keep) continue

      const sourceLinks: BoardItemSourceLink[] = candidate.sourceLinks.length > 0
        ? candidate.sourceLinks
        : raw.source_url ? [{ label: raw.source, url: raw.source_url }] : []

      allBoardItems.push({
        id: crypto.randomUUID(),
        user_id: CURRENT_USER_ID,
        agent: raw.agent,
        domain: raw.domain,
        title: raw.title,
        why_seeing: judgment.why_seeing,
        why_matters: judgment.why_matters,
        action: judgment.action,
        lvs: judgment.lvs,
        relevance: judgment.relevance,
        impact: judgment.impact,
        urgency: judgment.urgency,
        novelty: judgment.novelty,
        attention_budget: judgment.attention_budget,
        source: raw.source,
        source_url: raw.source_url,
        raw_content: raw.content,
        category: judgment.category ?? candidate.category,
        confidence: judgment.confidence,
        source_links: sourceLinks,
        published_at: raw.published_at,
        is_older: isOlder,
        why_this_week: judgment.why_this_week,
        feedback: null,
        dismissed: false,
        created_at: new Date().toISOString(),
      })
    }

    // 5. Weekly Snapshot (Product Stabilization Directive #1) — once a
    //    Weekly Brief exists for this user+week+language, it stays fixed;
    //    refreshing must NOT rebuild or reshuffle it. Only Explore & Expand
    //    is recomputed fresh on every call. Keying by language too (not
    //    just user+week) means switching languages never replays the
    //    wrong-language brief — see weekly-snapshot.ts header for why.
    allBoardItems.sort((a, b) => b.lvs - a.lvs)

    const existingSnapshot = force ? null : await getWeeklySnapshot(CURRENT_USER_ID, week.start, lang)
    const isNewSnapshot = !existingSnapshot
    let primary: BoardItem[]

    if (existingSnapshot) {
      primary = existingSnapshot
    } else {
      // First generation of this week's brief (new week, new language this
      // week, or the very first run ever) — same min-5/max-15 backfill
      // logic as before, computed once and then frozen for the week.
      primary = allBoardItems.filter(i => i.lvs >= PRIMARY_LVS_THRESHOLD).slice(0, MAIN_BOARD_MAX)
      if (primary.length < MAIN_BOARD_MIN) {
        const ids = new Set(primary.map(i => i.id))
        for (const item of allBoardItems) {
          if (primary.length >= MAIN_BOARD_MIN) break
          if (!ids.has(item.id)) {
            primary.push(item)
            ids.add(item.id)
          }
        }
        primary.sort((a, b) => b.lvs - a.lvs)
      }
    }

    // Explore & Expand is always computed fresh from this run's full judged
    // pool, excluding anything already locked into the Weekly Brief
    // snapshot. Matched by stable content key, not id — every pipeline run
    // assigns a fresh UUID, so id alone can't detect "already in the brief."
    const primaryKeys = new Set(primary.map(snapshotItemKey))
    const secondary = allBoardItems.filter(i => !primaryKeys.has(snapshotItemKey(i))).slice(0, SECONDARY_CAP)

    // 5b. Placement explanation (Part 5/6) — grounded in the same bucket/
    //     threshold logic this run actually used, in plain language rather
    //     than a raw LVS/rank number. Secondary items are re-explained on
    //     every call since the pool they're judged against is fresh; primary
    //     items only get a placement_reason the one time they're frozen into
    //     the snapshot, so the explanation matches the run that actually
    //     produced this week's brief rather than being overwritten by a
    //     later, different run's ranking.
    for (const item of secondary) {
      item.explore_bucket = exploreBucket(item, goals)
      item.placement_reason = placementReason(item, false, item.explore_bucket, goals, lang)
    }
    if (isNewSnapshot) {
      for (const item of primary) {
        item.placement_reason = placementReason(item, true, null, goals, lang)
      }
      await saveWeeklySnapshot(CURRENT_USER_ID, week.start, lang, primary)
    }

    // 5c. Record what was shown to this user — the Memory Engine's novelty
    //     scoring (getTopicFamiliarity) reads this history on the *next*
    //     run to recognize repeats/near-duplicates. Both layers count as
    //     "shown" since Explore & Expand is still a real, visible surface.
    await recordSurfaced(CURRENT_USER_ID, [...primary, ...secondary])

    // 6. Persist this run's board items when Supabase is configured (both
    //    layers — secondary items are still real, judged board items, just
    //    not in this week's brief). No-op in in-memory mode: board items
    //    aren't kept server-side there (the client already holds the full
    //    item from this response; /api/feedback's mock-item fallback covers
    //    feedback on items that were never persisted).
    if (isSupabaseConfigured() && allBoardItems.length > 0) {
      try {
        const supabase = getSupabase()!
        const { error } = await supabase.from('board_items').insert(allBoardItems)
        if (error) throw error
      } catch (err) {
        console.error('[RunAgents] Supabase board_items insert failed:', err)
      }
    }

    const elapsed = Date.now() - startTime
    console.log(`[RunAgents] Complete. ${primary.length} primary + ${secondary.length} secondary items surfaced in ${elapsed}ms`)

    return NextResponse.json({
      ok: true,
      items_collected: rawItems.length,
      items_surfaced: primary.length,
      items_filtered: rawItems.length - primary.length,
      elapsed_ms: elapsed,
      items: primary,
      secondary_items: secondary,
      week,
    })
  } catch (err) {
    console.error('[RunAgents] Error:', err)
    return NextResponse.json({ error: 'Agent run failed' }, { status: 500 })
  }
}
