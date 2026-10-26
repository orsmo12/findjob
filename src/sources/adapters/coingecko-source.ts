/**
 * CoinGecko adapter — public "trending search" endpoint, no key required.
 * https://docs.coingecko.com/reference/trending-search
 *
 * Used only to surface "worth looking into" search-interest signals for the
 * experimental Market Signals domain — never to predict price, recommend a
 * trade, or imply a coin will go up or down. See market-signals-agent.ts for
 * how these get framed on the card (always "worth researching", never
 * "worth buying").
 */

import type { RawItem } from '@/sources/types'
import type { Lang } from '@/lib/i18n'

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    if (!res.ok) return null
    return res
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface CoinGeckoTrendingCoin {
  item: {
    id: string
    name: string
    symbol: string
    market_cap_rank?: number
  }
}

export interface CoinGeckoParams {
  limit?: number
  // Controls the language of the app-generated title/summary sentence below
  // (the coin name/symbol themselves are passed through as-is either way —
  // ticker symbols aren't translatable text). Defaults to English so any
  // caller that forgets to pass lang still gets a valid, single-language
  // string rather than a silently broken one.
  lang?: Lang
}

export async function fetchCoinGeckoTrending(params: CoinGeckoParams = {}): Promise<RawItem[]> {
  const { limit = 5, lang = 'en' } = params
  const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/search/trending')
  if (!res) return []

  try {
    const data = await res.json()
    const coins = (data?.coins ?? []) as CoinGeckoTrendingCoin[]

    return coins.slice(0, limit).map(c => {
      const name = c.item.name
      const symbol = c.item.symbol.toUpperCase()
      const rank = c.item.market_cap_rank

      const title = lang === 'he'
        ? `${name} (${symbol}) במגמת עלייה בחיפושים ב-CoinGecko`
        : `${name} (${symbol}) is trending on CoinGecko`

      const summary = lang === 'he'
        ? `אחת המטבעות המבוקשות ביותר כעת ב-CoinGecko${
            rank ? ` — מקום #${rank} בשווי שוק` : ''
          }. זה משקף עניין בחיפוש, לא תנועת מחיר או תחזית.`
        : `Currently among the most-searched coins on CoinGecko${
            rank ? ` — market cap rank #${rank}` : ''
          }. This reflects search interest, not a price movement or forecast.`

      return {
        id: `coingecko-${c.item.id}`,
        title,
        summary,
        url: `https://www.coingecko.com/en/coins/${c.item.id}`,
        sourceName: 'CoinGecko',
        sourceType: 'api' as const,
        // Trending search interest is inherently a live, point-in-time signal —
        // "now" is the real, honest timestamp for this kind of item.
        publishedAt: new Date().toISOString(),
        tags: ['crypto', 'trending', c.item.symbol.toLowerCase()],
        rawScoreSignals: { marketCapRank: rank ?? 0 },
        metadata: {},
      }
    })
  } catch {
    return []
  }
}
