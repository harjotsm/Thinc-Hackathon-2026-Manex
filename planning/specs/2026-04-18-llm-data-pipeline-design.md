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
- Tool layer (18 tools, Zod-typed), models and routing
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
- CUSUM / EWMA on `rework.duration_minutes` per `(product_id, section)`
- Rate-shift on marginal-fail fraction per `test_step` (week-over-week)
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

---

## 3. Signal Schema · Lifecycle

### 3.1 Schema

```ts
signal {
  id: "SIG-xxxxx"                                   // Manex-convention prefix
  created_at: timestamptz
  source: 'operator' | 'engineer' | 'detector' | 'customer_email'
  source_ref: text | null                           // e.g. "defect:DEF-0042", "email:msg-id"
  raw_text: text                                    // always present; detector emits rule-name + summary
  lang: 'de' | 'en'                                 // langdetect at ingest
  embedding: vector(1536)                           // OpenAI text-embedding-3-small
  attachments: jsonb                                // [{kind:'image'|'audio', url, vision_out?, transcript?, status}]
  product_id: text | null
  station: text | null
  section: text | null
  shift: 'early' | 'late' | 'night' | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  triage: jsonb | null                              // {real:bool, reasoning:string, score:number}
  incident_id: text | null                          // set by correlator (nullable at ingest)
  created_by_user_id: text | null
  detector_rule: text | null                        // only when source='detector'
  detector_evidence: jsonb | null
  idempotency_key: text                             // hash(raw_text + source_ref + created_by + minute_bucket)
  // Audit (correlator results)
  match_type: 'det_prod_def'|'det_sta_def'|'det_rule'|'sem'|'new'|null
  match_score: float | null
  attach_reason: text | null
  matched_incident_id: text | null                  // same as incident_id but explicit for audit chain
}
UNIQUE(idempotency_key)
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

---

## 4. Incident Schema · Status Machine

```ts
incident {
  id: "INC-xxxxx"
  created_at
  archetype: 'supplier' | 'drift' | 'design' | 'operator' | 'unknown'    // set by Classify; 'unknown' initially
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'triage' | 'reasoning' | 'resolving' | 'closed' | 'dismissed'
  title: text                                                            // composed from signals (human-readable)
  summary: text                                                          // running summary, updated per session
  linked_product_ids: text[]                                             // denormalized from signals
  centroid_embedding: vector(1536)                                       // mean of attached signals' embeddings; recomputed on attach
  signal_count: int                                                      // denormalized
  last_activity_at
  closed_at | dismissed_at
  dismiss_reason: text | null
  is_provisional: bool                                                   // true when created from customer-mail without product_id
}
```

### 4.1 Status transitions

```
triage → reasoning (on investigate start)
triage → dismissed (manual, engineer marks false positive)
reasoning → resolving (on initiatives approved + dispatched)
reasoning → triage (on stall without resolution; engineer re-triages)
resolving → closed (all initiatives closed by monitor)
resolving → reasoning (on initiative failed; amend flow opens new session)
closed → reasoning (reopened manually by engineer; rare)
```

### 4.2 Provisional incidents

Customer-email signals without `product_id` and below the strict semantic threshold (0.90 with secondary evidence) create incidents with `is_provisional=true`. These are:

- Visible in engineer inbox with a "Provisional" badge
- Investigate cannot run until engineer promotes them (via UI action that asks for product_id hint or dismisses)
- Promotes by setting `is_provisional=false` after engineer confirms identification

---

## 5. Correlator (Signal → Incident)

### 5.1 Algorithm (layered)

For each new signal:

**Phase 1 — Deterministic joins** (SQL, fast):

| Match type | Condition | Time window |
|---|---|---|
| `det_prod_def` | `(product_id, defect_code)` match on open incident | **14d** |
| `det_sta_def` | `(station, defect_code)` match | **3d** |
| `det_rule` | `source='detector'` + same `detector_rule` + same `product_id` | **7d** |

Candidates collected across all three rules; pick highest-specificity match (prod_def > sta_def > rule) with most recent `last_activity_at` as tiebreaker.

**Phase 2 — Semantic fallback** (pgvector, runs only if Phase 1 empty):

- Compute `cosine(signal.embedding, incident.centroid_embedding)` for open incidents within the semantic window.
- Window: **30d** for internal signals (source operator/engineer/detector), **60d** for external signals (source customer_email) — longer window for external because Story 3 field-drift lags 8-12 weeks.
- Threshold: **0.82–0.85** when signal has structured fields (product_id or part_number present), **≥0.90** for pure free-text signals (no structured identifiers).
- For customer-mail without product_id: require threshold ≥0.90 AND secondary evidence (reported_part_number mentioned in raw_text OR article_number). Without secondary evidence → create provisional incident.

**Phase 3 — New incident**:

- If no attach: create incident with `archetype='unknown'`, `status='triage'`, `severity = max('medium', signal.severity)`, `centroid_embedding = signal.embedding`, `signal_count = 1`.

### 5.2 Priority rules when multiple incidents match

1. Deterministic ranks higher than semantic
2. Within same tier: higher match_score first
3. Tiebreak: most recent `last_activity_at`

### 5.3 On attach

- Transactional: `BEGIN; UPDATE signal SET incident_id=?, match_type=?, match_score=?, attach_reason=?; UPDATE incident SET signal_count=signal_count+1, centroid_embedding=<recompute>, severity=GREATEST(severity, ?), last_activity_at=now(); COMMIT;`
- Row-lock `FOR UPDATE` on the target incident to prevent race conditions when two signals concurrently attach to the same incident.

### 5.4 Audit chain

Every signal carries `match_type`, `match_score`, `attach_reason`, `matched_incident_id` for post-hoc debuggability. No separate `attach_event` table — fields live on `signal`.

### 5.5 Tunable parameters (via env)

```bash
CORRELATOR_DET_PROD_DEF_DAYS=14
CORRELATOR_DET_STA_DEF_DAYS=3
CORRELATOR_DET_RULE_DAYS=7
CORRELATOR_COSINE_STRUCTURED=0.82
CORRELATOR_COSINE_FREETEXT=0.90
CORRELATOR_SEMANTIC_WINDOW_INTERNAL_DAYS=30
CORRELATOR_SEMANTIC_WINDOW_EXTERNAL_DAYS=60
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
    → 8D D1-D8 + visualizations spec
  Propose (Sonnet)
    ← root_causes + archetype + domain-agent-registry
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

