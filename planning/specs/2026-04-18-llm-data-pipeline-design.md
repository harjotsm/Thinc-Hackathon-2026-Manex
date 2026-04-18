# LLM + Data Pipeline — Design Spec

> **Scope:** End-to-end implementation design for Resolve's LLM and data pipeline.
> **Status:** Draft for review — 2026-04-18
> **Owner:** Joscha (`feat/joscha`)
> **Canonical parent:** [planning/ARCHITECTURE.md](../ARCHITECTURE.md) — this spec refines HOW the pipeline runs; the architecture defines WHAT it is and WHY.
> **Companion visualizations:** [planning/visualizations/architecture.html](../visualizations/architecture.html), [planning/visualizations/llm-architecture.html](../visualizations/llm-architecture.html)

This spec is the single source of truth for implementing the LLM + Data pipeline in 24h. Any conflict with previous documents resolves in favor of this spec; contradictions with `ARCHITECTURE.md` should be raised and reconciled explicitly.

---

## 1. Context · Scope · Non-Negotiables

### 1.1 What this spec covers

The full vertical from ingest (operator / engineer / detector) through reasoning (4-phase orchestrated pipeline) to action (dispatched initiatives with closure predicates) and learning (embedded lessons retrieved on future runs). It covers:

- Trigger model, signal schema, correlator, session layer
- Prompt architecture, evidence-cite enforcement, context management
- Tool layer (19 core tools exposed to Investigate loop + 4 support tools for contributions & impact, all Zod-typed), models and routing
- Lessons store, closure monitor, dispatcher
- API contracts per lens, error paths, observability, dev environment

### 1.2 What this spec does not cover

- Frontend visual design, component styling, canvas UX — **Lila's ownership** (`feat/lila`)
- Tool-layer concrete SQL implementations, visualizations (React Flow / Recharts) — **Harsh's ownership** (`feat/harsh`)
- pgvector migrations, data-layer optimization, DevOps — **Harjot's ownership** (`feat/harjot`) (this spec defines the required schema; Harjot owns the physical implementation)

### 1.3 Non-Negotiables (from ARCHITECTURE.md, refs only)

1. Orchestrated 4-phase pipeline (Classify → Investigate → Compose → Propose). Not free-form ReAct.
2. Typed tool layer with Zod. No free-form SQL.
3. Evidence-cite contract. Every LLM claim references a `tool_call_id`; post-validator checks.
4. Prompt caching on Anthropic system prompt.
5. pgvector for free text only. Structured queries stay SQL.
6. Write tools gated. Not callable inside Investigate loop.
7. Closure predicates typed JSON, evaluated by cron, not stampable.
8. Max 8 tool-call iterations per Investigate phase. **Max 1 retry per post-validation failure** (strict).

### 1.4 Time budget

24h total. Targets: M1 (Schemas + Models) within first 3h. M7 (PR to develop) within T-2h. Demo runs local on Joscha's laptop (single-instance Node process); Vercel deploy optional for team preview.

### 1.5 Demo-story priority

Story 1 (Supplier batch — ElektroParts/SB-00007/PM-00008) and Story 3 (Design thermal drift — MC-200/R33/PM-00015) are primary. Stories 2 + 4 must run but are not primary demo targets. Three pre-approved lessons seeded; one story unseeded to demonstrate live network effect.

---

## 2. Entry-Points · Trigger Model

Three independent paths produce signals. All three end in the same correlator.

### 2.1 Path A — Operator Push

- Operator on the shop floor opens Floor lens (mobile-first)
- Submits free-text + optional photo attachments + optional voice note
- `POST /api/signal/ingest` with `source='operator'`
- Server: Whisper transcribes voice → text; Vision classifier annotates photos; text embedded via `text-embedding-3-small`
- Signal persisted, Correlator runs synchronously

### 2.2 Path B — Engineer Push

- Engineer opens Engineer lens, sees inbox of open incidents
- Manual "Analyze" button on an incident → `POST /api/incident/:id/investigate`
- Session created, worker enqueued, 202 + session_id returned

### 2.3 Path C — Autonomous Detector (SPC + LLM Triage Hybrid)

**Layer 1 — SPC rule-based detector** runs on 60s cron (configurable `DETECTOR_CRON_INTERVAL_SEC`). Queries:

- Rolling z-score on `(product_id, defect_code, week)` — fires at `|z| > 2.5`
- CUSUM / EWMA on `rework.time_minutes` per `(product_id, rework_section_id)`
- Rate-shift on marginal-fail fraction per `test_key` (week-over-week)
- Pareto-shift: top-5 defect_code distribution change > 20% on a product_id over 7d
- Field-vs-factory gap: customer complaints on product_id with low factory defect rate (Story-3 signature)

Each rule emits candidate signals with `source='detector'`, `detector_rule=<rule_name>`, `detector_evidence=<rule-specific jsonb>`.

**Layer 2 — Haiku triage** classifies each candidate as `real | noise | dedupe` with reasoning. Output written to `signal.triage = {real: bool, reasoning: string, score: number}`. Only `real` candidates flow into the correlator.

**Layer 3 — Manual trigger** for demo: `POST /api/detector/scan` button in Engineer dashboard runs one full scan immediately (bypasses cron wait).

### 2.4 Auto-trigger rules for Investigate

After the correlator attaches or creates an incident, trigger Investigate automatically when:

- `incident.severity ∈ {high, critical}` at creation time, OR
- `signal_count >= 3` within a 24h rolling window on the same incident, OR
- **Early-burst:** `signal_count >= 2` within 6h with the same `defect_code`

Otherwise the incident waits for a manual engineer trigger.

### 2.5 Historical Backfill (Manex → Signal)

Per arch §7 H2-10, the pipeline's first-run input is the existing Manex data: `defect`, `field_claim`, and `test_result` rows with `overall_result ∈ {MARGINAL, FAIL}`. Without backfill, the demo stories have no signals to correlate.

**Two modes, sequenced:**

**Mode 1 — One-shot seed script** (`scripts/backfill-signals.ts`), runs after `pnpm db:reset`:

```
For each source table:
  1. defect       → signal_type='factory_defect',   source='backfill_defect',      signal_count = all rows in seed
  2. field_claim  → signal_type='field_claim',      source='backfill_field_claim', signal_count = all rows in seed
  3. test_result  → signal_type='marginal_test',    source='backfill_test_result', signal_count = rows WHERE overall_result IN ('MARGINAL','FAIL')

For each source row:
  - Compose raw_text summary from structured fields (defect_code + part + section + notes, or complaint_text, or test_key+value+unit)
  - Populate structured FKs (product_id, section_id, defect_code, test_key, etc.)
  - raw_payload = full original row as jsonb
  - idempotency_key = hash(source_system + source_ref)  — re-runnable safely
  - captured_ts = source row's timestamp (defect.ts, field_claim.claim_ts, test_result.ts)
  - Embed raw_text via OpenAI; skip embedding on API error, set cluster_state='pending_cluster' with embedding=null (embedding-recovery sweep picks up later — §15.1 row 18)
  - Run correlator (same as live ingest)

Pending-cluster signals are promoted naturally as their second-signal matches land.
```

One-shot terminates when all rows processed. Idempotent — re-running does no duplicate inserts (unique idempotency_key).

**Mode 2 — Incremental cron** (`server/worker/handlers/backfill-incremental.ts`), runs every `BACKFILL_CRON_INTERVAL_SEC` (default 120s), controlled by env flag `BACKFILL_CRON_ENABLED=true|false`:

- Maintains watermark in `backfill_watermark` table: `{source_table, last_seen_ts, last_id}`
- Each run: `SELECT * FROM <source> WHERE ts > last_seen_ts ORDER BY ts LIMIT 500`
- Transforms + ingests exactly like Mode 1 (shared code)
- Updates watermark on success
- Handles idempotency via same `idempotency_key` scheme — replaying is safe

**Env flag for demo stability:** `BACKFILL_CRON_ENABLED=false` disables Mode 2 entirely during the live demo (prevents the cron from injecting surprise signals mid-pitch). Default `true` in dev.

**Schema:**
```ts
backfill_watermark {
  source_table: text PRIMARY KEY              // 'defect' | 'field_claim' | 'test_result'
  last_seen_ts: timestamptz
  last_id: text
  updated_at: timestamptz
}
```

**Seed choreography (for demo):**
1. `pnpm db:reset` → loads Manex tables + Resolve tables (migrations 00001-00012)
2. `pnpm db:seed:demo` → injects 3 pre-approved lessons
3. `pnpm backfill:seed` (wrapper around `scripts/backfill-signals.ts`) → ingests all Manex rows as signals, correlator groups them into the 4 demo incidents
4. `pnpm dev` → runs Next.js + worker; detector cron + embedding-recovery cron run live, backfill cron depends on env flag

---

## 3. Signal Schema · Lifecycle

### 3.1 Schema

```ts
signal {
  id: "SIG-xxxxx"                                   // Manex-convention prefix
  signal_type: 'operator_report'|'engineer_report'|'detector_anomaly'|'field_claim'|'factory_defect'|'marginal_test'
  source: 'operator' | 'engineer' | 'detector' | 'customer_email' | 'backfill_defect' | 'backfill_field_claim' | 'backfill_test_result'
  source_system: text                               // 'resolve_ui' | 'manex_defect' | 'manex_field_claim' | 'manex_test_result' | 'spc_detector' | 'customer_inbox'
  created_at: timestamptz                           // when signal was ingested into resolve
  captured_ts: timestamptz                          // when the underlying event actually happened (defect.ts, field_claim.claim_ts, operator-report-time)
  source_ref: text | null                           // e.g. "defect:DEF-0042", "field_claim:FC-0012", "email:msg-id"

  raw_text: text                                    // always present; detector emits rule-name + summary; backfilled rows get composed summary
  lang: 'de' | 'en'                                 // langdetect at ingest
  embedding: vector(1536) | null                    // OpenAI text-embedding-3-small; null in degraded mode, back-filled by embedding-recovery sweep (§15.1 row 18)
  attachments: jsonb                                // [{kind:'image'|'audio', url, vision_out?, transcript?, status}]

  // Structured references — all Manex-aligned FK (nullable; backfill populates from source row)
  product_id: text | null                           // FK product.product_id
  part_number: text | null                          // FK part_master.part_number
  reported_part_number: text | null                 // from defect.reported_part_number / field_claim.reported_part_number
  batch_id: text | null                             // FK supplier_batch.batch_id (for supplier-archetype signals)
  section_id: text | null                           // FK section.section_id (Manex's canonical section; replaces old "station")
  defect_code: text | null                          // from defect.defect_code or detector_evidence.defect_code
  test_key: text | null                             // from test_result.test_key (for marginal_test signals)
  order_id: text | null                             // FK product_order.order_id (for Story 4)
  user_id: text | null                              // FK app_user.user_id (operator who caused defect; from rework.user_id)
  market: text | null                               // from field_claim.market
  shift: 'early' | 'late' | 'night' | null

  severity: 'low' | 'medium' | 'high' | 'critical'
  severity_hint: numeric | null                     // from defect.severity / detector score; optional numeric continuous

  triage: jsonb | null                              // {real:bool, reasoning:string, score:number}
  incident_id: text | null                          // set by correlator (nullable at ingest)
  created_by_user_id: text | null

  // Source-specific metadata
  detector_rule: text | null                        // only when source='detector'
  detector_evidence: jsonb | null
  raw_payload: jsonb                                // always present; full original record from source system (for audit)

  // Pending-cluster state (§5.1 Phase 3)
  cluster_state: 'attached' | 'pending_cluster'     // pending_cluster = waiting for ≥2 signals in arch §2's clustering rule
  pending_until: timestamptz | null                 // stale-pending sweep threshold

  idempotency_key: text                             // hash(source_system + source_ref) for backfills; hash(raw_text + created_by + minute_bucket) for operator

  // Audit (correlator results)
  match_type: 'det_prod_def'|'det_sec_def'|'det_rule'|'sem'|'new'|'pending'|null
  match_score: float | null
  attach_reason: text | null
  matched_incident_id: text | null
}
UNIQUE(idempotency_key)
INDEX signal (cluster_state) WHERE cluster_state = 'pending_cluster';
INDEX signal USING ivfflat (embedding vector_cosine_ops);
```

