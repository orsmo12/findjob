/**
 * DeveloperOpportunitiesAgent
 *
 * Goal: surface technologies worth learning, GitHub repos worth exploring,
 * open-source projects gaining traction, and useful tutorials — for
 * students, junior developers, and software developers leveling up.
 *
 * Sources: GitHub Search (new/trending repos), Hacker News (programming
 * discussion), Dev.to (tutorials).
 */

import type { RawItem } from '@/sources/types'
import type { AgentDefinition, CandidateItem } from '@/agents/base-agent'
import type { Lang } from '@/lib/i18n'
import { fetchGitHubRepos } from '@/sources/adapters/github-source'
import { fetchHackerNews } from '@/sources/adapters/hacker-news-source'
import { fetchDevToArticles } from '@/sources/adapters/devto-source'
import { pick, say, type Bi } from '@/lib/text-variants'

const PROGRAMMING_KEYWORDS = [
  'programming language', 'framework', 'open source', 'library', 'compiler',
  'rust', 'typescript', 'webassembly', 'database', 'performance', 'tooling',
]

function toCandidate(raw: RawItem, sourceReliability: number, lang: Lang): CandidateItem | null {
  const isRepo = raw.sourceName === 'GitHub'
  const stars = raw.rawScoreSignals.stars ?? 0
  const points = raw.rawScoreSignals.points ?? 0
  const reactions = raw.rawScoreSignals.reactions ?? 0
  const comments = raw.rawScoreSignals.comments ?? 0
  const seed = raw.id

  // Filter out clearly low-signal items: a brand-new repo with almost no
  // stars and no other signal isn't "worth exploring" yet.
  if (isRepo && stars < 5) return null

  const signalStrength = stars || points || reactions
  const confidence = Math.min(1, 0.4 + signalStrength / 500)

  const category: CandidateItem['category'] = isRepo ? 'Build' : 'Learn'

  const whyVariants: readonly Bi[] = isRepo
    ? [
        {
          he: `שווה להבין איזו בעיה הפרויקט הזה (${raw.tags[0] ?? 'חדש'}) בעצם פותר — הוא כבר צובר תאוצה אמיתית (${stars} כוכבים).`,
          en: `Worth understanding what problem this ${raw.tags[0] ?? 'new'} project actually solves — it's already gaining real traction (${stars} stars).`,
        },
        {
          he: `הצצה מוקדמת לכיוון שאליו ${raw.tags[0] ?? 'כלי הפיתוח'} מתפתח — צובר עניין מהר מספיק (${stars} כוכבים בזמן קצר) שכדאי להכיר אותו לפני שהוא בכל מקום.`,
          en: `An early look at where ${raw.tags[0] ?? 'dev tooling'} is heading — picking up interest fast enough (${stars} stars in a short window) that it's worth knowing before it's everywhere.`,
        },
      ]
    : raw.sourceName === 'Hacker News'
    ? [
        {
          he: `שינוי ששווה להכיר לפני שהוא מתגבש — מפתחים דנים בו בפועל (${points} נקודות, ${comments} תגובות).`,
          en: `A shift worth knowing about before it's settled — developers are actively hashing it out (${points} points, ${comments} comments).`,
        },
        {
          he: `לא עמדת שוליים — זה דיון חי ומשמעותי בקהילת המפתחים (${points} נקודות, ${comments} תגובות) ששווה לגבש לגביו דעה משלכם.`,
          en: `Not a fringe take — this is a live, substantive debate in the developer community (${points} points, ${comments} comments) worth forming your own view on.`,
        },
      ]
    : [
        {
          he: `סביר שיחסוך לכם זמן מחקר ממשי — מאמר מעשי שמספיק מפתחים אחרים מתעניינים בו (${reactions} תגובות) כדי להעיד עליו.`,
          en: `Likely to save you real research time — a practical write-up enough other developers are engaging with it (${reactions} reactions) to vouch for it.`,
        },
        {
          he: `קונקרטי מספיק שקהל מפתחים בפועל התעסק בו (${reactions} תגובות) במקום לגלול הלאה — בדרך כלל סימן לתוכן ממשי, לא תיאוריה.`,
          en: `Concrete enough that a developer audience actually engaged with it (${reactions} reactions) rather than scrolling past — usually means real substance, not theory.`,
        },
      ]
  const whyItMightMatter = say(pick(whyVariants, seed), lang)

  const actionVariants: readonly Bi[] = isRepo
    ? [
        {
          he: 'עברו על ה-README, סמנו כוכב אם רלוונטי, וניסו להריץ אותו מקומית השבוע.',
          en: 'Skim the README, star it if relevant, and try running it locally this week.',
        },
        {
          he: 'עברו על הקוד ובדקו אם הוא פותר בעיה שרלוונטית לעבודה שלכם כרגע.',
          en: 'Look through the code and check whether it solves a problem relevant to your work right now.',
        },
      ]
    : [
        {
          he: 'קראו את המאמר עד הסוף וסמנו טכניקה אחת שאפשר להחיל על הפרויקט שלכם.',
          en: 'Read it end-to-end and note one technique you could apply to your own project.',
        },
        {
          he: 'עברו עליו במהירות ובדקו אם יש כאן רעיון אחד שאפשר לאמץ מיד.',
          en: 'Skim it for one idea you could put to use right away.',
        },
      ]
  const suggestedAngle = say(pick(actionVariants, `${seed}:action`), lang)

  return {
    id: `dev-opportunities-${raw.id}`,
    title: raw.title,
    summary: raw.summary,
    url: raw.url,
    sourceLinks: [{ label: raw.sourceName, url: raw.url }],
    agentId: 'dev_opportunities',
    domain: 'programming',
    category,
    tags: raw.tags,
    whyItMightMatter,
    suggestedAngle,
    rawSignals: raw.rawScoreSignals,
    confidence,
    sourceName: raw.sourceName,
    sourceReliability,
    publishedAt: raw.publishedAt,
  }
}

export const developerOpportunitiesAgent: AgentDefinition = {
  id: 'dev_opportunities',
  name: { en: 'Developer Opportunities Agent', he: 'סוכן הזדמנויות פיתוח' },
  domain: 'programming',
  goal: 'Surface technologies worth learning, repos worth exploring, and tutorials worth reading for developers leveling up.',
  getJobs: (lang: Lang) => [
    { sourceId: 'github', fetch: () => fetchGitHubRepos({ query: 'topic:developer-tools', limit: 6, sinceDays: 21, sort: 'stars', lang }) },
    { sourceId: 'github', fetch: () => fetchGitHubRepos({ query: 'topic:open-source', limit: 4, sinceDays: 14, sort: 'stars', lang }) },
    { sourceId: 'hacker_news', fetch: () => fetchHackerNews({ keywords: PROGRAMMING_KEYWORDS, limit: 6, lang }) },
    { sourceId: 'devto', fetch: () => fetchDevToArticles({ tag: 'programming', limit: 6, lang }) },
  ],
  toCandidate,
}