18 tools across 6 groups. All defined as Zod schemas in `schemas/tool-io.ts`, implementations in `server/tools/<group>/<name>.ts`, registered in `server/tools/index.ts`.

### 9.1 Groups + tools

**Signal & Incident (read):**
- `get_incident(incident_id)` → full incident with signals, centroid, status, linked products
- `list_signals_for_incident(incident_id, limit?)` → signals list with text + attachments preview
- `find_related_incidents(incident_id, window_days?)` → pgvector knn on centroid

**Retrieval (structured SQL, read):**
- `query_defects(filters: { product_id?, defect_code?, station?, date_from?, date_to?, limit? })` → defect rows
- `trace_batch(batch_id | supplier_batch_id)` → suppliers + products + defects along a batch
- `bom_parts_for_product(product_id)` → BOM explosion
- `pareto_defect_codes(filters)` → sorted distribution of defect_codes
- `test_results_marginal(filters)` → marginal test results

**Cross-boundary (composite queries):**
- `field_vs_factory_gap(product_id, window_days?)` → compares customer complaints vs factory defect rate
- `operator_effect_analysis(user_id | station, window_days?)` → defect/rework rates per operator
- `rework_timeline_by_section(product_id, window_days?)` → time-series of rework durations per section
- `weekly_quality_summary(window_weeks?)` → aggregated KPIs per week

**Semantic / Vision / Lessons:**
- `semantic_search_signals(query_text, filters?, top_k=10)` → pgvector knn on signal embeddings
- `retrieve_lessons(incident_signature_text, top_k=3)` → pgvector knn on `lesson.embedding` WHERE `validated='approved' AND superseded_by IS NULL`; weighted by `cosine × (1 + 0.2 × log(1+usage_count)) × recency_decay(half_life=180d)`
- `classify_defect_image(image_url)` → vision classifier output for a signal attachment