### 3.2 Lifecycle

1. **Ingest** — all three paths serialize to this shape. If `idempotency_key` collides → return existing signal_id (no insert), 200 OK.
2. **Embed** — `raw_text` embedded immediately at ingest (synchronous; if OpenAI down, embedding is deferred and correlator runs in degraded mode — deterministic joins only).
3. **Triage** — detector-sourced signals go through Haiku triage before correlator. Operator/engineer signals skip triage.
4. **Correlate** — passed to Correlator (§5).
5. **Attach / Create** — `incident_id` set or new incident created with this signal as seed.
6. **Trigger check** — auto-trigger rules (§2.4) evaluated.

### 3.3 Language handling

No translation. Embeddings are multi-lingual (OpenAI `text-embedding-3-small` handles DE + EN natively). Prompts instruct the model to respond in the signal's source language; technical terms (defect_code, rework_time) stay English across languages.

### 3.4 Attachment storage

Supabase Storage. `.env.local` has `SUPABASE_STORAGE_BUCKET=resolve-attachments`. Client uploads directly (signed URL), server stores URL only. Fallback for 24h if storage setup slips: local filesystem `/assets/uploads/` with URL `http://localhost:3000/assets/uploads/<uuid>.jpg`. Choice finalized at implementation M1.

### 3.5 Embedding-recovery sweep (degraded-mode backfill)

When the OpenAI embedding API is unavailable, ingest proceeds in **degraded mode**: signals are persisted with `embedding=null`, the correlator runs deterministic-only (Phase 1 matches), and `cluster_state='pending_cluster'` defaults apply.

Once the embedding API recovers, a cron worker (`server/worker/handlers/embedding-recovery.ts`, interval `EMBEDDING_RECOVERY_INTERVAL_SEC`, default 60s) runs:

1. **Batch select:** `SELECT id, raw_text FROM signal WHERE embedding IS NULL ORDER BY created_at LIMIT 100`
2. **Embed:** batch-call `text-embedding-3-small`; update rows with embeddings in a single transaction
3. **Re-correlate:** for each newly-embedded signal with `cluster_state != 'attached'`:
   - Re-run Correlator Phase 2 (semantic fallback) — the signal may now match a semantically-close incident that was unreachable without its embedding
   - If attached: update `cluster_state='attached'`, re-run auto-trigger rules
   - If still unmatched: leave `cluster_state='pending_cluster'` with refreshed `pending_until` (resets the window so the signal gets fair semantic-clustering opportunity)
4. **Degraded-mode badge:** UI exposes `GET /api/system/health` returning `{ embedding_service: 'ok'|'degraded', pending_embeddings_count }` — engineer-lens shows a yellow banner while degraded.

Env flag `EMBEDDING_RECOVERY_ENABLED=true|false` (default true). Disabling stops the sweep but leaves degraded-mode ingest functional.

---

## 4. Incident Schema · Status Machine

```ts
incident {
  id: "INC-xxxxx"
  created_at
  archetype: 'supplier' | 'drift' | 'design' | 'operator' | 'unknown'    // set by Classify; 'unknown' initially
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'triage' | 'reasoning' | 'resolving' | 'closed' | 'dismissed' | 'reopen'
  title: text                                                            // composed from signals (human-readable)
  summary: text                                                          // running summary, updated per session
  primary_product_id: text | null                                        // FK product.product_id (from clustering seed)
  primary_part_number: text | null                                       // FK part_master.part_number
  linked_product_ids: text[]                                             // denormalized from attached signals
  centroid_embedding: vector(1536)                                       // mean of attached signals' embeddings; recomputed on attach
  signal_count: int                                                      // denormalized (counts attached signals only, not pending_cluster)
  hypothesis_tree: jsonb | null                                          // populated by Investigate phase (per arch §5 incident.hypothesis_tree)
  last_activity_at
  closed_at | dismissed_at | reopened_at
  dismiss_reason: text | null
  reopen_reason: text | null
  cosign_required: bool                                                  // true iff severity ∈ {high, critical} AND has initiatives (§13.10)
  cosigned_by_user_id: text | null
  cosigned_at: timestamptz | null
  is_provisional: bool                                                   // true when created from customer-mail without product_id
}
```

### 4.1 Status transitions

```
triage → reasoning (on investigate start)
triage → dismissed (manual, engineer marks false positive)
reasoning → resolving (on initiatives approved + dispatched, AND cosign if required)
reasoning → triage (on stall without resolution; engineer re-triages)
resolving → closed (all initiatives closed by monitor)
resolving → reopen (on initiative failed OR closure predicate deadline-exceeded; per arch §4.4)
reopen → reasoning (on engineer-clicked "Reopen" → new session starts with context of failure)
closed → reopen (reopened manually by engineer; rare, e.g., new evidence contradicts resolution)
```

**"reopen" is a distinct state** (not `resolving` or `reasoning`): incident is awaiting engineer decision on whether to re-investigate. Once the engineer clicks "Reopen", a new session is created and `status → reasoning`.

### 4.2 Provisional incidents

Customer-email signals without `product_id` and below the strict semantic threshold (0.90 with secondary evidence) create incidents with `is_provisional=true`. These are:

- Visible in engineer inbox with a "Provisional" badge
- Investigate cannot run until engineer promotes them (via UI action that asks for product_id hint or dismisses)
- Promotes by setting `is_provisional=false` after engineer confirms identification

### 4.3 Contribution records (9 domains per arch §3.2)

Every incident accumulates auditable `contribution` records — one per domain that provided input to the reasoning. Each contribution is queryable, challengeable, and feeds into Compose input.

**Schema:**
```ts
contribution {
  id: "CTR-xxxxx"
  incident_id: text
  domain: 'market_research' | 'central_quality' | 'plant_quality_indirect' | 'plant_quality_direct'
        | 'process_planner' | 'technology_planning' | 'supplier_quality'
        | 'business_analytics' | 'marketing'
  author_user_id: text | null                    // null if system-generated
  source: 'tool' | 'user' | 'stub'               // tool = derived via domain tool; user = engineer text input; stub = unavailable placeholder
  content: text                                  // human-readable summary
  structured_payload: jsonb | null               // domain-specific typed data (e.g. SPC cards, supplier scorecards)
  evidence_refs: jsonb                           // {tool_call_ids: string[], deep_links?: string[]}
  weight: numeric DEFAULT 1.0                    // contribution weight in hypothesis ranking
  status: 'available' | 'unavailable' | 'pending'
  created_at: timestamptz
}
INDEX contribution (incident_id, domain);
UNIQUE(incident_id, domain, source);              -- one record per (incident, domain, source) combination
```

**Domain registry & 24h scope:**

| Domain | 24h status | Source (24h) | 48h+ path |
|---|---|---|---|
| `central_quality` | **functional** | tool `contrib_central_quality(incident_id)` — retrieves similar past incidents + lessons | same |
| `plant_quality_direct` | **functional** | tool `contrib_plant_quality(incident_id)` — defect history, rework patterns, operator logs | same |
| `supplier_quality` | **functional** | tool `contrib_supplier_quality(incident_id)` — batch certificates, supplier scorecards | same |
| `market_research` | stub | static "unavailable" placeholder record | external CRM API |
| `plant_quality_indirect` | stub | static placeholder | SPC service integration |
| `process_planner` | stub | static placeholder | ERP routing integration |
| `technology_planning` | stub | static placeholder | FMEA registry |
| `business_analytics` | stub | static placeholder | cost-accounting integration |
| `marketing` | stub | static placeholder | communications platform |

Stub contributions are inserted with `source='stub'`, `status='unavailable'`, `content="Domain not yet integrated"`. They appear in the contribution-stream UI greyed out — visible so the engineer knows the full picture, not hidden.

**Pipeline integration:**
- At Classify phase start: 3 functional domain tools are invoked in parallel (`contrib_central_quality`, `contrib_plant_quality`, `contrib_supplier_quality`), results persisted as `contribution` rows
- 6 stub contributions inserted synchronously at incident-create time (so contribution-stream UI has 9 cards from the start)
- Compose input receives `contributions: Contribution[]` alongside evidence_ledger + hypotheses + selected summaries
- Engineer can manually add contributions via `POST /api/incident/:id/contribution` with `source='user'` (free-text + optional evidence refs)

**API:**
```
GET  /api/incident/:id/contributions          → Contribution[]
POST /api/incident/:id/contribution           → body: { domain, content, evidence_refs?, structured_payload? } (engineer-only, source='user')
POST /api/incident/:id/contribution/refresh   → re-runs the 3 functional domain tools (engineer-trigger)
```

**UI:** Canvas "Contribution stream" panel renders 9 cards (3 filled, 6 greyed). Each card has: domain badge, content, evidence-link popovers, weight slider (engineer adjustable — updates ranking), "Challenge" button (opens amend flow).

---

## 5. Correlator (Signal → Incident)

### 5.1 Algorithm (layered)

For each new signal:

**Phase 1 — Deterministic joins** (SQL, fast):

| Match type | Condition | Time window |
|---|---|---|
| `det_prod_def` | `(product_id, defect_code)` match on open incident | **14d** |
| `det_sec_def` | `(section_id, defect_code)` match | **3d** |
| `det_rule` | `source='detector'` + same `detector_rule` + same `product_id` | **7d** |

Candidates collected across all three rules; pick highest-specificity match (prod_def > sec_def > rule) with most recent `last_activity_at` as tiebreaker.

**Phase 2 — Semantic fallback** (pgvector, runs only if Phase 1 empty):

