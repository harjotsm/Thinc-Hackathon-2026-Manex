# LLM Orchestrator Implementation Plan — v2

> **Revised 2026-04-18 after merging `develop` (Harjot's `web/` Next.js scaffold) and Dashboard prototype (Lila's `.jsx` reference) into feat/joscha. v1 (planning/plans/2026-04-18-llm-orchestrator-implementation.md) is superseded — it assumed scaffold-from-scratch at repo root; v2 extends the existing `web/` app.**
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing `web/` scaffold up to full spec compliance (planning/specs/2026-04-18-llm-data-pipeline-design.md v2) so Story 1 (Supplier-batch SB-00007) and Story 3 (Design-drift R33) demo end-to-end with live SSE, full evidence-cite enforcement, lessons network effect, and Dashboard-prototype-aligned UI.

**Architecture:** Extend Harjot's 4-phase orchestrator + 5-tool scaffold in `web/src/server/` to (a) full 19-tool typed registry with Zod I/O, (b) session/turn/event append-only logging with token-streaming SSE, (c) 3-layer evidence-cite validator, (d) full schema (session/report/initiative_check/dispatch_attempt/lesson_usage tables + missing signal/incident columns), (e) pgvector-backed semantic search, (f) contribution pipeline (3 functional + 6 stub), (g) lessons retrieve+compose, (h) port 3 key Dashboard screens to Next.js.

**Tech Stack (locked, matches develop):** Next.js 16 + App Router (in `web/`), TypeScript strict, pnpm, `@anthropic-ai/sdk` ^0.90, `openai` ^6.34, `@supabase/supabase-js` ^2.103, Zod ^4.3, Vitest. Remote Postgres at Manex (PostgREST + direct pg).

**Scope decisions (Q1-Q4 all (a) — no compromises):**
- Q1(a) — full schema fix via breaking migration 00006; `signal.embedding JSONB → vector(1536)`; ALL missing columns; session/turn/event tables; report/initiative_check/dispatch_attempt/lesson_usage/app_user tables
- Q2(a) — full tool registry; kill `switch` in orchestrator; 19 tools typed
- Q3(a) — real SSE EventSource consumer on engineer investigate page; token_delta live stream
- Q4(a) — Joscha ports 3 key Dashboard screens (engineer/investigate-canvas, engineer/inbox, operator/capture) into `web/src/app/` with Dashboard CSS tokens ported to Tailwind

**Scope handoffs (unchanged from v1):**
- Lila (feat/lila): remaining screen ports (leadership dashboard, lessons library, connectors, 8D-projection, other Floor variants), polish
- Harsh (feat/harsh): implementations for non-MVP tools, viz components (React Flow graph, Recharts)
- Harjot (feat/harjot): closure-predicate evaluator internals (RPC already stubbed), pgvector tuning, DevOps

**Total budget:** Joscha ~20h of work (bootstrap 0.5h + M1 1.5h + M2 1h + M3 2h + M4 2.5h + M5 3h + M6 4h + M7 2h + buffer 3.5h).

---

## Context — What Exists on `develop` (After Merge)

**Scaffold at `web/`:**
- Next.js 16 + Turbopack + TS strict
- `pnpm` workspace; `web/package.json` has `@anthropic-ai/sdk`, `openai`, `@supabase/supabase-js`, `ai`, `zod`
- Env resolution via `web/src/lib/env.ts` (Manex-aware via `MANEX_API_URL` fallback)

**Server (`web/src/server/`):**
- `agent/orchestrator.ts` — `runOrchestrator(incidentId)`: 4 synchronous phases (Classify → Investigate → Compose → Propose), returns `OrchestratorResult`, tools dispatched via hard-coded `switch`
- `agent/evidence-validator.ts` — 31 lines; minimal, only Layer-1-structured; no inline [[tc:]] markers; no retry
- `agent/types.ts`
- `correlator/run.ts` — 218 lines, deterministic joins + lexical neighbor graph via `resolve_semantic_neighbors` RPC
- `domain-agents/` — `production.ts`, `rnd.ts`, `supplier.ts`, `types.ts` — minimal initiative builders
- `embeddings.ts` — OpenAI wrapper; writes embedding as JSONB to `signal.embedding`
- `models/router.ts` — Anthropic/OpenAI client routing
- `prompts/playbooks.ts` + `prompts/system.ts` — inline TS strings
- `schemas/` — signal (minimal 11 fields), incident (minimal 10 fields), initiative (complete), orchestrator
- `tools/` — 5 tools, `ToolCallResult` return, **no registry** (switch in orchestrator)
  - `query-defects.ts` — functional, queries `v_defect_detail` view
  - `query-claims.ts` — functional, queries `v_field_claim_detail`
  - `trace-batch.ts` — functional, queries `v_product_bom_parts`
  - `weekly-quality-summary.ts` — functional, queries `v_quality_summary`
  - `semantic-search-complaints.ts` — **LEXICAL not semantic** (ilike token Jaccard); blocker
- `workers/closure-monitor.ts` — 143 lines; evaluates closure predicates
- `utils/id.ts` — `makeId(prefix)` helper

