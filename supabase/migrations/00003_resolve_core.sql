BEGIN;

CREATE TABLE signal (
  signal_id      TEXT PRIMARY KEY,
  signal_type    TEXT NOT NULL,
  source_system  TEXT NOT NULL,
  captured_ts    TIMESTAMPTZ NOT NULL,
  product_id     TEXT REFERENCES product(product_id) ON DELETE RESTRICT,
  part_number    TEXT REFERENCES part_master(part_number) ON DELETE RESTRICT,
  section_id     TEXT REFERENCES section(section_id) ON DELETE RESTRICT,
  batch_id       TEXT REFERENCES supplier_batch(batch_id) ON DELETE RESTRICT,
  severity_hint  NUMERIC CHECK (severity_hint >= 0 AND severity_hint <= 1),
  text_payload   TEXT,
  raw_payload    JSONB NOT NULL,
  embedding      JSONB
);

CREATE TABLE incident (
  incident_id        TEXT PRIMARY KEY,
  opened_ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_ts          TIMESTAMPTZ,
  status             TEXT NOT NULL CHECK (status IN ('triage', 'reasoning', 'resolving', 'closed', 'dismissed')),
  title              TEXT,
  summary            TEXT,
  severity           TEXT,
  primary_product_id TEXT REFERENCES product(product_id) ON DELETE RESTRICT,
  primary_part       TEXT REFERENCES part_master(part_number) ON DELETE RESTRICT,
  hypothesis_tree    JSONB,
  embedding          JSONB
);

CREATE TABLE incident_signal (
  incident_id TEXT NOT NULL REFERENCES incident(incident_id) ON DELETE RESTRICT,
  signal_id   TEXT NOT NULL REFERENCES signal(signal_id) ON DELETE RESTRICT,
  added_by    TEXT,
  PRIMARY KEY (incident_id, signal_id)
);

CREATE TABLE contribution (
  contribution_id TEXT PRIMARY KEY,
  incident_id     TEXT NOT NULL REFERENCES incident(incident_id) ON DELETE RESTRICT,
  domain          TEXT NOT NULL,
  author_user_id  TEXT,
  content         TEXT,
  evidence_refs   JSONB,
  weight          NUMERIC NOT NULL DEFAULT 1.0,
  created_ts      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE initiative (
  initiative_id     TEXT PRIMARY KEY,
  incident_id       TEXT NOT NULL REFERENCES incident(incident_id) ON DELETE RESTRICT,
  agent_domain      TEXT NOT NULL,
  target_system     TEXT NOT NULL,
  external_ref      TEXT,
  product_action_id TEXT REFERENCES product_action(action_id) ON DELETE RESTRICT,
  owner_user_id     TEXT,
  due_ts            TIMESTAMPTZ,
  status            TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'in_progress', 'done', 'reopen', 'rejected')),
  closure_predicate JSONB NOT NULL,
  created_ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_ts         TIMESTAMPTZ
);

CREATE TABLE impact_measurement (
  measurement_id TEXT PRIMARY KEY,
  initiative_id  TEXT NOT NULL REFERENCES initiative(initiative_id) ON DELETE RESTRICT,
  measured_ts    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metric         TEXT NOT NULL,
  value          NUMERIC,
  confidence     NUMERIC,
  method         TEXT NOT NULL
);

CREATE TABLE lesson (
  lesson_id       TEXT PRIMARY KEY,
  incident_id     TEXT NOT NULL REFERENCES incident(incident_id) ON DELETE RESTRICT,
  signature_text  TEXT NOT NULL,
  embedding       JSONB,
  outcome         TEXT NOT NULL,
  fix_summary     TEXT NOT NULL,
  created_ts      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signal_captured_ts ON signal(captured_ts DESC);
CREATE INDEX idx_signal_product_id ON signal(product_id);
CREATE INDEX idx_signal_part_number ON signal(part_number);
CREATE INDEX idx_signal_batch_id ON signal(batch_id);
CREATE INDEX idx_signal_embedding ON signal USING gin (embedding);

CREATE INDEX idx_incident_status ON incident(status);
CREATE INDEX idx_incident_opened_ts ON incident(opened_ts DESC);
CREATE INDEX idx_incident_embedding ON incident USING gin (embedding);

CREATE INDEX idx_contribution_incident_id ON contribution(incident_id);
CREATE INDEX idx_initiative_incident_id ON initiative(incident_id);
CREATE INDEX idx_initiative_status ON initiative(status);
CREATE INDEX idx_impact_measurement_initiative_id ON impact_measurement(initiative_id);
CREATE INDEX idx_lesson_embedding ON lesson USING gin (embedding);

GRANT SELECT, INSERT, UPDATE, DELETE ON signal TO team_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON incident TO team_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_signal TO team_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON contribution TO team_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON initiative TO team_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON impact_measurement TO team_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON lesson TO team_writer;

GRANT SELECT ON signal, incident, incident_signal, contribution, initiative, impact_measurement, lesson TO seed_readonly;

COMMIT;
