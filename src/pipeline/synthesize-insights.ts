/**
 * Cross-item synthesis — the pipeline stage between dedupe and the
 * Judgment Engine that turns "15 similar cards" into "one stronger
 * insight + its sources."
 *
 * CandidateItems → topic clustering → insight synthesis. Clustering is
 * done at the Life Domain GROUP level (career_business / technology /
 * investing_finance / real_estate / sports / travel / health_fitness /
 * custom — see '@/lib/domains'), not the raw granular `domain` string,
 * because the group is the level BoardCard always renders on the card
 * badge (see domains.ts / BoardCard.tsx) — a cluster that's "valid" at
 * the granular level but spans two groups would never read as one
 * coherent thing to the user looking at the badge.
 *
 * Within a group, items are clustered by significant keyword overlap
 * between `title`+`summary` (stopword-filtered, deterministic, no LLM —
 * per the zero-cost/no-API-key product constraint). A cluster of 2+
 * members produces ONE additional synthesized CandidateItem (aggregating
 * every member's source links — "keep source links to all supporting
 * items").
 *
 * Insights over posts (Part 2, beta-readiness directive): once a cluster's
 * members have been folded into a synthesized insight, those member items
 * are dropped from the stream entirely — they no longer compete for a
 * separate board slot. The synthesized item already carries their combined
 * signal and every one of their source links, so keeping both around would
 * mean the same pattern shows up once as "the insight" and again as 2-5
 * ordinary-looking duplicate cards. "Prefer presenting the pattern" means
 * exactly one card per real pattern, not a discounted echo of each member.
 * Items that never cluster (no real pattern found) are completely
 * untouched — synthesis never scores, discounts, or rewrites a genuinely
 * standalone item; it only ever adds a new item for a cluster it found.
 *
 * The synthesized item carries a real lead-member `url`/`sourceName` (the
 * highest-confidence, most-reliable member) so it honestly passes the
 * exact same anti-hallucination filter every other candidate does (see
 * run-agent-pipeline.ts) — no special-casing needed downstream.
 */

import type { CandidateItem, CandidateSourceLink } from '@/agents/base-agent'
import type { Lang } from '@/lib/i18n'
import { getLifeDomainGroupId, LIFE_DOMAIN_GROUPS, type LifeDomainGroupId } from '@/lib/domains'
import { pick, say, cleanSourceName, seedHash, type Bi } from '@/lib/text-variants'

// ─── Tuning constants ──────────────────────────────────────────────────
// Conservative on purpose: under-clustering (a real pattern stays as
// separate cards) is a safe failure; over-clustering (unrelated items
// forced into one "insight") is the failure mode that would actually
// damage trust, so the threshold/cap below both lean cautious.

const MIN_SHARED_KEYWORDS = 2   // members must share at least this many significant keywords with the cluster's seed item
const MAX_CLUSTER_SIZE = 5      // caps one dominant theme from swallowing everything in a busy group

// ─── Keyword extraction ────────────────────────────────────────────────
// Deterministic, pure-JS, language-agnostic tokenizing (Unicode letter/
// number classes so Hebrew and English both split correctly on
// punctuation/whitespace) plus a small EN+HE stopword list. No NLP
// library, no Math.random — same text always yields the same keyword set.

const STOPWORDS = new Set<string>([
  // English
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'about', 'into', 'your', 'their',
  'are', 'was', 'were', 'has', 'have', 'will', 'can', 'not', 'but', 'all', 'new', 'more',
  'than', 'what', 'when', 'how', 'why', 'who', 'which', 'its', 'his', 'her', 'you', 'our',
  'out', 'use', 'used', 'using', 'over', 'under', 'per', 'via', 'now', 'just', 'also',
  'some', 'such', 'most', 'much', 'very', 'says', 'said', 'show', 'shows', 'make', 'makes',
  'made', 'one', 'two', 'get', 'gets', 'got', 'here', 'there', 'these', 'those', 'they',
  'them', 'then', 'still', 'after', 'before', 'being', 'been', 'because', 'while',
  'where', 'should', 'would', 'could', 'does', 'did', 'doing', 'off', 'down', 'up', 'on',
  'in', 'at', 'to', 'of', 'by', 'as', 'is', 'it', 'be', 'an', 'or', 'if', 'we', 'my', 'me',
  'live', 'news',
  // Hebrew
  'של', 'את', 'על', 'עם', 'אל', 'הוא', 'היא', 'הם', 'הן', 'זה', 'זו', 'זאת', 'אבל', 'כי',
  'גם', 'רק', 'לא', 'כן', 'יש', 'אין', 'מה', 'מי', 'איך', 'למה', 'כאשר', 'בין', 'אחר',
  'אחרי', 'לפני', 'כל', 'עוד', 'כבר', 'הזה', 'הזו', 'אלה', 'אלו', 'שלו', 'שלה', 'שלהם',
  'שלנו', 'שלי', 'שלך', 'אני', 'אתה', 'אנחנו', 'הייתי', 'יהיה', 'להיות', 'בתוך',
  'כדי', 'אם', 'או', 'כך', 'כמו', 'עד', 'תוך', 'פריט', 'עדכון',
])

