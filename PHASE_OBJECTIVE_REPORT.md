# Life Board — Phase Objective Report

Optimized for Trust, Consistency, Relevance, Explainability, and Personalization. No new screens, no new colors, no new features — every change below is a targeted fix to architecture, scoring, memory, and explanation. Zero-cost constraint preserved throughout: no OpenAI requirement, no paid services, only free/no-key public APIs.

## 1. Architecture tree

```
src/
  agents/
    base-agent.ts                    # AgentDefinition / CandidateItem types + runAgent()
    developer-opportunities-agent.ts # MVP agent — Programming specialist
    ai-trends-agent.ts               # MVP agent — AI/Tech specialist
    project-ideas-agent.ts           # MVP agent — Startups specialist
    career-signals-agent.ts          # MVP agent — Career specialist
    market-signals-agent.ts          # MVP agent — Market Signals specialist (experimental)
    planned-agents.ts                # Documented-but-inactive future specialists
    domain-agents.ts                 # Legacy generic fetch-and-judge path (non-MVP specialists)
    judgment-engine.ts               # Scores + explains every candidate (9 dimensions, no randomness)
    memory-engine.ts                 # Learns from feedback, adjusts priority/trust/confidence
  sources/
    types.ts                         # RawItem / SourceDescriptor shared types
    source-registry.ts               # Full catalog: active + planned sources
    adapters/                        # github, hacker-news, arxiv, devto, rss, coingecko
  pipeline/
    normalize-items.ts               # Clean HTML/entities/whitespace/dates
    dedupe-items.ts                  # URL- then title-based dedupe
    run-agent-pipeline.ts            # Orchestrates MVP agents + legacy path → CandidateItem[] (+ anti-hallucination filter)
  app/
    api/
      board/                         # GET board items
      feedback/                      # POST helpful / not_helpful
      priorities/                    # POST domain priorities (onboarding + profile)
      memory/                        # GET real memory event timeline + ranking-impact summary
      run-agents/                    # POST trigger the real pipeline
    page.tsx
    layout.tsx
  components/
    AppShell.tsx                     # Root layout, routing, onboarding gate
    board/
      BoardCard.tsx                  # Card: domain + source (never agent name), full explanation stack
      BoardPage.tsx                  # Weekly Brief hero + primary/secondary layers
      MemoryPage.tsx                 # Real memory timeline + ranking-impact view
      ProfilePage.tsx                # Priority visual scale + Life Domains section
    layout/
      Sidebar.tsx                    # Nav + active domains grouped by Life Domain
  lib/
    domains.ts                       # Specialist registry + Life Domains grouping — single source of truth
    week.ts                          # Monday-start week range + generated-date labels
    i18n.ts                          # Hebrew/English dictionary
    mock-data.ts                     # Demo dataset (MOCK_MODE) + starter priorities
  types/
    index.ts                         # Shared TypeScript types
supabase/
  schema.sql                        # Full database schema with RLS
```

