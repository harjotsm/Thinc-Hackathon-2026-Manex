# Resolve — Manex's Closed-Loop Quality Intelligence Layer

**Working name:** Resolve
**Tagline:** *"Every voice becomes an initiative."*

This document is the single source of truth for the architecture. It is the
merge of our team's two parallel proposals, adapted to the committed stack
(Next.js + TypeScript) and scoped to 24h.

---

## 0. The core insight

Manex's slide 2 says the real problem isn't "engineers hate Excel." It is that
**quality signals arrive from nine stakeholder domains and twelve data silos,
and none of them talk to each other.** Slide 3 names Manex's own answer:
*"Each customer voice is assigned an initiative that is semi-automatically
implemented by agents in development, supplier management, marketing,
production, etc."* Slide 8 draws a line: *"Challenge the process itself. Do not
just digitize what exists."*

So the win condition is: **build the connective tissue that turns any incoming
signal — wild production or customer voice — into a routed, tracked, measurable
initiative, and let 8D/FMEA fall out as side effects.** The report becomes a
byproduct of the workflow, not the workflow itself.

---

## 1. Three Acts (not three pillars)

The Manex brief names three pillars — Generation, Visualization, Closed-Loop.
The strategic framing that actually challenges the process is:

**LISTEN → REASON → RESOLVE**

| Act | What it does | Manex pain point it answers (slide 2) |
|---|---|---|
| **Listen** | Ingest signals from internal production and external customer voices; correlate into incidents | Customer voices get lost, market adaptations very slow |
| **Reason** | Multi-stakeholder canvas where nine domains contribute; AI drafts hypotheses grounded in the semantic model | Quality indicators lost due to high complexity |
| **Resolve** | Domain agents turn hypotheses into initiatives in each domain's system of record; impact measured and fed back | High FTE effort for the overall process |

The three pillars fall out: Generation lives inside Reason, Visualization *is*
the canvas itself, Closed-Loop is the full arc from Listen to Resolve and back.

---

## 2. Act I — LISTEN

Signals don't only come from field claims. They arrive from everywhere, and
**many of the most valuable ones are caught internally before a customer ever
complains.**

### 2.1 Signal sources

**Internal (wild production).** Worker voice (Whisper → text), end-of-line test
failures, statistical MES drift (Cpk erosion, SPC out-of-control, near-limit
clustering), supplier incoming-inspection anomalies, rework pattern
concentration on a user/order, maintenance overdue, FMEA-anticipated failures,
near-miss test results.

**External (customer voices).** Field claims, warranty/dealer tickets, NPS open
text, reviews and social posts, IoT telemetry from the installed base,
call-center transcripts.

### 2.2 The canonical `signal` record

Every source is normalized into one shape before any downstream work:

```ts
{
  signal_id, signal_type, source_system, captured_ts,
  product_ref?, part_ref?, section_ref?, batch_ref?,
  severity_hint,        // LLM-scored 0..1
  text_payload, raw_payload: JSONB,  // never lose the original
  embedding: vector(1536)
}
```

### 2.3 Signal Correlator (the hidden star)

Two passes, in order:

1. **Deterministic joins** — same product, part, batch, section, within a
   time window.
2. **Semantic clustering** — pgvector cosine similarity on `signal.embedding`,
   threshold-gated.

When ≥2 signals cluster with high confidence, an **Incident** is formed. This
is the key abstraction: a thing worth reasoning about. An incident may gather
signals from three weeks of field claims, two weeks of near-miss tests, and a
supplier inspection anomaly, all pointing at one latent defect. That is
exactly what Story 1 (supplier batch SB-00007) and Story 3 (thermal drift R33)
look like in the provided data.

**This alone beats every team that only reacts to one field claim at a time.**

---

## 3. Act II — REASON

### 3.1 The Incident Canvas (replaces the document)

A single workspace per incident:

- The **incident node** sits in the middle as a spatial anchor.
- Correlated **signals orbit** it (clickable, with raw payloads).
- A **Root-Cause Graph** (React Flow) shows the AI's hypothesis tree:
  branches for Material / Process / Design / Operator, each with supporting
  evidence nodes and confidence bars.
- A **Timeline** strip shows when signals arrived, when the build happened,
  when rework or field failure occurred.