- Compute `cosine(signal.embedding, incident.centroid_embedding)` for open incidents within the semantic window.
- Window: **30d** for internal signals (source operator/engineer/detector), **60d** for external signals (source customer_email) — longer window for external because Story 3 field-drift lags 8-12 weeks.
- Threshold: **0.82–0.85** when signal has structured fields (product_id or part_number present), **≥0.90** for pure free-text signals (no structured identifiers).
- For customer-mail without product_id: require threshold ≥0.90 AND secondary evidence (reported_part_number mentioned in raw_text OR article_number). Without secondary evidence → create provisional incident.

**Phase 3 — Incident formation (hybrid, per arch §2 ≥2-cluster rule + user-push exception):**

The rule for whether to create an incident from an un-matched signal depends on the signal source:

| Signal source | Phase 3 behavior |
|---|---|
| `operator`, `engineer` | **Immediate incident** — explicit human-authored problem reports are trusted; create incident with `signal_count=1`, `status='triage'`, `centroid_embedding=signal.embedding`. `cluster_state='attached'`. |
| `detector`, `backfill_*` | **Pending cluster** — signal sits in `cluster_state='pending_cluster'` for a window defined by `CORRELATOR_CLUSTER_WINDOW_DAYS` (default 7). Waits for a second signal matching the same deterministic key (product_id+defect_code, section_id+defect_code, or detector_rule+product_id). On match: both signals promote to an incident (signal_count=2). Without match within window: signal expires (stays in DB for audit, but `cluster_state='expired'`, never surfaces in UI). |
| `customer_email` | **Cluster-based with severity shortcut**. Default: pending_cluster like detector. Exception: if signal has `severity='high'` or `'critical'` AND a recognizable `product_id` / `reported_part_number` / `batch_id` — create provisional incident immediately (single-signal, `is_provisional=true`). Engineer promotes or dismisses in UI. |
| `detector` with strong deterministic match | **Immediate incident bypass** — if a detector-emitted signal has `detector_evidence.baseline_count >= 5 AND deviation_factor >= 3` (i.e., rule fires on a clearly statistically-significant anomaly), create incident with `signal_count=1`. Logs `match_type='new_strong_detector'`. |

**Pending-cluster sweep job:** Every `CORRELATOR_PENDING_SWEEP_INTERVAL_SEC` (default 300s = 5min), worker scans `signal WHERE cluster_state='pending_cluster' AND pending_until < now()`. For each: look for new deterministic matches among other pending-cluster signals; promote pairs to incident if found; else mark `cluster_state='expired'`.

### 5.2 Priority rules when multiple incidents match

1. Deterministic ranks higher than semantic
2. Within same tier: higher match_score first
3. Tiebreak: most recent `last_activity_at`

### 5.3 On attach

- Transactional: `BEGIN; UPDATE signal SET incident_id=?, match_type=?, match_score=?, attach_reason=?, cluster_state='attached'; UPDATE incident SET signal_count=signal_count+1, centroid_embedding=<recompute>, severity=GREATEST(severity, ?), last_activity_at=now(); COMMIT;`
- Row-lock `FOR UPDATE` on the target incident to prevent race conditions when two signals concurrently attach to the same incident.

### 5.4 Audit chain

Every signal carries `match_type`, `match_score`, `attach_reason`, `matched_incident_id` for post-hoc debuggability. No separate `attach_event` table — fields live on `signal`.

### 5.5 Tunable parameters (via env)

```bash
CORRELATOR_DET_PROD_DEF_DAYS=14
CORRELATOR_DET_SEC_DEF_DAYS=3
CORRELATOR_DET_RULE_DAYS=7
CORRELATOR_COSINE_STRUCTURED=0.82
CORRELATOR_COSINE_FREETEXT=0.90
CORRELATOR_SEMANTIC_WINDOW_INTERNAL_DAYS=30
CORRELATOR_SEMANTIC_WINDOW_EXTERNAL_DAYS=60
CORRELATOR_CLUSTER_WINDOW_DAYS=7
CORRELATOR_PENDING_SWEEP_INTERVAL_SEC=300
```

---

## 6. Session Layer (A+)

Investigate runs are modeled as `session` records with append-only `session_event` log and denormalized `session_turn` view. Live streaming via EventEmitter + SSE.

### 6.1 Schema

```ts
session {
  id: "SES-xxxxx"
  incident_id                                        // 1:N — multiple runs per incident allowed
  phase: 'classify'|'investigate'|'compose'|'propose'|'complete'|'failed'
  status: 'running'|'succeeded'|'failed'|'stalled'|'cancelled'
  started_at, ended_at
  total_tokens_in, total_tokens_out, total_cost_usd
  failure_reason: FailureReason | null                // enum defined in §15.3
  created_by_user_id
}
CREATE UNIQUE INDEX ON session (incident_id) WHERE status = 'running';   -- max 1 running per incident

session_turn {                                       -- denormalized per-turn view
  id
  session_id
  turn_index
  phase
  role: 'assistant' | 'tool'
  model: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7' | null
  content_text: text | null                          // preview, ~2KB max
  tool_call: {
    tool_call_id, name, input, output_ref,           // output_ref → separate storage (blob or `tool_result` table)
    status, latency_ms, result_hash
  } | null
  tokens_in, tokens_out, duration_ms, created_at
}

session_event {                                      -- append-only event log
  session_id
  event_seq: bigserial
  event_type: 'phase_start'|'tool_call_start'|'tool_call_result'|'turn_complete'|'phase_complete'|'session_complete'|'session_failed'|'hint_provided'
  payload: jsonb
  ts: timestamptz
}
UNIQUE(session_id, event_seq)
```

### 6.2 Source-of-truth ordering

```
session_event (Postgres, append-only) → EventEmitter → SSE client
                ▲
                └── source of truth. DB persists first, then emit.
```

If emitter crashes or SSE disconnects, DB retains all state. Client reconnect with `Last-Event-ID` re-reads from `session_event` starting at `event_seq > received_seq`.

### 6.3 Live streaming

- `token_delta` events stream live over SSE ONLY, never persisted (high write pressure, low replay value).
- Structured checkpoints (`phase_start`, `tool_call_start/result`, `turn_complete`, `phase_complete`, `session_complete/failed`, `hint_provided`) persist to `session_event` AND emit to bus.
- Heartbeat `event: ping` every 12s on SSE stream to prevent silent connection death.

### 6.4 Worker pattern

- **Dev / Demo:** Node process `server/worker/index.ts` runs alongside Next.js (`pnpm dev` starts both via `concurrently`). Orchestrator runs in-process; safe because Node process stays up.
- **Prod / Vercel:** Interface-compatible Inngest adapter. Swap import, no API changes.
- **Interface:**
  ```ts
  export interface Worker {
    enqueueInvestigate(args: { session_id: string }): Promise<void>;
  }
  ```
- **Session lifecycle:**
  1. `POST /api/incident/:id/investigate` → DB insert session (status='running'), call `worker.enqueueInvestigate({ session_id })`, return 202 + session_id
  2. Worker runs orchestrator, emits events via `sessionBus.emit(session_id, event)` + writes to `session_event` + `session_turn`
  3. On completion: `session.status = 'succeeded' | 'failed' | 'stalled' | 'cancelled'`, final event emitted

### 6.5 Reconnect + replay

- `GET /api/session/:id` returns full turn history (digested) + session metadata. Supports `?since=<event_seq>` for append-only delta.
- `GET /api/session/:id/stream?since=<event_seq>` opens SSE. Server replays events from `event_seq > since` first, then streams live. If `since >= max_seq` → start streaming live immediately.
- Live-token events never in history (never persisted). Client-UX: replay shows stable turn structure; live stream adds token_delta on top of current turn.

---

## 7. 4-Phase Orchestrator

### 7.1 Phase overview

| Phase | Model | Token budget in | Token budget out | Purpose |
|---|---|---|---|---|
| Classify | Haiku 4.5 | 2k | 150 | Determine archetype + severity_assessment + suggested_playbook |
| Investigate | Sonnet 4.6 | 18k | 3k per turn (max 8 turns) | Bounded ReAct loop with tool use |
| Compose | Sonnet 4.6 | 6k | 2.5k | Build 8D report + visualization spec from evidence |
| Propose | Sonnet 4.6 | 3k | 1.5k | Derive initiatives with closure predicates + impact estimates |

Opus 4.7 is **fallback only**, gated at max 2 calls per session, invoked when Sonnet's confidence < 0.5 in Compose or Propose.

### 7.2 Control flow

```
POST /api/incident/:id/investigate
  ↓
session insert (status='running')
  ↓
worker.enqueueInvestigate
  ↓
─── orchestrator runs in worker ───
  Classify (Haiku)
    → composes incident.signature_text from signals
    → calls retrieve_lessons tool (top-3 on signature_text embedding, filtered approved + not-superseded)
    → output Zod-validated → session_turn + session_event
  Investigate (Sonnet, loop)
    ← retrieve_lessons tool remains available for on-demand retrieval mid-loop
    ← turn 1..8 with tool calls
    ← post-validator (evidence-cite) per phase-terminal-output
    ← stall detector (hash-dedupe) between turns
    ← context manager (Haiku-summarize if > 190k tokens)
    → terminal: evidence_ledger + root_cause_hypotheses + confidence
  Compose (Sonnet)
    ← compact input: evidence_ledger + hypotheses + selected tool summaries (NOT full transcript)
       + contributions[] (from §4.3, 3 functional + 6 stub domains)
    → 8D D1-D8 + visualizations spec
    → persists as `report` row (§7.5)
  Propose (Sonnet)
    ← root_causes + archetype + domain-agent-registry + report_id
    ← must invoke simulate_impact tool for each initiative's impact_estimate
    → initiatives[] with closure_predicate + impact_estimate (cited to simulate_impact)
    → post-validator with semantic LLM-as-judge layer (Haiku)
  session.status = 'succeeded'
───────────────────────────────────
```

### 7.3 Archetype playbooks

Each of `supplier | drift | design | operator | unknown` has a playbook that injects into Investigate (and optionally Compose/Propose) as few-shot priors.

Playbook structure (per archetype, ~200-400 tokens):
- Typical signature (3-5 bullets to recognize)
- Investigation sequence (numbered tool-call strategy)
- Root-cause template (hypothesis shape)
- Typical initiatives (default agent_domain + target_system)
- Closure predicate template
- **1 condensed few-shot transcript (~150-250 tokens)**, exceptions: supplier + design get 2 few-shots (demo-critical)

### 7.4 Uncertainty path

When confidence drops (< threshold, LLM self-reports, or post-validator fails):

1. **First resort:** `request_hint` tool → session transitions to `status='stalled'`, engineer receives notification with open questions, can `POST /api/session/:id/hint` with free-text
2. **Fallback:** `abandon_with_partial_finding` when no hint arrives within patience window OR LLM still uncertain after hint → `session.status='stalled'` with partial output, UI shows un-cited claims for engineer to curate

### 7.5 Report persistence