**Simulation:**
- `simulate_impact(initiative_template, incident_context)` → rule-based prior + lesson similarity → `{expected_defect_reduction, confidence, horizon_days, methodology_note}`. **Required citation source for `initiative.impact_estimate`.**

**Write-gated (callable only by approve-endpoint / closure-monitor / compose-lesson, NEVER by Investigate loop):**
- `create_initiative(incident_id, template, predicate, impact_estimate)` — dispatcher calls this on approve
- `register_closure_predicate(initiative_id, predicate)` — part of create_initiative transaction
- `emit_lesson(source_session_id, draft)` — closure_monitor calls on incident close

### 9.2 Tool I/O schemas

Every tool has:

```ts
// schemas/tool-io.ts
export const QueryDefectsInput = z.object({
  product_id: z.string().optional(),
  defect_code: z.string().optional(),
  station: z.string().optional(),
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
  triggers: jsonb                                  // {defect_codes:[], product_ids:[], detector_rules:[], station_patterns:[]}
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

Three pre-approved lessons seeded in migration `00008_resolve_seed_demo_lessons.sql` with `seed_source='demo'`:

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
2. `result='passed'` → `initiative.status='closed'`, `closed_at=now()`, emit `initiative.closed` event
3. `result='failed'` → `initiative.status='failed'`, emit `initiative.failed` event, engineer notification (semi-auto amend-flow)
4. `result='pending' AND now() > patience_until` → engineer notification "stale initiative", status unchanged
5. `result='error'` → `initiative_check.result='error'` logged, `consecutive_error_count++`. On 3 consecutive errors → flag `closure_monitor_paused` + engineer alert. Any non-error check resets counter.
6. If all initiatives of an incident are `closed`:
   - `incident.status='closed'`
   - Trigger `compose_lesson` (writes lesson with engineer_validated per §11.2)
7. If any initiative is `failed`:
   - Incident stays in `resolving`
   - Semi-auto amend-flow: notification + 1-click "Amend?" button → opens new session with context `{reason: 'previous_initiative_failed', original: INI-xxxxx}`

### 12.5 Concurrency

- Workers use `SELECT ... FOR UPDATE SKIP LOCKED` on the initiative batch
- `UNIQUE(initiative_id, checked_at)` on `initiative_check` prevents double-record from concurrent workers
- Idempotent write-path: if row already exists, abort with no-op

### 12.6 Patience window

- Proposed by LLM during Propose phase based on archetype (supplier=14d, drift=7d, design=60d, operator=3d)
- Engineer confirms / edits in approve dialog before dispatch
- Stored as absolute `patience_until = dispatched_at + patience_days`

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

### 13.5 Dispatch flow (transactional, no intermediate state)

```sql
BEGIN;
  SELECT ... FROM initiative WHERE id=? AND status='approved' FOR UPDATE;
  -- adapter runs, performs target write or returns error
  -- on success:
  UPDATE initiative SET status='dispatched', target_ref=?, product_action_id=?, dispatched_at=now() WHERE id=?;
  INSERT INTO dispatch_attempt (initiative_id, attempt_index, target_system, kind, payload, status, idempotency_key, ...) VALUES (...);
  -- on failure:
  -- UPDATE initiative SET status='failed', failure_reason=? WHERE id=?;
  -- INSERT INTO dispatch_attempt (... status='failed' ...);
