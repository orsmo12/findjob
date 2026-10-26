# Connecting Supabase (optional)

Life Board works today with **zero setup** — no Supabase project, no
credentials. Profile, domain priorities, feedback, memory events, weekly
snapshots, and surfaced history all live in an in-memory store that resets
when the server restarts. This guide adds real persistence so that data
survives a refresh, a restart, or a redeploy.

Nothing below is required. If you skip it, the app keeps working exactly as
it does now.

## What changes once this is set up

Every persistence call in the app checks for Supabase credentials at
runtime (`isSupabaseConfigured()` in `src/lib/supabase.ts`):

- Credentials present → reads and writes go to Supabase (Postgres).
- Credentials absent, or a Supabase call fails for any reason → the app
  falls back to the in-memory store automatically. Nothing crashes either
  way.

There's no login and no multi-user support yet — the whole app runs as one
fixed user (id `00000000-0000-0000-0000-000000000001`, defined in
`src/lib/constants.ts`). The schema is shaped so that adding real
Supabase Auth later is additive (see the comment block at the top of
`supabase/schema.sql`), not a rewrite.

## Steps

**1. Create a Supabase project.**
Go to [supabase.com](https://supabase.com), sign up (free tier is enough),
and create a new project. This takes a couple of minutes while Supabase
provisions the database.

**2. Run the schema.**
Open your project's **SQL Editor** (left sidebar), paste in the full
contents of `supabase/schema.sql` from this repo, and run it. This creates
all 7 tables (`profiles`, `domain_priorities`, `life_goals`, `board_items`,
`memory_events`, `weekly_snapshots`, `surfaced_history`), enables row-level
security with permissive policies, and seeds the one fixed profile row.

Don't use `npm run db:migrate` / `npm run db:seed` — those package.json
scripts are placeholders pointing at scripts that don't exist yet. The SQL
Editor is the supported path for now.

**3. Get your API credentials.**
In your Supabase project, go to **Project Settings → API**. You need:
- **Project URL**
- **anon / public key**

(Not the `service_role` key — the app only ever uses the anon key.)

**4. Add them to your local environment.**
Copy `.env.example` to `.env.local` and fill in the two Supabase values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Leave everything else in `.env.example` as-is unless you also want the
optional OpenAI-backed judgment path (also off by default, also optional).

**5. Restart the dev server.**
```
npm run dev
```
That's it — every route now reads/writes through Supabase instead of the
in-memory fallback. No code changes needed.

## Verifying it worked

- Open the app, go through onboarding or give some feedback on a card.
- In Supabase, open **Table Editor → board_items** (or `memory_events`,
  `domain_priorities`) and confirm rows are appearing.
- Restart `npm run dev` and reload the app — priorities, feedback effects,
  and this week's Weekly Brief should still be there (previously, an
  in-memory restart would have wiped all of it).

If something's misconfigured (wrong key, project paused, etc.), the app
logs a `console.error` describing the failure and silently falls back to
in-memory mode rather than breaking — check your terminal output if data
isn't showing up in Supabase.

## Tables at a glance

| Table | Holds |
|---|---|
| `profiles` | Name, email, profession, location, skills — one row |
| `domain_priorities` | Per-domain priority score (1–10) + active flag |
| `board_items` | Every judged item from every pipeline run |
| `memory_events` | Feedback history + priority-adjustment events |
| `weekly_snapshots` | The frozen Weekly Brief per user+week+language |
| `surfaced_history` | Everything ever shown, for novelty/dedup scoring |
| `life_goals` | Defined in the schema, not yet wired up — goals still live in browser `localStorage` (`AppShell.tsx`) |