Compose produces a structured 8D report + visualization spec. This is persisted as a versioned `report` row tied to the session + incident:

**Schema:**
```ts
report {
  id: text PRIMARY KEY                       // "REP-xxxxx"
  incident_id: text REFERENCES incident(id)
  session_id: text REFERENCES session(id)
  version: int                               // incremented on amend-flow re-compose (1, 2, 3, ...)
  status: 'draft' | 'current' | 'superseded'
  report_8d: jsonb                           // {D1: {title, body_markdown, evidence[]}, D2: {...}, ..., D8: {...}}
  visualizations: jsonb                      // [{type: 'pareto'|'timeline'|'fishbone'|'fmea'|'bom', data_query, caption, evidence[]}]
  composed_by_model: text                    // 'claude-sonnet-4-6' etc.
  composed_at: timestamptz
  confidence: numeric                        // Compose-phase self-reported
  compose_tokens_in: int
  compose_tokens_out: int
}
INDEX report (incident_id, version DESC);
UNIQUE(incident_id) WHERE status = 'current';   -- only one current report per incident
```

**Status transitions:**
- On Compose-complete → `status='draft'`
- Engineer review accept → `status='current'`; previous current (if any) → `status='superseded'`
- On amend-flow re-compose → new row with `version=prev+1, status='draft'`

**API exposure:** `GET /api/incident/:id` returns `reports: Report[]` with current first, superseded following (full history visible). `GET /api/report/:id` returns single report. `POST /api/report/:id/accept` (engineer) transitions draft→current. `GET /api/report/:id/pdf` returns server-rendered PDF of report_8d (stub for 24h — can be implemented as a client-side print-to-PDF via browser).

**Session-turn relation:** The Compose-phase turn in `session_turn` stores the raw LLM output (preview + token counts). The parsed `report_8d` + `visualizations` land in `report`. Session turns are the audit trail; `report` is the consumed artifact.

---

## 8. Prompt Layer

### 8.1 Organization

```
server/prompts/
  system/
    base.md                              # shared: Resolve identity, language policy, evidence-cite contract
    tools.auto.md                        # generated from Zod schemas by build step
    playbooks/
      supplier.md
      drift.md
      design.md
      operator.md
      unknown.md
  phase/
    classify.md
    investigate.md
    compose.md
    propose.md
  generated/                             # .ts output (git-committed)
    system.base.ts
    system.tools.ts
    phase.classify.ts
    phase.investigate.ts
    phase.compose.ts
    phase.propose.ts
    playbooks.supplier.ts
    ...
```

`pnpm prompts:build` regenerates `generated/*.ts`. Pre-commit hook verifies `generated/` is in sync with `.md` sources. CI check verifies regeneration produces no diff.

### 8.2 Cache breakpoints (Anthropic prompt caching)

Two breakpoints per phase call, enabling cross-phase cache reuse:

**Breakpoint 1 — shared across all phases (big static prefix):**
- base.md (identity, language policy, evidence-cite contract, grounding rules)
- tools.auto.md (full tool spec, ~4-6k tokens)

**Breakpoint 2 — phase-specific static:**
- Phase-specific template (classify.md / investigate.md / compose.md / propose.md)
- Active archetype playbook (one of the 5)

**Dynamic (not cached):**
- Incident payload (signals, current summary)
- Retrieved lessons (top-3 with cosine > 0.75)
- Running session context (for Investigate loop: tool call history)

Target: ~8-10k tokens cached prefix, >80% hit rate after first run per session.

### 8.3 Grounding rules (base.md, shared)

1. **Evidence-Cite** — Every data claim references `tool_call_id` via `[[tc:<id>]]` inline marker AND structured `evidence` field (structured is source of truth, inline is guard).
2. **No-Hallucination-Table** — Never invent a table, column, defect_code, or rule not present in the tool spec.
3. **Language-Policy** — Respond in the source-signal's language (DE or EN). Technical terms (defect_code, rework_time, product_id) stay English across both.
4. **Uncertainty-Marker** — On low confidence, state "unclear" explicitly and call `request_hint` rather than guessing.
5. **Scope-Guard** — Do not recommend actions outside the current incident. Do not propose initiatives without a closure_predicate.
6. **Reasoning-Marker** — Inferences without direct tool evidence must be marked `[[reasoning]]`. `[[reasoning]]` MUST NOT appear near a number/ID/KPI (post-validator rejects this).

### 8.4 Model routing

| Concern | Model | Rationale |
|---|---|---|
| Classify | Haiku 4.5 | Cheap, structured classification task |
| Triage (detector) | Haiku 4.5 | Same, high volume |
| Investigate main loop | Sonnet 4.6 | Needs tool-use + reasoning quality |
| Compose 8D | Sonnet 4.6 | Structured report generation |
| Propose initiatives | Sonnet 4.6 | Multi-step decision, closure-predicate design |
| Semantic post-validator (propose only) | Haiku 4.5 | Matcher for cited claims; cheap |
| Context-overflow summarizer | Haiku 4.5 | Summarize old turns; cheap |
| Deep-think fallback | Opus 4.7 | Only when Sonnet confidence < 0.5, max 2 calls/session |
| Embeddings | text-embedding-3-small (OpenAI) | Multi-lingual, 1536 dims, cheap |
| Voice transcription | Whisper (OpenAI) | Handles DE + EN operator voice notes |

---

## 9. Tool Catalog

**23 tools across 8 groups** (19 core LLM tools + 3 contribution-domain tools + 1 write-gated impact tool). All defined as Zod schemas in `schemas/tool-io.ts`, implementations in `server/tools/<group>/<name>.ts`, registered in `server/tools/index.ts`. The 19-tool canonical count refers to tools exposed to the Investigate loop's typed layer; contribution tools run in Classify-parallel; impact-write is closure-monitor-only.

### 9.1 Groups + tools

**Signal & Incident (read, 3):**
- `get_incident(incident_id)` → full incident with signals, centroid, status, linked products
- `list_signals_for_incident(incident_id, limit?)` → signals list with text + attachments preview
- `find_related_incidents(incident_id, window_days?)` → pgvector knn on centroid

**Retrieval (structured SQL, read, 5):**
- `query_defects(filters: { product_id?, defect_code?, section_id?, date_from?, date_to?, limit? })` → defect rows
- `trace_batch(batch_id | supplier_batch_id)` → suppliers + products + defects along a batch
- `bom_parts_for_product(product_id)` → BOM explosion
- `pareto_defect_codes(filters)` → sorted distribution of defect_codes
- `test_results_marginal(filters)` → marginal test results

**Cross-boundary (composite queries, 4):**
- `field_vs_factory_gap(product_id, window_days?)` → compares customer complaints vs factory defect rate
- `operator_effect_analysis(user_id | section_id, window_days?)` → defect/rework rates per operator
- `rework_timeline_by_section(product_id, window_days?)` → time-series of rework durations per section
- `weekly_quality_summary(window_weeks?)` → aggregated KPIs per week

**Semantic / Vision / Lessons (3):**
- `semantic_search_signals(query_text, filters?, top_k=10)` → pgvector knn on signal embeddings
- `retrieve_lessons(incident_signature_text, top_k=3)` → pgvector knn on `lesson.embedding` WHERE `engineer_validated='approved' AND superseded_by IS NULL`; weighted by `cosine × (1 + 0.2 × log(1+usage_count)) × recency_decay(half_life=180d)`
- `classify_defect_image(image_url)` → vision classifier output for a signal attachment

**Simulation (1):**
- `simulate_impact(initiative_template, incident_context)` → rule-based prior + lesson similarity → `{expected_defect_reduction, confidence, horizon_days, methodology_note}`. **Required citation source for `initiative.impact_estimate`.**

**Write-gated (callable only by approve-endpoint / closure-monitor / emit_lesson, NEVER by Investigate loop, 3):**
- `create_initiative(incident_id, template, predicate, impact_estimate)` — dispatcher calls this on approve
- `register_closure_predicate(initiative_id, predicate)` — part of create_initiative transaction
- `emit_lesson(source_session_id, draft)` — closure_monitor calls on incident close

**Contribution (Classify-parallel, 3 functional + 6 stub):**
- `contrib_central_quality(incident_id)` → similar past incidents + retrievable lessons (summarizes `retrieve_lessons` + `find_related_incidents` into a domain-shaped contribution record)
- `contrib_plant_quality(incident_id)` → defect history + rework patterns + operator logs (calls `query_defects` + `operator_effect_analysis` + `rework_timeline_by_section`; shapes as one contribution)
- `contrib_supplier_quality(incident_id)` → batch certificates, supplier scorecards (calls `trace_batch` + aggregates supplier_batch metadata)
- Stub-contrib domains (6): no runtime tool — static placeholder rows inserted at incident-create time (see §4.3 for the stub list)

**Write-gated impact (closure-monitor only, 1):**
- `emit_impact_measurement(initiative_id, metric_spec, evidence_refs)` — writes `impact_measurement` row on `initiative.closed`; computes baseline + observed + delta; see §12.7

### 9.2 Tool I/O schemas

Every tool has:

```ts
// schemas/tool-io.ts
export const QueryDefectsInput = z.object({
  product_id: z.string().optional(),
  defect_code: z.string().optional(),
  section_id: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});
export const QueryDefectsOutput = z.object({
  rows: z.array(z.object({ /* row shape */ })),
  total: z.number(),
  truncated: z.boolean(),
});
```

Tool wrapper validates input via Zod, catches implementation errors, returns uniform `{ ok: true, output } | { ok: false, error: ErrorResponse }`. LLM sees error as tool result, can recover or skip.

### 9.3 Tool-call error recovery

- Tool returns `{ok: false, error}` — LLM sees as tool result, orchestrator does not abort
- After **2 consecutive same-tool errors**, orchestrator force-skips that tool name for the rest of the session (adds rule to tool registry for this session)
- Tool-call error logged to `pipeline_error_log` with category='tool'

---

## 10. Evidence-Cite Enforcement

Three-layer enforcement. Structured evidence is the source of truth; inline markers are defense-in-depth and UX-friendly.

### 10.1 Layer 1 — Structured (Zod-enforced)

All claim-bearing Zod output types have:

```ts
evidence: z.array(z.object({
  tool_call_id: z.string(),
  note: z.string().optional(),
})).min(1)
```

Zod parse fails on empty array → hard reject of phase output, retry-prompt triggered.

Applied to:
- `Investigate.output.hypotheses[i].evidence`
- `Compose.output.report_8d.D{1..8}.evidence`
- `Propose.output.initiatives[i].rationale.evidence`
- `Propose.output.initiatives[i].impact_estimate.evidence` (must reference `simulate_impact` tool_call_id specifically)

### 10.2 Layer 2 — Inline markers (text narrative)

All facts/numbers/IDs in free-text fields wrapped with `[[tc:<id>]]`. LLM-inferences without direct evidence wrapped with `[[reasoning]]`.