- A **BOM traceability** panel drills from product → install → batch → supplier.
- A **Contribution stream** shows inputs from the nine stakeholder domains
  in real time.

### 3.2 Nine stakeholder-domain contributions

Each domain has a seat at the canvas. The AI fetches what it needs from each,
merges into a coherent problem statement and ranked hypotheses, but every
contribution is auditable and can be challenged individually.

| Domain | Contribution |
|---|---|
| Market Research | Customer-sentiment trend on the product family |
| Central Quality | Similar historical incidents, lessons learned |
| Plant Quality (indirect) | SPC context, Cpk trajectory, test distribution |
| Plant Quality (direct) | Defect history, rework patterns, operator logs |
| Process Planner | Affected routings, alternative process paths |
| Technology Planning | FMEA entries, design-review decisions |
| Supplier Quality | Supplier scorecards, batch certificates, incoming inspection |
| Business Analytics | Cost exposure, warranty accrual, recall risk |
| Marketing | Customer-facing messaging impact, communications guardrails |

Each contribution is a `contribution` record tied to the incident.

### 3.3 8D / FMEA / Ishikawa / Pareto are derived views

One toggle on the canvas renders:

- **8D view** — eight-discipline layout, fields auto-filled
- **FMEA view** — S × O × D table with RPN computed live
- **Ishikawa view** — fishbone auto-drawn from the root-cause graph
- **Pareto view** — sector/plant/article rollups

None of these *are* the report. They are projections of the canvas. PDF export
is a two-click side-effect.

### 3.4 Three lenses on the same canvas

| Lens | Primary user | What they see first |
|---|---|---|
| **Floor** | Foreman, line operator | One-question voice prompt + the three highest-confidence actions |
| **Engineer** | Junior/senior QE | Full canvas, graph, timeline, BOM, edit mode |
| **Leadership** | Plant director, central quality head | Pareto rollup, cost exposure, open-initiatives dashboard |

Same data model, different projections. The foreman never sees "LLM", "prompt",
or "8D". They see a button: *"Report something weird."*

### 3.5 How the AI reasons (engineering rigor)

Inside the Reason act, the AI loop is **orchestrated**, not free-form:

1. **Classify** (Haiku 4.5) — route the incident to an **archetype playbook**
   (Supplier / Drift / Design / Operator / unknown).
2. **Investigate** (Sonnet 4.6, bounded ReAct, max 8 turns) — tool calls over
   a **typed tool layer** (never free-form SQL). Evidence cached per session.
3. **Compose** (Sonnet 4.6) — fill the 8D projection and select visualizations.
   Noise-filter pre-emit by Haiku.
4. **Propose** (Sonnet 4.6) — 1..N initiative candidates with rationale,
   owner hint, deadline, closure predicate.

**Every claim in the report must cite a `tool_call_id`.** Post-validator
confirms each evidence ID exists in the call log. This is our single most
important anti-hallucination mechanism.

### 3.6 Archetype playbooks (few-shots, not hard-coded DAGs)

Prompt snippets in the system prompt guide the Investigate loop. The model may
deviate when signals contradict.

| Archetype | Canonical tool chain |
|---|---|
| **Supplier** | `pareto_defect_codes → query_defects → bom_parts_for_product → trace_batch → semantic_search_complaints` |
| **Drift** | `weekly_quality_summary → query_defects(window) → rework_timeline_by_section → semantic_search_reworks` |
| **Design** | `field_vs_factory_gap → query_defects → bom_parts_for_product → semantic_search_complaints` |
| **Operator** | `query_defects(sev=low) → group_by(order_id) → operator_effect_analysis → rework_timeline_by_section` |

---

## 4. Act III — RESOLVE

Once the incident has a confirmed root-cause hypothesis and chosen corrective
action, the user clicks **Resolve**. The platform dispatches parallel agents,
each writing into the appropriate system of record. **This is Manex slide 3,
made real.**

### 4.1 Domain agents

Scope cut for 24h: **three real agents + two stubbed**.

