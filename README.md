# Life Board

A **personal intelligence board** — not a feed, not a news reader, not a recommendation engine. Its job is to answer one question: *what are the most important things I should know from the last 7 days?* The primary layer is a **Weekly Brief**: a small, curated, explained set of items framed by week range and generation date, refreshed on demand (default framing: Monday-start week) — explained, scored, and ranked, not just listed.

This MVP is focused on one audience: **students, junior developers, software developers, AI builders, people looking for project ideas, and people working on their career.** The architecture underneath is general-purpose and built to support many more domains and sources later without a rewrite — see [Scaling beyond the MVP](#scaling-beyond-the-mvp).

## What it surfaces

- Technologies worth learning
- GitHub repos and open-source projects worth exploring
- AI tools and research worth trying/reading
- Project ideas worth building
- Career signals and in-demand skills
- Early dev-community trends
- Experimental: research-signal-only market/macro signals (never investment advice — see [Market Signals](#market-signals-experimental))

Every card answers: what is this, why does it matter, why is it relevant to you, why did it earn a slot in *this week's* brief, what should you do next, why this score, and which real source(s) it came from. Every card carries a real `https://` source URL — there are no fabricated items in the real pipeline (see [Anti-hallucination](#anti-hallucination)).

## The pipeline

```
Sources → RawItems → Agent Processing → CandidateItems → Judgment Engine → BoardItems → Primary/Secondary split → Feedback → Memory
```

1. **Sources** (`src/sources/`) — free, no-key APIs and feeds (GitHub, Hacker News, arXiv, Dev.to, RSS, CoinGecko, Federal Reserve RSS, SEC press releases RSS). Cataloged in `source-registry.ts`, fetched by adapters in `src/sources/adapters/`.
2. **RawItems** — every adapter returns the same shape (`RawItem`) regardless of which API it called, so agents stay source-agnostic.
3. **Agent Processing** (`src/agents/*-agent.ts`) — each of the 5 active agents normalizes, dedupes, filters out noise, and converts useful raw items into `CandidateItem`s with a category, a "why it might matter" hint, and a suggested next action.
4. **CandidateItems** — the shared currency between agents and judgment, whether they came from a real MVP agent or the generic domain-agent path. `src/pipeline/run-agent-pipeline.ts` merges both paths, dedupes them, and applies the anti-hallucination filter before anything reaches judgment.
5. **Judgment Engine** (`src/agents/judgment-engine.ts`) — scores every candidate on 8 dimensions, decides whether to surface it at all, applies the recency rule, and writes the bilingual explanation text shown on the card (including `why_this_week`).
6. **BoardItems** — final, ranked, explained cards.
7. **Primary/Secondary split** (`/api/run-agents/route.ts`) — ranked items above the brief-quality bar become the **Weekly Brief** (min 5, max 15); everything else that still cleared the surfacing + recency bar becomes **Explore & Expand**, capped so it stays a second curated layer, not an unbounded feed.
8. **Feedback** — 👍 / 👎 on a card calls `POST /api/feedback`.
9. **Memory** (`src/agents/memory-engine.ts`) — feedback is stored and used to adjust domain priority, source trust, and category confidence on the *next* agent run.

This is how the product stays narrow and curated today while every domain in the registry remains selectable and functional.

## Recency

The Weekly Brief is explicitly **not** a real-time feed, so freshness is enforced server-side (`/api/run-agents/route.ts`):

- Items published within the last **14 days** are eligible normally.
- Items **14–30 days** old are kept only if relevance *and* impact are both exceptionally high (≥85/100) — and are flagged `is_older` so the card shows a visible "older item" badge instead of pretending to be current.
- Items older than **30 days** never reach the board, in either layer.
- Every card shows its published date / relative age.

## Anti-hallucination

`run-agent-pipeline.ts` enforces, after merging and deduping every candidate from both agent paths, that each one has a real `sourceName` and a `url` matching `^https?://`. Anything without both is dropped before it can ever reach judgment or the board — there is no fallback that invents a source. The only place synthetic content can appear at all is the curated demo dataset (`src/lib/mock-data.ts`), and only when `MOCK_MODE=true` is explicitly set; real agent runs never fake a result.

## The 5 active MVP agents

| Agent | Domain | Goal | Sources used |
|---|---|---|---|
| **Developer Opportunities Agent** (`dev_opportunities`) | Programming | Surface technologies worth learning, repos worth exploring, tutorials worth reading | GitHub Search, Hacker News, Dev.to |
| **AI Trends Agent** (`ai_trends`) | AI / Tech | Surface AI tools worth trying, research worth reading, early AI dev-community trends | arXiv, Hacker News, RSS (TechCrunch AI) |
| **Project Ideas Agent** (`project_ideas`) | Startups | Surface project ideas and pain points worth building into a project or small startup | Hacker News (Show HN / launches), GitHub, RSS (Y Combinator blog) |
| **Career Signals Agent** (`career_signals`) | Career | Surface hiring trends and in-demand skills for students/junior devs | Hacker News (hiring threads), Dev.to (career tag) |
| **Market Signals Agent** (`market_signals`) | Investing (experimental) | Surface research-grade market/macro signals — never price targets or buy/sell advice | CoinGecko (trending), Federal Reserve RSS, SEC press releases RSS, Hacker News |

Each agent is a plain `AgentDefinition` (`src/agents/base-agent.ts`): a list of source jobs to run, and a `toCandidate()` function that turns one `RawItem` into a `CandidateItem` or filters it out (returns `null`) if it's not useful enough. Adding a 6th real agent means writing one new file like these five — no pipeline or UI change required.

The `Open Source` and `Entrepreneurship` domains also route through `dev_opportunities` / `project_ideas` respectively, so turning them on in the profile widens what those two agents fetch rather than requiring a separate agent.

## Market Signals (experimental)

`market_signals` is explicitly framed as a research-signal domain, not investment advice: every card in this category carries a permanent, non-collapsible disclaimer (`BoardCard.tsx`), and no card in the product ever states a price target, a buy/sell recommendation, or portfolio guidance. It surfaces things like notable CoinGecko trending-search activity, Federal Reserve press releases, and SEC press releases — raw, attributable signals, left for the user to interpret.

## Life Domains (grouping layer)

The profile/onboarding still exposes the original fine-grained domain registry (`DOMAIN_REGISTRY` in `src/lib/domains.ts`, 19 specialists) — internally these are "specialists." Splitting that registry up would have meant rewriting the onboarding/profile UI the product already had working. Layered on top, additively, is a coarser **Life Domains** grouping (`LIFE_DOMAIN_GROUPS` / `DOMAIN_TO_GROUP` / `groupDomainsByLifeDomain()`, same file) — the only top-level structure a user ever sees. A user never sees "AI Agent," "Programming Agent," a specialist name, or a raw `DOMAIN_REGISTRY` id directly; cards and navigation show one of these 7 Life Domains (or Custom) plus the real source name:

| Life Domain | Specialists inside it |
|---|---|
| 💼 Career & Business | career, startups, entrepreneurship |
| 🤖 Technology | ai_tech, programming, open_source, cybersecurity, science, education |
| 📈 Investing & Finance | investing, market_signals, personal_finance |
| 🏠 Real Estate | real_estate |
| ⚽ Sports | sports |
| ✈️ Travel | travel |
| 💪 Health & Fitness | health_fitness |
| 🧩 Custom | cars, gaming, local_events, and anything not explicitly mapped |

This is purely a presentation layer — `getLifeDomainGroupId()` falls back to `'custom'` for any domain not explicitly mapped, so the grouping never breaks as new domains are added to the registry. The user sees Life Domains; the underlying per-specialist sources, MVP-agent mapping, and priority score are still exactly what drives the real pipeline: Source → Specialist → Life Domain → Judgment Engine → Memory Engine → Weekly Brief / Explore & Expand.

## Source registry

`src/sources/source-registry.ts` documents every source considered, not just the ones live today — the point is to keep a wide, honest research trail.

**Active today** (free, no key required):

| Source | Provides | Used by |
|---|---|---|
| GitHub Search API | Trending/new repos, project ideas via README/topics | dev_opportunities, project_ideas, ai_trends |
| Hacker News (Firebase API) | Dev-community trends, discussion volume, early signal on tools/launches | all 5 agents |
| arXiv API | New AI/ML research papers | ai_trends |
| Dev.to (Forem) API | Tutorials, practitioner write-ups | dev_opportunities, career_signals |
| Generic RSS adapter | Engineering blog posts, AI newsletters, company announcements, Fed/SEC press releases | ai_trends, dev_opportunities, project_ideas, market_signals |
| CoinGecko trending (no key) | Trending-search crypto signal | market_signals |

**Planned** (researched, not wired up yet — see the registry for why and how hard each would be): Reddit, Product Hunt, Stack Exchange, Papers with Code, Hugging Face Hub, npm Registry, PyPI, GitLab, Lobsters, Indie Hackers, Y Combinator directory, remote job boards (RemoteOK/Arbeitnow). None of these need a paid plan or a complex auth flow to add later — most are a new adapter file plus a `source-registry.ts` entry.

## Judgment Engine

Every candidate gets scored on 9 deterministic dimensions — every sub-score is a real function of profile, goals, priorities, memory, source signal, and age; there is no `Math.random()` anywhere in this file, since a product built on trust cannot rank things by chance:

| Dimension | Weight | Meaning |
|---|---|---|
| Relevance | 22% | How closely this matches the user's profile, goals, and priorities — nudged by domain-level memory |
| Impact | 18% | Opportunity creation, risk avoidance, domain importance, source authority, decision influence |
| Actionability | 14% | Presence of a clear action, time sensitivity, opportunity window, action confidence — not text length |
| Recency | 10% | How fresh the item is, on the same recency curve used for the eligibility filter (see below) |
| Confidence | 9% | How sure the agent is this is worth surfacing — nudged by category-level memory |
| Urgency | 8% | Deterministic time-sensitivity signal (metadata hint, age, title/content cues) |
| Novelty | 8% | Recent board history, topic similarity, whether this was already surfaced before |
| Fit | 6% | Skills, profession, interests, goals, and domain priorities |
| Source quality | 5% | How reliable the originating source has been — nudged by source-level memory |

The weighted sum is the **Life Value Score (LVS)**. LVS &lt; 40 is filtered out entirely (`should_surface`); otherwise it sets the Attention Budget (High ≥80, Medium ≥60, Low otherwise) and whether it's a "top pick" on the board (≥80, given a visibly stronger card treatment). A separate, stricter bar (LVS ≥ 55, `PRIMARY_LVS_THRESHOLD` in `run-agents/route.ts`) decides Weekly Brief membership — see [Primary/Secondary split](#the-pipeline).

With `OPENAI_API_KEY` set, GPT-4o-mini handles scoring and explanation text. Without it, rule-based scoring (`ruleBased()` in `judgment-engine.ts`) runs automatically — this is what the app uses out of the box, with no paid service required.

## Memory Engine

Every 👍/👎 is recorded with its domain, source, and category. `memory-engine.ts` exposes three feedback-stat readers that the Judgment Engine reads on every subsequent run:

- **Domain-level** — repeated feedback nudges that domain's relevance score directly, and every 3rd consistent signal adjusts the domain's priority score.
- **Source-level** — liking/disliking several items from the same source raises/lowers trust in that source generally.
- **Category-level** — liking several "Build" cards raises confidence in future Build-category items, independent of which agent produced them.

All of this is visible on the Memory page and is real, not cosmetic — the same in-memory store is read by `/api/run-agents` on the next run.

## Mock mode

Set `MOCK_MODE=true` to make `/api/run-agents` return the curated demo dataset (`src/lib/mock-data.ts`) instead of running the real pipeline — useful for UI work or demos without hitting any external API. Real agents never fake results: when `MOCK_MODE` is unset or `false`, the route always runs the actual source-driven pipeline.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — works fully out of the box with rule-based judgment and real free sources (no keys needed). Set `MOCK_MODE=true` in `.env.local` if you want the curated demo dataset instead.

## Adding real AI judgment (OpenAI) — optional

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local
npm run dev
```

The Judgment Engine automatically uses GPT-4o-mini when the key is present; this is optional — the product is fully usable for free without it.

## Adding a real database (Supabase) — optional

1. Create a project at supabase.com
2. Run `supabase/schema.sql` in the SQL editor
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`

Without these, priorities/memory/feedback all work via in-memory stores — fine for a single-session demo, reset on server restart.

## Language

The app is fully bilingual (English / Hebrew), including text the pipeline *generates* at runtime — not just static UI labels. `useLanguage()` / `t()` / `tr()` (`src/lib/i18n.ts`) drive static copy and RTL layout (logical `ms-`/`me-`/`ps-`/`start`/`end` classes throughout); the current UI language is also sent to `/api/run-agents` in the request body, so every generated string for that run — agent display names, `why_it_might_matter`/`why_matters`, suggested actions, the week label, `why_this_week` — comes back already in the right language instead of being translated after the fact or silently staying in English. There is no per-card text in the real pipeline that bypasses this.

## Triggering a real agent run

```bash
curl -X POST http://localhost:3000/api/run-agents -H "Content-Type: application/json" -d '{"lang":"en"}'
```

This reads the user's active domain priorities, runs the real pipeline (5 MVP agents for their mapped domains + the generic path for any other active domain), judges every candidate, applies the recency rule, and returns `{ items, secondary_items, week }` — the Weekly Brief, the Explore & Expand layer, and the week-range/generated-date framing, all already localized to `lang`.

## Scaling beyond the MVP

The registry-driven design means new domains, sources, and agents are additive:

- **New domain:** add one entry to `DOMAIN_REGISTRY` in `src/lib/domains.ts`, and optionally map it into a `LifeDomainGroupId` in `DOMAIN_TO_GROUP` (falls back to `'custom'` if you don't). It immediately shows up in onboarding, the sidebar, the profile page, and produces real items via the generic agent path — no other file needs to change.
- **New source:** add a `SourceDescriptor` to `source-registry.ts` as `'planned'`; when ready, write an adapter in `src/sources/adapters/` and flip it to `'active'`.
- **New real agent:** write a new `AgentDefinition` (see any of the 5 current agent files as a template), then set `mvpAgent` on the relevant domain(s) in `domains.ts`. The pipeline picks it up automatically.

`src/agents/planned-agents.ts` documents domains explicitly deferred for this validation round (Real Estate, Sports, Health & Fitness, Travel, Personal Finance, and a catch-all General Life agent) with the reasoning for each — they stay selectable today via the generic agent path and are ready to be deepened into real agents later using the same pattern.

See [Future expansion](#future-expansion) below for the longer-term production picture (auth, persistence, scheduling, more agents).

## Project structure

```
src/
  agents/
    base-agent.ts                    # AgentDefinition / CandidateItem types + runAgent()
    developer-opportunities-agent.ts # MVP agent 1
    ai-trends-agent.ts               # MVP agent 2
    project-ideas-agent.ts           # MVP agent 3
    career-signals-agent.ts          # MVP agent 4
    market-signals-agent.ts          # MVP agent 5 (experimental, research-signal only)
    planned-agents.ts                # Documented-but-inactive future agents
    domain-agents.ts                 # Generic fetch-and-judge path (non-MVP domains)
    judgment-engine.ts               # Scores + explains every candidate (OpenAI or rule-based)
    memory-engine.ts                 # Learns from feedback, adjusts priorities/trust/confidence
  sources/
    types.ts                         # RawItem / SourceDescriptor shared types
    source-registry.ts               # Full catalog: active + planned sources
    adapters/                        # github, hacker-news, arxiv, devto, rss, coingecko
  pipeline/
    normalize-items.ts               # Clean HTML/entities/whitespace/dates
    dedupe-items.ts                  # URL- then title-based dedupe
    run-agent-pipeline.ts            # Orchestrates MVP agents + generic path → CandidateItem[] (+ anti-hallucination filter)
  app/
    api/
      board/                         # GET board items
      feedback/                      # POST helpful / not_helpful (falls back to client-supplied item fields for non-mock items)
      priorities/                    # POST domain priorities (onboarding + profile)
      memory/                        # GET real memory event timeline + ranking-impact summary for the Memory page
      run-agents/                    # POST trigger the real pipeline (recency rule, primary/secondary split, week framing, or mock mode)
    page.tsx
    layout.tsx
  components/
    AppShell.tsx                     # Root layout, routing, onboarding gate
    board/
      BoardCard.tsx                  # Card: category badge, LVS ring, top-pick treatment, why-this-week, market disclaimer, sources, feedback
      BoardPage.tsx                  # Weekly Brief hero banner + primary/secondary layers + compact research-status line
      MemoryPage.tsx
      ProfilePage.tsx                # Priority visual scale + Life Domains section
    layout/
      Sidebar.tsx                    # Nav + active domains grouped by Life Domain
  lib/
    domains.ts                       # Domain registry + Life Domains grouping layer — single source of truth
    week.ts                          # Monday-start week range + generated-date labels (bilingual)
    i18n.ts                          # Hebrew/English dictionary
    mock-data.ts                     # Demo dataset (MOCK_MODE) + starter priorities
    supabase.ts
  types/
    index.ts                         # Shared TypeScript types
supabase/
  schema.sql                         # Full database schema with RLS
```

## Environment variables

| Variable | Required | Effect |
|---|---|---|
| `MOCK_MODE` | No | `true` returns the curated demo dataset instead of running real agents |
| `OPENAI_API_KEY` | No | Enables GPT-4o-mini judgment; falls back to rule-based scoring if unset |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Enables persistent storage; falls back to in-memory stores if unset |
| `NEXT_PUBLIC_APP_URL` | No | Used for absolute URLs where needed |

Nothing in this product requires a paid service to run. No OpenAI key, no Supabase project, no API keys of any kind are needed for the full pipeline (sources → agents → judgment → board → feedback → memory) to work today.

## Future expansion

1. Add Supabase auth (email magic link is ~30 min to set up)
2. Promote a few `'planned'` sources to `'active'` (Reddit, Product Hunt, and Stack Exchange are the best next additions per the registry's `priority` field)
3. Add a real Monday-morning cron (Vercel Cron or pg_cron) that calls `/api/run-agents` weekly per user — today the Weekly Brief regenerates on demand (Refresh button), always framed by the *current* week (see the honest scope note in `src/lib/week.ts`), not on an actual schedule
4. Persist `memory-engine.ts`'s in-memory stores to Supabase so feedback/priority learning survives a server restart
5. Deepen more `planned-agents.ts` domains (Real Estate, Sports, Travel, Personal Finance, Health & Fitness) into real multi-source agents using the same `AgentDefinition` pattern as the 5 active ones
6. Promote `market_signals` out of "experimental" only with real, attributable financial-data sources and continued strict adherence to research-signal-only framing — never advice
