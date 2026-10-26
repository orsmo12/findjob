-- LifeBoard — Supabase Schema
-- הרץ ב-SQL Editor של Supabase (כולו בפעם אחת)
--
-- טבלאות:
--   jobs          — משרות שנמצאו ע"י Finder
--   pipeline      — tracking של כל הגשה (שלב נוכחי)
--   pipeline_history — היסטוריית מעברי שלבים
--   cover_letters — מכתבי מוטיבציה שנוצרו
--   token_usage   — מעקב אחר שימוש בtokens (Budget Guard)

-- ── Extensions ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enum: Pipeline Stage ────────────────────────────────────────────────────────
CREATE TYPE pipeline_stage AS ENUM (
  'saved', 'applied', 'phone_screen', 'interview',
  'technical', 'final_round', 'offer',
  'accepted', 'rejected', 'withdrawn', 'ghosted'
);

-- ── Jobs ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT DEFAULT '',
  salary        TEXT DEFAULT '',
  url           TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  ats_score     INT  DEFAULT 50,
  source        TEXT DEFAULT 'unknown',
  status        pipeline_stage DEFAULT 'saved',
  dismissed     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Pipeline ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID REFERENCES jobs(id) ON DELETE CASCADE,
  stage       pipeline_stage DEFAULT 'saved',
  notes       TEXT DEFAULT '',
  applied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id)  -- job מופיע פעם אחת ב-pipeline
);

-- ── Pipeline History ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id     UUID REFERENCES jobs(id) ON DELETE CASCADE,
  from_stage pipeline_stage,
  to_stage   pipeline_stage NOT NULL,
  notes      TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Cover Letters ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cover_letters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID REFERENCES jobs(id) ON DELETE CASCADE,
  letter      TEXT NOT NULL,
  model       TEXT DEFAULT 'claude-opus-4-5',
  language    TEXT DEFAULT 'he',
  tone        TEXT DEFAULT 'professional',
  from_cache  BOOLEAN DEFAULT false,
  tokens_used INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Token Usage (Budget Guard) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_usage (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  agent      TEXT NOT NULL,
  task       TEXT DEFAULT '',
  tokens     INT  NOT NULL,
  model      TEXT DEFAULT 'groq',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created    ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage  ON pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(date);

-- ── Updated_at trigger ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER pipeline_updated_at
  BEFORE UPDATE ON pipeline
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Views ────────────────────────────────────────────────────────────────────────

-- משרות עם שלב pipeline נוכחי
CREATE OR REPLACE VIEW jobs_with_pipeline AS
SELECT
  j.*,
  p.stage   AS pipeline_stage,
  p.notes   AS pipeline_notes,
  p.applied_at,
  cl.letter AS cover_letter
FROM jobs j
LEFT JOIN pipeline p     ON p.job_id = j.id
LEFT JOIN cover_letters cl ON cl.job_id = j.id
ORDER BY j.created_at DESC;

-- סיכום תקציב יומי
CREATE OR REPLACE VIEW daily_token_usage AS
SELECT
  date,
  SUM(tokens)           AS total_tokens,
  COUNT(*)              AS total_calls,
  STRING_AGG(DISTINCT agent, ', ') AS agents
FROM token_usage
GROUP BY date
ORDER BY date DESC;

-- ── RLS (Row Level Security) ─────────────────────────────────────────────────────
-- מאפשר לservice_role key לעשות הכל, anon key לקרוא בלבד
-- (single-user app — לא צריך auth מורכב)
ALTER TABLE jobs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage   ENABLE ROW LEVEL SECURITY;

-- service_role (Python backend) — full access
CREATE POLICY "service_role full access on jobs"
  ON jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role full access on pipeline"
  ON pipeline FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role full access on cover_letters"
  ON cover_letters FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role full access on token_usage"
  ON token_usage FOR ALL USING (auth.role() = 'service_role');

-- anon (Next.js frontend) — read only
CREATE POLICY "anon read jobs"
  ON jobs FOR SELECT USING (true);
CREATE POLICY "anon read pipeline"
  ON pipeline FOR SELECT USING (true);
CREATE POLICY "anon read cover_letters"
  ON cover_letters FOR SELECT USING (true);