COMMIT;
```

Status transitions strictly: `proposed → approved → dispatched | failed | cancelled`. No `dispatching` intermediate (transaction provides atomicity).

### 13.6 Idempotency

```sql
CREATE UNIQUE INDEX ON dispatch_attempt (idempotency_key);
```

`dispatch_idempotency_key` generated at Propose phase (hash of initiative-id + template-hash + patience_until). Prevents double-dispatch on retry.

### 13.7 Retry policy

On first failure: 1 retry with 30s backoff. Next attempt inserts new `dispatch_attempt` row with `attempt_index = previous + 1`. After failed retry: initiative goes to `status='failed'`, amend-flow engaged.

### 13.8 Cancellation

- Engineer cancels `approved` initiative: set `status='cancelled'`, never dispatched.
- Engineer cancels `dispatched` initiative on stub: `status='cancelled'` + append `dispatch_attempt` row with status='cancelled' (append-only, shows full timeline).
- Engineer cancels `dispatched` initiative on `manex_native`: `initiative.status='cancelled'` but `product_action` remains (Manex rule: no deletes on product_action). Engineer must cancel in Manex UI separately.

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
| `GET /api/incident/*` | ✗ | ✓ | ✗ |
| `POST /api/incident/:id/investigate` | ✗ | ✓ | ✗ |
| `GET /api/session/*` | ✗ | ✓ | ✗ |
| `POST /api/initiative/:id/*` | ✗ | ✓ | ✗ |
| `POST /api/closure/*` | ✗ | ✓ | ✗ |
| `POST /api/lesson/:id/validate` | ✗ | ✓ | ✗ |
| `POST /api/detector/scan` | ✗ | ✓ | ✗ |
| `GET /api/analytics/*` | ✗ | ✓ | ✓ |

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
| 11 | Embedding API error | OpenAI SDK throws | Retry 2×; fallback: deterministic-only correlator | 2 + fallback |
| 12 | DB deadlock / write conflict | Postgres 40001/40P01 | Retry 3× with 100ms jitter; then 503 | 3 |
| 13 | SSE disconnect / resume gaps | Client reconnect with `Last-Event-ID` | Server replays from `session_event` where `seq > last_event_id` | N/A |
| 14 | Orchestrator crash mid-turn | Watchdog: `status='running' AND max(session_event.ts) < now()-5min` | Auto-mark failed; `reason='orchestrator_crash'` | N/A |
| 15 | Ingest / dispatch idempotency | Idempotency key collision | Return existing resource (no duplicate) | N/A |
| 16 | Cron race / double-evaluation | `FOR UPDATE SKIP LOCKED` + `UNIQUE(initiative_id, checked_at)` | Idempotent no-op if duplicate | N/A |
| 17 | Whisper / Vision / Storage failures | SDK throws or returns empty | Whisper fail → user-text fallback; Vision fail → `vision_out=null`; Storage fail → client 3 retries then reject | 3 (storage) / 1 (ML) |
| 18 | pgvector unavailable | Embedding query fails | Correlator falls to deterministic-only; UI "degraded mode" badge | N/A |
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
    index.ts                                # durable worker entry
    handlers/
      investigate.ts
      detector-scan.ts
      closure-sweep.ts
      compose-lesson.ts

schemas/                                    # Zod schemas (shared client+server)
  signal.ts
  incident.ts
  session.ts
  initiative.ts
  lesson.ts
  closure.ts
  action-templates.ts
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
    00003_resolve_signal_incident.sql
    00004_resolve_session_events.sql
    00005_resolve_initiative_closure.sql
    00006_resolve_lesson.sql
    00007_resolve_pgvector_indexes.sql
    00008_resolve_seed_demo_lessons.sql
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
CORRELATOR_DET_PROD_DEF_DAYS=14
CORRELATOR_DET_STA_DEF_DAYS=3
CORRELATOR_DET_RULE_DAYS=7
CORRELATOR_COSINE_STRUCTURED=0.82
CORRELATOR_COSINE_FREETEXT=0.90
CORRELATOR_SEMANTIC_WINDOW_INTERNAL_DAYS=30
CORRELATOR_SEMANTIC_WINDOW_EXTERNAL_DAYS=60
CLOSURE_CRON_INTERVAL_SEC=60
DETECTOR_CRON_INTERVAL_SEC=60
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
3. `pnpm db:reset` (loads migrations 00001-00008 + seed.sql)
4. `pnpm db:seed:demo` (adds Resolve demo data)
5. `pnpm dev` (Next.js + worker)

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

---

## 18. References

- [planning/ARCHITECTURE.md](../ARCHITECTURE.md) — architectural foundation
- [planning/visualizations/architecture.html](../visualizations/architecture.html) — engineering dashboard
- [planning/visualizations/llm-architecture.html](../visualizations/llm-architecture.html) — LLM pipeline deep-dive
- [CLAUDE.md](../../CLAUDE.md) — AI-agent conventions for this repo
- [docs/DATA_PATTERNS.md](../../docs/DATA_PATTERNS.md) — the four seeded data stories

---

*End of spec. Next step: implementation plan via `superpowers:writing-plans`.*
