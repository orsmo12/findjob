/**
 * CareerSignalsAgent
 *
 * Goal: surface career signals and in-demand skills — hiring trends,
 * what skills companies are asking for, and what the dev-job market is
 * talking about — for students and junior developers planning their next
 * move.
 *
 * Sources: Hacker News (hiring threads), Dev.to (career-tagged posts),
 * GitHub (what skills/technologies are showing up in active job-adjacent
 * tooling — used lightly here, primary signal is HN + Dev.to).
 */

import type { RawItem } from '@/sources/types'
import type { AgentDefinition, CandidateItem } from '@/agents/base-agent'
import type { Lang } from '@/lib/i18n'
import { fetchHackerNews } from '@/sources/adapters/hacker-news-source'
import { fetchDevToArticles } from '@/sources/adapters/devto-source'
import { pick, say, type Bi } from '@/lib/text-variants'

const CAREER_KEYWORDS = [
  'hiring', 'who is hiring', 'job', 'remote work', 'salary', 'interview',
  'career', 'layoffs', 'resume', 'junior developer',
]

function toCandidate(raw: RawItem, sourceReliability: number, lang: Lang): CandidateItem | null {
  const points = raw.rawScoreSignals.points ?? 0
  const reactions = raw.rawScoreSignals.reactions ?? 0
  const signal = points || reactions

  if (signal === 0 && raw.sourceName !== 'Hacker News') return null

  const confidence = Math.min(1, 0.4 + signal / 400)
  const seed = raw.id

  // 2 deterministic phrasings per branch — same item always renders the
  // same pick (no flicker), different items land on different variants so
  // a wall of HN/Dev.to career cards doesn't read as the identical
  // sentence with only the number swapped in.
  const whyVariants: readonly Bi[] = raw.sourceName === 'Hacker News'
    ? [
        {
          he: `קריאה ישירה על מה שהשוק באמת מבקש כרגע — השרשור הזה מושך מעורבות אמיתית (${points} נקודות).`,
          en: `A direct read on what the job market is actually demanding right now — this hiring thread is drawing real engagement (${points} points).`,
        },
        {
          he: `קריאה חדה ועדכנית יותר על מה שחברות בפועל מגייסות אליו מכל דוח מגמות כללי — וזה קורה ממש עכשיו (${points} נקודות).`,
          en: `A sharper, more current read on what companies are actually hiring for than any generic trends report — and it's live right now (${points} points).`,
        },
      ]
    : [
        {
          he: `עצה קונקרטית בנושא קריירה שמפתחים אחרים כבר בדקו ומצאו שימושית (${reactions} תגובות) — פחות ניחושים על המסלול שלכם.`,
          en: `Concrete career advice other developers already vetted as useful (${reactions} reactions) — less guesswork on your own path.`,
        },
        {
          he: `מעשי מספיק כך שמפתחים אחרים בפועל פעלו לפיו (${reactions} תגובות) — סוג העצה שהיא קונקרטית ולא כללית.`,
          en: `Practical enough that other developers actually acted on it (${reactions} reactions) — the kind of advice that's concrete, not generic.`,
        },
      ]
  const whyItMightMatter = say(pick(whyVariants, seed), lang)

  const isHiringTitle = raw.title.toLowerCase().includes('hiring')
  const actionVariants: readonly Bi[] = isHiringTitle
    ? [
        {
          he: 'חפשו כישורים/טכנולוגיות שחוזרים על עצמם — זו רשימת הלימוד שלכם.',
          en: 'Scan for the skills/stacks mentioned repeatedly — that’s your study list.',
        },
        {
          he: 'בדקו כמה מודעות מזכירות את אותם 2-3 כישורים — התדירות הזו שימושית יותר ממודעה בודדת.',
          en: 'Count how many listings mention the same 2-3 skills — that frequency is more useful than any single posting.',
        },
      ]
    : [
        {
          he: 'השוו את העצה הזו לפערים בקורות החיים/בתיק העבודות שלכם.',
          en: 'Compare this advice against your own resume/portfolio gaps.',
        },
        {
          he: 'בחרו את ההמלצה הכי קלה לביצוע השבוע מתוך הכתבה הזו, ובצעו אותה.',
          en: 'Pick the one suggestion here that\'s easiest to act on this week, and actually do it.',
        },
      ]
  const suggestedAngle = say(pick(actionVariants, `${seed}:action`), lang)

  return {
    id: `career-signals-${raw.id}`,
    title: raw.title,
    summary: raw.summary,
    url: raw.url,
    sourceLinks: [{ label: raw.sourceName, url: raw.url }],
    agentId: 'career_signals',
    domain: 'career',
    category: 'Career',
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

export const careerSignalsAgent: AgentDefinition = {
  id: 'career_signals',
  name: { en: 'Career Signals Agent', he: 'סוכן איתותי קריירה' },
  domain: 'career',
  goal: 'Surface hiring trends and in-demand skills for students and junior developers planning their next move.',
  getJobs: (lang: Lang) => [
    { sourceId: 'hacker_news', fetch: () => fetchHackerNews({ keywords: CAREER_KEYWORDS, limit: 7, lang }) },
    { sourceId: 'devto', fetch: () => fetchDevToArticles({ tag: 'career', limit: 5, lang }) },
  ],
  toCandidate,
}
