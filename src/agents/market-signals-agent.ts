/**
 * MarketSignalsAgent (experimental)
 *
 * Goal: surface market research signals worth investigating — never buy/sell
 * recommendations, price targets, or portfolio advice. This agent's score
 * answers "how worth researching is this signal?", not "how likely is this
 * to make money?" Every candidate it produces gets the 'Market' category,
 * which BoardCard.tsx renders with a visible non-advice disclaimer.
 *
 * Kept secondary/experimental on purpose — the core MVP focus stays
 * students/junior devs/developers/AI builders/career signals. This domain
 * is opt-in and low default-priority (see lib/domains.ts).
 *
 * Sources: CoinGecko (trending search interest — not a price signal),
 * Federal Reserve press releases (real, primary-source monetary policy),
 * Hacker News (market/macro discussion threads).
 */

import type { RawItem } from '@/sources/types'
import type { AgentDefinition, CandidateItem } from '@/agents/base-agent'
import type { Lang } from '@/lib/i18n'
import { fetchCoinGeckoTrending } from '@/sources/adapters/coingecko-source'
import { fetchRSSFeed } from '@/sources/adapters/rss-source'
import { fetchHackerNews } from '@/sources/adapters/hacker-news-source'
import { pick, say, type Bi } from '@/lib/text-variants'

const MARKET_KEYWORDS = [
  'stock market', 'federal reserve', 'interest rates', 'inflation',
  'sec filing', 'earnings', 'ipo', 'crypto', 'bitcoin', 'etf', 'recession',
]