| Agent | Status | Files into | Example initiative (Story 1) |
|---|:---:|---|---|
| **Production** | ✅ real | MES, `product_action`, work instructions | Quarantine products with batch SB-00007, add inspection step |
| **Supplier** | ✅ real | SRM, supplier 8D PDF, scorecards | Issue supplier 8D to ElektroParts, demand incoming ESR screening |
| **R&D / Dev** | ✅ real | Dev backlog (Jira-style JSON), FMEA registry | Update PM-00008 design note, add ESR tolerance to spec |
| **Logistics** | 🟡 stubbed | ERP, WMS | Hold shipments of affected PO range |
| **Customer-Response** | 🟡 stubbed | CRM, field-service, marketing-ops | Proactive outreach to customers with affected serials |

Each agent owns its playbook and tool manifest. Each initiative is an
`initiative` row (with optional cross-link to Manex-native `product_action`).

### 4.2 Impact Simulator (pre-dispatch)

Before dispatch, the UI surfaces:

- **Without action** — projected additional field claims over 12 weeks
  (heuristic + embedding similarity to past `lesson` rows)
- **With this action set** — projected residual risk, cost avoided (€)
- **Confidence band** — based on resolution outcomes of similar past incidents

For the hackathon: rule-based prior + one embedding-similarity term. Simple,
demos well.

### 4.3 Lessons and network effect

Every resolved incident writes a `lesson` row with an embedding of its
signature. The next incident, anywhere in the network, retrieves nearest
lessons first. **The platform gets smarter the more plants it runs in.** This
is the defensibility story for the pitch.

### 4.4 Closure monitor

Each initiative registers a **typed closure predicate** —
`{type: "no_defect_code_in_window", params: {...}}`. A 60-second cron worker
evaluates it against the live DB. Outcomes:

- Satisfied → `status=done` → write `impact_measurement` row
- Deadline exceeded, unsatisfied → `status=reopen` → re-inject into Reason

Closure is verifiable, not stampable.

---

## 5. Data model additions

Beyond the 19 Manex tables, we create in the team schema (we have `CREATE` on
`public`):

```sql
-- Single normalized incoming fact
CREATE TABLE signal (
  signal_id      TEXT PRIMARY KEY,
  signal_type    TEXT NOT NULL,
  source_system  TEXT NOT NULL,
  captured_ts    TIMESTAMPTZ NOT NULL,
  product_id     TEXT REFERENCES product(product_id),
  part_number    TEXT REFERENCES part_master(part_number),
  section_id     TEXT REFERENCES section(section_id),
  batch_id       TEXT REFERENCES supplier_batch(batch_id),
  severity_hint  NUMERIC,
  text_payload   TEXT,
  raw_payload    JSONB NOT NULL,
  embedding      vector(1536)
);
CREATE INDEX ON signal USING ivfflat (embedding vector_cosine_ops);

-- Cluster of signals worth reasoning about
CREATE TABLE incident (
  incident_id        TEXT PRIMARY KEY,
  opened_ts          TIMESTAMPTZ DEFAULT now(),
  closed_ts          TIMESTAMPTZ,
  status             TEXT CHECK (status IN ('triage','reasoning','resolving','closed','dismissed')),
  title              TEXT,
  summary            TEXT,
  severity           TEXT,
  primary_product_id TEXT REFERENCES product(product_id),
  primary_part       TEXT REFERENCES part_master(part_number),
  hypothesis_tree    JSONB,
  embedding          vector(1536)
);

CREATE TABLE incident_signal (
  incident_id TEXT REFERENCES incident(incident_id),
  signal_id   TEXT REFERENCES signal(signal_id),
  added_by    TEXT,
  PRIMARY KEY (incident_id, signal_id)
);

-- Per-domain contribution to an incident
CREATE TABLE contribution (
  contribution_id TEXT PRIMARY KEY,
  incident_id     TEXT REFERENCES incident(incident_id),
  domain          TEXT NOT NULL,
  author_user_id  TEXT,
  content         TEXT,
  evidence_refs   JSONB,
  weight          NUMERIC DEFAULT 1.0,
  created_ts      TIMESTAMPTZ DEFAULT now()
);

-- Cross-domain initiatives (external systems written via the right agent)
CREATE TABLE initiative (
  initiative_id     TEXT PRIMARY KEY,
  incident_id       TEXT REFERENCES incident(incident_id),
  agent_domain      TEXT,
  target_system     TEXT,
  external_ref      TEXT,
  product_action_id TEXT REFERENCES product_action(action_id),
  owner_user_id     TEXT,
  due_ts            TIMESTAMPTZ,
  status            TEXT,
  closure_predicate JSONB,
  created_ts        TIMESTAMPTZ DEFAULT now(),
  closed_ts         TIMESTAMPTZ
);

-- Measured outcome per initiative
CREATE TABLE impact_measurement (
  measurement_id TEXT PRIMARY KEY,
  initiative_id  TEXT REFERENCES initiative(initiative_id),
  measured_ts    TIMESTAMPTZ DEFAULT now(),
  metric         TEXT,
  value          NUMERIC,
  confidence     NUMERIC,
  method         TEXT
);

-- Learned resolution signatures (network effect)
CREATE TABLE lesson (
  lesson_id       TEXT PRIMARY KEY,
  incident_id     TEXT REFERENCES incident(incident_id),
  signature_text  TEXT,
  embedding       vector(1536),
  outcome         TEXT,
  fix_summary     TEXT,
  created_ts      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON lesson USING ivfflat (embedding vector_cosine_ops);
```