function extractKeywords(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(tok => tok.length >= 3 && !STOPWORDS.has(tok) && !/^\d+$/.test(tok))
  return new Set(tokens.slice(0, 40)) // bound cost on long summaries
}

function sharedKeywordCount(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const k of a) if (b.has(k)) n++
  return n
}

// ─── Clustering ────────────────────────────────────────────────────────

interface ClusterMember {
  item: CandidateItem
  keywords: Set<string>
}

// Greedy, single-pass, order-stable (no Math.random, no re-sorting by
// score) — the same input array always produces the same clusters. Each
// unclustered item becomes a new cluster "seed"; later unclustered items
// join it once they share >= MIN_SHARED_KEYWORDS with that seed.
function clusterGroup(members: ClusterMember[]): ClusterMember[][] {
  const clusters: ClusterMember[][] = []
  const used = new Array(members.length).fill(false)

  for (let i = 0; i < members.length; i++) {
    if (used[i] || members[i].keywords.size === 0) continue
    const cluster = [members[i]]
    used[i] = true
    for (let j = i + 1; j < members.length && cluster.length < MAX_CLUSTER_SIZE; j++) {
      if (used[j]) continue
      if (sharedKeywordCount(members[i].keywords, members[j].keywords) >= MIN_SHARED_KEYWORDS) {
        cluster.push(members[j])
        used[j] = true
      }
    }
    if (cluster.length >= 2) clusters.push(cluster)
  }

  return clusters
}

// ─── Synthesis ─────────────────────────────────────────────────────────

function isRealCandidate(c: CandidateItem): boolean {
  // Mirrors run-agent-pipeline.ts's final anti-hallucination filter — kept
  // local (not imported) since that filter is a one-line inline check,
  // not an exported helper. Applied here too so clustering only ever
  // operates on candidates that could legitimately reach the board, and
  // so the synthesized item's lead member is guaranteed to have a real
  // url/sourceName to inherit.
  return !!c.url && /^https?:\/\//i.test(c.url) && !!c.sourceName?.trim()
}

function pickLead(cluster: ClusterMember[]): CandidateItem {
  // Stable sort (spec-guaranteed since ES2019) — ties keep original
  // array order, so this is fully deterministic.
  return [...cluster]
    .sort((a, b) => {
      if (b.item.confidence !== a.item.confidence) return b.item.confidence - a.item.confidence
      return b.item.sourceReliability - a.item.sourceReliability
    })[0].item
}

// The keyword shared by the most cluster members (not a strict
// intersection — a greedy cluster's later members were only checked
// against the seed, not against each other, so a true all-member
// intersection can be empty even for a valid cluster). Every shared-
// with-seed keyword is, by construction, shared by at least the seed +
// one other member, so this always resolves to a real, non-empty theme
// for any cluster built by clusterGroup().
function themeKeyword(cluster: ClusterMember[]): string | null {
  const freq = new Map<string, number>()
  for (const m of cluster) {
    for (const k of m.keywords) freq.set(k, (freq.get(k) ?? 0) + 1)
  }
  const shared = [...freq.entries()].filter(([, n]) => n >= 2)
  if (shared.length === 0) return null
  shared.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]            // most frequent first
    if (b[0].length !== a[0].length) return b[0].length - a[0].length // more specific (longer) first
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0      // deterministic alphabetical tie-break
  })
  return shared[0][0]
}