**API routes (`web/src/app/api/`):**
- `intake/capture` (POST) — signal ingest + sync correlator
- `intake/query` (GET) — signal list
- `incident/[incidentId]` (GET)
- `incident/[incidentId]/signals` (GET)
- `agent/run` (POST) — batch, no stream
- `agent/stream` (GET, SSE) — **turn-level only**, emits `status`/`phase`/`result`/`done`; not token-delta
- `initiative/approve` (POST) — atomic via `resolve_approve_initiative` RPC
- `workers/closure-monitor` (POST, auth'd) — fires worker
- `demo/seed` — demo data seeding

**Persona pages (`web/src/app/(...)/page.tsx`):**
- `(operator)/capture` — "use client"; POST to `/api/intake/capture`; simple form
- `(engineer)/investigate/[incidentId]` — "use client"; uses `/api/agent/run` batch mode; Recharts charts; **does NOT consume SSE stream**
- `(manager)/dashboard` — async RSC; direct Supabase queries for Pareto + initiatives + quality_summary

**Migrations (`supabase/migrations/`):**
- `00001_create_schema.sql` — Manex baseline (untouched)
- `00002_create_views.sql` — Manex views
- `00003_resolve_core.sql` — Resolve core: signal (11 cols, `embedding JSONB`), incident (10 cols), incident_signal, contribution, initiative, impact_measurement, lesson. **Critical: signal.embedding is JSONB not vector(1536).**
- `00004_resolve_workflow_atomic.sql` — `resolve_approve_initiative`, `resolve_apply_closure_result` RPCs
- `00005_resolve_semantic_helpers.sql` — `resolve_semantic_neighbors` RPC (lexical Jaccard)

**Dashboard prototype at `dashboard-prototype/`:**
- 11 screens in `.jsx` (landing, inbox, canvas, eightd, resolve, initiatives, lessons, leadership, connectors + floor variants)
- `data.jsx` mock data — UI-flat shapes (strings) not strict spec shapes
- `styles.css` — light-mode custom tokens (`--accent: #639fc4`, `--cta: #1032cf`, `--sev-*`)
- `Resolve Wireframe.html` + `uploads/RESOLVE_WIREFRAME_BRIEF.md` — design source of truth

---

## Gap Delta — What Needs to Change

**Schema gaps (Q1a: fix ALL):**
- `signal` — add 15 columns: `embedding vector(1536)` (change type from jsonb), `lang`, `attachments`, `triage`, `cluster_state`, `pending_until`, `idempotency_key`, `detector_rule`, `detector_evidence`, `match_type`, `match_score`, `attach_reason`, `matched_incident_id`, `part_number` (exists on some?), `test_key`, `order_id`, `user_id`, `market`, `shift`, `severity` (new enum), `severity_hint`, `source_ref`, `signal_type` (new enum), `captured_ts` (new)
- `incident` — add 12 columns: `archetype`, `centroid_embedding vector(1536)`, `signature_text`, `signature_embedding vector(1536)`, `linked_product_ids`, `signal_count`, `is_provisional`, `cosign_required`, `cosigned_by_user_id`, `cosigned_at`, `reopen_reason`, `dismiss_reason`, `reopened_at`, `last_activity_at`; expand status enum with `reopen`
- New tables: `app_user`, `session`, `session_turn`, `session_event`, `report`, `initiative_check`, `dispatch_attempt`, `lesson_usage`, `backfill_watermark`, `pipeline_error_log`
- `initiative` — add `cosign_required`, `co_signed`, `co_signed_by_user_id`, `co_signed_at`, `dispatch_idempotency_key`, `patience_until`, `consecutive_error_count`
- Indexes: `CREATE INDEX signal USING ivfflat (embedding vector_cosine_ops)`; `CREATE INDEX signal (cluster_state) WHERE cluster_state = 'pending_cluster'`; `CREATE UNIQUE INDEX ON session (incident_id) WHERE status = 'running'`; `UNIQUE(signal.idempotency_key)`
- Enable `CREATE EXTENSION IF NOT EXISTS vector;` if not already

**Code gaps (Q2a + Q3a + Q4a + content):**
- Tool registry pattern — new `web/src/server/tools/registry.ts`; migrate 5 existing + add 14 new (10 functional, 4 stubbed)
- Replace `semantic-search-complaints` (lexical) with real pgvector `semantic_search_signals`
- New tools: `get_incident`, `list_signals_for_incident`, `find_related_incidents`, `pareto_defect_codes`, `bom_parts_for_product`, `test_results_marginal`, `field_vs_factory_gap`, `operator_effect_analysis`, `rework_timeline_by_section`, `retrieve_lessons`, `classify_defect_image`, `simulate_impact`, `create_initiative`, `register_closure_predicate`, `emit_lesson`, `emit_impact_measurement`, `contrib_central_quality`, `contrib_plant_quality`, `contrib_supplier_quality`
- Session/turn/event persistence in orchestrator
- Evidence validator Layer 2 (`[[tc:]]` inline markers + `[[reasoning]]`) + Layer 3 (post-validator + 1-retry)
- Semantic validator (Haiku-judge) for Propose phase only
- Prompt cache breakpoints (2 per phase per spec §8.2)
- SSE token_delta event emission from orchestrator + EventSource consumer in engineer page
- Contribution pipeline (9 domains: 3 functional, 6 stubs)
- Lessons retrieve + compose
- Dashboard screen ports (3 screens)
- Backfill script (defect + field_claim + test_result → signal)
- Embedding-recovery cron + pending-cluster-sweep cron

**Unchanged from `develop` (kept as-is for now):**
- Correlator deterministic phase (spec §5.1 phase 1) — already in place
- `resolve_approve_initiative` RPC (initiative dispatch transactional)
- `resolve_apply_closure_result` RPC
- Persona page routing (operator/engineer/manager)
- env.ts Manex-aware fallback

---

## File Structure — Modify/Create

**Modify (Harjot's code):**
```
web/src/server/schemas/signal.ts                # add 15+ fields
web/src/server/schemas/incident.ts              # add 12+ fields
web/src/server/schemas/initiative.ts            # add cosign + dispatch_idempotency_key
web/src/server/schemas/orchestrator.ts          # align to new terminal shapes
web/src/server/agent/orchestrator.ts            # kill switch, use registry, add session, add cache breakpoints
web/src/server/agent/evidence-validator.ts      # expand to 3-layer + retry
web/src/server/correlator/run.ts                # integrate new fields; use signature_text composition
web/src/server/embeddings.ts                    # change write to vector type; batch variant
web/src/server/tools/semantic-search-complaints.ts   # replace impl with pgvector knn
web/src/app/api/agent/stream/route.ts           # add token_delta events + Last-Event-ID replay
web/src/app/(engineer)/investigate/[incidentId]/page.tsx   # swap to EventSource consumer
web/src/app/(operator)/capture/page.tsx         # redesign with Floor-lens Dashboard UI
web/src/app/globals.css                         # port Dashboard tokens
web/tailwind.config.ts                          # add Dashboard token mappings  (create if missing)
```

**Create (Joscha):**
```
supabase/migrations/00006_resolve_schema_completion.sql   # breaking ALTER + new tables + indexes
supabase/migrations/00007_resolve_contribution_domains.sql  # seed 6 stub domains per incident
supabase/migrations/00008_resolve_demo_lessons.sql        # 3 pre-approved lessons
web/src/server/schemas/session.ts
web/src/server/schemas/report.ts
web/src/server/schemas/dispatch.ts
web/src/server/schemas/impact.ts
web/src/server/schemas/lesson.ts                          # full spec shape
web/src/server/schemas/closure.ts                         # ClosurePredicate discriminated union
web/src/server/schemas/action-templates.ts                # ActionTemplate union
web/src/server/schemas/api-responses.ts                   # SessionEventEnvelope, ErrorResponse, etc.
web/src/server/tools/registry.ts                          # ToolSpec, invokeTool, register
web/src/server/tools/types.ts                             # Tool interface + ToolCtx
web/src/server/tools/_register.ts                         # side-effect import of all tools
web/src/server/tools/signal-incident/get-incident.ts
web/src/server/tools/signal-incident/list-signals-for-incident.ts
web/src/server/tools/signal-incident/find-related-incidents.ts   # stub
web/src/server/tools/retrieval/pareto-defect-codes.ts
web/src/server/tools/retrieval/bom-parts-for-product.ts
web/src/server/tools/retrieval/test-results-marginal.ts          # stub
web/src/server/tools/cross-boundary/field-vs-factory-gap.ts
web/src/server/tools/cross-boundary/operator-effect-analysis.ts  # stub
web/src/server/tools/cross-boundary/rework-timeline-by-section.ts # stub
web/src/server/tools/semantic-vision-lessons/semantic-search-signals.ts  # real pgvector
web/src/server/tools/semantic-vision-lessons/retrieve-lessons.ts
web/src/server/tools/semantic-vision-lessons/classify-defect-image.ts    # stub
web/src/server/tools/simulation/simulate-impact.ts
web/src/server/tools/write-gated/create-initiative.ts
web/src/server/tools/write-gated/register-closure-predicate.ts
web/src/server/tools/write-gated/emit-lesson.ts
web/src/server/tools/write-gated/emit-impact-measurement.ts
web/src/server/tools/contributions/central-quality.ts
web/src/server/tools/contributions/plant-quality.ts
web/src/server/tools/contributions/supplier-quality.ts
web/src/server/agent/context-manager.ts                   # haiku-summarize on 190k+ tokens
web/src/server/agent/stall-detector.ts                    # canonical-hash loop detector
web/src/server/agent/session-logger.ts                    # turn/event persistence helpers
web/src/server/agent/phases/classify.ts                   # extract phase from orchestrator
web/src/server/agent/phases/investigate.ts
web/src/server/agent/phases/compose.ts
web/src/server/agent/phases/propose.ts
web/src/server/prompts/base.md                            # .md for future build-step (starter)
web/src/server/prompts/phase.classify.md
web/src/server/prompts/phase.investigate.md
web/src/server/prompts/phase.compose.md
web/src/server/prompts/phase.propose.md
web/src/server/prompts/playbooks/supplier.md
web/src/server/prompts/playbooks/drift.md
web/src/server/prompts/playbooks/design.md
web/src/server/prompts/playbooks/operator.md
web/src/server/prompts/playbooks/unknown.md
web/src/server/workers/detector.ts                        # stub SPC detector
web/src/server/workers/embedding-recovery.ts              # re-embed null rows + re-correlate
web/src/server/workers/pending-cluster-sweep.ts           # expire pending_cluster signals
web/src/server/workers/backfill-incremental.ts            # cron variant
web/src/app/api/session/[sessionId]/route.ts              # GET history with ?since
web/src/app/api/session/[sessionId]/stream/route.ts       # SSE live+replay
web/src/app/api/session/[sessionId]/hint/route.ts         # POST engineer hint
web/src/app/api/initiative/[id]/cosign/route.ts           # Leadership co-sign
web/src/app/api/incident/[incidentId]/reopen/route.ts
web/src/app/api/incident/[incidentId]/promote/route.ts
web/src/app/api/incident/[incidentId]/contributions/route.ts  # GET + POST
web/src/app/api/incident/[incidentId]/contribution/refresh/route.ts
web/src/app/api/report/[reportId]/route.ts                # GET
web/src/app/api/report/[reportId]/accept/route.ts
web/src/app/api/system/health/route.ts
web/src/app/(engineer)/inbox/page.tsx                     # ported from landing_inbox.jsx
web/src/app/(engineer)/canvas/[incidentId]/page.tsx       # ported from canvas.jsx
web/src/components/cards/SignalCard.tsx
web/src/components/cards/IncidentCard.tsx
web/src/components/cards/ContributionCard.tsx
web/src/components/cards/HypothesisNode.tsx
web/src/components/evidence/EvidenceCitation.tsx
web/src/lib/stable-stringify.ts
web/src/lib/event-bus.ts                                   # EventEmitter singleton
scripts/backfill-signals.ts                               # at repo root; executes against Manex remote
scripts/health-check.ts                                    # at repo root
tests/unit/stable-stringify.test.ts
tests/unit/stall-detector.test.ts
tests/unit/evidence-validator.test.ts
tests/integration/tool-registry.test.ts
tests/integration/orchestrator-e2e.test.ts
tests/golden/story-1-supplier-batch.test.ts
tests/golden/story-3-design-drift.test.ts
tests/fixtures/incidents/story-1.json
tests/fixtures/incidents/story-3.json
```

---

## Milestones

| M | Content | Hours |
|---|---|---|
| M0 | Bootstrap: env + health-check against existing web/ | 0.5 |
| M1 | Breaking schema migration (00006_resolve_schema_completion.sql) | 1.5 |
| M2 | Zod schema completion (web/src/server/schemas/) | 1 |
| M3 | Tool registry + 19-tool migration | 2 |
| M4 | Session persistence + evidence-validator 3-layer + cache breakpoints | 2.5 |
| M5 | Contribution pipeline + lessons retrieve/compose + backfill + workers | 3 |
| M6 | SSE token streaming + Dashboard screen ports (3 screens) + design tokens | 4 |
| M7 | Golden tests (Story 1 + 3) + demo reset + PR to develop | 2 |
| **Total** | | **16.5** |

Buffer for integration bugs: 3.5h. 20h total.

---

## Milestone 0 — Bootstrap

**Target: verify env + connectivity with existing web/ running. 30min.**

### Task 0.1: Pull latest + install deps

**Files:** `web/package.json`, `.env.local`

- [ ] **Step 1: Install web/ deps**

```bash
cd /Users/joschahaertel/Projects/Hackathons/Deconstructors/De.Constructors/web
pnpm install
cd ..
```

- [ ] **Step 2: Create `.env.local` at repo root if missing**

Based on spec §16.3 + real Manex credentials from team handout. See v1 Task 0.2 for full template. Required NOW:

```bash
# at repo root (not web/)
MANEX_API_URL=http://34.89.205.150:8005/
MANEX_ANON_KEY=<bearer-jwt>  # same as MANEX_API_KEY in v1
MANEX_SERVICE_ROLE_KEY=<bearer-jwt>
MANEX_PG_URL=postgres://team_writer_deconstructors:<pw>@34.89.205.150:5435/hackathon
MANEX_IMAGES_URL=http://34.89.205.150:9000/defect_images/
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CRON_SECRET=<random>
```

Also create `web/.env.local` (Next.js reads from its own cwd):
```bash
ln -s ../.env.local web/.env.local
# OR duplicate the values
```

- [ ] **Step 3: Verify dev server starts**

```bash
cd web && pnpm dev
```
Expected: Next.js on http://localhost:3000. Check /api/incident/INC-00000 errors cleanly (no incident yet).

### Task 0.2: Health-check script

**Files:** `scripts/health-check.ts`, `package.json` (root)

- [ ] **Step 1: Create health-check at repo root**

Same as v1 Task 0.3 but dotenv-loads from both `.env.local` and `web/.env.local`. Run: `pnpm tsx scripts/health-check.ts`. Expected: 3 ✓ lines.

- [ ] **Step 2: Commit**

```bash
git add scripts/health-check.ts package.json web/package.json
git commit -m "chore(m0): health-check script + env template against live Manex"
```

---

## Milestone 1 — Breaking Schema Migration

**Target: 00006 migration brings DB schema to full spec compliance. 1.5h. BREAKING — requires re-seed of any existing Resolve rows.**

### Task 1.1: Write 00006_resolve_schema_completion.sql

**Files:** `supabase/migrations/00006_resolve_schema_completion.sql`

- [ ] **Step 1: Sketch the migration**

```sql
-- 00006_resolve_schema_completion.sql
-- BREAKING: re-seed signal/incident/initiative after apply.
-- Aligns schema to planning/specs/2026-04-18-llm-data-pipeline-design.md v2.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- 0. Drop dependent views that reference signal/incident so we can alter them
-- (none in Resolve yet; Manex views are untouched)

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

-- 2. Enum types for signal
CREATE TYPE signal_source AS ENUM (
  'operator','engineer','detector','customer_email',
  'backfill_defect','backfill_field_claim','backfill_test_result'
);
CREATE TYPE signal_type AS ENUM (
  'operator_report','engineer_report','detector_anomaly',
  'field_claim','factory_defect','marginal_test'
);
CREATE TYPE severity_t AS ENUM ('low','medium','high','critical');
CREATE TYPE cluster_state_t AS ENUM ('attached','pending_cluster','expired');
CREATE TYPE match_type_t AS ENUM (
  'det_prod_def','det_sec_def','det_rule','sem','new','new_strong_detector','pending','expired'
);
CREATE TYPE lang_t AS ENUM ('de','en');
CREATE TYPE shift_t AS ENUM ('early','late','night');

-- 3. Signal table: DROP old embedding (jsonb), ADD columns, migrate type
ALTER TABLE signal DROP COLUMN IF EXISTS embedding;
ALTER TABLE signal ADD COLUMN embedding vector(1536);

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
  ADD COLUMN IF NOT EXISTS matched_incident_id TEXT,
  ADD COLUMN IF NOT EXISTS reported_part_number TEXT,
  ADD COLUMN IF NOT EXISTS defect_code TEXT,
  ADD COLUMN IF NOT EXISTS test_key TEXT,
  ADD COLUMN IF NOT EXISTS order_id TEXT REFERENCES production_order(order_id),
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES app_user(user_id),
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS shift shift_t,
  ADD COLUMN IF NOT EXISTS severity severity_t,
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  ADD COLUMN IF NOT EXISTS source signal_source,
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS signal_type_enum signal_type,  -- tmp; existing signal_type is TEXT
  ADD COLUMN IF NOT EXISTS captured_ts_new TIMESTAMPTZ;

-- Migrate existing rows: copy signal_type text → enum, text_payload → raw_text
UPDATE signal SET
  signal_type_enum = CASE signal_type
    WHEN 'operator_report' THEN 'operator_report'::signal_type
    WHEN 'factory_defect' THEN 'factory_defect'::signal_type
    ELSE 'operator_report'::signal_type END,
  raw_text = COALESCE(text_payload, ''),
  source = CASE source_system
    WHEN 'manex_defect' THEN 'backfill_defect'::signal_source
    WHEN 'manex_field_claim' THEN 'backfill_field_claim'::signal_source
    ELSE 'operator'::signal_source END,
  severity = COALESCE(
    CASE WHEN severity_hint >= 0.75 THEN 'high'::severity_t
         WHEN severity_hint >= 0.5 THEN 'medium'::severity_t
         ELSE 'low'::severity_t END,
    'medium'::severity_t),
  captured_ts_new = captured_ts,
  idempotency_key = COALESCE(idempotency_key, signal_id);
ALTER TABLE signal DROP COLUMN signal_type;
ALTER TABLE signal RENAME COLUMN signal_type_enum TO signal_type;
ALTER TABLE signal ALTER COLUMN signal_type SET NOT NULL;
ALTER TABLE signal DROP COLUMN captured_ts;
ALTER TABLE signal RENAME COLUMN captured_ts_new TO captured_ts;
ALTER TABLE signal ALTER COLUMN captured_ts SET NOT NULL;
ALTER TABLE signal ALTER COLUMN source SET NOT NULL;
ALTER TABLE signal ALTER COLUMN raw_text SET NOT NULL;
ALTER TABLE signal ALTER COLUMN idempotency_key SET NOT NULL;
ALTER TABLE signal ADD CONSTRAINT signal_idempotency_uniq UNIQUE (idempotency_key);

CREATE INDEX IF NOT EXISTS signal_cluster_state_idx ON signal (cluster_state) WHERE cluster_state = 'pending_cluster';
CREATE INDEX IF NOT EXISTS signal_incident_idx ON signal (incident_id);
CREATE INDEX IF NOT EXISTS signal_embedding_ivfflat ON signal USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Incident: add missing columns
CREATE TYPE archetype_t AS ENUM ('supplier','drift','design','operator','unknown');
CREATE TYPE incident_status_t AS ENUM ('triage','reasoning','resolving','closed','dismissed','reopen');

ALTER TABLE incident
  ADD COLUMN IF NOT EXISTS archetype archetype_t NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS centroid_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS signature_text TEXT,
  ADD COLUMN IF NOT EXISTS signature_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS linked_product_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signal_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hypothesis_tree_v2 JSONB,   -- keep old hypothesis_tree, migrate if needed
  ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cosign_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cosigned_by_user_id TEXT REFERENCES app_user(user_id),
  ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
  ADD COLUMN IF NOT EXISTS dismiss_reason TEXT,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Migrate status to enum
ALTER TABLE incident ADD COLUMN status_new incident_status_t;
UPDATE incident SET status_new = status::incident_status_t;
ALTER TABLE incident DROP COLUMN status;
ALTER TABLE incident RENAME COLUMN status_new TO status;
ALTER TABLE incident ALTER COLUMN status SET NOT NULL;
ALTER TABLE incident ALTER COLUMN status SET DEFAULT 'triage';

CREATE INDEX IF NOT EXISTS incident_status_idx ON incident (status);
CREATE INDEX IF NOT EXISTS incident_centroid_ivfflat ON incident USING ivfflat (centroid_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS incident_signature_ivfflat ON incident USING ivfflat (signature_embedding vector_cosine_ops) WITH (lists = 50);

-- 5. Session, session_turn, session_event
CREATE TYPE session_phase_t AS ENUM ('classify','investigate','compose','propose','complete','failed');
CREATE TYPE session_status_t AS ENUM ('running','succeeded','failed','stalled','cancelled');
CREATE TYPE failure_reason_t AS ENUM (
  'max_turns','stall_loop','evidence_cite_unfixable','model_refusal',
  'context_overflow','api_error_exhausted','tool_errors_exhausted',
  'aborted_by_user','orchestrator_crash','semantic_validator_failed'
);

CREATE TABLE session (
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
CREATE UNIQUE INDEX session_one_running_per_incident ON session (incident_id) WHERE status = 'running';

CREATE TABLE session_turn (
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
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, turn_index)
);

CREATE TABLE session_event (
  session_id TEXT NOT NULL REFERENCES session(id),
  event_seq BIGSERIAL NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  ts TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (session_id, event_seq)
);
CREATE INDEX session_event_seq ON session_event (session_id, event_seq);

-- 6. Report
CREATE TABLE report (
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
CREATE UNIQUE INDEX report_one_current_per_incident ON report (incident_id) WHERE status = 'current';

-- 7. Initiative columns + initiative_check + dispatch_attempt + impact_measurement already exists
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

CREATE TABLE initiative_check (
  id TEXT PRIMARY KEY DEFAULT 'IC-' || gen_random_uuid(),
  initiative_id TEXT NOT NULL REFERENCES initiative(initiative_id),
  checked_at TIMESTAMPTZ DEFAULT now(),
  predicate_snapshot JSONB NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('pending','passed','failed','error')),
  evidence JSONB,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron','manual')),
  UNIQUE(initiative_id, checked_at)
);

CREATE TABLE dispatch_attempt (
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

-- 8. Lesson table extend
ALTER TABLE lesson
  ADD COLUMN IF NOT EXISTS archetype archetype_t,
  ADD COLUMN IF NOT EXISTS signature_embedding vector(1536),
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

ALTER TABLE lesson DROP COLUMN IF EXISTS embedding;
ALTER TABLE lesson ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX lesson_embedding_ivfflat ON lesson USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX lesson_validated_idx ON lesson (engineer_validated) WHERE superseded_by IS NULL;

-- 9. Lesson_usage (append-only)
CREATE TABLE lesson_usage (
  id TEXT PRIMARY KEY DEFAULT 'LU-' || gen_random_uuid(),
  lesson_id TEXT NOT NULL REFERENCES lesson(lesson_id),
  session_id TEXT REFERENCES session(id),
  incident_id TEXT NOT NULL REFERENCES incident(incident_id),
  used_at TIMESTAMPTZ DEFAULT now(),
  cosine_score NUMERIC NOT NULL
);

-- 10. Backfill watermark
CREATE TABLE backfill_watermark (
  source_table TEXT PRIMARY KEY CHECK (source_table IN ('defect','field_claim','test_result','rework')),
  last_seen_ts TIMESTAMPTZ,
  last_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Pipeline error log
CREATE TABLE pipeline_error_log (
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

-- 12. Contribution table extend (archetypes, status enum)
ALTER TABLE contribution
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'tool'
    CHECK (source IN ('tool','user','stub')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','unavailable','pending')),
  ADD COLUMN IF NOT EXISTS structured_payload JSONB;

-- Domain constraint
ALTER TABLE contribution DROP CONSTRAINT IF EXISTS contribution_domain_check;
ALTER TABLE contribution ADD CONSTRAINT contribution_domain_check CHECK (domain IN (
  'market_research','central_quality','plant_quality_indirect','plant_quality_direct',
  'process_planner','technology_planning','supplier_quality',
  'business_analytics','marketing'
));

CREATE UNIQUE INDEX contribution_uniq_per_source ON contribution (incident_id, domain, source);

COMMIT;
```

- [ ] **Step 2: Apply migration to remote**

```bash
pnpm tsx scripts/apply-remote-migrations.ts
```

If the apply-remote-migrations.ts script doesn't exist yet (Harjot may or may not have provided one), create it per v1 Task 1.4 Step 4. Uses `pg` client + migration_history table for idempotency.

- [ ] **Step 3: Verify in Studio UI**

Check:
- `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='signal';` → 30+ columns, `embedding` = `vector`
- `\d session`, `\d session_turn`, `\d session_event` show correctly
- `\d+ lesson` shows vector(1536) embedding + engineer_validated
- `SELECT * FROM app_user;` → 4 rows

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00006_resolve_schema_completion.sql scripts/apply-remote-migrations.ts
git commit -m "feat(db): 00006 schema completion — vector type, session/turn/event, report, dispatch_attempt, lesson extensions, app_user, indexes"
```

### Task 1.2: Seed demo data migration

**Files:** `supabase/migrations/00007_resolve_contribution_domains.sql` (template for 9-domain rows), `supabase/migrations/00008_resolve_demo_lessons.sql` (3 pre-approved lessons)

- [ ] **Step 1: Write 00007 (contribution template seeding procedure)**

Not actual rows — just a PL/pgSQL function `seed_contribution_domains(p_incident_id TEXT)` that inserts 9 rows per incident. Called from app code at incident creation.

- [ ] **Step 2: Write 00008 (demo lessons)**

Insert 3 rows into `lesson` with `seed_source='demo'`, `engineer_validated='approved'`. Hand-crafted signature_text + prompt_snippet matching Stories 1, 2, 4 (not Story 3 — that's the "live network effect" demo).

- [ ] **Step 3: Apply + commit**

```bash
pnpm tsx scripts/apply-remote-migrations.ts
git add supabase/migrations/00007_resolve_contribution_domains.sql supabase/migrations/00008_resolve_demo_lessons.sql
git commit -m "feat(db): seed 3 demo lessons + contribution template function"
```

---

## Milestone 2 — Zod Schema Completion

**Target: `web/src/server/schemas/` matches the full migration. 1h.**

### Task 2.1: Extend `schemas/signal.ts`

**Files:** `web/src/server/schemas/signal.ts`

- [ ] **Step 1: Rewrite file with full field set**

Use Zod shape from v1 Task 1.1 Step 3 (~40 fields). Preserve existing exports (`signalCaptureSchema`, `signalRowSchema`) but expand them to match new DB.

- [ ] **Step 2: Add test**

```ts
// web/src/server/schemas/__tests__/signal.test.ts
import { signalRowSchema } from '../signal';
// Assert all 40 fields parse; reject if embedding is not array of 1536 numbers.
```

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
cd ..
```

Expected: no errors in `schemas/` files. (Other files may have errors since they use old shape — fix in M3+.)

### Task 2.2: Extend `schemas/incident.ts`

Same pattern. Expanded to v2 spec §4. Add `status: incident_status_t` with 'reopen'.

### Task 2.3: Extend `schemas/initiative.ts`

Add `cosign_required`, `co_signed*`, `dispatch_idempotency_key`, `patience_until`, `consecutive_error_count`.

### Task 2.4: New schema files

`schemas/session.ts`, `schemas/report.ts`, `schemas/dispatch.ts`, `schemas/impact.ts`, `schemas/lesson.ts` (rewrite from scratch — existing is minimal), `schemas/closure.ts` (ClosurePredicate discriminated union), `schemas/action-templates.ts` (ActionTemplate union), `schemas/api-responses.ts` (SessionEventEnvelope, ErrorResponse, PaginationMeta, etc.).

- [ ] **Step 1: Write all files in one go**

Each ~30-60 lines. Copy Zod shapes from v1 Task 1.1 Step 5 (they haven't changed) and spec §12, §13.

- [ ] **Step 2: Barrel export**

`web/src/server/schemas/index.ts`:
```ts
export * from './signal';
export * from './incident';
export * from './session';
export * from './report';
export * from './initiative';
export * from './dispatch';
export * from './impact';
export * from './lesson';
export * from './closure';
export * from './action-templates';
export * from './api-responses';
export * from './orchestrator';
```

- [ ] **Step 3: Commit**

```bash
cd web && pnpm tsc --noEmit
# Expect errors in orchestrator.ts + tools (old shapes). OK for now — M3 fixes them.
cd ..
git add web/src/server/schemas/
git commit -m "feat(schemas): full Zod completion for signal/incident/session/report/dispatch/lesson/closure/templates"
```

---

## Milestone 3 — Tool Registry + 19-Tool Migration

**Target: Kill `switch` in orchestrator. All 19 tools registered via typed registry. ~2h.**

### Task 3.1: Registry infrastructure

**Files:** `web/src/server/tools/registry.ts`, `web/src/server/tools/types.ts`, `web/src/server/tools/_register.ts`

- [ ] **Step 1: Write types + registry (see v1 Task 3.1)**

```ts
// web/src/server/tools/types.ts — as v1
// web/src/server/tools/registry.ts — as v1 with `invokeTool`, `allTools`, `nonWriteTools`
// web/src/server/tools/_register.ts — side-effect imports to trigger registrations
```

- [ ] **Step 2: Test registry**

```ts
// tests/unit/tool-registry.test.ts — assert invokeTool returns typed error on unknown tool
```

Run: `cd web && pnpm vitest ../tests/unit/tool-registry.test.ts` → pass.

### Task 3.2: Migrate 5 existing tools

**Files:** `web/src/server/tools/retrieval/{query-defects,query-claims,trace-batch,weekly-quality-summary,semantic-search-complaints}.ts`

Each is already close to registry shape — just wrap existing exports with `registerTool({...})` call. Inputs: rewrap in Zod (use existing `z.object(...)`). Outputs: align to spec §9.1.

**`semantic-search-complaints.ts` — full replacement:**

Rename to `semantic-search-signals.ts` per spec §9.1. Replace lexical impl with pgvector knn:

```ts
import { registerTool } from '../registry';
import { z } from 'zod';
import { manex } from '@/server/db/client';  // or whatever the existing supabase client import is
import { embed } from '@/server/embeddings';

const Input = z.object({
  query_text: z.string(),
  filters: z.object({
    product_id: z.string().optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }).optional(),
  top_k: z.number().int().min(1).max(50).default(10),
});

const Output = z.object({
  rows: z.array(z.object({
    signal_id: z.string(),
    captured_ts: z.string(),
    raw_text: z.string(),
    product_id: z.string().nullable(),
    cosine: z.number(),
  })),
  total: z.number(),
});

registerTool({
  name: 'semantic_search_signals',
  description: 'pgvector knn on signal embeddings',
  input_schema: Input,
  output_schema: Output,
  async handler(input) {
    const embedding = await embed(input.query_text);
    if (!embedding) return { rows: [], total: 0 };
    // Use raw SQL via Supabase RPC or direct pg query
    const { data, error } = await manex().rpc('semantic_search_signals_rpc', {
      query_embedding: embedding,
      top_k: input.top_k,
      product_id_f: input.filters?.product_id ?? null,
      ts_from_f: input.filters?.date_from ?? null,
      ts_to_f: input.filters?.date_to ?? null,
    });
    if (error) throw new Error(`semantic_search_signals: ${error.message}`);
    return { rows: data ?? [], total: (data ?? []).length };
  },
});
```

Add corresponding PL/pgSQL function in a new migration `00009_resolve_rpc_functions.sql`:
```sql
CREATE OR REPLACE FUNCTION semantic_search_signals_rpc(
  query_embedding vector(1536),
  top_k INT,
  product_id_f TEXT DEFAULT NULL,
  ts_from_f TIMESTAMPTZ DEFAULT NULL,
  ts_to_f TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE(signal_id TEXT, captured_ts TIMESTAMPTZ, raw_text TEXT, product_id TEXT, cosine NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT s.signal_id, s.captured_ts, s.raw_text, s.product_id,
         1 - (s.embedding <=> query_embedding) AS cosine
  FROM signal s
  WHERE s.embedding IS NOT NULL
    AND (product_id_f IS NULL OR s.product_id = product_id_f)
    AND (ts_from_f IS NULL OR s.captured_ts >= ts_from_f)
    AND (ts_to_f IS NULL OR s.captured_ts <= ts_to_f)
  ORDER BY s.embedding <=> query_embedding
  LIMIT top_k;
$$;
```

- [ ] **Step 3: Commit**

```bash
git add web/src/server/tools/ supabase/migrations/00009_resolve_rpc_functions.sql
git commit -m "feat(tools): registry + migrate 5 existing tools + real pgvector semantic search"
```

### Task 3.3: Add 14 new tools (10 functional for Story 1+3, 4 stubs)

**Files in `web/src/server/tools/`:**

| Tool | Group | Story 1+3 need | Impl |
|---|---|---|---|
| `get_incident` | signal-incident | YES | functional — SELECT from incident + signals |
| `list_signals_for_incident` | signal-incident | YES | functional |
| `find_related_incidents` | signal-incident | NO | stub |
| `pareto_defect_codes` | retrieval | YES (Story 1) | functional |
| `bom_parts_for_product` | retrieval | YES (Story 1+3) | functional (uses v_product_bom_parts) |
| `test_results_marginal` | retrieval | NO (Story 2) | stub |
| `field_vs_factory_gap` | cross-boundary | YES (Story 3) | functional |
| `operator_effect_analysis` | cross-boundary | NO (Story 4) | stub |
| `rework_timeline_by_section` | cross-boundary | NO (Story 2) | stub |
| `retrieve_lessons` | semantic-vision-lessons | YES | functional (new RPC) |
| `classify_defect_image` | semantic-vision-lessons | YES (cosmetic) | stub (returns canned label) |
| `simulate_impact` | simulation | YES | stub (heuristic — spec §9.1 locked as stub for 24h) |
| `create_initiative` | write-gated | YES | functional — wraps existing `resolve_approve_initiative` RPC |
| `register_closure_predicate` | write-gated | YES | no-op (part of create_initiative transaction) |
| `emit_lesson` | write-gated | stub | stub |
| `emit_impact_measurement` | write-gated | stub | stub |
| `contrib_central_quality` | contributions | YES | functional (wraps retrieve_lessons + find_related_incidents) |
| `contrib_plant_quality` | contributions | YES | functional |
| `contrib_supplier_quality` | contributions | YES | functional |

- [ ] **Step 1: Create all 14 tool files**

Each ~30-60 lines. For functional tools, real SQL. For stubs, typed mock returns. Follow pattern from Task 3.2.

`retrieve_lessons` requires a new RPC:
```sql
-- append to 00009 (or a new 00010)
CREATE OR REPLACE FUNCTION retrieve_lessons_by_signature_rpc(
  query_embedding vector(1536), top_k INT, min_cosine NUMERIC DEFAULT 0.75
) RETURNS TABLE(lesson_id TEXT, title TEXT, prompt_snippet TEXT, signature_text TEXT, archetype TEXT, cosine NUMERIC, usage_count INT)
LANGUAGE sql STABLE AS $$
  WITH uc AS (SELECT lesson_id, count(*)::int AS cnt FROM lesson_usage GROUP BY lesson_id)
  SELECT l.lesson_id, l.fix_summary AS title, l.prompt_snippet, l.signature_text, l.archetype::text,
         1 - (l.embedding <=> query_embedding) AS cosine,
         COALESCE(uc.cnt, 0)
  FROM lesson l LEFT JOIN uc ON l.lesson_id = uc.lesson_id
  WHERE l.engineer_validated = 'approved' AND l.superseded_by IS NULL AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) >= min_cosine
  ORDER BY l.embedding <=> query_embedding
  LIMIT top_k;
$$;
```

- [ ] **Step 2: Add to `_register.ts`**

Import each new tool file for side-effect registration.

- [ ] **Step 3: Integration tests for functional tools**

`tests/integration/tools.test.ts` — one test per functional tool, against real Manex backend. ~5 minutes each.

- [ ] **Step 4: Commit**

```bash
git add web/src/server/tools/ supabase/migrations/00009_resolve_rpc_functions.sql tests/integration/tools.test.ts
git commit -m "feat(tools): 14 new tools (10 functional, 4 stubs) + retrieve_lessons RPC"
```

### Task 3.4: Kill switch in orchestrator

**Files:** `web/src/server/agent/orchestrator.ts`

- [ ] **Step 1: Replace switch with `invokeTool`**

Old:
```ts
switch (toolName) {
  case 'query_defects': return queryDefects(...)
  ...
}
```

New:
```ts
import { invokeTool } from '@/server/tools/registry';
import '@/server/tools/_register';   // register-all-tools side-effect
...
const result = await invokeTool(toolName, toolInput, { session_id, incident_id, user_id });
```

- [ ] **Step 2: Typecheck + smoke test**

```bash
cd web && pnpm tsc --noEmit
```

Run an end-to-end agent call against an existing seeded incident:
```bash
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"incident_id":"INC-00001"}'
```

Expected: returns OrchestratorResult with tool_calls from the registry.

- [ ] **Step 3: Commit**

```bash
git add web/src/server/agent/orchestrator.ts
git commit -m "refactor(orchestrator): replace switch with registry invokeTool"
```

---

## Milestone 4 — Session Persistence + 3-Layer Evidence Validator + Cache Breakpoints

**Target: Orchestrator writes session/turn/event rows on every phase + tool-call. Evidence validator enforces structured+inline+numeric with retry. Prompts have 2 cache breakpoints. 2.5h.**

### Task 4.1: Session creation endpoint + refactor `/api/agent/run`

**Files:** `web/src/app/api/incident/[incidentId]/investigate/route.ts` (new), `web/src/app/api/agent/run/route.ts` (deprecate or proxy)

- [ ] **Step 1: New investigate endpoint**

Per spec §14.3. Checks for existing running session (unique partial index), creates session row, enqueues investigate via worker, returns 202 + session_id.

- [ ] **Step 2: Deprecate `/api/agent/run` or make it a sync wrapper**

For backwards compat with existing engineer page while we port it (Task 6.2), keep the endpoint but have it internally call the new flow.

### Task 4.2: Orchestrator — session-aware

**Files:** `web/src/server/agent/orchestrator.ts`, `web/src/server/agent/session-logger.ts` (new)

- [ ] **Step 1: Session-logger helpers**

```ts
// session-logger.ts
export async function logPhaseStart(sessionId: string, phase: string, payload: any) { ... }
export async function logTurn(sessionId: string, turn: { index, phase, role, model, content_text, tool_call?, tokens_in, tokens_out, duration_ms }) { ... }
export async function logEvent(sessionId: string, event_type: string, payload: any) { ... }
// All insert to session_turn / session_event respectively.
```

- [ ] **Step 2: Wire into orchestrator**

On phase start → `logEvent('phase_start', ...)`. On each tool call → `logTurn({role:'tool', ...})`. On each assistant response → `logTurn({role:'assistant', ...})`. On completion → `logEvent('session_complete', ...)` + update session row to `succeeded`.

- [ ] **Step 3: Commit**

```bash
git add web/src/server/agent/ web/src/app/api/incident/
git commit -m "feat(session): orchestrator persists session/turn/event on every phase boundary"
```

### Task 4.3: Evidence validator 3-layer

**Files:** `web/src/server/agent/evidence-validator.ts`, `tests/unit/evidence-validator.test.ts`

- [ ] **Step 1: Expand validator**

Take the impl from v1 Task 4.2. Layers:
- L1 structured (already in Harjot's code — extend to fail-on-empty-evidence array)
- L2 inline — `[[tc:ID]]` + `[[reasoning]]` markers; hallucinated-id check
- L3 post-validator — numeric-claim regex + id-reference regex + reasoning-near-number rejection; 1-retry with correction prompt
- L4 semantic (propose-only) — Haiku-judge

- [ ] **Step 2: Tests** (copy from v1 Task 4.2 Step 3 — 5 cases)

- [ ] **Step 3: Wire into Compose and Propose phases**

In both phase functions: after Zod parse succeeds, run L1+L2+L3. If errors, retry once with listed errors. If still fails, mark session stalled with `failure_reason='evidence_cite_unfixable'`.

For Propose only: after L3 passes, run L4 Haiku-judge on each initiative's rationale.

- [ ] **Step 4: Commit**

```bash
git add web/src/server/agent/evidence-validator.ts tests/unit/evidence-validator.test.ts
git commit -m "feat(evidence): 3-layer validator + Propose semantic judge + 1-retry loop"
```

### Task 4.4: Prompt cache breakpoints

**Files:** `web/src/server/prompts/system.ts`, `web/src/server/prompts/playbooks.ts`, `web/src/server/agent/phases/{classify,investigate,compose,propose}.ts` (extract phases from orchestrator)

- [ ] **Step 1: Structure prompts as arrays of cacheable text blocks**

Instead of single string prompts, export arrays where items have optional `cache: true` flag:

```ts
// system.ts
export const SYSTEM_BASE = [
  { text: `You are Resolve... [grounding rules, language policy, evidence-cite contract]`, cache: true },
];
export const TOOLS_SPEC = [{ text: buildToolsSpec(), cache: true }];  // built from registry at import time
```

- [ ] **Step 2: Extract phases into separate files**

Each phase imports its playbook + phase-specific template. Caller assembles:
```ts
system: [
  ...SYSTEM_BASE,                      // cache breakpoint 1
  ...TOOLS_SPEC,                       // same breakpoint
  { text: phasePrompt, cache: true },  // cache breakpoint 2
  { text: playbook, cache: true },     // same breakpoint
],
messages: [...]
```

In Anthropic SDK, attach `cache_control: { type: 'ephemeral' }` on the last item in each breakpoint group.

- [ ] **Step 3: Verify cache works**

Add temp logging of `res.usage.cache_read_input_tokens`. Run same incident twice. Second call should show >0 cache reads.

- [ ] **Step 4: Commit**

```bash
git add web/src/server/prompts/ web/src/server/agent/phases/
git commit -m "feat(prompts): 2 cache breakpoints per phase + extract phases into separate files"
```

---

## Milestone 5 — Contribution Pipeline + Lessons Retrieve/Compose + Backfill + Workers

**Target: All 9 contributions insert per incident (3 functional + 6 stubs). Lessons retrieve in Classify + compose on close. Backfill ingests 3 Manex source tables. Embedding-recovery + pending-cluster-sweep workers running. 3h.**

### Task 5.1: Contribution pipeline wire-in

**Files:** `web/src/server/correlator/run.ts` (add contribution seed on incident create), `web/src/server/tools/contributions/*.ts` (ensure registered), phase imports

- [ ] **Step 1: Seed 6 stub contributions on incident creation**

In correlator's new-incident branch, after `incident` insert:
```ts
await manex().rpc('seed_contribution_domains', { p_incident_id: incident.incident_id });
```

(RPC already written in M1 Task 1.2 Step 1.)

- [ ] **Step 2: Classify-parallel contribution tool calls**

Modify `classify.ts` phase: after classification, fire 3 contribution tools in parallel:
```ts
await Promise.allSettled([
  invokeTool('contrib_central_quality', { incident_id }, ctx),
  invokeTool('contrib_plant_quality', { incident_id }, ctx),
  invokeTool('contrib_supplier_quality', { incident_id }, ctx),
]);
```

Each tool writes its result into the `contribution` row (UPSERT on (incident_id, domain, source='tool')).

- [ ] **Step 3: Compose input includes contributions**

In `compose.ts` phase, load `contribution` rows for this incident and inject into compact input:
```
## Contributions
- central_quality: {content}
- plant_quality_direct: {content}
- supplier_quality: {content}
(6 others: unavailable)
```

- [ ] **Step 4: API endpoints** (`web/src/app/api/incident/[incidentId]/contributions/route.ts`, `.../contribution/refresh/route.ts`)

Both simple Supabase queries. Refresh endpoint re-runs the 3 functional tools.

- [ ] **Step 5: Commit**

```bash
git add web/src/server/correlator/ web/src/server/agent/phases/classify.ts web/src/server/agent/phases/compose.ts web/src/app/api/incident/
git commit -m "feat(contributions): seed on create + tool-parallel on classify + compose includes + API"
```

### Task 5.2: Lessons retrieve + compose

**Files:** `web/src/server/agent/phases/classify.ts`, `web/src/server/agent/phases/compose.ts`, `web/src/server/workers/compose-lesson.ts` (new)

- [ ] **Step 1: Retrieve in Classify**

After Classify generates `signature_text`, compute its embedding + call `retrieve_lessons`. Inject as few-shot prior into Investigate system prompt (3rd cache breakpoint group if lessons present).

- [ ] **Step 2: Compose lesson on incident close**

New function in `web/src/server/workers/compose-lesson.ts`:
```ts
export async function composeLessonForClosedIncident(incidentId: string) {
  // Load incident + its session (succeeded) + all initiatives (closed) + their impact_measurement
  // Call Sonnet with a "compose_lesson" prompt (new in web/src/server/prompts/phase.compose-lesson.md)
  // Parse output → insert into lesson table with auto-approve logic per spec §11.2
}
```

Called from `closure-monitor.ts` worker when all initiatives of an incident reach `closed` status.

- [ ] **Step 3: Commit**

```bash
git add web/src/server/agent/phases/ web/src/server/workers/compose-lesson.ts
git commit -m "feat(lessons): retrieve in Classify + compose on close with hybrid auto-approve"
```

### Task 5.3: Backfill script

**Files:** `scripts/backfill-signals.ts` (at repo root), `package.json` script `backfill:seed`

- [ ] **Step 1: Write script (see v1 Task 6.1 Step 2 — copy largely verbatim)**

Key adaptations:
- Source-ref hashing: `source_system + ':' + source_ref`
- Per-table: defect (ts), field_claim (claim_ts), test_result (ts) with `overall_result IN ('MARGINAL','FAIL')`
- Every row → `signal` insert with `cluster_state='pending_cluster'` (correlator may promote on second signal match via immediate-promotion trigger per spec §5.1)
- Batch embedding call (100 at a time) for cost efficiency

- [ ] **Step 2: Run**

```bash
pnpm backfill:seed
```

Expected: several hundred signals ingested, many pending_cluster, some promoted to incidents. Cost: ~$0.10-0.30 for embeddings.

Verify:
```sql
SELECT source, count(*) FROM signal GROUP BY source;
SELECT count(*) FROM incident;
SELECT count(*) FROM signal WHERE cluster_state='pending_cluster';
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-signals.ts package.json
git commit -m "feat(backfill): one-shot ingest from defect + field_claim + test_result tables"
```

### Task 5.4: Workers — embedding-recovery + pending-cluster-sweep

**Files:** `web/src/server/workers/embedding-recovery.ts`, `web/src/server/workers/pending-cluster-sweep.ts`, `web/src/app/api/workers/embedding-recovery/route.ts`, `.../pending-cluster-sweep/route.ts`

- [ ] **Step 1: Workers**

Each ~30 lines. embedding-recovery: select `signal WHERE embedding IS NULL LIMIT 100`, call OpenAI batch, update, run correlator Phase 2. pending-cluster-sweep: select `signal WHERE cluster_state='pending_cluster' AND pending_until < now()`, mark `expired`.

- [ ] **Step 2: Endpoints (auth via CRON_SECRET, like Harjot's closure-monitor)**

Same pattern as `/api/workers/closure-monitor`.

- [ ] **Step 3: Commit**

```bash
git add web/src/server/workers/ web/src/app/api/workers/
git commit -m "feat(workers): embedding-recovery + pending-cluster-sweep crons"
```

---

## Milestone 6 — SSE Token Streaming + Dashboard Screen Ports

**Target: Orchestrator emits token_delta events via SSE. Engineer page consumes them live. 3 Dashboard screens ported to Next.js with CSS-token-to-Tailwind mapping. 4h.**

### Task 6.1: SSE token streaming

**Files:** `web/src/app/api/session/[sessionId]/stream/route.ts` (new), `web/src/server/agent/orchestrator.ts` (emit token events)

- [ ] **Step 1: New SSE endpoint per spec**

Implements replay from `session_event` via `?since=` query + live via EventEmitter. See v1 Task 5.2 Step 3 for shape.

- [ ] **Step 2: Orchestrator emits token_delta**

During Anthropic streaming call (Sonnet), pipe `content_block_delta` events through EventEmitter as `token_delta`. Not persisted (spec §6.3).

- [ ] **Step 3: Deprecate `/api/agent/stream` route**

Leave endpoint for now (Harjot's page uses it) but redirect internally to new flow during M6.2 page rewrite.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/session/ web/src/server/agent/orchestrator.ts
git commit -m "feat(sse): token_delta live stream + event-log replay per sessionId"
```

### Task 6.2: Engineer investigate page — live EventSource consumer

**Files:** `web/src/app/(engineer)/investigate/[incidentId]/page.tsx`

- [ ] **Step 1: Rewrite to consume SSE**

```tsx
'use client';
import { useEffect, useState } from 'react';

export default function InvestigatePage({ params }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [phase, setPhase] = useState<string>('idle');

  async function start() {
    const r = await fetch(`/api/incident/${params.incidentId}/investigate`, {
      method: 'POST', headers: { 'X-Demo-User': 'user_eng_anna' },
    });
    const { session_id } = await r.json();
    setSessionId(session_id);
  }

  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/session/${sessionId}/stream`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      setEvents(prev => [...prev, ev]);
      if (ev.phase) setPhase(ev.phase);
    };
    es.addEventListener('phase_start', () => {/* show loader for phase */});
    es.addEventListener('token_delta', (e: any) => {/* append to live transcript */});
    es.addEventListener('session_complete', () => { es.close(); });
    return () => es.close();
  }, [sessionId]);
  // ...render with Dashboard-matching styling
}
```

Keep existing Recharts + investigation-result rendering. Add live transcript pane for token_delta. Add phase indicator chips.

- [ ] **Step 2: Commit**

```bash
git add web/src/app/(engineer)/investigate/
git commit -m "feat(ui): engineer investigate page consumes SSE with live phases + token_delta"
```

### Task 6.3: Port Dashboard landing/inbox screen

**Files:** `web/src/app/(engineer)/inbox/page.tsx` (new), `web/src/app/page.tsx` (route redirect), `web/src/app/globals.css` (add tokens)

- [ ] **Step 1: Port CSS tokens**

Extract tokens from `dashboard-prototype/styles.css` lines 8-64 into `web/src/app/globals.css`:
```css
:root {
  --bg-deep: #ffffff;
  --bg-surface: #ffffff;
  --ink-primary: #160042;
  --accent: #639fc4;
  --cta: #1032cf;
  --sev-low: #5FC2A3;
  --sev-med: #F3C969;
  --sev-high: #F48A5C;
  --sev-crit: #EB5E55;
  /* ...rest */
}
```

Add Tailwind config extension:
```ts
// web/tailwind.config.ts (create if missing)
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { primary: '#160042', secondary: '#3a3f55', muted: '#6b7080' },
        accent: { DEFAULT: '#639fc4', dim: '#4a82a5', bg: '#e1eef4' },
        cta: { DEFAULT: '#1032cf', hi: '#1f42df' },
        sev: { low: '#5FC2A3', med: '#F3C969', high: '#F48A5C', crit: '#EB5E55' },
      },
    },
  },
};
```

- [ ] **Step 2: Port landing_inbox.jsx → inbox/page.tsx**

Translate the JSX structure to TSX. Replace `DATA` mock with `fetch('/api/incidents')` call. Keep the exact layout: metric tiles + "Needs your attention" + "Rising patterns" + "Recently resolved". Use Tailwind classes matching the CSS tokens.

~300-400 lines. Heavy port but mechanical.

- [ ] **Step 3: Make inbox the default route**

`web/src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
export default function Home() { redirect('/inbox'); }
```

- [ ] **Step 4: Commit**

```bash
git add web/src/app/(engineer)/inbox/ web/src/app/globals.css web/tailwind.config.ts web/src/app/page.tsx
git commit -m "feat(ui): port Dashboard inbox screen + design tokens to Tailwind"
```

### Task 6.4: Port Canvas screen

**Files:** `web/src/app/(engineer)/canvas/[incidentId]/page.tsx` (new), companion components

- [ ] **Step 1: Port canvas.jsx structure**

3-panel layout (280px | 1fr | 300px). Left rail: signals list + near-miss + BOM tree. Center: root-cause graph (start with GraphStack variant — simplest). Right rail: 9 contribution cards. Floating action bar.

- [ ] **Step 2: Consume live session events**

If URL has `?session=SES-xxxxx`, start SSE listening and update graph/contributions live as events arrive.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/(engineer)/canvas/ web/src/components/cards/
git commit -m "feat(ui): port Dashboard canvas screen + live-session integration"
```

### Task 6.5: Port Floor-lens operator capture

**Files:** `web/src/app/(operator)/capture/page.tsx` (rewrite)

- [ ] **Step 1: Port floor classic variant from other_screens.jsx**

Mobile-first layout. Issue tiles grid + photo upload + voice button + "Send report" CTA + "My reports today" list. Strip all jargon per brief §Floor lens.

- [ ] **Step 2: Whisper integration**

On voice capture: POST `/api/intake/capture` with `multipart/form-data` containing audio blob; server calls `transcribeAudio()` from `web/src/server/models/openai.ts` (create if missing — see v1 Task 1.3).

- [ ] **Step 3: Commit**

```bash
git add web/src/app/(operator)/ web/src/server/models/
git commit -m "feat(ui): Floor-lens redesign matching Dashboard + Whisper voice transcription"
```

---

## Milestone 7 — Golden Tests + Demo Prep + PR to develop

**Target: Golden snapshot per story. Demo reset script. PR feat/joscha → develop. 2h.**

### Task 7.1: Golden tests

**Files:** `tests/golden/story-1-supplier-batch.test.ts`, `tests/golden/story-3-design-drift.test.ts`, `tests/fixtures/`

- [ ] **Step 1: VCR setup**

Minimal VCR — capture Anthropic responses during a real run into `tests/fixtures/anthropic-vcr/story-N.json`. On replay, mock `callAnthropic` to return the recorded response deterministically.

- [ ] **Step 2: Story 1 golden**

Seeded DB (via backfill) → GET /api/incidents to find Story-1 incident → POST investigate → wait for session_complete → assert:
- `incident.archetype === 'supplier'`
- `evidence_ledger.length >= 2`
- `initiatives.length >= 1`
- at least one initiative has `target_system='manex_native'` and impact_estimate references `simulate_impact` tool_call_id
- Report's D4 (Root cause) mentions SB-00007 (via evidence)

- [ ] **Step 3: Story 3 golden**

Same pattern. Expected archetype=`design`, initiatives include R&D agent_domain.

- [ ] **Step 4: Commit**

```bash
git add tests/golden tests/fixtures/
git commit -m "test(golden): Story 1 + Story 3 E2E snapshots with VCR"
```

### Task 7.2: Demo reset script

**Files:** `scripts/demo-reset.ts`

- [ ] **Step 1: Reset script**

Deletes all Resolve-owned rows except `lesson WHERE seed_source='demo'`. Calls `pnpm backfill:seed` to re-ingest. Takes ~2 minutes end-to-end.

```bash
pnpm tsx scripts/demo-reset.ts
```

- [ ] **Step 2: Commit**

```bash
git add scripts/demo-reset.ts
git commit -m "chore: demo reset + re-seed script"
```

### Task 7.3: Merge dashboard-prototype cleanup (optional)

Delete any unused `.jsx` files that have been successfully ported. Or leave the folder as reference.

### Task 7.4: PR to develop

- [ ] **Step 1: Final sync + push**

```bash
git fetch origin
git merge origin/develop --no-ff -m "Sync with develop before PR"  # if develop moved during implementation
# resolve conflicts if any
git push origin feat/joscha
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base develop --title "feat: LLM orchestrator full spec completion (M1-M7)" --body "$(cat <<EOF
## Summary
- Breaking schema migration 00006: vector(1536) embeddings, session/turn/event tables, report, dispatch_attempt, full field coverage on signal + incident + initiative
- 19-tool typed registry replacing switch in orchestrator; real pgvector semantic search
- 3-layer evidence-cite validator with 1-retry + Propose-phase Haiku semantic judge
- 2-breakpoint prompt caching per phase
- Session persistence + token-level SSE streaming + EventSource consumer on engineer page
- Contribution pipeline (3 functional + 6 stub domains)
- Lessons retrieve in Classify + compose on close + 3 pre-approved demo lessons
- Backfill from Manex defect/field_claim/test_result (~N signals ingested)
- Embedding-recovery + pending-cluster-sweep workers
- Dashboard UI ports: inbox, canvas, floor capture with CSS tokens → Tailwind
- Golden E2E tests: Story 1 + Story 3

## Test plan
- [ ] pnpm test (unit) — green
- [ ] pnpm test:integration (real Manex) — green
- [ ] pnpm test:golden — Story 1 + Story 3 snapshots match
- [ ] Manual: GET /api/incidents → Story 1 shows → click investigate → SSE streams → session_complete → initiative approve → product_action row
- [ ] Manual: GET /api/incidents → Story 3 → archetype=design, R&D agent_domain
- [ ] Manual: reset + re-seed clean in < 3min

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Final commit**

```bash
git add .
git commit --allow-empty -m "chore: hand-off to develop via PR"
git push origin feat/joscha
```

---

## Self-Review

**Coverage of v1 gaps → v2 tasks:**
- v1 built from scratch at root → v2 extends web/ (Harjot's scaffold)
- v1 invented API shapes → v2 uses existing + adds session/*
- v1 scaffolded 18 tools → v2 migrates 5 + adds 14 for 19 total
- v1 dodged SSE token streaming → v2 does Q3(a) properly
- v1 had no Dashboard alignment → v2 ports 3 screens (Q4a)
- All schema gaps from code-review round-2 → v2 M1 migration

**Remaining risks (budget ~3.5h buffer):**
- Schema migration on remote may conflict with existing data — re-seed required, may uncover other bugs
- Prompt cache validation depends on Anthropic response shape — may need iteration
- VCR infrastructure not battle-tested — 30min budget for golden tests may slip
- Dashboard CSS port is mechanical but tedious (~700 lines of CSS tokens and component styles) — 4h may compress to 3h canvas port if token port runs long

**What's NOT in scope (Harsh/Lila/Harjot handoffs still stand):**
- Full closure-predicate evaluator internals (Harjot — RPC exists but logic may need polish)
- Remaining 8 Dashboard screens (Lila)
- 10 non-MVP tool implementations replace stubs (Harsh)
- Dark mode + full design-system port (Lila post-demo)
- Auto-detector SPC layer (post-demo or Harjot)
- Real Inngest queue for worker (local Node fine for demo)

---

## Execution Handoff

**Plan v2 saved to `planning/plans/2026-04-18-llm-orchestrator-implementation-v2.md`. v1 superseded.**

**Two execution options:**

**1. Subagent-Driven** (recommended for M1-M5 where tasks are schema/code-mechanical)
Fresh subagent per task, review between tasks. Best for M1 migration (isolated), M2 schemas (file-by-file), M3 tool registry (per-tool), M5 workers (independent).

**2. Inline Execution** (recommended for M6-M7 where UI + integration + live testing)
Execute in this session using executing-plans. Needed for Dashboard ports (browser-in-loop feedback), SSE debugging (dev server + curl), golden test calibration.

**Suggested hybrid:** Subagent for M1-M5 (~10h work, parallelizable), then switch to inline for M6-M7 (~6h integration).

Which approach?