function toCandidate(raw: RawItem, sourceReliability: number, lang: Lang): CandidateItem | null {
  const isCrypto = raw.sourceName === 'CoinGecko'
  const isFed = raw.sourceName.toLowerCase().includes('federal reserve')
  const isSec = raw.sourceName.toLowerCase().includes('sec ')
  const points = raw.rawScoreSignals.points ?? 0
  const seed = raw.id

  const confidence = isFed || isSec ? 0.75 : isCrypto ? 0.5 : Math.min(1, 0.4 + points / 500)

  const whyVariants: readonly Bi[] = isFed
    ? [
        {
          he: 'הודעה רשמית מהפדרל ריזרב — סיגנל ממקור ראשון על מדיניות מוניטרית, ששווה לקרוא ישירות ולא רק דרך פרשנות של מישהו אחר.',
          en: 'An official Federal Reserve release — primary-source monetary policy signal worth reading directly rather than via secondhand commentary.',
        },
        {
          he: 'עדכון ראשוני מהפדרל ריזרב, לפני שהוא מתורגם לכותרות וניתוחים משניים.',
          en: 'A primary-source update from the Federal Reserve, before it gets filtered into headlines and secondhand analysis.',
        },
      ]
    : isSec
    ? [
        {
          he: 'הודעה רשמית מרשות ניירות הערך האמריקאית (SEC) — מקור ראשי על אכיפה, גילוי נאות או שינויי רגולציה, לפני שזה מתפרש דרך כתבות משניות.',
          en: 'An official SEC release — primary-source signal on enforcement, disclosure, or regulatory change, before it gets filtered through secondhand coverage.',
        },
        {
          he: 'הודעה רשמית מה-SEC, ממקור ראשון — שווה לקרוא לפני שמישהו אחר מסכם אותה בשבילכם.',
          en: 'An official SEC release, straight from the primary source — worth reading before someone else summarizes it for you.',
        },
      ]
    : isCrypto
    ? [
        {
          he: 'עלייה בעניין החיפוש יכולה להקדים תשומת לב רחבה יותר — שווה להבין *מדוע* יש עניין לפני שמסיקים מסקנה כלשהי.',
          en: 'Rising search interest can precede broader attention — worth understanding *why* people are looking at this before drawing any conclusion.',
        },
        {
          he: 'זה נכנס לרשימת המגמות החמות בחיפוש כרגע — לא ראיה לתנועת מחיר, אלא לעלייה בתשומת לב.',
          en: 'This is showing up in trending search right now — not evidence of price movement, just rising attention worth understanding.',
        },
      ]
    : [
        {
          he: `קריאה על הכיוון שאליו תשומת הלב של המשקיעים בפועל נעה כרגע, לא קריאת מחיר — השרשור הזה מושך דיון אמיתי (${points} נקודות).`,
          en: `A read on where investor attention is actually shifting right now, not a price call — this thread is drawing real discussion (${points} points).`,
        },
        {
          he: `שימושי כמדד למצב הרוח בשוק, לא כתחזית — וברור שלא רק אתם עוקבים אחרי זה (${points} נקודות).`,
          en: `Useful as a gauge of market mood, not a forecast — and you're clearly not the only one watching this (${points} points).`,
        },
      ]
  const whyItMightMatter = say(pick(whyVariants, seed), lang)

  const actionVariants: readonly Bi[] = isFed
    ? [
        {
          he: 'קראו את ההודעה המלאה וגבשו דעה משלכם לפני שפועלים על סמך סיכום של מישהו אחר.',
          en: 'Read the full release and form your own view before acting on any secondhand summary.',
        },
        {
          he: 'עברו על ההודעה המלאה ושאלו אם היא משנה משהו בתחזית שלכם, לא רק בכותרת.',
          en: 'Read the full release and ask whether it changes anything in your own outlook, not just the headline.',
        },
      ]
    : isSec
    ? [
        {
          he: 'קראו את ההודעה הרשמית במקור — בדקו אם היא נוגעת לחברה, סקטור או רגולציה שרלוונטיים לכם, לפני שמסיקים מסקנה כלשהי.',
          en: 'Read the official release at the source — check whether it touches a company, sector, or rule that\'s actually relevant to you before drawing any conclusion.',
        },
        {
          he: 'בדקו אם ההודעה נוגעת למשהו שאתם עוקבים אחריו, וקראו אותה במקור לפני שמסתמכים על סיכום.',
          en: 'Check whether the release touches something you actually track, and read it at the source before relying on a summary.',
        },
      ]
    : isCrypto
    ? [
        {
          he: 'חקרו מדוע העניין עולה (חדשות, השקת מוצר, רישום בבורסה) — התייחסו לזה כליד למחקר, לא כסיגנל לקנייה.',
          en: 'Research why interest is rising (news, product launch, listing) — treat this as a research lead, not a signal to buy.',
        },
        {
          he: 'מצאו את הטריגר לעלייה בעניין לפני שמייחסים לזה משמעות — לפעמים זו רק כתבה אחת.',
          en: 'Find the actual trigger behind the rising interest before reading too much into it — sometimes it\'s just one article.',
        },
      ]
    : [
        {
          he: 'קראו את הדיון לקבלת קונטקסט, ואז אמתו כל טענה מול מקור ראשי לפני שמתייחסים אליה כעובדה.',
          en: 'Read the discussion for context, then verify any claim against a primary source before treating it as fact.',
        },
        {
          he: 'עברו על כמה תגובות מובילות, ובדקו אם מישהו שם הצביע על מקור ראשי שכדאי לבדוק בעצמכם.',
          en: 'Skim a few top comments and see whether anyone points to a primary source worth checking yourself.',
        },
      ]
  const suggestedAngle = say(pick(actionVariants, `${seed}:action`), lang)

  return {
    id: `market-signals-${raw.id}`,
    title: raw.title,
    summary: raw.summary,
    url: raw.url,
    sourceLinks: [{ label: raw.sourceName, url: raw.url }],
    agentId: 'market_signals',
    domain: 'market_signals',
    category: 'Market',
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

export const marketSignalsAgent: AgentDefinition = {
  id: 'market_signals',
  name: { en: 'Market Signals Agent (Experimental)', he: 'סוכן סיגנלי שוק (ניסיוני)' },
  domain: 'market_signals',
  goal: 'Surface market research signals worth investigating — never buy/sell recommendations, price targets, or portfolio advice.',
  getJobs: (lang: Lang) => [
    { sourceId: 'coingecko', fetch: () => fetchCoinGeckoTrending({ limit: 5, lang }) },
    { sourceId: 'finance_rss_fed', fetch: () => fetchRSSFeed({ url: 'https://www.federalreserve.gov/feeds/press_all.xml', label: 'Federal Reserve', limit: 5, lang }) },
    { sourceId: 'finance_rss_sec', fetch: () => fetchRSSFeed({ url: 'https://www.sec.gov/news/pressreleases.rss', label: 'SEC Press Releases', limit: 5, lang }) },
    { sourceId: 'hacker_news', fetch: () => fetchHackerNews({ keywords: MARKET_KEYWORDS, limit: 5, lang }) },
  ],
  toCandidate,
}