Manex's native `product_action` and `rework` tables remain the ground-truth
write targets inside Manex. `initiative` is our cross-domain fan-out, because
R&D tickets and supplier 8Ds live outside Manex.

---

## 6. Tech stack (committed)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router · TypeScript | One repo, one language, team skills match |
| UI kit | Tailwind + shadcn/ui | No dedicated designer on team; ship polished fast |
| Graph viz | React Flow | Interactive root-cause tree + BOM graph |
| Charts | Recharts | Pareto, Cpk, timeline |
| Voice capture | OpenAI Whisper API | Floor-lens voice input |
| Agent SDK | `@anthropic-ai/sdk` | Tool use, streaming, prompt cache |
| UI streaming | `ai` (Vercel AI SDK) | Generative-UI components from tool stream |
| Primary LLM | Claude Sonnet 4.6 · `claude-sonnet-4-6` | Reasoning + vision |
| Fast LLM | Claude Haiku 4.5 · `claude-haiku-4-5-20251001` | Classification, noise filter |
| Fallback LLM | Claude Opus 4.7 · `claude-opus-4-7` | Stall-recovery only, gated `max_calls=2` |
| Embeddings | OpenAI `text-embedding-3-small` | 1536-dim, pgvector-compatible, cheap |
| DB | Provided Postgres + `pgvector` | Already there; we enable vector extension |
| API | PostgREST (provided) + Next.js Route Handlers | Dual path: PostgREST CRUD, orchestrator for AI |
| Background | Vercel Cron / Inngest | Closure monitor + signal correlator |

**Rejected:** Python FastAPI split stack — doubles ops, requires cross-service
auth, team strength is TypeScript. Whisper runs via API from Next.js, no Python
required.

---

## 7. LLM engineering decisions

The decisions that make the Reason act trustworthy in a live demo:

1. **Orchestrated 4-phase pipeline, not pure ReAct.** Classify → Investigate →
   Compose → Propose. Phases are the unit of observation.
2. **Two-tier model routing.** Haiku for classification, summarization, noise
   filter. Sonnet for reasoning. Opus only on stall. ~70% inference savings.
3. **Typed tool layer (Zod). Never free-form SQL.** Hallucinated table names =
   demo abort. Typed tools = predictable latency, cacheable results, grounded
   output.
4. **Evidence-cite contract.** `{"claim": "...", "evidence": ["tc_042"]}`.
   Post-validator checks every ID exists in `meta.tool_calls`.
5. **Anthropic prompt caching** on the system prompt (5-min TTL). Expected
   hit rate >80% during demo. ~60% input-cost reduction, ~3× latency
   improvement on cached prefix.
6. **pgvector for free-text only.** `signal.embedding`, `complaint_text`,
   `action_text`, `defect.notes`. SQL owns structured queries.
7. **Archetype playbooks as few-shots, not hard-coded DAGs.** Strong prior
   without losing reasoning flexibility.
8. **Human-in-the-loop as a state.** Stall → `request_hint` → engineer input
   re-injected. Clean semantics instead of infinite loops.
9. **Streaming UX via Vercel AI SDK.** Tool results carry `render_hint`
   (e.g. `{component: "pareto_chart", data: [...]}`). Juror sees report being
   built, not popping.
10. **Closure predicates, not status stamps.** Typed JSON union evaluated by
    cron worker. Reopening is automatic.

### 7.1 Guardrails