Example:
> "Detected 42 cold-solder defects [[tc:a1b2c3]] on product PM-00008 [[tc:a1b2c3]] between W48–W49 [[tc:d4e5f6]]. Likely supplier-batch correlation [[reasoning]]."

### 10.3 Layer 3 — Post-validator (deterministic, JS)

Runs after each phase output, before persistence:

1. **Extract** all `[[tc:ID]]` from text + all `tool_call_id` from structured evidence arrays.
2. **Existence check** — every ID must exist in `session_turn.tool_call.tool_call_id` for this session. Hallucinated IDs → reject.
3. **Numeric-claim detector** — regex: numbers-with-unit (`\d+\s*(µF|kg|mm|%|rows|days|€|W\d+|...)`) OR numbers in enumeration context. Each matched number must have `[[tc:` or `[[reasoning]]` within 40 chars.
4. **ID-reference detector** — occurrences of `PRD-\d+ | SB-\d+ | PA-\d+ | DEF-\d+ | PM-\d+ | SUP-\d+` must have `[[tc:` within 40 chars (never `[[reasoning]]` for IDs).
5. **`[[reasoning]]` misuse check** — if a numeric or ID token appears within 40 chars of `[[reasoning]]`, reject (reasoning-marker is for pure inferences only).
6. **Retry on fail** — single retry with correction prompt listing un-cited claims verbatim.
7. **After 1 retry** — if still failing: `session.status='stalled'`, `failure_reason='evidence_cite_unfixable'`, un-cited claims surfaced in UI (per Gap 7 parallel stall-UX).

### 10.4 Layer 4 — Semantic LLM-as-judge (Propose phase only)

After Layer 3 passes, Haiku is called with each initiative's `rationale` + cited `tool_call_output_preview` and asked: "Does this claim accurately summarize the tool result?" Output: `{match: 'yes'|'partial'|'no', explanation}`.

- All `yes` → approved, passes through
- Any `partial`/`no` → treated as Layer-3 failure: retry once, then stall

### 10.5 Parallel stall-UX

When evidence-cite unfixable:

- UI shows un-cited claims as **red-highlighted rows** with "Edit or Dismiss" buttons (manual curation path)
- Simultaneously shows "Request clarification" button → `request_hint` flow (AI-assisted re-run with engineer guidance)
- Engineer chooses per time pressure: quick manual edit vs. deeper hint-driven re-run

---

## 11. Lessons Store

### 11.1 Schema

```ts
lesson {
  id: "LES-xxxxx"
  created_at
  source_incident_id
  source_session_id
  archetype: 'supplier'|'drift'|'design'|'operator'|'unknown'
  title: text                                      // 1-line human summary
  signature_text: text                             // 120-220 word condensed abstract (for embedding)
  prompt_snippet: text                             // pre-formatted inline snippet for prompt injection
  embedding: vector(1536)
  triggers: jsonb                                  // {defect_codes:[], product_ids:[], detector_rules:[], section_patterns:[]}
  root_cause: text
  root_cause_evidence: jsonb                       // {tool_call_ids:[], key_queries:[]}
  initiatives_taken: jsonb                         // [{agent_domain, target_system, action_template}]
  initiatives_outcome: jsonb | null                // set by closure_monitor: {predicate_results, impact_measurement}
  confidence: float                                // set by Compose
  engineer_validated: 'pending'|'approved'|'rejected'
  validated_by_user_id: text | null
  validated_at: timestamptz | null
  superseded_by: "LES-xxxxx" | null
  seed_source: text | null                         // 'demo' for pre-seeded; null for runtime-generated
}

lesson_usage {                                     -- append-only, race-safe usage tracking
  id
  lesson_id
  session_id
  incident_id
  used_at
  cosine_score
}
```

`usage_count` and `last_used_at` are derived columns (materialized view or computed on read from `lesson_usage`).

### 11.2 Write trigger — hybrid auto-approve

When closure_monitor detects `incident.status → closed`:

1. Fire `emit_lesson` tool (gated, closure_monitor is the only caller)
2. Sonnet composes lesson from session transcript + evidence_ledger + outcome
3. Write lesson row with `engineer_validated` determined by:
   - **`'approved'`** iff ALL:
     - `confidence >= 0.8`
     - all closure_predicates evaluated to `passed`
     - evidence-check clean (no un-cited claims in source session)
   - **`'pending'`** otherwise
4. Rejected lessons (engineer action) stay in DB for audit; never retrieved.

### 11.3 Retrieval

- Called in Classify + Investigate via `retrieve_lessons` tool
- Filter: `engineer_validated='approved' AND superseded_by IS NULL`
- Embed query = `incident.signature_text` (composed in Classify from signals)
- pgvector knn top-k (default k=3)
- Keep only `cosine > 0.75`
- Weight: `cosine × (1 + 0.2 × log(1+usage_count)) × recency_decay(half_life=180d)`
- Inject as few-shot priors (~200-400 tokens each) via `prompt_snippet`
- Each retrieval logs a `lesson_usage` row

### 11.4 Superseding

Manual only. Engineer UI has "Supersede by [new lesson]" action on a lesson detail view. Sets `old.superseded_by = NEW_ID`. Old lesson retained in DB but removed from retrieval. No auto-supersede (too error-prone for 24h).

### 11.5 Demo seed

Three pre-approved lessons seeded in migration `00012_resolve_seed_demo_lessons.sql` with `seed_source='demo'`:

- Story 1 (Supplier batch signature)
- Story 2 (Calibration drift signature)
- Story 4 (Operator handling signature)

Story 3 is intentionally **not seeded** — the demo shows the pipeline learning this pattern live, then retrieving it for a subsequent incident as the network-effect moment.

---

## 12. Closure Monitor

### 12.1 Schema

```ts
initiative {
  id: "INI-xxxxx"                                  // internal Resolve ID
  product_action_id: "PA-xxxxx" | null             // set after successful manex_native dispatch
  incident_id
  agent_domain: 'production'|'supplier'|'rd'|'logistics'|'customer_response'
  target_system: 'manex_native'|'email_stub'|'slack_stub'|'supplier_portal_stub'|'plm_stub'
  target_ref: text | null                          // e.g. "product_action:PA-00101", "email:<uuid>"
  action_template: jsonb                           // typed ActionTemplate (§13)
  closure_predicate: jsonb                         // typed ClosurePredicate (§12.2)
  status: 'proposed'|'approved'|'dispatched'|'closed'|'failed'|'cancelled'
  dispatched_at, dispatched_by_user_id
  last_checked_at, last_check_result: jsonb
  closed_at, failure_reason: text | null
  patience_until: timestamptz                      // deadline for "stale initiative" alert
  consecutive_error_count: int                     // reset on any non-error check
}

initiative_check {                                 -- append-only audit log
  id
  initiative_id
  checked_at
  predicate_snapshot: jsonb
  result: 'pending'|'passed'|'failed'|'error'
  evidence: jsonb
  triggered_by: 'cron'|'manual'
}
UNIQUE(initiative_id, checked_at)
```

### 12.2 Closure predicate types (discriminated union)

```ts
type ClosurePredicate =
  | { kind: 'metric_below_threshold';
      metric_spec: MetricSpec;                     // parameterized, Zod-validated
      threshold: number;
      window_days: number;
      start_from: 'dispatch_time' | 'explicit_date';
      start_date?: string }
  | { kind: 'count_stayed_at_value';
      filter_spec: FilterSpec;
      value: number;
      window_days: number }
  | { kind: 'composite';
      op: 'and' | 'or';
      children: ClosurePredicate[] }
  | { kind: 'external_state_check';                // STUB for 24h — adapter returns not_implemented
      target_system: string;
      target_ref: string;
      expected_state: string };
```

`metric_spec` and `filter_spec` are parameterized SQL queries with Zod-validated inputs. No free-form SQL — predefined query templates only.

### 12.3 Cron + manual

- Cron every **60s** (configurable `CLOSURE_CRON_INTERVAL_SEC`), runs on worker process
- Manual button in Engineer UI: `POST /api/closure/check/:initiative_id` triggers single eval
- Check batch per cron run: `SELECT ... FROM initiative WHERE status IN ('dispatched') FOR UPDATE SKIP LOCKED LIMIT 50`

### 12.4 Cascade logic

For each initiative evaluated:

1. Evaluator returns `{result, evidence}`
2. `result='passed'` → `initiative.status='closed'`, `closed_at=now()`, emit `initiative.closed` event, **write `impact_measurement` row** (per arch §4.4, §12.7)
3. `result='failed'` → `initiative.status='failed'`, emit `initiative.failed` event; **set `incident.status='reopen'`, `reopen_reason='initiative_failed:<INI-id>'`**; notify engineer with 1-click "Reopen" button (semi-auto per Gap 9 Q-d)
4. `result='pending' AND now() > patience_until` → emit `initiative.deadline_exceeded`; **set `incident.status='reopen'`, `reopen_reason='deadline_exceeded:<INI-id>'`**; notify engineer
5. `result='error'` → `initiative_check.result='error'` logged, `consecutive_error_count++`. On 3 consecutive errors → flag `closure_monitor_paused` + engineer alert. Any non-error check resets counter.
6. If all initiatives of an incident are `closed`:
   - `incident.status='closed'`
   - Trigger `emit_lesson` (writes lesson with engineer_validated per §11.2)
7. On `incident.status='reopen'`:
   - UI shows banner "Incident reopened — <reason>" with 1-click "Start new session" button
   - Engineer click → creates new session with context `{reason: <reopen_reason>, original_initiative: INI-xxxxx}`, `incident.status → reasoning`, `incident.reopened_at=now()` (preserved for history)
   - Aligns with arch §4.4 ("Deadline exceeded, unsatisfied → status=reopen → re-inject into Reason") while keeping engineer in-the-loop per Gap 9 Q-d

### 12.5 Concurrency

- Workers use `SELECT ... FOR UPDATE SKIP LOCKED` on the initiative batch
- `UNIQUE(initiative_id, checked_at)` on `initiative_check` prevents double-record from concurrent workers
- Idempotent write-path: if row already exists, abort with no-op

### 12.6 Patience window

- Proposed by LLM during Propose phase based on archetype (supplier=14d, drift=7d, design=60d, operator=3d)
- Engineer confirms / edits in approve dialog before dispatch
- Stored as absolute `patience_until = dispatched_at + patience_days`

### 12.7 Impact measurement (arch §4.4)

On every `initiative.status → closed`, the closure monitor writes an `impact_measurement` row capturing what was observed.

**Schema:**
```ts
impact_measurement {
  id: text PRIMARY KEY                           // "IMP-xxxxx"
  initiative_id: text REFERENCES initiative(id)
  measured_at: timestamptz DEFAULT now()
  metric: text                                   // e.g., 'defect_rate_change', 'marginal_fail_rate_delta', 'zero_defect_streak_days'
  baseline_value: numeric | null                 // pre-dispatch observed value
  observed_value: numeric                        // current value at closure
  delta_absolute: numeric | null                 // observed - baseline
  delta_pct: numeric | null                      // (observed-baseline)/baseline * 100
  unit: text | null                              // '%', 'count/day', 'days', etc.
  confidence: numeric                            // 0.0-1.0; based on sample size + variance
  method: text                                   // 'closure_predicate_direct' | 'simulate_impact_retrospective' | 'engineer_estimated'
  evidence_refs: jsonb                           // {tool_call_ids_from_predicate_checks: [], baseline_query: text}
}
INDEX impact_measurement (initiative_id);
```

