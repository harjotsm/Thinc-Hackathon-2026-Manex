-- 00006_resolve_schema_completion.sql
-- BREAKING: re-seed signal/incident/initiative after apply.
-- Aligns schema to planning/specs/2026-04-18-llm-data-pipeline-design.md v2.
--
-- NOTE ON VECTOR TYPE:
--   pgvector (vector extension) is not available on this PostgreSQL 15 instance.
--   Embedding columns are created as FLOAT8[] (1536-element float arrays) as an
--   interim type. Once pgvector is installed by the server admin, run:
--     ALTER TABLE signal ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector;
--     ALTER TABLE incident ALTER COLUMN centroid_embedding TYPE vector(1536) USING centroid_embedding::vector;
--     ALTER TABLE incident ALTER COLUMN signature_embedding TYPE vector(1536) USING signature_embedding::vector;
--     ALTER TABLE lesson ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector;
--     ALTER TABLE lesson ALTER COLUMN signature_embedding TYPE vector(1536) USING signature_embedding::vector;
--   Then create the ivfflat indexes.
--
-- NOTE ON PGCRYPTO:
--   pgcrypto is available but requires superuser to create. gen_random_uuid() is
--   available natively in PostgreSQL 15, so pgcrypto is not needed.

BEGIN;

-- 1. app_user (spec §16.2)
CREATE TABLE IF NOT EXISTS app_user (
  user_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('operator','engineer','leadership')),
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_user (user_id, name, role) VALUES
  ('user_op_042', 'Klaus Weber (Operator)', 'operator'),
  ('user_op_101', 'Maria Schmidt (Operator)', 'operator'),
  ('user_eng_anna', 'Anna Meier (Engineer)', 'engineer'),
  ('user_lead_thomas', 'Thomas Vogel (Plant Manager)', 'leadership')