- `max_iterations = 8` per Investigate phase
- Zod validator on every LLM emission (1 retry on fail)
- Evidence-cite post-check
- Amend budget: max 2× per session
- Per-phase token budgets (Classify 1k · Investigate 16k · Compose 8k · Propose 4k)
- Tool-arg Zod gate before SQL execution
- Max 5 concurrent tool calls, 5s per tool, 60s per agent run
- Write tools gated — not available in Investigate, only post-approval
- Evidence cache TTL 15 min, embedding index TTL 24h

### 7.2 Cost envelope (per end-to-end run)

With prompt caching: **≈ $0.15**. Breakdown: Classify $0.002 · Investigate
$0.05 · Compose $0.055 · Propose $0.032 · Noise filter $0.002 · Vision (if
operator photo) $0.012 · Embedding initial index $0.001. Hackathon budget
~$33 total across ~200 dev runs + 20 demo runs.

---

## 8. Personas & the journey

Four actors operate on Resolve. Three human (the lenses), one non-human (the
AI agent pipeline).

| Actor | Color | What they see | Write scope |
|---|---|---|---|
| **System / AI Agent** | sky | no UI — runs in background; surfaces only as reasoning trace inside Engineer lens | event bus, tool calls, draft emissions |
| **QC Operator** | amber | Floor lens: mobile capture, voice + photo, 1-sentence prompt, receipt toast | `signal` rows |
| **Quality Engineer** | orange | Engineer lens: Incident Canvas 3-panel (reasoning trace · 8D draft · viz), Initiative composer | `incident`, `contribution`, `initiative` approve |
| **Quality Manager** | violet | Leadership lens: portfolio dashboard, approval inbox, cross-plant incident map | high-severity approval, escalations |

### Swimlane journey

Five phases × four actors. Operator has 2 touchpoints, Engineer has 3
(optional hint · review · closure verify), Manager has 2 (approval · portfolio),
System owns the rest.

| | **1 · Trigger** | **2 · Investigate** | **3 · Report** | **4 · Decide** | **5 · Track** |
|---|---|---|---|---|---|
| **System / AI** | Continuous monitor + Signal Correlator → Incident formed | Agent reasoning with tools (streamed) | Draft 8D + initiative candidates | idle | Persist + closure monitor |
| **QC Operator** | Photo / free-text / voice | idle | idle | idle | Receipt toast: "Initiative PA-XXX opened" |
| **Quality Engineer** | idle | Optional hint if agent stalls | Review canvas + evidence links | Accept / Amend / Reject + owner + deadline | Verify closure met |
| **Quality Manager** | idle | idle | idle | High-severity co-sign | Portfolio dashboard + recurrence warning |

The visual equivalent of this table is in
[docs/visualizations/architecture.html](visualizations/architecture.html).

---

## 9. 24h delivery plan (three parallel pods)

Not 48h. The teammate's plan is scope-cut one-third.

**Hour 0–2 — Kickoff**
Align on Acts; split into pods; confirm branches.

**Hour 2–10 — LISTEN (Harjot lead + Harsh)**
- `pgvector` extension on the provided Postgres
- Seed `signal` by ingesting `defect`, `field_claim`, `test_result (MARGINAL/FAIL)`
- Deterministic + semantic correlator → seed `incident`
- Floor-lens mobile page with voice capture (Whisper)

**Hour 2–16 — REASON · LLM core (Joscha)**
- Anthropic SDK wiring + prompt cache breakpoints
- 4-phase orchestrator + typed tool layer
- All 17 tools with Zod schemas
- Archetype playbooks in system prompt
- Evidence-cite post-validator
- Guardrails

**Hour 6–20 — REASON · Canvas UI (Lila + Harsh)**
- 3-panel Incident Canvas layout
- Root-cause graph (React Flow)
- Timeline + BOM panel
- 8D / FMEA / Pareto projections
- Contribution-stream panel
- Generative-UI components wired to tool stream

**Hour 14–22 — RESOLVE (split between all four)**
- 3 real agents: Production / Supplier / R&D (each own tool manifest + system prompt)
- 2 stubbed agents for demo-completeness: Logistics + Customer-Response
- Impact Simulator (rule + lesson-embedding similarity)
- Leadership lens: portfolio + incidents map + Pareto
- Closure-predicate evaluator as cron

