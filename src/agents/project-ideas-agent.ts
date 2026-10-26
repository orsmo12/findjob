/**
 * ProjectIdeasAgent
 *
 * Goal: surface project ideas worth building and pain points that could
 * become a project or small startup — for builders looking for what to
 * work on next.
 *
 * Sources: Hacker News ("Show HN" / launch / side-project discussion),
 * GitHub (small new projects that look like starter-friendly ideas), RSS
 * (Y Combinator blog, already used for the startups domain).
 */

import type { RawItem } from '@/sources/types'
import type { AgentDefinition, CandidateItem } from '@/agents/base-agent'
import type { Lang } from '@/lib/i18n'
import { fetchHackerNews } from '@/sources/adapters/hacker-news-source'
import { fetchGitHubRepos } from '@/sources/adapters/github-source'
import { fetchRSSFeed } from '@/sources/adapters/rss-source'
import { pick, say, type Bi } from '@/lib/text-variants'

const PROJECT_KEYWORDS = [
  'show hn', 'side project', 'weekend project', 'i built', 'launched',
  'idea', 'startup', 'indie', 'solo founder', 'mvp',
]

function toCandidate(raw: RawItem, sourceReliability: number, lang: Lang): CandidateItem | null {
  const isRepo = raw.sourceName === 'GitHub'
  const stars = raw.rawScoreSignals.stars ?? 0
  const points = raw.rawScoreSignals.points ?? 0
  const seed = raw.id

  if (isRepo && stars < 3) return null

  const confidence = Math.min(1, 0.4 + (stars || points || 30) / 400)
  const category: CandidateItem['category'] = isRepo ? 'Build' : 'Trend'

  const whyVariants: readonly Bi[] = isRepo
    ? [
        {
          he: `תבנית מציאותית לפרויקט משלכם — קטן, הושק לאחרונה, וכבר אושר בעניין מוקדם (${stars} כוכבים).`,
          en: `A realistic template for a project of your own — small, recently started, and already validated by early interest (${stars} stars).`,
        },
        {
          he: `נקודת פתיחה ריאלית, לא תיאוריה — מישהו בנה את זה לאחרונה וזה כבר מרוויח עניין (${stars} כוכבים).`,
          en: `A realistic starting point, not a theory — someone built this recently and it's already earning interest (${stars} stars).`,
        },
      ]
    : [
        {
          he: `איתות חי לבעיות שאנשים בפועל פותרים כרגע — בונים דנים בזה באופן פעיל (${points} נקודות).`,
          en: `A live signal of what problems people are actually solving right now — builders are actively discussing it (${points} points).`,
        },
        {
          he: `סימן שהבעיה הזו אמיתית ומשותפת, ולא רק שלכם — מספיק בונים מתבטאים בנושא כדי להוכיח את זה (${points} נקודות).`,
          en: `A sign this problem is real and shared, not just yours — enough builders are weighing in to prove it (${points} points).`,
        },
      ]
  const whyItMightMatter = say(pick(whyVariants, seed), lang)

  const actionVariants: readonly Bi[] = isRepo
    ? [
        {
          he: 'השתמשו בזה כארכיטקטורת התייחסות, או עשו פורק כנקודת פתיחה לגרסה שלכם.',
          en: 'Use this as a reference architecture, or fork it as a starting point for your own version.',
        },
        {
          he: 'עברו על המבנה שלו ושאלו מה הייתם משנים בגרסה שלכם.',
          en: 'Look through its structure and ask what you\'d do differently in your own version.',
        },
      ]
    : [
        {
          he: 'שאלו את עצמכם: אפשר לבנות גרסה קטנה ומהירה יותר מזה בסוף שבוע?',
          en: 'Ask: could I build a smaller, faster version of this in a weekend?',
        },
        {
          he: 'קראו את הדיון וחפשו את הפרט שעדיין אף אחד לא פתר טוב — זו ההזדמנות.',
          en: 'Read the discussion and look for the one detail nobody\'s solved well yet — that\'s the opening.',
        },
      ]
  const suggestedAngle = say(pick(actionVariants, `${seed}:action`), lang)

  return {
    id: `project-ideas-${raw.id}`,
    title: raw.title,
    summary: raw.summary,
    url: raw.url,
    sourceLinks: [{ label: raw.sourceName, url: raw.url }],
    agentId: 'project_ideas',
    domain: 'startups',
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

export const projectIdeasAgent: AgentDefinition = {
  id: 'project_ideas',
  name: { en: 'Project Ideas Agent', he: 'סוכן רעיונות לפרויקטים' },
  domain: 'startups',
  goal: 'Surface project ideas and pain points worth building into a project or small startup.',
  getJobs: (lang: Lang) => [
    { sourceId: 'hacker_news', fetch: () => fetchHackerNews({ keywords: PROJECT_KEYWORDS, limit: 7, lang }) },
    { sourceId: 'github', fetch: () => fetchGitHubRepos({ query: 'topic:starter-project', limit: 4, sinceDays: 30, sort: 'stars', lang }) },
    { sourceId: 'rss_generic', fetch: () => fetchRSSFeed({ url: 'https://www.ycombinator.com/blog/rss', label: 'Y Combinator', limit: 5, lang }) },
  ],
  toCandidate,
}