ON CONFLICT (user_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_user TO team_writer;
GRANT SELECT ON app_user TO seed_readonly;

-- 2. Enum types for signal
-- Use DO blocks to create types only if they don't exist (idempotent)
DO $$ BEGIN
  CREATE TYPE signal_source AS ENUM (
    'operator','engineer','detector','customer_email',
    'backfill_defect','backfill_field_claim','backfill_test_result'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE signal_type_new AS ENUM (
    'operator_report','engineer_report','detector_anomaly',
    'field_claim','factory_defect','marginal_test'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE severity_t AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cluster_state_t AS ENUM ('attached','pending_cluster','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_type_t AS ENUM (
    'det_prod_def','det_sec_def','det_rule','sem','new','new_strong_detector','pending','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lang_t AS ENUM ('de','en');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_t AS ENUM ('early','late','night');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Signal table: DROP old TEXT embedding, ADD FLOAT8[] embedding, ADD new columns, migrate types

-- Drop the old TEXT embedding column
ALTER TABLE signal DROP COLUMN IF EXISTS embedding;
-- Add new embedding as FLOAT8[] (interim until pgvector is installed)
ALTER TABLE signal ADD COLUMN IF NOT EXISTS embedding FLOAT8[];

-- Add all new columns
ALTER TABLE signal
  ADD COLUMN IF NOT EXISTS lang lang_t,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS triage JSONB,
  ADD COLUMN IF NOT EXISTS cluster_state cluster_state_t NOT NULL DEFAULT 'attached',
  ADD COLUMN IF NOT EXISTS pending_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS detector_rule TEXT,
  ADD COLUMN IF NOT EXISTS detector_evidence JSONB,
  ADD COLUMN IF NOT EXISTS match_type match_type_t,
  ADD COLUMN IF NOT EXISTS match_score NUMERIC,
  ADD COLUMN IF NOT EXISTS attach_reason TEXT,
  ADD COLUMN IF NOT EXISTS incident_id TEXT REFERENCES incident(incident_id),
  ADD COLUMN IF NOT EXISTS matched_incident_id TEXT,
  ADD COLUMN IF NOT EXISTS reported_part_number TEXT,
  ADD COLUMN IF NOT EXISTS defect_code TEXT,
  ADD COLUMN IF NOT EXISTS test_key TEXT,
  ADD COLUMN IF NOT EXISTS order_id TEXT,  -- no FK: team_writer lacks REFERENCES privilege on Manex-owned production_order
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_user(user_id),
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS shift shift_t,
  ADD COLUMN IF NOT EXISTS severity severity_t,
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  ADD COLUMN IF NOT EXISTS source signal_source,
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS signal_type_new signal_type_new;
-- NOTE: NOT adding captured_ts_new column — existing captured_ts is already TIMESTAMPTZ NOT NULL, no dance needed.

-- Migrate existing rows: copy signal_type text → enum, text_payload → raw_text, set idempotency_key
UPDATE signal SET
  signal_type_new = CASE signal_type
    WHEN 'operator_report' THEN 'operator_report'::signal_type_new
    WHEN 'engineer_report' THEN 'engineer_report'::signal_type_new
    WHEN 'detector_anomaly' THEN 'detector_anomaly'::signal_type_new
    WHEN 'field_claim' THEN 'field_claim'::signal_type_new
    WHEN 'factory_defect' THEN 'factory_defect'::signal_type_new
    WHEN 'marginal_test' THEN 'marginal_test'::signal_type_new
    ELSE 'operator_report'::signal_type_new END,
  raw_text = COALESCE(text_payload, ''),
  source = CASE source_system
    WHEN 'manex_defect' THEN 'backfill_defect'::signal_source
    WHEN 'manex_field_claim' THEN 'backfill_field_claim'::signal_source
    WHEN 'manex_test_result' THEN 'backfill_test_result'::signal_source
    ELSE 'operator'::signal_source END,
  severity = COALESCE(
    CASE WHEN severity_hint >= 0.75 THEN 'high'::severity_t
         WHEN severity_hint >= 0.5  THEN 'medium'::severity_t
         ELSE 'low'::severity_t END,
    'medium'::severity_t),
  idempotency_key = COALESCE(idempotency_key, signal_id);

-- Drop old TEXT signal_type, rename new enum column
ALTER TABLE signal DROP COLUMN signal_type;
ALTER TABLE signal RENAME COLUMN signal_type_new TO signal_type;
ALTER TABLE signal ALTER COLUMN signal_type SET NOT NULL;

-- Make other columns NOT NULL after backfill
ALTER TABLE signal ALTER COLUMN source SET NOT NULL;
ALTER TABLE signal ALTER COLUMN raw_text SET NOT NULL;
ALTER TABLE signal ALTER COLUMN idempotency_key SET NOT NULL;

-- Unique index on idempotency_key (safer than ADD CONSTRAINT ... UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS signal_idempotency_uniq ON signal(idempotency_key);

-- Functional indexes (non-vector)
CREATE INDEX IF NOT EXISTS signal_cluster_state_idx ON signal (cluster_state) WHERE cluster_state = 'pending_cluster';
CREATE INDEX IF NOT EXISTS signal_incident_idx ON signal (incident_id);
-- NOTE: ivfflat index on signal.embedding omitted — requires pgvector extension.
--   Once pgvector is installed, run:
--   CREATE INDEX signal_embedding_ivfflat ON signal USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Incident: add missing columns
DO $$ BEGIN
  CREATE TYPE archetype_t AS ENUM ('supplier','drift','design','operator','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incident_status_t AS ENUM ('triage','reasoning','resolving','closed','dismissed','reopen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS archetype archetype_t NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS centroid_embedding FLOAT8[],
  ADD COLUMN IF NOT EXISTS signature_text TEXT,
  ADD COLUMN IF NOT EXISTS signature_embedding FLOAT8[],
  ADD COLUMN IF NOT EXISTS linked_product_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signal_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hypothesis_tree_v2 JSONB,
  ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cosign_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cosigned_by_user_id TEXT REFERENCES app_user(user_id),
  ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
  ADD COLUMN IF NOT EXISTS dismiss_reason TEXT,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Drop old TEXT embedding column from incident
ALTER TABLE incident DROP COLUMN IF EXISTS embedding;

-- Migrate incident status: TEXT → enum
-- First need to drop the existing check constraint, then migrate
ALTER TABLE incident DROP CONSTRAINT IF EXISTS incident_status_check;
ALTER TABLE incident ADD COLUMN status_new incident_status_t;
UPDATE incident SET status_new = status::incident_status_t;
ALTER TABLE incident DROP COLUMN status;
ALTER TABLE incident RENAME COLUMN status_new TO status;
ALTER TABLE incident ALTER COLUMN status SET NOT NULL;
ALTER TABLE incident ALTER COLUMN status SET DEFAULT 'triage';

CREATE INDEX IF NOT EXISTS incident_status_idx ON incident (status);
-- NOTE: ivfflat indexes on centroid_embedding / signature_embedding omitted — requires pgvector.
--   Once pgvector is installed, run:
--   CREATE INDEX incident_centroid_ivfflat ON incident USING ivfflat (centroid_embedding vector_cosine_ops) WITH (lists = 50);
--   CREATE INDEX incident_signature_ivfflat ON incident USING ivfflat (signature_embedding vector_cosine_ops) WITH (lists = 50);

-- 5. Session, session_turn, session_event
DO $$ BEGIN
  CREATE TYPE session_phase_t AS ENUM ('classify','investigate','compose','propose','complete','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status_t AS ENUM ('running','succeeded','failed','stalled','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE failure_reason_t AS ENUM (
    'max_turns','stall_loop','evidence_cite_unfixable','model_refusal',
    'context_overflow','api_error_exhausted','tool_errors_exhausted',
    'aborted_by_user','orchestrator_crash','semantic_validator_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident(incident_id),
  phase session_phase_t NOT NULL,
  status session_status_t NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_tokens_in INT DEFAULT 0,
  total_tokens_out INT DEFAULT 0,
  total_cost_usd NUMERIC DEFAULT 0,
  failure_reason failure_reason_t,
  created_by_user_id TEXT REFERENCES app_user(user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS session_one_running_per_incident ON session (incident_id) WHERE status = 'running';

GRANT SELECT, INSERT, UPDATE, DELETE ON session TO team_writer;
GRANT SELECT ON session TO seed_readonly;

CREATE TABLE IF NOT EXISTS session_turn (
  id TEXT PRIMARY KEY DEFAULT 'ST-' || gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES session(id),
  turn_index INT NOT NULL,
  phase session_phase_t NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('assistant','tool')),
  model TEXT,
  content_text TEXT,
  tool_call JSONB,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_turn_by_session ON session_turn (session_id, turn_index, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS session_turn_one_assistant_per_turn ON session_turn (session_id, turn_index) WHERE role = 'assistant';

GRANT SELECT, INSERT, UPDATE, DELETE ON session_turn TO team_writer;
GRANT SELECT ON session_turn TO seed_readonly;

CREATE TABLE IF NOT EXISTS session_event (
  session_id TEXT NOT NULL REFERENCES session(id),
  event_seq BIGSERIAL NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  ts TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (session_id, event_seq)
);
CREATE INDEX IF NOT EXISTS session_event_seq ON session_event (session_id, event_seq);

GRANT SELECT, INSERT, UPDATE, DELETE ON session_event TO team_writer;
GRANT SELECT ON session_event TO seed_readonly;
GRANT USAGE, SELECT ON SEQUENCE session_event_event_seq_seq TO team_writer;

-- 6. Report
CREATE TABLE IF NOT EXISTS report (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident(incident_id),
  session_id TEXT NOT NULL REFERENCES session(id),
  version INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','current','superseded')),
  report_8d JSONB NOT NULL,
  visualizations JSONB DEFAULT '[]'::jsonb,
  composed_by_model TEXT,
  composed_at TIMESTAMPTZ DEFAULT now(),
  confidence NUMERIC,
  compose_tokens_in INT DEFAULT 0,
  compose_tokens_out INT DEFAULT 0,
  UNIQUE(incident_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS report_one_current_per_incident ON report (incident_id) WHERE status = 'current';

GRANT SELECT, INSERT, UPDATE, DELETE ON report TO team_writer;
GRANT SELECT ON report TO seed_readonly;

-- 7. Initiative columns + initiative_check + dispatch_attempt
ALTER TABLE initiative
  ADD COLUMN IF NOT EXISTS cosign_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS co_signed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS co_signed_by_user_id TEXT REFERENCES app_user(user_id),
  ADD COLUMN IF NOT EXISTS co_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS patience_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_error_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_check_result JSONB,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE TABLE IF NOT EXISTS initiative_check (
  id TEXT PRIMARY KEY DEFAULT 'IC-' || gen_random_uuid(),
  initiative_id TEXT NOT NULL REFERENCES initiative(initiative_id),
  checked_at TIMESTAMPTZ DEFAULT now(),
  predicate_snapshot JSONB NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('pending','passed','failed','error')),
  evidence JSONB,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron','manual')),
  UNIQUE(initiative_id, checked_at)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON initiative_check TO team_writer;
GRANT SELECT ON initiative_check TO seed_readonly;

CREATE TABLE IF NOT EXISTS dispatch_attempt (
  id TEXT PRIMARY KEY DEFAULT 'DAT-' || gen_random_uuid(),
  initiative_id TEXT NOT NULL REFERENCES initiative(initiative_id),
  attempt_index INT NOT NULL,
  target_system TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','preview','sent','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  target_ref TEXT,
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  sent_by_user_id TEXT REFERENCES app_user(user_id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by_user_id TEXT REFERENCES app_user(user_id),
  UNIQUE(initiative_id, target_system, kind, attempt_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON dispatch_attempt TO team_writer;
GRANT SELECT ON dispatch_attempt TO seed_readonly;

-- 8. Lesson table extend
ALTER TABLE lesson
  ADD COLUMN IF NOT EXISTS archetype archetype_t,
  ADD COLUMN IF NOT EXISTS signature_embedding FLOAT8[],
  ADD COLUMN IF NOT EXISTS prompt_snippet TEXT,
  ADD COLUMN IF NOT EXISTS triggers JSONB,
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS root_cause_evidence JSONB,
  ADD COLUMN IF NOT EXISTS initiatives_taken JSONB,
  ADD COLUMN IF NOT EXISTS initiatives_outcome JSONB,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS engineer_validated TEXT NOT NULL DEFAULT 'pending'
    CHECK (engineer_validated IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS validated_by_user_id TEXT REFERENCES app_user(user_id),
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by TEXT REFERENCES lesson(lesson_id),
  ADD COLUMN IF NOT EXISTS seed_source TEXT,
  ADD COLUMN IF NOT EXISTS source_session_id TEXT REFERENCES session(id);

-- Drop old TEXT embedding column, add FLOAT8[] embedding
ALTER TABLE lesson DROP COLUMN IF EXISTS embedding;
ALTER TABLE lesson ADD COLUMN IF NOT EXISTS embedding FLOAT8[];

CREATE INDEX IF NOT EXISTS lesson_validated_idx ON lesson (engineer_validated) WHERE superseded_by IS NULL;
-- NOTE: ivfflat index on lesson.embedding omitted — requires pgvector.
--   Once pgvector is installed, run:
--   CREATE INDEX lesson_embedding_ivfflat ON lesson USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
--   CREATE INDEX lesson_sig_embedding_ivfflat ON lesson USING ivfflat (signature_embedding vector_cosine_ops) WITH (lists = 50);

-- 9. Lesson_usage (append-only)
CREATE TABLE IF NOT EXISTS lesson_usage (
  id TEXT PRIMARY KEY DEFAULT 'LU-' || gen_random_uuid(),
  lesson_id TEXT NOT NULL REFERENCES lesson(lesson_id),
  session_id TEXT REFERENCES session(id),
  incident_id TEXT NOT NULL REFERENCES incident(incident_id),
  used_at TIMESTAMPTZ DEFAULT now(),
  cosine_score NUMERIC NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON lesson_usage TO team_writer;
GRANT SELECT ON lesson_usage TO seed_readonly;

-- 10. Backfill watermark
CREATE TABLE IF NOT EXISTS backfill_watermark (
  source_table TEXT PRIMARY KEY CHECK (source_table IN ('defect','field_claim','test_result','rework')),
  last_seen_ts TIMESTAMPTZ,
  last_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON backfill_watermark TO team_writer;
GRANT SELECT ON backfill_watermark TO seed_readonly;

-- 11. Pipeline error log
CREATE TABLE IF NOT EXISTS pipeline_error_log (
  id TEXT PRIMARY KEY DEFAULT 'PEL-' || gen_random_uuid(),
  occurred_at TIMESTAMPTZ DEFAULT now(),
  session_id TEXT REFERENCES session(id),
  incident_id TEXT REFERENCES incident(incident_id),
  initiative_id TEXT REFERENCES initiative(initiative_id),
  phase TEXT,
  category TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT,
  details JSONB,
  recovered BOOLEAN DEFAULT false,
  retry_count INT DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON pipeline_error_log TO team_writer;
GRANT SELECT ON pipeline_error_log TO seed_readonly;

-- 12. Contribution table extend (source, status, structured_payload)
ALTER TABLE contribution
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'tool'
    CHECK (source IN ('tool','user','stub')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','unavailable','pending')),
  ADD COLUMN IF NOT EXISTS structured_payload JSONB;

-- Domain constraint (replace any existing one)
ALTER TABLE contribution DROP CONSTRAINT IF EXISTS contribution_domain_check;
ALTER TABLE contribution ADD CONSTRAINT contribution_domain_check CHECK (domain IN (
  'market_research','central_quality','plant_quality_indirect','plant_quality_direct',
  'process_planner','technology_planning','supplier_quality',
  'business_analytics','marketing'
));

CREATE UNIQUE INDEX IF NOT EXISTS contribution_uniq_per_source ON contribution (incident_id, domain, source);

COMMIT;