**Hour 20–22 — Demo seed + E2E rehearsal**
Deterministic triggers for the four stories. Pre-seed 2–3 `lesson` rows.
Snapshot `signal` / `incident` / `initiative` tables at hour 23 and restore
before the pitch.

**Hour 22–24 — Pitch + buffer**
3-minute demo, 2-minute business case.

---

## 10. Demo choreography

Four stories exist in the data. Lead with two, have the other two runnable.

1. **Story 1 — Supplier batch (SB-00007 · ElektroParts).**
   Multi-signal correlation wow: incident auto-forms from ESR near-misses
   *plus* field-claim cluster. Supplier Agent fires an 8D PDF to the supplier.
2. **Story 3 — Design drift (R33 · thermal).**
   "We catch what you can't": incident formed from field claims with *zero*
   factory defects. Demonstrates the cross-boundary gap that slide 2's
   "customer voices get lost" talks about.
3. *Runnable but not led:* Story 2 (torque drift, self-healing, lesson
   retrieval demo) and Story 4 (operator pattern via `rework.user_id`).

---

## 11. Business pitch — aligned to Manex slide 2

| Manex pain point (their words) | Resolve's answer | Quantified claim |
|---|---|---|
| "Quality indicators lost due to high complexity" | Signal Correlator + Incident Canvas replace 12 data silos with one reasoning surface | ~70% of early-warning signals (MARGINAL tests, inbound-inspection anomalies) currently invisible; we surface them |
| "High FTE effort for the overall process" | Domain agents auto-draft the initiative into each system of record; engineer only approves | Target 60% reduction in time-to-initiative (hours, not days) |
| "Customer voices get lost, market adaptations very slow" | External sources are first-class citizens, clustered with internal signals in the same incident | Target 4–6 week compression of claim-to-resolution |

**Network effect:** every resolved incident produces a `lesson` embedding. New
incidents retrieve nearest lessons. Platform value compounds across plants.

**Why this beats the obvious submission:** most teams will ship a prettier 8D
form-filler. We are not in that contest. We are building the layer that makes
8D obsolete as a primary artifact — it becomes a regulatory-export projection
of a richer underlying record. That lands slide 8's instruction.

---

## 12. Open questions for the team

1. Which two stories lead the demo? (Recommendation: Story 1 + Story 3)
2. Do we pre-seed `lesson` rows for Stories 2 and 4 so retrieval looks magical?
   (Recommendation: yes — hackathon judgment, not fraud)
3. External-signal demo: do we inject fake reviews/social posts into `signal`?
   (Recommendation: yes, 2–3 rows, honestly labeled "demo feed")
4. Pitch narrative owner locked in by hour 16?
5. Snapshot strategy: pg_dump at hour 23, restore before demo?

---

## 13. Directory layout (on `develop`, off-limits on `main`)

```
app/
  (engineer)/investigate/page.tsx           3-panel workspace
  (operator)/capture/page.tsx               mobile capture
  (manager)/dashboard/page.tsx              portfolio
  components/                               generative-UI (<ParetoChart> etc.)
  server/
    agent/                                  orchestrator + 4 phases
    tools/                                  one file per tool, Zod schema exported
    schemas/                                shared I/O types
    prompts/                                system prompts + playbook few-shots
    models/                                 model clients & routing
    correlator/                             signal dedupe + pgvector clustering
    domain-agents/                          production / supplier / rnd / logistics / cx
  api/
    intake/capture/route.ts
    intake/query/route.ts
    agent/run/route.ts
    agent/stream/route.ts                   SSE
    initiative/approve/route.ts
workers/
  closure-monitor.ts                        Vercel Cron / Inngest
  embedding-indexer.ts                      one-shot on first session
supabase/
  migrations/                               pgvector + our tables
docs/
  ARCHITECTURE.md                           this file
  visualizations/                           HTML dashboards
```

---

## 14. Visualizations

- [docs/visualizations/architecture.html](visualizations/architecture.html) — engineering dashboard: decisions, model routing, E2E pipeline diagram, tool catalog, swimlane journey, guardrails, cost envelope, milestones
- [docs/visualizations/problem-flow.html](visualizations/problem-flow.html) — problem understanding + persona journey

Both are standalone HTML with Mermaid via CDN. Open locally in any browser.
