# findjob

**A team of AI agents that runs a junior job search end to end — and is only allowed to say true things.**

findjob reads your CV and a short questionnaire, then a team of six agents searches jobs twice a day, ranks them against your CV, researches the companies you save, writes tailored cover letters, prepares you for interviews and suggests CV and LinkedIn improvements. Every generated sentence is checked against its source (your CV, the job ad, or a cited web page) before you see it, and nothing happens in your accounts without you: the agents draft, you approve and act.

Built by **Or Smolarchik** (B.Sc. Computer Science, HIT). Hebrew-first mobile web app · Python agents · free API tiers only.

---

## The agents

| Agent | Role | What it actually does |
|---|---|---|
| **Yoav** (`strategist`) | Manager | Turns the CV + questionnaire into a search plan (roles, levels, regions, target companies). Runs a **weekly review**: reads real stats from past scans, retires search queries that stopped producing results, adds companies that keep producing good matches, and proposes new roles for you to approve. |
| **Doron** (`hunter`) | Job hunter | Collects ~190 jobs per scan from LinkedIn and Indeed (via JobSpy) and directly from company career boards (Greenhouse, Lever, Ashby, Comeet, Workday, SmartRecruiters). Discovers each company's board automatically, dedupes, filters by seniority, rates fit, and checks that saved jobs are still open. |
| **Gil** (`researcher`) | Company research | Searches public sources about a saved job's company and writes a brief where every fact carries its source link. |
| **Shai** (`assistant`) | Writer & chat | Writes a short cover letter per saved job; answers questions in the in-app chat and proposes actions (save, skip, add a note…) that run only after you confirm. |
| **Maya** (`coach`) | Interview coach | Interview questions from the ad, two real take-home assignments (with source and solution), and **skill cards** for gaps that keep appearing in jobs that fit you. |
| **Kobi** (`linkedin`) | CV & LinkedIn | Weekly post ideas and comment drafts, LinkedIn profile fixes from your PDF export, and CV lines backed by your public GitHub repos (read-only). |

## How ranking works

1. **No title-only guesses.** If the full ad can't be read (LinkedIn rate-limits cloud IPs), the job is retried next scan instead of being rated on its title.
2. **LLM extraction, code scoring.** The model turns the ad into structured JSON: every *core* requirement (met / not met by the CV), how many *nice-to-have* items are missing, required years, wrong field. The score is then computed in code — `1 + 4 × (core met / core total)`, minus at most 0.3 for missing nice-to-haves — so rankings stay stable across runs and across models.
3. **Seniority is enforced in code**, from the required years the model read and a regex over the ad (that ignores things like "for over 50 years, organizations have trusted…").
4. **Rejected jobs are remembered**, so the AI budget goes to new jobs every scan.

## Grounding ("only true things")

- A **reason** a job fits must name only things written in the CV; a **gap** must appear in the ad.
- **Cover letters**: every name and number is checked against CV + ad + job title; anything unsupported triggers a rewrite, then removal.
- **Company briefs**: each fact is tied to a numbered source; facts without a source are dropped.
- **CV suggestions** may use only facts found in that repo's files.
- **Learning links** come only from real search results on known sites.
- A test (`tests/test_no_account_actions.py`) fails if any code tries to act in a user's account (post, apply, write to GitHub…).

## Architecture

```
            GitHub Actions (cron)                         Vercel
 ┌──────────────────────────────────────┐   ┌──────────────────────────────┐
 │ nightly.yml  every 12h               │   │ web/index.html  (mobile PWA)  │
 │   re-rate → plan → career boards →   │   │ api/chat.js     chat + actions│
 │   search → rate → still-open check → │   │ api/addjob.js   add by link   │
 │   LinkedIn → weekly meeting          │   │ api/domain.js   field kit     │
 │ letters.yml  every 2h                │   └──────────────┬───────────────┘
 │   letters, briefs, prep, skills, CV  │                  │
 └──────────────────┬───────────────────┘                  │
                    │        Supabase (Postgres + Auth, Row-Level Security)
                    └──────► profiles · jobs · runs (messages, work log, agent memory) ◄┘
```

- **LLM router** (`agent_core/llm_router.py`): discovers the models available on Groq at runtime, routes by task tier, waits out per-minute limits, backs off on daily limits and defers work to the next run — the whole system runs on free tiers.
- **Field kits**: software and mechanical engineering are built in; for any other field, Yoav builds a kit (roles → job-ad titles, Hebrew search phrases, tools) from the CV.
- **Activity log**: every agent writes what it is doing and what it hands to whom; the app shows it live in "the office".

## Repository layout

```
agent_core/            Python agents and shared code
  agents/              hunter, ats (career boards), live (still open?), letters, research,
                       prep, tasks, growth (skills + CV), linkedin_coach, meeting
  llm_router.py        model discovery, limits, retries
  profile.py           search plan, field kits, target companies
  cloud_store.py       Supabase REST
scripts/               nightly.py, assistant_job.py (entry points for Actions)
prototype/src/         the app source (built into one HTML file by build.py)
web/                   deployed app + Vercel serverless functions
tests/                 49 tests: python tests/run_all.py
```

## Running

```bash
pip install python-jobspy groq httpx python-dotenv ddgs
python tests/run_all.py                     # tests, no keys needed
GROQ_API_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_KEY=… python scripts/nightly.py
```

Build the app: `cd prototype/src && python build.py --cloud <SUPABASE_URL> <PUBLISHABLE_KEY> ../../web/index.html`.

---

© 2026 Or Smolarchik. Shared as a portfolio project. All rights reserved.

## License

Copyright © 2026 Or Smolarchik. All rights reserved. The code is published for viewing only. See [LICENSE](LICENSE).