**Pipeline:** `Source → Specialist → Life Domain → Judgment Engine → Memory Engine → Weekly Brief / Explore & Expand`. This single sentence (now literally in `domains.ts`'s own header comment) is the product's real information architecture. The user never sees a specialist name, an agent label, or a raw registry id — only a Life Domain, a source, and an explanation.

## 2. Domain hierarchy (what the user sees)

| Life Domain | Specialists routed into it |
|---|---|
| 💼 Career & Business | Career, Startups, Entrepreneurship |
| 🤖 Technology | AI/Tech, Programming, Open Source, Cybersecurity, Science, Education |
| 📈 Investing & Finance | Investing, Market Signals (experimental), Personal Finance |
| 🏠 Real Estate | Real Estate |
| ⚽ Sports | Sports |
| ✈️ Travel | Travel |
| 💪 Health & Fitness | Health & Fitness |
| 🧩 Custom | Cars, Gaming, Local Events, and any future specialist not explicitly mapped |

This is the only top-level structure rendered in the Sidebar, Profile, and board cards. It's a presentation layer over the specialist registry — `getIntelligenceGroupId()` falls back to `custom` for anything unmapped, so it never breaks as specialists are added.

## 3. Specialist hierarchy (internal — never shown directly)

19 specialists in `DOMAIN_REGISTRY`, each with its own sources, default priority, and (for 5 of them) a real MVP agent:

| Specialist | MVP agent | Sources |
|---|---|---|
| Career | career_signals | Hacker News (hiring threads) |
| AI/Tech | ai_trends | Hacker News, RSS (TechCrunch) |
| Programming | dev_opportunities | GitHub Search, Dev.to |
| Startups | project_ideas | RSS (Y Combinator), Hacker News |
| Investing | — (legacy path) | Reddit (r/investing, r/stocks) |
| Market Signals (experimental) | market_signals | CoinGecko, Fed RSS, SEC RSS, Hacker News |
| Real Estate | — (legacy path) | Reddit |
| Sports | — (legacy path) | Reddit |
| Travel | — (legacy path) | Reddit |
| Cars | — (legacy path) | Reddit |
| Gaming | — (legacy path) | Reddit |
| Health & Fitness | — (legacy path) | Reddit |
| Entrepreneurship | project_ideas | Reddit |
| Personal Finance | — (legacy path) | Reddit |
| Education | — (legacy path) | Dev.to, Reddit |
| Science | — (legacy path) | arXiv |
| Cybersecurity | — (legacy path) | Hacker News, Reddit |
| Open Source | dev_opportunities | GitHub Search, Hacker News |
| Local Events | — (no source yet) | none — honest gap, not faked |

Specialists without an MVP agent aren't second-class — they run the same generic fetch-and-judge legacy path (`domain-agents.ts`), produce real items, and are fully selectable today. They're simply not yet deepened into a dedicated multi-source agent.

## 4. Source hierarchy

**Active today** (free, no key required): GitHub Search API, Hacker News (Firebase API), arXiv API, Dev.to (Forem) API, generic RSS adapter (TechCrunch, Y Combinator blog, Federal Reserve, SEC), CoinGecko trending, Reddit public JSON.

**Planned** (researched, documented in `source-registry.ts`, not wired up): Product Hunt, Stack Exchange, Papers with Code, Hugging Face Hub, npm Registry, PyPI, GitLab, Lobsters, Indie Hackers, Y Combinator directory, remote job boards (RemoteOK/Arbeitnow). None require a paid plan or complex auth — each is one new adapter file plus a registry entry.

Sources are never agents and never domains. A card's footer shows the real source name with a real `https://` link — never an internal specialist or agent label.

## 5. Judgment Engine (rebuilt this phase — the highest-priority fix)

The prior scoring system used `Math.random()` in places. That's gone entirely. Every one of the 9 dimensions below is now a deterministic function of real inputs:

| Dimension | Weight | Real inputs it's computed from |
|---|---|---|
| Relevance | 22% | Profile/goals/priorities match, nudged by domain-level memory |
| Impact | 18% | Opportunity creation, risk avoidance, domain importance, source authority, decision influence |
| Actionability | 14% | Presence of a clear action, time sensitivity, opportunity window, action confidence — never text length |
| Recency | 10% | Published date, on the same curve as the eligibility filter |
| Confidence | 9% | Agent's own confidence signal, nudged by category-level memory |
| Urgency | 8% | Metadata hint, item age, title/content cues — deterministic |
| Novelty | 8% | Recent board history, topic similarity, whether this exact item was already surfaced |
| Fit | 6% | Skills, profession, interests, goals, domain priorities |
| Source quality | 5% | Source's track record, nudged by source-level memory |

The weighted sum is the Life Value Score (LVS). LVS < 40 is filtered out entirely. ≥ 80 is a "top pick" (visually distinct card). ≥ 55 (`PRIMARY_LVS_THRESHOLD`) is the stricter bar for Weekly Brief membership — everything else that still clears 40 becomes Explore & Expand. With `OPENAI_API_KEY` set, GPT-4o-mini can also generate scores/explanations; without it (the zero-cost default), the rule-based path above runs and is what ships out of the box.

## 6. Memory Engine

Every 👍/👎 is recorded with its domain, source, and category. Three feedback-stat readers (`getDomainFeedbackStats`, `getSourceFeedbackStats`, `getCategoryFeedbackStats`) feed directly into the Judgment Engine on the *next* run — not a separate, cosmetic system:

- **Domain-level**: nudges that domain's Relevance score directly; every 3rd consistent helpful/not-helpful signal also adjusts the domain's priority score (visible as a `priority_adjusted` event).
- **Source-level**: nudges Source quality for everything from that source.
- **Category-level**: nudges Confidence for everything in that category, independent of which specialist produced it.

All three use the same `clampDelta(helpful, notHelpful)` formula. The Memory page (`/api/memory`, rebuilt this phase) now reads from this exact engine instead of a static mock list: it shows an honest empty state for new users, a "how this changed your rankings" section broken down by domain/source/category using the literal delta numbers the engine applies, and a recent-events timeline. The "Patterns" stat now counts `priority_adjusted` events (the type the engine actually emits) instead of `pattern_learned` (reserved, never fired) — a small honesty fix in the same spirit as removing the randomness.

## 7. Weekly Brief flow

1. Every active specialist's candidates are judged and scored.
2. Items with LVS ≥ 55 are ranked and capped at 15; if fewer than 5 clear that bar, the next-best scoring items (still ≥ 40, the surfacing floor) backfill up to a minimum of 5 — the brief is never empty just because nothing hit the strict bar.
3. Every card explains its placement: `why_seeing`, `why_matters`, `why_this_week` (ties it to the current week, not a timeless feed), a recommended `action`, and — new this phase — `placement_reason`, rendered on every card so a user can see exactly why an item sits where it does this run, not just why it was surfaced at all.
4. The brief is framed by week range + generation date (`week.ts`), refreshed on demand rather than on a real cron today (honest scope note, documented).

Per the explicit instruction to keep this stable without a large rewrite: the architecture (deterministic scoring + a fixed-size, explained, ranked list) is what gives Weekly Brief stability, without yet building persisted weekly snapshots. Refreshing the board re-runs the same deterministic pipeline rather than reshuffling randomly, so trust isn't destroyed by a refresh.

## 8. Explore & Expand flow

Items that clear the surfacing floor (LVS ≥ 40) and the recency bar but don't make the primary 55+ cut become the secondary layer, capped (`SECONDARY_CAP`) so it stays a curated second view rather than an unbounded feed. Every Explore & Expand card carries the exact same explanation stack as a primary card — including `placement_reason`, which for these items specifically explains why the item didn't make this week's brief (e.g., a lower relevance/impact combination) rather than just restating why it was surfaced.

## 9. Future roadmap

1. Add Supabase auth (email magic link, ~30 min to wire up).
2. Promote `'planned'` sources to `'active'` — Reddit-equivalent breadth already exists; Product Hunt and Stack Exchange are next per the registry's priority field.
3. Add a real Monday-morning cron (Vercel Cron or `pg_cron`) so the Weekly Brief regenerates on an actual schedule instead of on-demand.
4. Persist `memory-engine.ts`'s in-memory stores to Supabase so learned priorities/trust survive a server restart.
5. Deepen more legacy-path specialists (Real Estate, Sports, Travel, Personal Finance, Health & Fitness) into real multi-source MVP agents using the same `AgentDefinition` pattern.
6. Mature Market Signals beyond "experimental" with more attributable financial-data sources, keeping the non-advice framing permanent.
7. Build persisted weekly snapshots (deferred this phase per explicit instruction) so a refresh can show "what changed since last week" instead of only the current run.

## 10. Honest assessment

**Strengths.** The scoring system is now fully deterministic and auditable — every sub-score traces to a real input, and the same `clampDelta()` numbers driving the Judgment Engine are the numbers shown on the Memory page, so "how this changed your rankings" isn't a separate, potentially-inconsistent estimate. The user-facing architecture (7 Life Domains + Custom) is now genuinely decoupled from the internal specialist/agent layer — verified by re-reading `BoardCard.tsx` in full, which renders domain, source, category, and five distinct explanation fields, but never an agent or specialist name. The README has been reconciled line-by-line against the current code (group table, dimension weights/count, specialist count, project structure) rather than left aspirational.

**Weaknesses / known gaps.** Weekly Brief stability is architectural, not yet literal — there's no persisted snapshot, so two refreshes in the same week can still produce a different ranked list if memory or recency shifted underneath it; this was an explicit, deliberate scope decision, not an oversight. The Local Events specialist has no working source at all (no free, no-key, location-aware event API exists) — it's an honest gap, left unfilled rather than faked. Two internal backend fields still contain the literal word "Agent" in their value (`MOCK_ITEMS_EN/HE`'s `agent:` field in `mock-data.ts`, and `domain-agents.ts`'s legacy `baseItem()` helper, which builds `` `${domain.label.en} Agent` ``) — both confirmed, by direct re-read of every component that renders a `BoardItem`, to never reach the UI. They were deliberately left unchanged rather than edited, since changing invisible backend metadata carries real regression risk for zero user-visible benefit, and the standing instruction was to make targeted fixes, not a rewrite. They're flagged here rather than silently left as a surprise.

**Blockers encountered.** The sandboxed shell's view of this project's files went stale relative to the Read/Edit tools partway through this work — `bash`/`npm`/`tsc` output could not be trusted to reflect the latest edits. The workaround adopted for the remainder of the session was to verify every change exclusively via the Read and Grep tools (re-reading full file contents and grepping for dead/live key usage) rather than relying on a build step. This is slower than a real compile check and means there's no automated guarantee against, for instance, a TypeScript type error — every file touched this phase was re-read in full and manually checked for syntax correctness instead. One harmless leftover artifact from that investigation, `_sync_test.txt`, remains in the project root; it couldn't be deleted with the tools available in this session and should be removed manually.