**Write path:** `server/closure-monitor/escalator.ts` on `initiative.closed` emits an `emit_impact_measurement` tool call (write-gated, only closure-monitor). Evaluator extracts baseline/observed from the most recent `initiative_check.evidence` payload + optionally runs `simulate_impact` retrospectively to compare predicted vs actual.

**Consumed by:** Leadership analytics endpoint `/api/analytics/impact` aggregates impact_measurement rows for the dashboard.

---

## 13. Dispatcher (Initiative → Target System)

### 13.1 Adapter interface

```ts
interface DispatchAdapter<K extends ActionKind> {
  kind: K;
  supports: TargetSystem[];
  validateTemplate: (template: ActionTemplate<K>) => { ok: true } | { ok: false; error: ErrorResponse };
  dispatch: (args: {
    initiative: Initiative;
    template: ActionTemplate<K>;
    ctx: DispatchCtx;
  }) => Promise<{
    ok: boolean;
    target_ref?: string;
    details?: jsonb;
    error?: ErrorResponse;
  }>;
}
```

Adapters registered in `server/dispatcher/adapters/index.ts`.

### 13.2 Target systems (24h scope)

| Target | Status | Implementation |
|---|---|---|
| `manex_native` | **real** | `INSERT INTO product_action (...)`, returns PA-ID, binds `initiative.product_action_id` |
| `email_stub` | functional | Insert into `dispatch_attempt` with status='preview', rendered in Engineer UI as email-preview card, "Mark as sent" button |
| `slack_stub` | functional | Insert into `dispatch_attempt` with status='preview', rendered as slack-message card |
| `supplier_portal_stub` | placeholder | Adapter returns `{ok: false, error: {code: 'not_implemented'}}`. Registered for interface completeness. |
| `plm_stub` | placeholder | Same as above. |

### 13.3 Action template taxonomy

Zod discriminated union in `schemas/action-templates.ts`:

```ts
type ActionTemplate =
  | { kind: 'production_action';     params: ProductionActionParams }
  | { kind: 'supplier_notice';       params: SupplierNoticeParams }
  | { kind: 'design_change_request'; params: DesignChangeRequestParams }
  | { kind: 'rework_dispatch';       params: ReworkDispatchParams }
  | { kind: 'customer_response';     params: CustomerResponseParams }
  | { kind: 'logistics_hold';        params: LogisticsHoldParams }
  | { kind: 'internal_notification'; params: InternalNotificationParams };
```

Each `params` is its own Zod schema with strict fields (no arbitrary jsonb).

### 13.4 Engineer approve dialog

Engineer opens approve dialog from Engineer UI. Fields are classified via a per-`ActionTemplate.kind` map in `schemas/action-templates.ts` (`editableFields: keyof Params[]`) so editability is declarative, not implicit. General rule:

**Editable across all kinds (when field exists in the kind's Params):**
- `assigned_to`, `due_date`, `description` / `body_markdown`, `cc` / `recipients`, `subject`, `priority`

**Read-only across all kinds:**
- Structural FKs: `product_id`, `supplier_id`, `customer_ref`, `linked_part_ids`, `shipment_ref`, etc. (changing these requires amend flow)
- Closure predicate structural: `closure_predicate.kind`, `closure_predicate.metric_spec`, `closure_predicate.filter_spec`, `closure_predicate.children`

**Editable for closure predicate (hybrid):**
- `closure_predicate.window_days`
- `closure_predicate.threshold`
- `closure_predicate.value`
- `patience_until`

Engineer UI renders fields dynamically: form reads `editableFields` per kind and gates inputs accordingly. Non-listed fields render as read-only text. Zod re-validates on submit.

### 13.5 `dispatch_attempt` — full schema

```ts
dispatch_attempt {
  id: text PRIMARY KEY                                // "DAT-xxxxx"
  initiative_id: text REFERENCES initiative(id)
  attempt_index: int                                  // 1, 2, 3, ... per initiative (append-only; retries increment)
  target_system: text                                 // 'manex_native'|'email_stub'|'slack_stub'|'supplier_portal_stub'|'plm_stub'
  kind: text                                          // ActionTemplate.kind
  payload: jsonb                                      // rendered template (email subject+body, slack text, etc.); for manex_native: the product_action insert shape
  status: text                                        // 'succeeded'|'failed'|'preview'|'sent'|'cancelled'
  idempotency_key: text
  target_ref: text | null                             // e.g. "product_action:PA-00101" (manex_native) | "email:<uuid>" (stubs)
  error: jsonb | null                                 // {code, message, details} on failure
  created_at: timestamptz DEFAULT now()
  sent_at: timestamptz | null
  sent_by_user_id: text | null
  cancelled_at: timestamptz | null
  cancelled_by_user_id: text | null
}
CREATE UNIQUE INDEX ON dispatch_attempt (idempotency_key);
CREATE UNIQUE INDEX ON dispatch_attempt (initiative_id, target_system, kind, attempt_index);
CREATE INDEX ON dispatch_attempt (initiative_id, created_at DESC);
```

**Semantics:**
- Append-only. Every dispatch, retry, state change (stub → sent, sent → cancelled) inserts a new row.
- Current state of a stub initiative = latest row per initiative ordered by `created_at DESC`.
- `status='preview'` on stubs when first dispatched; engineer click "Mark as sent" inserts new row with `status='sent'` (same idempotency_key disallowed — use `{idempotency_key}_sent` suffix or separate key hierarchy).

### 13.6 Dispatch flow (transactional, no intermediate state)

```sql
BEGIN;
  SELECT ... FROM initiative WHERE id=? AND status='approved' FOR UPDATE;
  -- guard: if cosign_required AND NOT co_signed → abort with 403 (§13.10)
  -- adapter runs, performs target write or returns error
  -- on success:
  UPDATE initiative SET status='dispatched', target_ref=?, product_action_id=?, dispatched_at=now() WHERE id=?;
  INSERT INTO dispatch_attempt (initiative_id, attempt_index, target_system, kind, payload, status='succeeded'|'preview', idempotency_key, target_ref, ...);
  -- on failure:
  UPDATE initiative SET status='failed', failure_reason=? WHERE id=?;
  INSERT INTO dispatch_attempt (... status='failed', error=? ...);
COMMIT;
```

Status transitions strictly: `proposed → approved → dispatched | failed | cancelled`. No `dispatching` intermediate (transaction provides atomicity).

### 13.7 Idempotency (regenerated after engineer edit)

`dispatch_idempotency_key` is **regenerated at approve-time**, not Propose-time.

- **Original behavior was wrong:** key was hash of Propose-phase template; engineer edits changed template but key stayed same → two materially different dispatches would collide.
- **Fix:** at `POST /api/initiative/:id/approve`, after merging engineer edits into the template, compute `dispatch_idempotency_key = sha256(canonical_json({ initiative_id, final_template, final_predicate, patience_until }))` and persist to `initiative.dispatch_idempotency_key`. Dispatcher reads from there.
- **Retry (within one approved version):** same idempotency_key is reused — intentional, prevents double-dispatch of the same approved spec. `UNIQUE(idempotency_key)` on `dispatch_attempt` would block retry, so retries use a suffix: `idempotency_key = base_key + ':attempt_' + attempt_index`.
- **Re-approve after amend (engineer changed template again):** new key, fresh hash, new attempt sequence.

### 13.8 Retry policy

On first failure: 1 retry with 30s backoff. Next attempt inserts new `dispatch_attempt` row with `attempt_index = previous + 1` and suffixed idempotency_key. After failed retry: initiative goes to `status='failed'`, amend-flow engaged.

### 13.9 Cancellation

- Engineer cancels `approved` initiative: set `status='cancelled'`, never dispatched. No `dispatch_attempt` row (never dispatched).
- Engineer cancels `dispatched` initiative on stub: `status='cancelled'` + insert `dispatch_attempt` with status='cancelled' (append-only, shows full timeline).
- Engineer cancels `dispatched` initiative on `manex_native`: `initiative.status='cancelled'` but `product_action` remains (Manex rule: no deletes on product_action). Engineer must cancel in Manex UI separately. `dispatch_attempt` with status='cancelled' inserted for audit.

### 13.10 Leadership co-sign (high-severity gate)

Per arch §8 ("Quality Manager: High-severity co-sign"), initiatives on incidents with `severity ∈ {high, critical}` require Leadership co-sign before dispatch.

**Fields (on `initiative`):**
```ts
cosign_required: bool                                 // computed: severity IN (high, critical) AND target_system != 'email_stub' AND kind != 'customer_response'
co_signed: bool DEFAULT false
co_signed_by_user_id: text | null                     // must be user.role='leadership'
co_signed_at: timestamptz | null
```

**Endpoint:** `POST /api/initiative/:id/cosign` (Leadership role only)
```
body: { approved: bool, comment?: string }
effect on approved=true: UPDATE initiative SET co_signed=true, co_signed_by_user_id=?, co_signed_at=now()
effect on approved=false: UPDATE initiative SET status='cancelled', failure_reason='cosign_rejected'
```

**Dispatch gate:** `/api/initiative/:id/approve` executes the dispatch ONLY if `NOT cosign_required OR co_signed`. Otherwise returns 409 Conflict with `{code: 'cosign_required', ...}`. Engineer UI shows "awaiting co-sign" state; Leadership inbox shows pending co-signs.

### 13.11 `external_state_check` predicate — stub-adapter coupling

For stub target systems (`email_stub`, `slack_stub`, `supplier_portal_stub`, `plm_stub`), the `external_state_check` predicate evaluates against `dispatch_attempt` instead of a live external system:

```ts
{ kind: 'external_state_check',
  target_system: 'email_stub',
  target_ref: '<initiative_id>',                      // looks up latest dispatch_attempt for this initiative
  expected_state: 'sent' }                            // matches dispatch_attempt.status
```

Evaluator logic: `SELECT status FROM dispatch_attempt WHERE initiative_id=? AND target_system=? ORDER BY created_at DESC LIMIT 1`. If latest.status matches expected_state → `passed`. If latest is `preview` and expected is `sent` → `pending` (engineer hasn't clicked "Mark as sent" yet). If latest is `cancelled` or `failed` → `failed`.

For `manex_native`, `external_state_check` can check `product_action.status` directly (read-only query on Manex table).

This couples the predicate to observable state without requiring real external integration.

---

## 14. API Contracts per Lens

### 14.1 Auth model (demo-pragmatic)

- No Supabase Auth for 24h. `X-Demo-User` header carries user identity.
- Server-side guard (`server/auth/guards.ts`) resolves user from header via lookup in seeded `app_user` table. Ignores `user_id` in query/body (prevents trivial spoofing).
- Role-based matrix in `server/auth/rbac-matrix.ts`:

| Endpoint pattern | Operator | Engineer | Leadership |
|---|---|---|---|
| `POST /api/signal/ingest` | ✓ | ✓ | ✗ |
| `GET /api/signals/mine` | ✓ | ✓ | ✗ |
| `GET /api/incident/*` | ✗ | ✓ | ✓ (read-only view, hides investigation turns) |
| `POST /api/incident/:id/investigate` | ✗ | ✓ | ✗ |
| `POST /api/incident/:id/contribution*` | ✗ | ✓ | ✗ |
| `GET /api/session/*` | ✗ | ✓ | ✗ |
| `POST /api/initiative/:id/approve\|cancel\|amend` | ✗ | ✓ | ✗ |
| `POST /api/initiative/:id/cosign` | ✗ | ✗ | ✓ |
| `POST /api/closure/*` | ✗ | ✓ | ✗ |
| `POST /api/lesson/:id/validate` | ✗ | ✓ | ✗ |
| `POST /api/detector/scan` | ✗ | ✓ | ✗ |
| `GET /api/analytics/*` | ✗ | ✓ | ✓ |
| `GET /api/initiatives/pending_cosign` | ✗ | ✓ | ✓ |

All endpoints use uniform `ErrorResponse` shape on errors. All paginated endpoints support `?page=&page_size=&since=`.

### 14.2 Floor-Lens (Operator, mobile) — minimal scope

```
POST   /api/signal/ingest                     → { signal_id, status: 'received' }
GET    /api/signals/mine?limit=20             → { data: SignalCard[], pagination: PaginationMeta }
GET    /api/signal/:id                        → single signal detail (own signals only)
GET    /api/signal/:id/stream (SSE)           → events: signal.attached | incident.status_change | resolution.available
```

Exposure level: `received | in_progress | resolved` enum + short `resolution_summary` at close. Operator does not see incident investigation details.

### 14.3 Engineer-Lens (Quality, desktop) — complete scope

```
GET    /api/incidents?status=&severity=&archetype=&product_id=&window=&q=&page=&since=
GET    /api/incident/:id                      → full payload: signals[], sessions[], reports[], initiatives[], linked_lessons[], closure_checks[]
POST   /api/incident/:id/investigate          → 202 + { session_id }
POST   /api/incident/:id/dismiss              → body: { reason }
POST   /api/incident/:id/promote              → promote provisional incident (engineer hint or accept)

GET    /api/session/:id?since=:seq            → turn history
GET    /api/session/:id/stream?since=:seq (SSE) → live + replay
POST   /api/session/:id/hint                  → body: { text }
POST   /api/session/:id/cancel                → status='cancelled'

POST   /api/initiative/:id/approve            → body: { edits?, patience_days? } → dispatches
POST   /api/initiative/:id/cancel
POST   /api/initiative/:id/amend              → opens new session with context

POST   /api/closure/check/:initiative_id      → manual re-eval

GET    /api/lessons?validated=pending&page=   → pending lesson queue
GET    /api/lesson/:id                        → detail
POST   /api/lesson/:id/validate               → body: { decision: 'approved'|'rejected', edits? }
POST   /api/lesson/:id/supersede              → body: { new_lesson_id }

POST   /api/detector/scan                     → manual detector run
```

### 14.4 Leadership-Lens (Analytics, scaffold scope)

```
GET    /api/analytics/kpi?window=                   → { open_incidents, closed_this_week, avg_time_to_close, impact_sum, lesson_count }
GET    /api/analytics/archetypes?window=            → time-series distribution (for Recharts)
GET    /api/analytics/products/top?by=&window=      → top-N products
GET    /api/analytics/impact?window=                → aggregated impact_measurement
```

Read-only. Server-side enforces via RBAC: Leadership role gets 403 on any POST/PATCH/DELETE outside `/api/analytics/*`. Polling every 30s on focus.

### 14.5 Shared contracts (Zod)

All in `schemas/api-responses.ts`:

```ts
SignalCard, IncidentCard, SessionCard, InitiativeCard, LessonCard,
ReportSection, ClosureCheckCard, EvidenceRef, SessionEventEnvelope,
PaginationMeta, ErrorResponse
```

`ErrorResponse`:
```ts
{ code: string; message: string; details?: jsonb; retryable: boolean }
```

`SessionEventEnvelope` (SSE):
```ts
{ seq: number; event: string; ts: string; session_id: string; payload: jsonb }
```

---

## 15. Error Paths · Retry Budgets · Observability

### 15.1 Failure-mode matrix

| # | Failure | Detection | Default Action | Retry Budget |
|---|---|---|---|---|
| 1 | Max-turns (8) exceeded | Turn counter ≥8 | `status='stalled'`; surface partial findings via Compose with what we have | 0 |
| 2 | Stall-loop (same tool+input 2× in a row) | Deterministic hash dedupe (canonical JSON) | Abort current turn; `request_hint` path | 0 |
| 3 | Evidence-cite unfixable | Post-validator after 1 retry | `status='stalled'`, `failure_reason='evidence_cite_unfixable'`; parallel stall-UX | 1 |
| 4 | Tool call error | Tool wrapper returns error | LLM sees error; after 2 consecutive same-tool errors → force skip | 2 per tool |
| 5 | Anthropic API error (429/500/529) | SDK throws | Exponential backoff (1s, 3s, 9s) | 3 with jitter |
| 6 | Model refusal | `stop_reason=refusal` | Log; `status='failed'`, `failure_reason='model_refusal'` | 0 |
| 7 | Context overflow | Pre-call token counter > 190k | Haiku-summarize old turns to ~500 tokens; light trim on > 4KB tool outputs first | 1 (compress-retry) |
| 8 | Concurrent session on same incident | Unique partial index violation | Return 409 Conflict | N/A |
| 9 | Dispatch failure | Adapter returns not-ok | 1 retry with 30s backoff; then `initiative.status='failed'` + amend | 1 |
| 10 | Closure eval error | Predicate evaluator throws | `initiative_check.result='error'`; consecutive counter | 3 consecutive before escalate |
| 11 | Embedding API error | OpenAI SDK throws | Retry 2×; fallback: deterministic-only correlator + signal persisted with `embedding=null`, `cluster_state='pending_cluster'`; **embedding-recovery sweep (§3.5) re-embeds + re-correlates on API recovery** | 2 + fallback + deferred re-embed |
| 12 | DB deadlock / write conflict | Postgres 40001/40P01 | Retry 3× with 100ms jitter; then 503 | 3 |
| 13 | SSE disconnect / resume gaps | Client reconnect with `Last-Event-ID` | Server replays from `session_event` where `seq > last_event_id` | N/A |
| 14 | Orchestrator crash mid-turn | Watchdog: `status='running' AND max(session_event.ts) < now()-5min` | Auto-mark failed; `reason='orchestrator_crash'` | N/A |
| 15 | Ingest / dispatch idempotency | Idempotency key collision | Return existing resource (no duplicate) | N/A |
| 16 | Cron race / double-evaluation | `FOR UPDATE SKIP LOCKED` + `UNIQUE(initiative_id, checked_at)` | Idempotent no-op if duplicate | N/A |
| 17 | Whisper / Vision / Storage failures | SDK throws or returns empty | Whisper fail → user-text fallback; Vision fail → `vision_out=null`; Storage fail → client 3 retries then reject | 3 (storage) / 1 (ML) |
| 18 | pgvector unavailable | Embedding knn query throws | Correlator falls to deterministic-only; UI "degraded mode" badge; on recovery, pending-cluster sweep re-runs semantic phase | N/A |
| 19 | Partial write failures | Transaction coupling enforces atomicity | Rollback; retry whole transaction | 1 |

### 15.2 Session status transitions

```
running → succeeded | failed | stalled | cancelled
stalled → running (on hint) | failed (hint-timeout) | cancelled (engineer dismiss)
```

### 15.3 `failure_reason` enum

```ts
type FailureReason =
  | 'max_turns'
  | 'stall_loop'
  | 'evidence_cite_unfixable'
  | 'model_refusal'
  | 'context_overflow'
  | 'api_error_exhausted'
  | 'tool_errors_exhausted'
  | 'aborted_by_user'
  | 'orchestrator_crash'
  | 'semantic_validator_failed';
```

### 15.4 Observability

```ts
pipeline_error_log {                      -- append-only, all non-fatal errors
  id, occurred_at,
  session_id?, incident_id?, initiative_id?,
  phase: 'classify'|'investigate'|'compose'|'propose'|'correlator'|'closure'|'dispatcher'|'detector'|'ingest',
  category: 'model_api'|'tool'|'db'|'validation'|'dispatch'|'embedding'|'storage'|'other',
  code, message,
  details: jsonb,
  recovered: bool,
  retry_count: int
}
```

- Dev mode: errors stream to console + browser devtools (SSE `error` event)
- Demo mode: errors persisted; UI badge shows count of recent errors per session
- Circuit breaker on Anthropic API: 3 consecutive 429/500 → 60s cooldown, new Investigate requests 503
- Dead-letter flag on closure-monitor: 3 consecutive eval errors → `closure_monitor_paused` + engineer alert

---

## 16. Dev Environment

### 16.1 Stack

- Node ≥ 20, pnpm ≥ 9
- Next.js 15.0+ App Router, TypeScript `strict: true`
- Tailwind 3.x, shadcn/ui
- Supabase CLI (local Postgres in Docker)
- Anthropic SDK, OpenAI SDK, Vercel AI SDK
- Vitest (unit + integration + golden)

### 16.2 Folder tree

```
app/
  (lens)/
    floor/                                  # operator lens (mobile)
    engineer/                               # quality lens (primary)
    leadership/                             # analytics scaffold
    layout.tsx
  api/
    signal/
      ingest/route.ts
      [id]/route.ts
      [id]/stream/route.ts
    incident/
      [id]/route.ts
      [id]/investigate/route.ts
      [id]/dismiss/route.ts
      [id]/promote/route.ts
    incidents/route.ts                      # list
    session/
      [id]/route.ts
      [id]/stream/route.ts
      [id]/hint/route.ts
      [id]/cancel/route.ts
    initiative/
      [id]/approve/route.ts
      [id]/cancel/route.ts
      [id]/amend/route.ts
    closure/
      check/[id]/route.ts
    lesson/
      [id]/validate/route.ts
      [id]/supersede/route.ts
    lessons/route.ts
    detector/
      scan/route.ts
    analytics/
      kpi/route.ts
      archetypes/route.ts
      products/top/route.ts
      impact/route.ts

server/                                     # server-only
  agent/
    orchestrator.ts
    phases/
      classify.ts
      investigate.ts
      compose.ts
      propose.ts
    stall-detector.ts
    evidence-validator.ts
    context-manager.ts                      # haiku-summarize on overflow
  tools/
    signal-incident/
    retrieval/
    cross-boundary/
    semantic-vision-lessons/
    simulation/
    write-gated/
    index.ts                                # registry + Zod registration
  prompts/
    system/
    phase/
    playbooks/
    generated/                              # git-committed .ts (compiled by scripts/prompts-build.ts)
  models/
    anthropic.ts                            # wrapped client: caching + retry + circuit breaker
    openai.ts                               # embeddings + whisper only
    budget.ts                               # token counter + cost tracker
  detector/
    spc-rules.ts
    triage.ts
    runner.ts
  correlator/
    signal-to-incident.ts
    idempotency.ts
    canonical-hash.ts
  closure-monitor/
    evaluator.ts
    predicates/
      metric-below.ts
      count-stayed.ts
      composite.ts
      external-stub.ts
    runner.ts
    escalator.ts
  dispatcher/
    adapters/
      manex-native.ts
      email-stub.ts
      slack-stub.ts
      supplier-portal-stub.ts                # placeholder → not_implemented
      plm-stub.ts                            # placeholder → not_implemented
      index.ts
    idempotency.ts
  db/
    client.ts                               # Supabase singleton
    queries/                                # typed helpers (no free-form SQL)
  sse/
    event-bus.ts                            # EventEmitter singleton
    stream.ts                               # SSE helpers + heartbeat
  auth/
    demo-user.ts
    guards.ts
    rbac-matrix.ts
  worker/
    index.ts                                # durable worker entry; registers all cron handlers
    handlers/
      investigate.ts                        # runs orchestrator for a session
      detector-scan.ts                      # SPC detector cron (§2.3)
      closure-sweep.ts                      # 60s closure-monitor cron (§12)
      emit-lesson.ts                        # on incident close (§11.2)
      backfill-seed.ts                      # one-shot wrapper (§2.5 Mode 1)
      backfill-incremental.ts               # watermark-based cron (§2.5 Mode 2)
      embedding-recovery.ts                 # re-embed + re-correlate sweep (§3.5)
      pending-cluster-sweep.ts              # promote / expire pending signals (§5.1)
      amend.ts                              # opens new session on reopen
  contributions/
    tools/
      central-quality.ts                    # contrib_central_quality
      plant-quality.ts                      # contrib_plant_quality
      supplier-quality.ts                   # contrib_supplier_quality
    stubs.ts                                # 6 stub placeholder inserters
    registry.ts                             # 9-domain registry + per-domain availability flag

schemas/                                    # Zod schemas (shared client+server)
  signal.ts
  incident.ts
  contribution.ts                           # (§4.3)
  session.ts
  report.ts                                 # (§7.5)
  initiative.ts
  dispatch.ts                               # ActionTemplate discriminated union + DispatchAttempt
  impact.ts                                 # impact_measurement (§12.7)
  lesson.ts
  closure.ts
  backfill.ts                               # BackfillWatermark + source-row-to-signal mappers
  tool-io.ts
  api-responses.ts

components/                                 # Lila/Harsh ownership; Joscha places stubs
  ui/                                       # shadcn generated
  cards/
    SignalCard.tsx
    IncidentCard.tsx
    LessonCard.tsx
    InitiativeCard.tsx
    ClosureCheckCard.tsx
    ContributionCard.tsx                    # (§4.3, greyed if status='unavailable')
    ReportCard.tsx                          # (§7.5, 8D panel)
    ImpactMeasurementCard.tsx               # (§12.7, for leadership dashboard)
  evidence/
    EvidenceCitation.tsx
  session/
    LiveTranscript.tsx
  lens/
    floor/
    engineer/
    leadership/

lib/
  cn.ts
  date.ts
  id-prefixes.ts
  stable-stringify.ts                       # canonical JSON for hashes

supabase/
  migrations/
    00001_create_schema.sql                 # Manex, untouched
    00002_create_views.sql                  # Manex, untouched
    00003_resolve_signal_incident.sql         # signal + incident + incident_signal (join) + audit indexes
    00004_resolve_contribution.sql             # contribution table (§4.3)
    00005_resolve_session_events.sql           # session + session_turn + session_event (§6)
    00006_resolve_report.sql                   # report table (§7.5)
    00007_resolve_initiative_closure.sql       # initiative + initiative_check + dispatch_attempt + impact_measurement (§12, §13)
    00008_resolve_lesson.sql                   # lesson + lesson_usage (§11)
    00009_resolve_backfill.sql                 # backfill_watermark (§2.5)
    00010_resolve_pipeline_error_log.sql       # pipeline_error_log (§15.4)
    00011_resolve_pgvector_indexes.sql         # all vector indexes (ivfflat on signal.embedding, incident.centroid_embedding, lesson.embedding)
    00012_resolve_seed_demo_lessons.sql        # 3 pre-approved demo lessons (§11.5)
  seed.sql                                  # Manex, untouched

scripts/
  seed-demo.ts                              # post-reset seeding of lessons + demo incidents
  prompts-build.ts

tests/
  unit/
  integration/
  fixtures/
  golden/

.env.local.example
planning/                                   # existing
docs/                                       # existing (Manex)
```

### 16.3 Env vars (`.env.local.example`)

```bash
# DB
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=resolve-attachments

# LLM
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Config
APP_ENV=dev
LOG_LEVEL=info
ANTHROPIC_CACHE_TTL=300
INVESTIGATE_MAX_TURNS=8

# Correlator
CORRELATOR_DET_PROD_DEF_DAYS=14
CORRELATOR_DET_SEC_DEF_DAYS=3
CORRELATOR_DET_RULE_DAYS=7
CORRELATOR_COSINE_STRUCTURED=0.82
CORRELATOR_COSINE_FREETEXT=0.90
CORRELATOR_SEMANTIC_WINDOW_INTERNAL_DAYS=30
CORRELATOR_SEMANTIC_WINDOW_EXTERNAL_DAYS=60
CORRELATOR_CLUSTER_WINDOW_DAYS=7
CORRELATOR_PENDING_SWEEP_INTERVAL_SEC=300

# Crons
CLOSURE_CRON_INTERVAL_SEC=60
DETECTOR_CRON_INTERVAL_SEC=60
BACKFILL_CRON_INTERVAL_SEC=120
BACKFILL_CRON_ENABLED=true                          # set to false during live demo
EMBEDDING_RECOVERY_INTERVAL_SEC=60
EMBEDDING_RECOVERY_ENABLED=true

# Auth
DEMO_USER_HEADER=X-Demo-User
```

### 16.4 Package scripts

```json
{
  "dev": "concurrently \"next dev\" \"pnpm worker:dev\"",
  "db:up": "supabase start",
  "db:down": "supabase stop",
  "db:reset": "supabase db reset",
  "db:migrate": "supabase db push",
  "db:seed:demo": "tsx scripts/seed-demo.ts",
  "backfill:seed": "tsx scripts/backfill-signals.ts",
  "worker:dev": "tsx watch server/worker/index.ts",
  "prompts:build": "tsx scripts/prompts-build.ts",
  "prompts:check": "tsx scripts/prompts-build.ts --check",
  "build": "pnpm prompts:build && next build",
  "start": "next start",
  "test": "vitest",
  "test:integration": "vitest --config vitest.integration.config.ts",
  "test:golden": "vitest run tests/golden",
  "typecheck": "tsc --noEmit",
  "lint": "next lint"
}
```

Bootstrap flow for any team-member:
1. `pnpm install`
2. `pnpm db:up` (one-time per session)
3. `pnpm db:reset` (loads migrations 00001-00012 + seed.sql)
4. `pnpm db:seed:demo` (adds 3 pre-approved demo lessons)
5. `pnpm backfill:seed` (ingests Manex defect/field_claim/marginal-test rows as signals, correlator clusters them into 4 demo incidents)
6. `pnpm dev` (Next.js + worker; detector + embedding-recovery + pending-cluster-sweep crons active; backfill cron toggled by env)

### 16.5 Testing

- **Unit (vitest):** Pure functions — Zod schemas, canonical-hash, stall-detector, cite-parser, predicate-evaluators
- **Integration (vitest + real local Postgres):** Correlator, closure-monitor, detector rules, tool implementations. Each integration suite resets DB first.
- **Golden (vitest):** One end-to-end test per demo story. Seeded DB → trigger incident → run orchestrator → snapshot `session_turns[]` + `report_8d` + `initiatives[]`. VCR-recorded Anthropic responses (replay, don't hit API in CI).
- **No mocks for semantic layer** (per CLAUDE.md convention).

---

## 17. Open Questions (for Implementation Plan)

These are deferred to the implementation-plan phase, not resolved in this spec:

1. **M1 sequencing** — schemas-first vs. E2E-spike-first? Informs team parallelization.
2. **Harjot / Joscha interface for pgvector** — mocking path if Harjot's migrations slip.
3. **Tool implementation ownership** — Harsh owns tool-layer implementations; which tools ship in M1 as stubs vs. functional?
4. **Lila's component contracts** — which shared cards ship as stubs in M1 so API+UI can integrate early?
5. **VCR infrastructure for Anthropic** — library choice, replay cadence in CI.
6. **Cost ceiling per session** — hard cutoff ($X) or soft warning only?
7. **Supabase Storage setup** — real bucket vs. local filesystem for 24h demo attachments.
8. **Prompts-generated commit cadence** — every commit, or only on .md change (pre-commit hook lint)?
9. **Backfill chunk size + ordering** — ingest defect rows first (factory events) vs. field_claim first (external voices)? Affects which stories surface first in UI.
10. **Contribution refresh cost** — `POST /api/incident/:id/contribution/refresh` re-runs 3 functional domain tools. Rate-limit to once per 10min per incident or allow unlimited (engineer-triggered only)?
11. **Impact-measurement baseline window** — `impact_measurement.baseline_value` is computed pre-dispatch. What fixed window (7d / 14d / 30d)? Depends on metric type.
12. **Pending-cluster promotion rule** — when a 2nd pending signal arrives, does the promoted incident inherit the earlier or later signal's `severity`/`archetype`? Proposal: `max(severity)`, `archetype='unknown'` until Classify runs.
13. **Demo fixtures for 2 non-primary stories (2, 4)** — ship as seeded signals only, or seed full pipeline through closure (so Leadership dashboard has historical impact_measurement rows)?

---

## 18. References

- [planning/ARCHITECTURE.md](../ARCHITECTURE.md) — architectural foundation
- [planning/visualizations/architecture.html](../visualizations/architecture.html) — engineering dashboard
- [planning/visualizations/llm-architecture.html](../visualizations/llm-architecture.html) — LLM pipeline deep-dive
- [CLAUDE.md](../../CLAUDE.md) — AI-agent conventions for this repo
- [docs/DATA_PATTERNS.md](../../docs/DATA_PATTERNS.md) — the four seeded data stories

---

*End of spec. Next step: implementation plan via `superpowers:writing-plans`.*