function prettyTheme(theme: string, lang: Lang): string {
  if (lang === 'he') return theme
  return theme.charAt(0).toUpperCase() + theme.slice(1)
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

// First value to reach the highest occurrence count wins ties (the order
// values are passed in is the cluster's own deterministic order).
function mode<T>(values: T[]): T {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = values[0]
  let bestCount = 0
  for (const v of values) {
    const c = counts.get(v)!
    if (c > bestCount) {
      bestCount = c
      best = v
    }
  }
  return best
}

function mostRecentPublishedAt(cluster: ClusterMember[]): string | undefined {
  const dates = cluster.map(m => m.item.publishedAt).filter((d): d is string => !!d)
  if (dates.length === 0) return undefined
  return dates.reduce((latest, d) => (new Date(d).getTime() > new Date(latest).getTime() ? d : latest))
}

function aggregateSourceLinks(cluster: ClusterMember[]): CandidateSourceLink[] {
  const seen = new Set<string>()
  const links: CandidateSourceLink[] = []
  for (const m of cluster) {
    const itemLinks: CandidateSourceLink[] = m.item.sourceLinks.length > 0
      ? m.item.sourceLinks
      : [{ label: m.item.sourceName, url: m.item.url }]
    for (const link of itemLinks) {
      if (!link.url || seen.has(link.url)) continue
      seen.add(link.url)
      links.push({ label: cleanSourceName(link.label), url: link.url })
    }
  }
  return links
}

function groupLabel(groupId: LifeDomainGroupId, lang: Lang): string {
  const group = LIFE_DOMAIN_GROUPS.find(g => g.id === groupId)
  return group ? group.label[lang] : groupId
}

function buildSynthesizedInsight(cluster: ClusterMember[], groupId: LifeDomainGroupId, lang: Lang): CandidateItem {
  const n = cluster.length
  const lead = pickLead(cluster)
  const domainLabel = groupLabel(groupId, lang)
  const theme = themeKeyword(cluster)
  const themeLabel = theme ? prettyTheme(theme, lang) : domainLabel
  const leadTitle = truncate(lead.title, 70)

  // Seed for deterministic 2-variant text selection — built from sorted
  // member urls so the same cluster always picks the same variant
  // regardless of the order items happened to arrive in this run.
  const seed = cluster.map(m => m.item.url).sort().join('|')

  const titleVariants: Bi[] = [
    {
      he: `${n} מקורות שונים מצביעים על מגמה אחת ב${domainLabel}, סביב: "${leadTitle}"`,
      en: `${n} separate sources are converging on one ${domainLabel} pattern, starting from: "${leadTitle}"`,
    },
    {
      he: `מגמה חוזרת ב${domainLabel} השבוע — "${leadTitle}" ועוד ${n - 1} מקורות שמדברים על אותו דבר`,
      en: `A recurring ${domainLabel} pattern this week — "${leadTitle}" and ${n - 1} more sources saying the same thing`,
    },
  ]

  const otherNames = cluster
    .filter(m => m.item !== lead)
    .slice(0, 2)
    .map(m => cleanSourceName(m.item.sourceName))
  const namesPart = otherNames.length > 0
    ? (lang === 'he' ? ` (כולל ${otherNames.join(' ו')})` : ` (including ${otherNames.join(' and ')})`)
    : ''

  const summaryVariants: Bi[] = [
    {
      he: `${n} פריטים נפרדים מ-${n} מקורות${namesPart} עוסקים בפועל באותה מגמה ב${domainLabel} השבוע — לא נראה כצירוף מקרים.`,
      en: `${n} separate items from ${n} sources${namesPart} are independently covering the same ${domainLabel} pattern this week — unlikely to be a coincidence.`,
    },
    {
      he: `בין כל מה שעלה השבוע ב${domainLabel}, ${n} פריטים נפרדים חזרו על אותה נקודה — סימן שזה איתות אמיתי ולא רעש.`,
      en: `Across everything new in ${domainLabel} this week, ${n} separate items kept circling back to the same point — a sign this is signal, not noise.`,
    },
  ]

  const whyVariants: Bi[] = [
    {
      he: `כשכמה מקורות בלתי תלויים מזכירים את "${themeLabel}" באותו שבוע, הסיכוי שזו מגמה אמיתית ב${domainLabel} (ולא כתבה בודדת) עולה משמעותית.`,
      en: `When several independent sources mention "${themeLabel}" in the same week, the odds this is a real ${domainLabel} trend — not a one-off story — go up significantly.`,
    },
    {
      he: `איתות בודד אפשר להתעלם ממנו; ${n} איתותים נפרדים שמצביעים על "${themeLabel}" ב${domainLabel} קשה יותר להתעלם מהם.`,
      en: `One signal is easy to ignore; ${n} different ones all pointing at "${themeLabel}" in ${domainLabel} are harder to wave off.`,
    },
  ]

  const actionVariants: Bi[] = [
    {
      he: `עברו על ${n} המקורות המקושרים, השוו את הזוויות שלהם, והחליטו אם זה משנה את התוכניות הקרובות שלכם ב${domainLabel}.`,
      en: `Skim through the ${n} linked sources, compare their angles, and decide whether it changes your near-term plans in ${domainLabel}.`,
    },
    {
      he: `קודם תקראו את המקור המוביל, ואז עברו במהירות על השאר ובדקו אם כולם מסכימים על אותה מגמה ב${domainLabel}.`,
      en: `Start with the lead source, then skim the rest to see whether they all agree on the same ${domainLabel} pattern.`,
    },
  ]

  const avgConfidence = cluster.reduce((s, m) => s + m.item.confidence, 0) / n
  const avgReliability = Math.round(cluster.reduce((s, m) => s + m.item.sourceReliability, 0) / n)

  return {
    id: `synthesis-${groupId}-${seedHash(seed)}`,
    title: say(pick(titleVariants, seed), lang),
    summary: say(pick(summaryVariants, `${seed}:summary`), lang),
    url: lead.url,
    sourceLinks: aggregateSourceLinks(cluster),
    agentId: `synthesis:${groupId}`,
    domain: mode(cluster.map(m => m.item.domain)),
    category: mode(cluster.map(m => m.item.category)),
    tags: Array.from(new Set(cluster.flatMap(m => m.item.tags))),
    whyItMightMatter: say(pick(whyVariants, `${seed}:why`), lang),
    suggestedAngle: say(pick(actionVariants, `${seed}:action`), lang),
    // `cluster_size` is the signal the Explanation Engine reads (via
    // judgment-engine.ts's ExplanationFacts.clusterSize) to switch this
    // card's why_seeing/why_this_week framing onto "N independent sources"
    // instead of single-item signal/freshness framing. The cluster's
    // member items are dropped from the stream once absorbed (see
    // synthesizeInsights() below), so this key is only ever set here, on
    // the one synthesized card representing the whole pattern.
    rawSignals: { cluster_size: n },
    confidence: Math.min(0.97, avgConfidence + 0.05),
    sourceName: cleanSourceName(lead.sourceName),
    sourceReliability: Math.max(1, Math.min(10, avgReliability)),
    publishedAt: mostRecentPublishedAt(cluster),
  }
}

/**
 * CandidateItems → topic clustering → insight synthesis. See file header
 * for the full design. Signature fixed by run-agent-pipeline.ts's
 * existing call site.
 */
export function synthesizeInsights(deduped: CandidateItem[], lang: Lang): CandidateItem[] {
  const real = deduped.filter(isRealCandidate)
  const ineligible = deduped.filter(c => !isRealCandidate(c))

  const members: (ClusterMember & { groupId: LifeDomainGroupId })[] = real.map(item => ({
    item,
    keywords: extractKeywords(`${item.title} ${item.summary}`),
    groupId: getLifeDomainGroupId(item.domain),
  }))

  const byGroup = new Map<LifeDomainGroupId, ClusterMember[]>()
  for (const m of members) {
    const list = byGroup.get(m.groupId)
    if (list) list.push(m)
    else byGroup.set(m.groupId, [m])
  }

  const synthesizedItems: CandidateItem[] = []
  const absorbed = new Set<CandidateItem>()

  for (const [groupId, groupMembers] of byGroup) {
    for (const cluster of clusterGroup(groupMembers)) {
      synthesizedItems.push(buildSynthesizedInsight(cluster, groupId, lang))
      for (const m of cluster) absorbed.add(m.item)
    }
  }

  // Insights over posts: a clustered member's signal now lives entirely in
  // the synthesized item above, so it's removed from the stream rather than
  // kept (even at a discount) to compete for the same board slot. Items
  // that never matched a cluster are returned exactly as they came in.
  const passthroughReal = real.filter(item => !absorbed.has(item))
  return [...passthroughReal, ...ineligible, ...synthesizedItems]
}
