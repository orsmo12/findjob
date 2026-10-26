/**
 * AITrendsAgent
 *
 * Goal: surface AI tools worth trying, AI research worth reading, and
 * early AI dev-community trends — for AI builders and developers tracking
 * the field.
 *
 * Sources: arXiv (new papers), Hacker News (AI discussion), generic RSS
 * (AI/tech blog feed already configured for the ai_tech domain).
 */

import type { RawItem } from '@/sources/types'
import type { AgentDefinition, CandidateItem } from '@/agents/base-agent'
import type { Lang } from '@/lib/i18n'
import { fetchArxivPapers } from '@/sources/adapters/arxiv-source'
import { fetchHackerNews } from '@/sources/adapters/hacker-news-source'
import { fetchRSSFeed } from '@/sources/adapters/rss-source'
import { pick, say, type Bi } from '@/lib/text-variants'

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'openai', 'anthropic', 'claude', 'gemini', 'copilot',
  'machine learning', 'neural', 'transformer', 'agent', 'model', 'inference',
]

function toCandidate(raw: RawItem, sourceReliability: number, lang: Lang): CandidateItem | null {
  const isPaper = raw.sourceName === 'arXiv'
  const points = raw.rawScoreSignals.points ?? 0
  const seed = raw.id

  const confidence = Math.min(1, 0.45 + (points || 50) / 600)

  const category: CandidateItem['category'] = isPaper ? 'Learn' : 'Trend'

  const whyVariants: readonly Bi[] = isPaper
    ? [
        {
          he: `מחקר חדש מ${raw.author ?? 'קהילת מחקר ה-AI'} — רלוונטי אם אתם עוקבים אחרי לאן יכולות ה-AI מתפתחות.`,
          en: `New research from ${raw.author ?? 'the AI research community'} — relevant if you're tracking where AI capabilities are heading.`,
        },
        {
          he: `פרסום ראשוני, לא מסונן, מ${raw.author ?? 'קהילת מחקר ה-AI'} — שווה הצצה לפני שזה מתורגם לכתבות פופולריות.`,
          en: `A primary, unfiltered publication from ${raw.author ?? 'the AI research community'} — worth a look before it gets filtered through popular coverage.`,
        },
      ]
    : raw.sourceName === 'Hacker News'
    ? [
        {
          he: `קריאה מוקדמת על מה שעומד להיות חשוב בכלי AI — מפתחים כבר מתדיינים על זה במספרים (${points} נקודות).`,
          en: `An early read on what's about to matter in AI tooling — developers are already debating it in numbers (${points} points).`,
        },
        {
          he: `שווה להכיר לפני שזה הופך למיינסטרים — מפתחי AI דנים בזה בפועל ולא מניחים לזה לעבור בשתיקה (${points} נקודות).`,
          en: `Worth knowing about before it's mainstream — AI developers are actively debating this rather than letting it pass quietly (${points} points).`,
        },
      ]
    : [
        {
          he: 'התפתחות בתחום ה-AI ששווה לעקוב אחריה לפני שהיא משפיעה על הכלים שתצטרכו לבחור בינם בהמשך.',
          en: "A development in AI worth tracking before it shapes the tools you'll be choosing between next.",
        },
        {
          he: 'איתות טרי לכיוון שאליו מתפתח השיח על AI השבוע — קונטקסט שימושי למה שאתם עוקבים אחריו כבר.',
          en: "A fresh signal of where the AI conversation is heading this week — useful context for what you're already tracking.",
        },
      ]
  const whyItMightMatter = say(pick(whyVariants, seed), lang)

  const actionVariants: readonly Bi[] = isPaper
    ? [
        {
          he: 'קראו קודם את התקציר והמסקנות; העמיקו רק אם זה נוגע למשהו שאתם בונים.',
          en: 'Read the abstract and conclusion first; only go deeper if it touches something you’re building.',
        },
        {
          he: 'עברו על המתודולוגיה ושאלו אם היא משנה משהו בהבנה שלכם על תחום ה-AI.',
          en: 'Skim the methodology and ask whether it shifts your understanding of the field.',
        },
      ]
    : [
        {
          he: 'בדקו אם זה משנה בחירת כלי/ספרייה שעמדתם לקבל.',
          en: 'Note whether this changes any tool/library choice you were about to make.',
        },
        {
          he: 'עברו על הדיון/הכתבה וסמנו טכניקה אחת שאפשר להחיל מיד.',
          en: 'Skim the discussion/piece and note one technique you could apply right away.',
        },
      ]
  const suggestedAngle = say(pick(actionVariants, `${seed}:action`), lang)

  return {
    id: `ai-trends-${raw.id}`,
    title: raw.title,
    summary: raw.summary,
    url: raw.url,
    sourceLinks: [{ label: raw.sourceName, url: raw.url }],
    agentId: 'ai_trends',
    domain: 'ai_tech',
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

export const aiTrendsAgent: AgentDefinition = {
  id: 'ai_trends',
  name: { en: 'AI Trends Agent', he: 'סוכן מגמות AI' },
  domain: 'ai_tech',
  goal: 'Surface AI tools worth trying, research worth reading, and early AI dev-community trends.',
  getJobs: (lang: Lang) => [
    { sourceId: 'arxiv', fetch: () => fetchArxivPapers({ query: 'cat:cs.AI OR cat:cs.CL OR cat:cs.LG', limit: 5 }) },
    { sourceId: 'hacker_news', fetch: () => fetchHackerNews({ keywords: AI_KEYWORDS, limit: 6, lang }) },
    { sourceId: 'rss_generic', fetch: () => fetchRSSFeed({ url: 'https://techcrunch.com/category/artificial-intelligence/feed/', label: 'TechCrunch AI', limit: 5, lang }) },
  ],
  toCandidate,
}
