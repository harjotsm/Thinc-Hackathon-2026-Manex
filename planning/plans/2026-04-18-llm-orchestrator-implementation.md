# LLM Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Resolve's LLM orchestrator (Classify → Investigate → Compose → Propose) with evidence-cited tool use, SSE live streaming, and closed-loop dispatch, such that Story 1 (Supplier-batch SB-00007) and Story 3 (Design-drift R33) demo end-to-end against the real Manex backend.

**Architecture:** Next.js 15 App Router + Anthropic SDK (Sonnet 4.6 + Haiku 4.5) with prompt caching, typed Zod tool layer, pgvector for semantic retrieval, Supabase-JS against the remote Manex Postgres. Durable worker runs orchestrator in-process. Append-only event log feeds SSE. See [planning/specs/2026-04-18-llm-data-pipeline-design.md](../specs/2026-04-18-llm-data-pipeline-design.md) for the canonical design.

**Tech Stack:** Next.js 15, TypeScript strict, pnpm, Tailwind + shadcn/ui (UI stubs only — Lila owns the real UI), Vercel AI SDK + `@anthropic-ai/sdk`, OpenAI SDK (whisper + embeddings only), `@supabase/supabase-js`, pgvector, Zod, Vitest.

**Scope (what this plan covers):**
- Joscha's ownership per CLAUDE.md: LLM orchestrator, phases, prompts, 19-tool Zod layer, evidence validator, session layer, worker, agent entry-points
- MVP tool set: 10 functional tools (enough for Story 1 + 3), 9 stubs returning typed mock data
- Bootstrap env + Supabase client setup (so the plan can run solo even if Harjot's migrations slip)
- One golden E2E test per primary demo story

**Scope (what this plan does NOT cover):**
- Visual design, canvas UX, live-transcript UI polish → **Lila (`feat/lila`)**
- Tool SQL implementations beyond MVP, React Flow + Recharts components → **Harsh (`feat/harsh`)**
- Migration execution against remote Manex, pgvector extension setup, detector cron deployment → **Harjot (`feat/harjot`)**

**Interface points with teammates:**
- Joscha writes Zod schemas + types for shared entities (signal, incident, session, initiative, lesson) — teammates import
- Joscha writes API route contracts and stubs — Lila's UI calls them
- Joscha writes tool interface Zod schemas — Harsh fills in SQL implementations for non-MVP tools
- Joscha assumes migrations are applied — coordinates with Harjot; provides fallback script if needed

---

## File Structure

Created (this plan):
```
.env.local                                      # gitignored; real Manex creds
.env.local.example                              # committed template
package.json                                    # pnpm project, scripts
tsconfig.json                                   # strict mode
next.config.js
tailwind.config.ts
postcss.config.js

app/
  layout.tsx                                    # minimal shell
  page.tsx                                      # redirect to /engineer
  api/
    signal/ingest/route.ts                      # POST operator signal
    incident/
      [id]/route.ts                             # GET incident detail
      [id]/investigate/route.ts                 # POST → enqueue session
    incidents/route.ts                          # GET list
    session/
      [id]/route.ts                             # GET turn history
      [id]/stream/route.ts                      # SSE live + replay
      [id]/hint/route.ts                        # POST engineer hint
    initiative/[id]/approve/route.ts            # POST approve → dispatch
    detector/scan/route.ts                      # POST manual scan trigger (M6)

server/
  db/
    client.ts                                   # Supabase singleton
    queries/
      incidents.ts
      signals.ts
      sessions.ts
      initiatives.ts
      lessons.ts
  models/
    anthropic.ts                                # wrapped client: caching + retry + circuit breaker
    openai.ts                                   # embeddings + whisper
    budget.ts                                   # token counter + cost tracker
    pricing.ts                                  # $/1M tokens per model
  prompts/
    system/
      base.md
      tools.auto.md                             # generated
    phase/
      classify.md
      investigate.md
      compose.md
      propose.md
    playbooks/
      supplier.md
      drift.md
      design.md
      operator.md
      unknown.md
    generated/                                  # git-committed .ts compiled output
  agent/
    orchestrator.ts                             # top-level phase runner
    phases/
      classify.ts
      investigate.ts
      compose.ts
      propose.ts
    stall-detector.ts                           # canonical-hash-based loop detector
    evidence-validator.ts                       # 3-layer cite enforcement
    context-manager.ts                          # haiku-summarize on overflow
  tools/
    index.ts                                    # registry + Zod registration
    types.ts                                    # Tool interface + result envelope
    signal-incident/
      get-incident.ts
      list-signals-for-incident.ts
      find-related-incidents.ts                 # stub
    retrieval/
      query-defects.ts
      trace-batch.ts
      bom-parts-for-product.ts
      pareto-defect-codes.ts
      test-results-marginal.ts                  # stub
    cross-boundary/
      field-vs-factory-gap.ts
      operator-effect-analysis.ts               # stub
      rework-timeline-by-section.ts             # stub
      weekly-quality-summary.ts                 # stub
    semantic-vision-lessons/
      semantic-search-signals.ts                # stub
      retrieve-lessons.ts
      classify-defect-image.ts                  # stub (returns canned labels)
    simulation/
      simulate-impact.ts
    write-gated/
      create-initiative.ts
      register-closure-predicate.ts
      emit-lesson.ts                            # stub
  sse/
    event-bus.ts                                # EventEmitter singleton
    stream.ts                                   # SSE response helpers + heartbeat
  auth/
    demo-user.ts                                # X-Demo-User header resolution
    guards.ts                                   # withGuard middleware
  worker/
    index.ts                                    # worker entry + cron registry
    handlers/
      investigate.ts                            # runs orchestrator for a session

schemas/
  signal.ts
  incident.ts
  session.ts
  initiative.ts
  lesson.ts
  closure.ts
  action-templates.ts
  tool-io.ts
  api-responses.ts

lib/
  stable-stringify.ts                           # canonical JSON for hashes
  id-prefixes.ts
  cn.ts

scripts/
  prompts-build.ts                              # .md → generated/*.ts
  backfill-signals.ts                           # one-shot seed (Mode 1)
  seed-demo.ts                                  # 3 pre-approved lessons

supabase/
  migrations/
    00003_resolve_app_user.sql                  # added by this plan
    00004_resolve_signal_incident.sql
    00006_resolve_session_events.sql
    00008_resolve_initiative_closure.sql
    00009_resolve_lesson.sql
    00012_resolve_pgvector_indexes.sql

tests/
  unit/
    stable-stringify.test.ts
    stall-detector.test.ts
    evidence-validator.test.ts
    canonical-hash.test.ts
    predicate-evaluators.test.ts
  integration/
    tools-query-defects.test.ts
    tools-trace-batch.test.ts
    correlator.test.ts
  golden/
    story-1-supplier-batch.test.ts
    story-3-design-drift.test.ts
  fixtures/
    incidents/
      story-1.json
      story-3.json
    anthropic-vcr/                              # recorded Anthropic responses
```

Modified/extended (coordinate with teammates):
```
supabase/migrations/                            # numbered sequence shared with Harjot
CLAUDE.md                                       # no changes
```

---

## Milestone overview (time estimates are Joscha's hours)

| Milestone | Hours | Gate |
|---|---|---|
| M0 Bootstrap | 1h | dev server up, Anthropic+OpenAI calls succeed, Manex API reachable |
| M1 Schemas + Model clients | 3h | all Zod types compiled; Sonnet call with cached system prompt works |
| M2 Classify phase spike | 2h | one incident fixture → structured Classify output with ≥1 retrieved lesson |
| M3 Investigate phase + 8 MVP tools | 4h | Story 1 fixture → terminal output with evidence_ledger ≥3 tool calls |
| M4 Compose + Propose | 3h | Story 1 → 8D report + 2 initiatives with simulate_impact-cited impact_estimate |
| M5 Evidence validator + SSE integration | 2h | post-validator blocks un-cited claims; SSE streams live to curl |
| M6 Backfill + dispatcher + closure stub | 2h | backfill seeds signals from Manex; approve-endpoint writes product_action |
| M7 Golden E2E + demo prep | 1-2h | Story 1 + Story 3 golden tests pass; PR to develop |

---

## Milestone 0 — Bootstrap

**Target: dev environment running end-to-end, real Manex backend reachable, first Anthropic call succeeds.**

### Task 0.1: Initialize Next.js project + pnpm

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Init pnpm project from scratch in repo root**

Manex scaffold already has docker-compose + migrations; DO NOT touch. Add Next.js on top.

Run:
```bash
cd /Users/joschahaertel/Projects/Hackathons/Deconstructors/De.Constructors
pnpm init
```

Edit `package.json` manually to set:
```json
{
  "name": "resolve",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "concurrently \"next dev\" \"pnpm worker:dev\"",
    "db:up": "supabase start",
    "db:down": "supabase stop",
    "db:reset": "supabase db reset",
    "db:migrate:remote": "tsx scripts/apply-remote-migrations.ts",
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
}
```

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add next@15 react@19 react-dom@19 typescript @types/node @types/react @types/react-dom
pnpm add @anthropic-ai/sdk openai zod @supabase/supabase-js
pnpm add tailwindcss postcss autoprefixer concurrently
pnpm add class-variance-authority clsx tailwind-merge
pnpm add -D tsx vitest @vitest/ui dotenv
```

- [ ] **Step 3: Create `tsconfig.json` with strict mode**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@schemas/*": ["./schemas/*"],
      "@server/*": ["./server/*"],
      "@lib/*": ["./lib/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};
module.exports = nextConfig;
```

- [ ] **Step 5: Create Tailwind config + globals**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`postcss.config.js`:
```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Minimal layout + page**

`app/layout.tsx`:
```tsx
import './globals.css';
export const metadata = { title: 'Resolve' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return <main className="p-8"><h1 className="text-2xl">Resolve — Engineering dashboard scaffold</h1></main>;
}
```

- [ ] **Step 7: Verify dev server starts**

Run: `pnpm dev` in a separate terminal (not in `concurrently` yet — worker doesn't exist).
Expected: Next.js starts on `http://localhost:3000`, `/` renders the heading.
Abort: `Ctrl+C`. Update `dev` script to strip `pnpm worker:dev` temporarily — add it back in Task 1.5.

Temporarily set `dev` to `"next dev"` only until worker exists.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json next.config.js tailwind.config.ts postcss.config.js app/ .gitignore
git commit -m "chore: scaffold Next.js 15 + Tailwind + TS strict baseline"
```

### Task 0.2: Configure `.env.local` with real Manex credentials

**Files:**
- Create: `.env.local` (gitignored)
- Create: `.env.local.example` (committed)
- Modify: `.gitignore`

- [ ] **Step 1: Verify `.env.local` is gitignored**

Check `.gitignore` includes:
```
.env.local
.env*.local
```

If missing, add.

- [ ] **Step 2: Create `.env.local.example` with placeholders**

```bash
# Manex backend (remote, provided per team)
MANEX_POSTGREST_URL=http://<manex-host>:<manex-port>
MANEX_PG_URL=postgres://<user>:<pw>@<manex-host>:<pg-port>/hackathon
MANEX_API_KEY=<bearer-token>
MANEX_IMAGES_URL=http://<manex-host>:<images-port>/defect_images/

# Local dev
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<from-pnpm-db:up-output>
SUPABASE_SERVICE_ROLE_KEY=<from-pnpm-db:up-output>
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
BACKFILL_CRON_ENABLED=false
EMBEDDING_RECOVERY_INTERVAL_SEC=60
EMBEDDING_RECOVERY_ENABLED=true

# Auth
DEMO_USER_HEADER=X-Demo-User
```

- [ ] **Step 3: Create `.env.local` — DO NOT COMMIT**

Copy `.env.local.example` to `.env.local`, replace placeholders with real values. Joscha pastes team credentials from handout message into `.env.local` directly (the plan does not persist them).

Values to fill in (team `deconstructors`):
- `MANEX_POSTGREST_URL=http://34.89.205.150:8005/`
- `MANEX_PG_URL=postgres://team_writer_deconstructors:<password>@34.89.205.150:5435/hackathon`
- `MANEX_API_KEY=<JWT bearer token from handout>`
- `MANEX_IMAGES_URL=http://34.89.205.150:9000/defect_images/`
- `ANTHROPIC_API_KEY=<own sk-ant-...>`
- `OPENAI_API_KEY=<own sk-...>`

- [ ] **Step 4: Commit `.env.local.example`**

```bash
git add .env.local.example .gitignore
git commit -m "chore: env template with Manex + LLM vars"
```

### Task 0.3: Verify Manex + Anthropic + OpenAI connectivity

**Files:**
- Create: `scripts/health-check.ts`

- [ ] **Step 1: Write health-check script**

`scripts/health-check.ts`:
```ts
import 'dotenv/config';

async function main() {
  const errors: string[] = [];

  // Manex PostgREST
  try {
    const r = await fetch(`${process.env.MANEX_POSTGREST_URL}defect?limit=1`, {
      headers: { Authorization: `Bearer ${process.env.MANEX_API_KEY}` },
    });
    if (!r.ok) errors.push(`Manex PostgREST ${r.status}: ${await r.text()}`);
    else {
      const rows = await r.json();
      console.log(`✓ Manex PostgREST: got ${rows.length} defect rows`);
    }
  } catch (e) { errors.push(`Manex PostgREST unreachable: ${e}`); }

  // Anthropic
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'say "ok"' }],
    });
    console.log(`✓ Anthropic Haiku: ${JSON.stringify(msg.content[0])}`);
  } catch (e) { errors.push(`Anthropic fail: ${e}`); }

  // OpenAI embeddings
  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const emb = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'health check',
    });
    console.log(`✓ OpenAI embeddings: dim=${emb.data[0].embedding.length}`);
  } catch (e) { errors.push(`OpenAI fail: ${e}`); }

  if (errors.length) {
    console.error('HEALTH CHECK FAILED');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('\n✓ All services reachable');
}

main();
```

- [ ] **Step 2: Run health check**

Run: `pnpm tsx scripts/health-check.ts`
Expected output: three ✓ lines, exit 0.
If any fail: fix `.env.local` credentials or network before proceeding.

- [ ] **Step 3: Commit**

```bash
git add scripts/health-check.ts
git commit -m "chore: health-check script for Manex/Anthropic/OpenAI"
```

---

## Milestone 1 — Schemas + Model Clients

**Target: All Zod types compiled. Anthropic client wraps caching + retry. Supabase client resolves. Test that the full prompt prefix caches.**

### Task 1.1: Write core Zod schemas

**Files:**
- Create: `schemas/signal.ts`, `schemas/incident.ts`, `schemas/session.ts`, `schemas/initiative.ts`, `schemas/lesson.ts`, `schemas/closure.ts`, `schemas/action-templates.ts`, `schemas/api-responses.ts`
- Test: `tests/unit/schemas.test.ts`

- [ ] **Step 1: Write failing test for Signal schema**

`tests/unit/schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Signal } from '@schemas/signal';

describe('Signal schema', () => {
  it('parses a minimal operator signal', () => {
    const parsed = Signal.safeParse({
      id: 'SIG-00001',
      signal_type: 'operator_report',
      source: 'operator',
      source_system: 'resolve_ui',
      created_at: new Date().toISOString(),
      captured_ts: new Date().toISOString(),
      raw_text: 'Kondensator sieht komisch aus',
      lang: 'de',
      severity: 'medium',
      cluster_state: 'attached',
      idempotency_key: 'hash123',
      raw_payload: {},
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid severity', () => {
    const parsed = Signal.safeParse({
      id: 'SIG-00001', signal_type: 'operator_report', source: 'operator',
      source_system: 'resolve_ui', created_at: new Date().toISOString(),
      captured_ts: new Date().toISOString(), raw_text: 'x', lang: 'de',
      severity: 'nonsense', cluster_state: 'attached', idempotency_key: 'h', raw_payload: {},
    });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `pnpm vitest tests/unit/schemas.test.ts`
Expected: Cannot find module '@schemas/signal'.

- [ ] **Step 3: Write minimum `schemas/signal.ts`**

```ts
import { z } from 'zod';

export const SignalSource = z.enum([
  'operator', 'engineer', 'detector', 'customer_email',
  'backfill_defect', 'backfill_field_claim', 'backfill_test_result',
]);

export const SignalType = z.enum([
  'operator_report', 'engineer_report', 'detector_anomaly',
  'field_claim', 'factory_defect', 'marginal_test',
]);

export const Severity = z.enum(['low', 'medium', 'high', 'critical']);
export const ClusterState = z.enum(['attached', 'pending_cluster', 'expired']);

export const MatchType = z.enum([
  'det_prod_def', 'det_sec_def', 'det_rule',
  'sem', 'new', 'new_strong_detector', 'pending', 'expired',
]);

export const Attachment = z.object({
  kind: z.enum(['image', 'audio']),
  url: z.string().url(),
  vision_out: z.record(z.unknown()).optional(),
  transcript: z.string().optional(),
  status: z.enum(['ok', 'failed']).optional(),
});

export const Triage = z.object({
  real: z.boolean(),
  reasoning: z.string(),
  score: z.number().min(0).max(1),
});

export const Signal = z.object({
  id: z.string().regex(/^SIG-\d{5}$/),
  signal_type: SignalType,
  source: SignalSource,
  source_system: z.string(),
  created_at: z.string().datetime(),
  captured_ts: z.string().datetime(),
  source_ref: z.string().nullable().optional(),
  raw_text: z.string(),
  lang: z.enum(['de', 'en']),
  embedding: z.array(z.number()).length(1536).nullable().optional(),
  attachments: z.array(Attachment).default([]),
  product_id: z.string().nullable().optional(),
  part_number: z.string().nullable().optional(),
  reported_part_number: z.string().nullable().optional(),
  batch_id: z.string().nullable().optional(),
  section_id: z.string().nullable().optional(),
  defect_code: z.string().nullable().optional(),
  test_key: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  market: z.string().nullable().optional(),
  shift: z.enum(['early', 'late', 'night']).nullable().optional(),
  severity: Severity,
  severity_hint: z.number().nullable().optional(),
  triage: Triage.nullable().optional(),
  incident_id: z.string().nullable().optional(),
  created_by_user_id: z.string().nullable().optional(),
  detector_rule: z.string().nullable().optional(),
  detector_evidence: z.record(z.unknown()).nullable().optional(),
  raw_payload: z.record(z.unknown()),
  cluster_state: ClusterState,
  pending_until: z.string().datetime().nullable().optional(),
  idempotency_key: z.string(),
  match_type: MatchType.nullable().optional(),
  match_score: z.number().nullable().optional(),
  attach_reason: z.string().nullable().optional(),
  matched_incident_id: z.string().nullable().optional(),
});
export type Signal = z.infer<typeof Signal>;
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `pnpm vitest tests/unit/schemas.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Write remaining schemas**

`schemas/incident.ts`:
```ts
import { z } from 'zod';
import { Severity } from './signal';

export const Archetype = z.enum(['supplier', 'drift', 'design', 'operator', 'unknown']);
export const IncidentStatus = z.enum([
  'triage', 'reasoning', 'resolving', 'closed', 'dismissed', 'reopen',
]);

export const Incident = z.object({
  id: z.string().regex(/^INC-\d{5}$/),
  created_at: z.string().datetime(),
  archetype: Archetype,
  severity: Severity,
  status: IncidentStatus,
  title: z.string(),
  summary: z.string(),
  primary_product_id: z.string().nullable(),
  primary_part_number: z.string().nullable(),
  linked_product_ids: z.array(z.string()),
  centroid_embedding: z.array(z.number()).length(1536).nullable(),
  signature_text: z.string().nullable(),
  signature_embedding: z.array(z.number()).length(1536).nullable(),
  signal_count: z.number().int(),
  hypothesis_tree: z.record(z.unknown()).nullable(),
  last_activity_at: z.string().datetime(),
  closed_at: z.string().datetime().nullable(),
  dismissed_at: z.string().datetime().nullable(),
  reopened_at: z.string().datetime().nullable(),
  dismiss_reason: z.string().nullable(),
  reopen_reason: z.string().nullable(),
  cosign_required: z.boolean(),
  cosigned_by_user_id: z.string().nullable(),
  cosigned_at: z.string().datetime().nullable(),
  is_provisional: z.boolean(),
});
export type Incident = z.infer<typeof Incident>;
```

`schemas/session.ts`:
```ts
import { z } from 'zod';

export const SessionPhase = z.enum(['classify', 'investigate', 'compose', 'propose', 'complete', 'failed']);
export const SessionStatus = z.enum(['running', 'succeeded', 'failed', 'stalled', 'cancelled']);
export const FailureReason = z.enum([
  'max_turns', 'stall_loop', 'evidence_cite_unfixable', 'model_refusal',
  'context_overflow', 'api_error_exhausted', 'tool_errors_exhausted',
  'aborted_by_user', 'orchestrator_crash', 'semantic_validator_failed',
]);

export const Session = z.object({
  id: z.string().regex(/^SES-\d{5}$/),
  incident_id: z.string(),
  phase: SessionPhase,
  status: SessionStatus,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  total_tokens_in: z.number().int(),
  total_tokens_out: z.number().int(),
  total_cost_usd: z.number(),
  failure_reason: FailureReason.nullable(),
  created_by_user_id: z.string(),
});
export type Session = z.infer<typeof Session>;

export const ToolCall = z.object({
  tool_call_id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
  output_ref: z.string().nullable(),
  status: z.enum(['pending', 'succeeded', 'failed']),
  latency_ms: z.number(),
  result_hash: z.string().nullable(),
});

export const SessionTurn = z.object({
  id: z.string(),
  session_id: z.string(),
  turn_index: z.number().int(),
  phase: SessionPhase,
  role: z.enum(['assistant', 'tool']),
  model: z.enum(['haiku-4-5', 'sonnet-4-6', 'opus-4-7']).nullable(),
  content_text: z.string().nullable(),
  tool_call: ToolCall.nullable(),
  tokens_in: z.number().int(),
  tokens_out: z.number().int(),
  duration_ms: z.number().int(),
  created_at: z.string().datetime(),
});
export type SessionTurn = z.infer<typeof SessionTurn>;
```

`schemas/initiative.ts`, `schemas/lesson.ts`, `schemas/closure.ts`, `schemas/action-templates.ts`, `schemas/api-responses.ts`: follow same pattern, exact shapes from spec §12, §11, §12.2, §13.3, §14.5. Write each in one sitting matching the spec.

- [ ] **Step 6: Add barrel export `schemas/index.ts`**

```ts
export * from './signal';
export * from './incident';
export * from './session';
export * from './initiative';
export * from './lesson';
export * from './closure';
export * from './action-templates';
export * from './api-responses';
```

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add schemas/ tests/unit/schemas.test.ts
git commit -m "feat(schemas): add Zod schemas for signal/incident/session/initiative/lesson/closure/api"
```

### Task 1.2: Wrap Anthropic client with caching + retry + circuit breaker

**Files:**
- Create: `server/models/anthropic.ts`, `server/models/pricing.ts`, `server/models/budget.ts`
- Test: `tests/unit/anthropic.test.ts` (minimal — unit tests use nock, integration tests use real API)

- [ ] **Step 1: Create pricing table**

`server/models/pricing.ts`:
```ts
// $/1M tokens (2026-04 Anthropic public pricing — adjust if changed)
export const PRICING = {
  'claude-haiku-4-5-20251001':   { input: 0.80, output: 4.00, cache_write: 1.00, cache_read: 0.08 },
  'claude-sonnet-4-6':            { input: 3.00, output: 15.00, cache_write: 3.75, cache_read: 0.30 },
  'claude-opus-4-7':              { input: 15.00, output: 75.00, cache_write: 18.75, cache_read: 1.50 },
} as const;

export type ModelId = keyof typeof PRICING;

export function costUsd(model: ModelId, tokens: {
  input: number; output: number; cache_write?: number; cache_read?: number;
}) {
  const p = PRICING[model];
  return (
    (tokens.input         * p.input         +
     tokens.output        * p.output        +
     (tokens.cache_write ?? 0) * p.cache_write +
     (tokens.cache_read  ?? 0) * p.cache_read)
    / 1_000_000
  );
}
```

- [ ] **Step 2: Create Anthropic wrapper**

`server/models/anthropic.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk';
import type { ModelId } from './pricing';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Simple in-memory circuit breaker
let anthropicCooldownUntil = 0;
let consecutiveErrors = 0;

export function anthropicCircuitStatus() {
  return { open: Date.now() < anthropicCooldownUntil, cooldown_ms: Math.max(0, anthropicCooldownUntil - Date.now()) };
}

type CallOptions = {
  model: ModelId;
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  max_tokens: number;
  temperature?: number;
};

export async function callAnthropic(opts: CallOptions) {
  if (Date.now() < anthropicCooldownUntil) {
    throw new Error(`anthropic_circuit_open; retry after ${new Date(anthropicCooldownUntil).toISOString()}`);
  }
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await client.messages.create({
        model: opts.model,
        max_tokens: opts.max_tokens,
        temperature: opts.temperature ?? 1,
        system: opts.system as any,
        messages: opts.messages,
        tools: opts.tools,
      });
      consecutiveErrors = 0;
      return res;
    } catch (e: any) {
      lastErr = e;
      const status = e?.status;
      if (status === 429 || status >= 500) {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          anthropicCooldownUntil = Date.now() + 60_000;
          throw new Error('anthropic_circuit_tripped_after_3_errors');
        }
        await new Promise(r => setTimeout(r, (1 + 2 * attempt) * 1000 + Math.random() * 500));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function streamAnthropic(opts: CallOptions) {
  if (Date.now() < anthropicCooldownUntil) {
    throw new Error('anthropic_circuit_open');
  }
  const stream = client.messages.stream({
    model: opts.model,
    max_tokens: opts.max_tokens,
    temperature: opts.temperature ?? 1,
    system: opts.system as any,
    messages: opts.messages,
    tools: opts.tools,
  });
  return stream;
}
```

- [ ] **Step 3: Create budget tracker**

`server/models/budget.ts`:
```ts
import { costUsd, type ModelId } from './pricing';

export type Usage = {
  input: number; output: number; cache_write?: number; cache_read?: number;
};

export class SessionBudget {
  private totalsByModel = new Map<ModelId, Usage>();

  record(model: ModelId, usage: Usage) {
    const prev = this.totalsByModel.get(model) ?? { input: 0, output: 0, cache_write: 0, cache_read: 0 };
    this.totalsByModel.set(model, {
      input: prev.input + usage.input,
      output: prev.output + usage.output,
      cache_write: (prev.cache_write ?? 0) + (usage.cache_write ?? 0),
      cache_read: (prev.cache_read ?? 0) + (usage.cache_read ?? 0),
    });
  }

  summary() {
    let total_cost_usd = 0;
    let total_in = 0, total_out = 0;
    for (const [model, u] of this.totalsByModel) {
      total_cost_usd += costUsd(model, u);
      total_in += u.input; total_out += u.output;
    }
    return { total_cost_usd, total_tokens_in: total_in, total_tokens_out: total_out };
  }
}
```

- [ ] **Step 4: Integration test for cache hit**

`tests/integration/anthropic-cache.test.ts`:
```ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { callAnthropic } from '@server/models/anthropic';

const BIG_SYSTEM = { type: 'text' as const, text: 'You are a helpful assistant. '.repeat(600), cache_control: { type: 'ephemeral' as const } };

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('anthropic cache', () => {
  it('second call reports cache_read_input_tokens > 0', async () => {
    const first = await callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      system: [BIG_SYSTEM],
      messages: [{ role: 'user', content: 'say "ok"' }],
      max_tokens: 10,
    });
    expect(first.usage?.cache_creation_input_tokens ?? 0).toBeGreaterThan(0);
    const second = await callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      system: [BIG_SYSTEM],
      messages: [{ role: 'user', content: 'say "ok again"' }],
      max_tokens: 10,
    });
    expect(second.usage?.cache_read_input_tokens ?? 0).toBeGreaterThan(0);
  }, 30_000);
});
```

- [ ] **Step 5: Run integration test**

Run: `pnpm vitest run tests/integration/anthropic-cache.test.ts`
Expected: 1 passed. Spends ~$0.001.

- [ ] **Step 6: Commit**

```bash
git add server/models/ tests/integration/anthropic-cache.test.ts
git commit -m "feat(models): anthropic client with circuit breaker + cost tracker + cache verified"
```

### Task 1.3: OpenAI client (embeddings + whisper)

**Files:**
- Create: `server/models/openai.ts`
- Test: `tests/integration/openai.test.ts`

- [ ] **Step 1: Write OpenAI wrapper**

`server/models/openai.ts`:
```ts
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

let embeddingCooldownUntil = 0;

export async function embed(text: string): Promise<number[] | null> {
  if (Date.now() < embeddingCooldownUntil) return null;
  try {
    const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
    return res.data[0].embedding;
  } catch (e: any) {
    if (e?.status === 429 || e?.status >= 500) embeddingCooldownUntil = Date.now() + 30_000;
    return null;
  }
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (Date.now() < embeddingCooldownUntil) return texts.map(() => null);
  try {
    const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: texts });
    return res.data.map(d => d.embedding);
  } catch (e: any) {
    if (e?.status === 429 || e?.status >= 500) embeddingCooldownUntil = Date.now() + 30_000;
    return texts.map(() => null);
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string | null> {
  try {
    const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type });
    const res = await client.audio.transcriptions.create({ model: 'whisper-1', file });
    return res.text;
  } catch { return null; }
}

export function embeddingServiceHealthy() {
  return { ok: Date.now() >= embeddingCooldownUntil, cooldown_ms: Math.max(0, embeddingCooldownUntil - Date.now()) };
}
```

- [ ] **Step 2: Integration test**

`tests/integration/openai.test.ts`:
```ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { embed, embedBatch } from '@server/models/openai';

describe.skipIf(!process.env.OPENAI_API_KEY)('openai embeddings', () => {
  it('single embed returns 1536-dim vector', async () => {
    const v = await embed('supplier batch defect cold solder');
    expect(v).not.toBeNull();
    expect(v!.length).toBe(1536);
  });
  it('batch of 3 returns 3 vectors', async () => {
    const vs = await embedBatch(['a', 'b', 'c']);
    expect(vs.length).toBe(3);
    expect(vs.every(v => v === null || v.length === 1536)).toBe(true);
  });
});
```

Run: `pnpm vitest run tests/integration/openai.test.ts` → 2 passed.

- [ ] **Step 3: Commit**

```bash
git add server/models/openai.ts tests/integration/openai.test.ts
git commit -m "feat(models): openai embeddings + whisper wrappers"
```

### Task 1.4: Supabase client + remote-migration script

**Files:**
- Create: `server/db/client.ts`, `scripts/apply-remote-migrations.ts`, `supabase/migrations/00003_resolve_app_user.sql`, `supabase/migrations/00004_resolve_signal_incident.sql`

- [ ] **Step 1: Write Supabase client singleton**

`server/db/client.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// We connect directly to Manex PostgREST for Manex tables (via their API key)
// and to our OWN migrations (also in the same Postgres via direct psql).
// Resolve tables are auto-exposed by PostgREST once created.

const MANEX_URL = process.env.MANEX_POSTGREST_URL!;
const MANEX_KEY = process.env.MANEX_API_KEY!;

let _manex: SupabaseClient | null = null;
export function manex() {
  if (!_manex) _manex = createClient(MANEX_URL, MANEX_KEY);
  return _manex;
}
```

- [ ] **Step 2: Write Resolve migrations**

`supabase/migrations/00003_resolve_app_user.sql`:
```sql
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
```

`supabase/migrations/00004_resolve_signal_incident.sql`:

Implement EXACTLY the `signal` and `incident` schemas from spec §3.1 + §4. Full SQL matching the Zod shape. Write this file in one shot. Include:
- `signal` table with all fields including FK to `product(product_id)`, `part_master(part_number)`, `supplier_batch(batch_id)`, `section(section_id)`, `app_user(user_id)`, all nullable
- Enum types for `signal_source`, `signal_type`, `cluster_state`, `match_type`, `severity`
- `incident` table with all fields
- `incident_signal` join table
- `UNIQUE(idempotency_key)` on signal
- Partial index `CREATE UNIQUE INDEX ON session (incident_id) WHERE status='running'` — wait, session table is in migration 00006
- `CREATE INDEX ON signal (cluster_state) WHERE cluster_state='pending_cluster'`
- `CREATE INDEX signal USING ivfflat (embedding vector_cosine_ops)` — in 00012

- [ ] **Step 3: Remaining migrations**

Write `00006_resolve_session_events.sql`, `00008_resolve_initiative_closure.sql`, `00009_resolve_lesson.sql`, `00012_resolve_pgvector_indexes.sql` — each matches the spec schema exactly. (Migrations 00005, 00007, 00010, 00011, 00013 are Harjot's scope: contribution, report, backfill_watermark, pipeline_error_log, seed_demo_lessons; coordinate via PR.)

- [ ] **Step 4: Write `scripts/apply-remote-migrations.ts`**

```ts
import 'dotenv/config';
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const pgUrl = process.env.MANEX_PG_URL!;
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS resolve_migration_history (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  const dir = 'supabase/migrations';
  const files = readdirSync(dir).filter(f => f.startsWith('0000') && f.endsWith('.sql') && f.includes('resolve')).sort();
  for (const f of files) {
    const { rows } = await client.query('SELECT 1 FROM resolve_migration_history WHERE filename=$1', [f]);
    if (rows.length) { console.log(`- ${f} (already applied)`); continue; }
    const sql = readFileSync(join(dir, f), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO resolve_migration_history (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`✓ ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`✗ ${f}: ${e}`);
      process.exit(1);
    }
  }
  await client.end();
}
main();
```

Add to deps: `pnpm add pg @types/pg`.

- [ ] **Step 5: Apply migrations to remote**

Run: `pnpm db:migrate:remote`
Expected: each Resolve migration printed with ✓.
Verify via Studio UI (Manex-provided) — check `signal`, `incident`, `app_user` tables exist.

- [ ] **Step 6: Commit**

```bash
git add server/db/ supabase/migrations/ scripts/apply-remote-migrations.ts
git commit -m "feat(db): resolve migrations + remote-apply script + supabase client"
```

### Task 1.5: Worker skeleton + event bus + SSE infra

**Files:**
- Create: `server/worker/index.ts`, `server/sse/event-bus.ts`, `server/sse/stream.ts`, `lib/stable-stringify.ts`
- Test: `tests/unit/stable-stringify.test.ts`

- [ ] **Step 1: TDD stable-stringify**

`tests/unit/stable-stringify.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { stableStringify } from '@lib/stable-stringify';

describe('stableStringify', () => {
  it('produces identical output regardless of key order', () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });
  it('nested objects too', () => {
    expect(stableStringify({ x: { c: 3, a: 1 } })).toBe(stableStringify({ x: { a: 1, c: 3 } }));
  });
  it('arrays preserve order', () => {
    expect(stableStringify({ a: [1, 2] })).not.toBe(stableStringify({ a: [2, 1] }));
  });
});
```

Run: fails.

- [ ] **Step 2: Implement**

`lib/stable-stringify.ts`:
```ts
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((v as any)[k])).join(',') + '}';
}
```

Run: pass.

- [ ] **Step 3: Event bus**

`server/sse/event-bus.ts`:
```ts
import { EventEmitter } from 'node:events';

export type SessionEvent = {
  seq: number;
  event: 'phase_start' | 'tool_call_start' | 'tool_call_result' | 'turn_complete'
       | 'phase_complete' | 'session_complete' | 'session_failed' | 'hint_provided' | 'token_delta';
  ts: string;
  session_id: string;
  payload: Record<string, unknown>;
};

class Bus {
  private emitter = new EventEmitter();
  emit(sessionId: string, ev: SessionEvent) { this.emitter.emit(sessionId, ev); }
  on(sessionId: string, cb: (ev: SessionEvent) => void) { this.emitter.on(sessionId, cb); return () => this.emitter.off(sessionId, cb); }
}
export const sessionBus = new Bus();
```

- [ ] **Step 4: SSE helper**

`server/sse/stream.ts`:
```ts
export function sseResponse(init: (send: (event: string, data: unknown, id?: number) => void, ping: () => void) => Promise<void> | void) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown, id?: number) => {
        const parts = [`event: ${event}`, `data: ${JSON.stringify(data)}`];
        if (id !== undefined) parts.unshift(`id: ${id}`);
        controller.enqueue(enc.encode(parts.join('\n') + '\n\n'));
      };
      const ping = () => controller.enqueue(enc.encode(`event: ping\ndata: {}\n\n`));
      const hb = setInterval(ping, 12_000);
      try { await init(send, ping); } finally { clearInterval(hb); controller.close(); }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 5: Worker skeleton**

`server/worker/index.ts`:
```ts
import 'dotenv/config';
import { sessionBus } from '@server/sse/event-bus';

type InvestigateJob = { session_id: string };

// In-process queue (single node for dev). Swap to Inngest for prod.
const queue: InvestigateJob[] = [];
let running = false;

export function enqueueInvestigate(job: InvestigateJob) { queue.push(job); if (!running) void runLoop(); }

async function runLoop() {
  running = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      const { runOrchestrator } = await import('@server/agent/orchestrator');
      await runOrchestrator(job.session_id, sessionBus);
    } catch (e) {
      console.error(`worker: session ${job.session_id} failed`, e);
    }
  }
  running = false;
}

// If executed directly as `tsx watch server/worker/index.ts`, keep process alive
if (process.argv[1]?.endsWith('worker/index.ts')) {
  console.log('worker: idle (polling every 2s)');
  setInterval(() => { /* in-memory only — routes call enqueueInvestigate directly */ }, 2000);
}
```

- [ ] **Step 6: Re-enable concurrent dev + smoke test**

Update `package.json` `dev` back to: `"concurrently \"next dev\" \"pnpm worker:dev\""`.

Run: `pnpm dev`. Expect Next.js on 3000 + worker idle message. Both alive. Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add server/worker server/sse lib/stable-stringify.ts tests/unit/stable-stringify.test.ts package.json
git commit -m "feat(worker,sse): event bus + SSE helpers + in-process worker skeleton"
```

### Task 1.6: Auth guards + health API

**Files:**
- Create: `server/auth/demo-user.ts`, `server/auth/guards.ts`, `server/auth/rbac-matrix.ts`, `app/api/system/health/route.ts`

- [ ] **Step 1: Demo user resolver**

`server/auth/demo-user.ts`:
```ts
import { manex } from '@server/db/client';

export type DemoUser = { user_id: string; name: string; role: 'operator'|'engineer'|'leadership' };

export async function resolveDemoUser(req: Request): Promise<DemoUser | null> {
  const header = process.env.DEMO_USER_HEADER || 'X-Demo-User';
  const uid = req.headers.get(header);
  if (!uid) return null;
  const { data } = await manex().from('app_user').select('user_id,name,role').eq('user_id', uid).single();
  return data as DemoUser | null;
}
```

- [ ] **Step 2: Guard middleware**

`server/auth/guards.ts`:
```ts
import { resolveDemoUser, type DemoUser } from './demo-user';

export function withGuard<T>(
  required: DemoUser['role'] | DemoUser['role'][],
  handler: (req: Request, ctx: { user: DemoUser; params: Record<string, string> }) => Promise<Response>,
) {
  return async (req: Request, { params }: { params: Record<string, string> | Promise<Record<string, string>> }) => {
    const user = await resolveDemoUser(req);
    const p = await Promise.resolve(params);
    if (!user) return Response.json({ code: 'unauthorized', message: 'missing X-Demo-User', retryable: false }, { status: 401 });
    const allowed = Array.isArray(required) ? required : [required];
    if (!allowed.includes(user.role)) {
      return Response.json({ code: 'forbidden', message: `requires role(s): ${allowed.join(',')}`, retryable: false }, { status: 403 });
    }
    return handler(req, { user, params: p });
  };
}
```

- [ ] **Step 3: Health endpoint**

`app/api/system/health/route.ts`:
```ts
import { anthropicCircuitStatus } from '@server/models/anthropic';
import { embeddingServiceHealthy } from '@server/models/openai';

export async function GET() {
  const anth = anthropicCircuitStatus();
  const emb = embeddingServiceHealthy();
  return Response.json({
    embedding_service: emb.ok ? 'ok' : 'degraded',
    embedding_cooldown_ms: emb.cooldown_ms,
    anthropic_circuit: anth.open ? 'cooldown' : 'ok',
    anthropic_cooldown_ms: anth.cooldown_ms,
    pending_embeddings_count: 0, // fill in M6 backfill task
    closure_monitor_paused: false,
  });
}
```

- [ ] **Step 4: Smoke test**

Run: `pnpm dev` then `curl http://localhost:3000/api/system/health`
Expected JSON with `embedding_service: "ok"`.

- [ ] **Step 5: Commit**

```bash
git add server/auth app/api/system
git commit -m "feat(auth,api): demo-user guards + /api/system/health"
```

---

## Milestone 2 — Classify Phase Spike

**Target: One incident fixture → Haiku Classify call with compiled prompts → structured Zod output. The whole prompt/tool pipeline is exercised end-to-end on a minimal path.**

### Task 2.1: Prompt build system

**Files:**
- Create: `server/prompts/system/base.md`, `server/prompts/phase/classify.md`, `scripts/prompts-build.ts`, `server/prompts/generated/.gitkeep`

- [ ] **Step 1: Write `base.md` (grounding rules)**

`server/prompts/system/base.md` — write the full content per spec §8.3. Include all 6 grounding rules verbatim. Mark `<CACHE/>` at the end. Keep to ~300 words (this prefix is cached forever).

- [ ] **Step 2: Write `classify.md`**

`server/prompts/phase/classify.md`:
```
You classify a quality incident into one of five archetypes.

Archetypes:
- supplier: defect correlates with a supplier batch or incoming part
- drift: process / tool / station drift over time
- design: field failures without factory-defect precursor (thermal, wear)
- operator: operator-specific handling pattern
- unknown: not enough signal to classify confidently

Given the incident payload (signals, structured references), emit JSON matching this shape:
{
  "archetype": "supplier"|"drift"|"design"|"operator"|"unknown",
  "severity_assessment": "low"|"medium"|"high"|"critical",
  "confidence": 0.0-1.0,
  "reasoning": "1-3 sentences in [[reasoning]] — no tool-cite required here, this is pure inference from the payload itself",
  "suggested_playbook": "supplier"|"drift"|"design"|"operator"|"unknown",
  "signature_text": "120-220 word condensed abstract of the incident for downstream retrieval"
}

{{incident_payload}}
{{lessons_prior}}
```

- [ ] **Step 3: Write prompts-build script**

`scripts/prompts-build.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { argv } from 'process';

const ROOT = 'server/prompts';
const OUT = join(ROOT, 'generated');
const check = argv.includes('--check');

function compile(file: string): string {
  const src = readFileSync(file, 'utf8');
  const name = basename(file, '.md');
  const parts = src.split('<CACHE/>');
  // Emit TS module exporting the cache-segmented blocks.
  return [
    `// AUTO-GENERATED from ${file}. DO NOT EDIT. Run pnpm prompts:build.`,
    `export const ${toId(name)}_BLOCKS = ${JSON.stringify(parts.map(p => p.trim()))} as const;`,
    `export const ${toId(name)} = ${JSON.stringify(src)} as const;`,
  ].join('\n');
}

function toId(s: string) { return s.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase(); }

function walk(dir: string, files: string[] = []) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory() && f.name !== 'generated') walk(join(dir, f.name), files);
    else if (f.isFile() && f.name.endsWith('.md')) files.push(join(dir, f.name));
  }
  return files;
}

const files = walk(ROOT);
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

let drift = false;
for (const f of files) {
  const outName = f.replace(/^server\/prompts\//, '').replace(/\//g, '.').replace(/\.md$/, '.ts');
  const outPath = join(OUT, outName);
  const ts = compile(f);
  if (check) {
    const existing = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
    if (existing !== ts) { console.error(`DRIFT: ${outPath}`); drift = true; }
  } else {
    writeFileSync(outPath, ts);
    console.log(`✓ ${outPath}`);
  }
}
if (check && drift) process.exit(1);
if (!check) writeFileSync(join(OUT, '.gitkeep'), '');
```

- [ ] **Step 4: Run build**

Run: `pnpm prompts:build`
Expected: `✓ generated/system.base.ts`, `✓ generated/phase.classify.ts`.

- [ ] **Step 5: Commit**

```bash
git add server/prompts scripts/prompts-build.ts
git commit -m "feat(prompts): base + classify prompts + build script"
```

### Task 2.2: Classify phase implementation

**Files:**
- Create: `server/agent/phases/classify.ts`, `schemas/tool-io.ts` (minimal ClassifyOutput)
- Test: `tests/integration/classify.test.ts`

- [ ] **Step 1: Write ClassifyOutput schema**

Extend `schemas/tool-io.ts`:
```ts
import { z } from 'zod';
import { Archetype, Severity } from './incident';

export const ClassifyOutput = z.object({
  archetype: Archetype,
  severity_assessment: Severity,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
  suggested_playbook: Archetype,
  signature_text: z.string().min(120).max(1500),
});
export type ClassifyOutput = z.infer<typeof ClassifyOutput>;
```

- [ ] **Step 2: Write failing test with fixture**

`tests/fixtures/incidents/story-1.json`: minimal handcrafted incident + 3 signals reflecting Story 1 (cold-solder defects on PM-00008, supplier SB-00007). Keep small — single object.

`tests/integration/classify.test.ts`:
```ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { classifyIncident } from '@server/agent/phases/classify';
import { ClassifyOutput } from '@schemas/tool-io';

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('classifyIncident', () => {
  it('classifies Story 1 as supplier', async () => {
    const fx = JSON.parse(readFileSync('tests/fixtures/incidents/story-1.json', 'utf8'));
    const out = await classifyIncident({ incident: fx.incident, signals: fx.signals, retrievedLessons: [] });
    const parsed = ClassifyOutput.parse(out.output);
    expect(parsed.archetype).toBe('supplier');
    expect(parsed.confidence).toBeGreaterThan(0.5);
    expect(parsed.signature_text.length).toBeGreaterThanOrEqual(120);
  }, 30_000);
});
```

Run: fails — `classifyIncident` undefined.

- [ ] **Step 3: Implement classify**

`server/agent/phases/classify.ts`:
```ts
import { callAnthropic } from '@server/models/anthropic';
import { SYSTEM_BASE_BLOCKS } from '@server/prompts/generated/system.base';
import { PHASE_CLASSIFY } from '@server/prompts/generated/phase.classify';
import { ClassifyOutput } from '@schemas/tool-io';
import type { Incident, Signal } from '@schemas/index';

type ClassifyInput = {
  incident: Incident;
  signals: Signal[];
  retrievedLessons: { id: string; title: string; prompt_snippet: string }[];
};
type ClassifyResult = {
  output: ClassifyOutput;
  usage: { input_tokens: number; output_tokens: number; cache_creation: number; cache_read: number };
};

export async function classifyIncident(input: ClassifyInput): Promise<ClassifyResult> {
  const incidentPayload = JSON.stringify({
    incident: { id: input.incident.id, archetype_hint: input.incident.archetype, severity: input.incident.severity, title: input.incident.title, summary: input.incident.summary, primary_product_id: input.incident.primary_product_id },
    signals: input.signals.map(s => ({
      id: s.id, source: s.source, raw_text: s.raw_text,
      product_id: s.product_id, defect_code: s.defect_code, section_id: s.section_id,
      batch_id: s.batch_id, severity: s.severity, captured_ts: s.captured_ts,
    })),
  });
  const lessonsBlock = input.retrievedLessons.length
    ? 'Prior lessons (retrieved via semantic similarity):\n' +
      input.retrievedLessons.map(l => `- [${l.id}] ${l.title}\n${l.prompt_snippet}`).join('\n---\n')
    : 'No prior lessons retrieved.';

  const userText = PHASE_CLASSIFY
    .replace('{{incident_payload}}', incidentPayload)
    .replace('{{lessons_prior}}', lessonsBlock);

  const sysBlocks = SYSTEM_BASE_BLOCKS.map((text, i) => ({
    type: 'text' as const,
    text,
    ...(i < SYSTEM_BASE_BLOCKS.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }));

  const res = await callAnthropic({
    model: 'claude-haiku-4-5-20251001',
    system: sysBlocks,
    messages: [{ role: 'user', content: userText }],
    max_tokens: 600,
  });

  const text = res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('\n');
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('classify: no JSON in response');
  const parsed = ClassifyOutput.parse(JSON.parse(jsonMatch[0]));
  return {
    output: parsed,
    usage: {
      input_tokens: res.usage?.input_tokens ?? 0,
      output_tokens: res.usage?.output_tokens ?? 0,
      cache_creation: (res.usage as any)?.cache_creation_input_tokens ?? 0,
      cache_read: (res.usage as any)?.cache_read_input_tokens ?? 0,
    },
  };
}
```

- [ ] **Step 4: Run test**

Run: `pnpm vitest run tests/integration/classify.test.ts`
Expected: 1 passed. Cost ~$0.002.

If it fails because Haiku returns different JSON shape: refine `PHASE_CLASSIFY` prompt to be more explicit about output format (e.g., "Respond with ONLY the JSON object, no prose").

- [ ] **Step 5: Commit**

```bash
git add schemas/tool-io.ts server/agent/phases/classify.ts tests/integration/classify.test.ts tests/fixtures/incidents/story-1.json
git commit -m "feat(classify): Haiku classifier with Zod-parsed output + Story 1 test"
```

---

## Milestone 3 — Investigate Phase + 8 MVP Tools

**Target: Bounded ReAct loop with 8 functional tools. Story 1 fixture runs through Investigate, emits evidence_ledger ≥3 tool calls, hits Zod terminal shape.**

### Task 3.1: Tool registry + Zod I/O base

**Files:**
- Create: `server/tools/types.ts`, `server/tools/index.ts`

- [ ] **Step 1: Tool types**

`server/tools/types.ts`:
```ts
import type { ZodTypeAny } from 'zod';

export type ToolSpec<In extends ZodTypeAny, Out extends ZodTypeAny> = {
  name: string;
  description: string;
  input_schema: In;
  output_schema: Out;
  write_gated?: boolean;
  handler: (input: ReturnType<In['parse']>, ctx: ToolCtx) => Promise<ReturnType<Out['parse']>>;
};

export type ToolCtx = {
  session_id: string;
  incident_id: string;
  user_id: string;
};

export type ToolResult =
  | { ok: true; output: unknown }
  | { ok: false; error: { code: string; message: string; retryable: boolean; details?: unknown } };
```

- [ ] **Step 2: Registry**

`server/tools/index.ts`:
```ts
import type { ToolSpec, ToolCtx, ToolResult } from './types';
import type { ZodTypeAny } from 'zod';

const registry = new Map<string, ToolSpec<any, any>>();
export function registerTool<I extends ZodTypeAny, O extends ZodTypeAny>(spec: ToolSpec<I, O>) {
  registry.set(spec.name, spec);
}
export function getTool(name: string): ToolSpec<any, any> | undefined { return registry.get(name); }
export function allTools() { return Array.from(registry.values()); }
export function nonWriteTools() { return allTools().filter(t => !t.write_gated); }

export async function invokeTool(name: string, rawInput: unknown, ctx: ToolCtx): Promise<ToolResult> {
  const spec = registry.get(name);
  if (!spec) return { ok: false, error: { code: 'unknown_tool', message: name, retryable: false } };
  const parsed = spec.input_schema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: { code: 'invalid_input', message: parsed.error.message, retryable: false, details: parsed.error.issues } };
  try {
    const output = await spec.handler(parsed.data, ctx);
    const parsedOut = spec.output_schema.safeParse(output);
    if (!parsedOut.success) return { ok: false, error: { code: 'invalid_output', message: parsedOut.error.message, retryable: false } };
    return { ok: true, output: parsedOut.data };
  } catch (e: any) {
    return { ok: false, error: { code: 'tool_exception', message: e?.message ?? String(e), retryable: e?.status === 429 || e?.status >= 500 } };
  }
}

// Side-effect import to auto-register all tools:
import './signal-incident/get-incident';
import './signal-incident/list-signals-for-incident';
import './signal-incident/find-related-incidents';
import './retrieval/query-defects';
import './retrieval/trace-batch';
import './retrieval/bom-parts-for-product';
import './retrieval/pareto-defect-codes';
import './retrieval/test-results-marginal';
import './cross-boundary/field-vs-factory-gap';
import './cross-boundary/operator-effect-analysis';
import './cross-boundary/rework-timeline-by-section';
import './cross-boundary/weekly-quality-summary';
import './semantic-vision-lessons/semantic-search-signals';
import './semantic-vision-lessons/retrieve-lessons';
import './semantic-vision-lessons/classify-defect-image';
import './simulation/simulate-impact';
import './write-gated/create-initiative';
import './write-gated/register-closure-predicate';
import './write-gated/emit-lesson';
```

- [ ] **Step 3: Commit**

```bash
git add server/tools/types.ts server/tools/index.ts
git commit -m "feat(tools): registry + invokeTool with Zod I/O guards"
```

### Task 3.2: Implement 4 MVP retrieval tools (functional, real DB)

**Files:**
- Create: `server/tools/signal-incident/get-incident.ts`, `list-signals-for-incident.ts`, `server/tools/retrieval/query-defects.ts`, `pareto-defect-codes.ts`
- Test: `tests/integration/tools-query-defects.test.ts`, `tests/integration/tools-pareto.test.ts`

- [ ] **Step 1: Write failing integration test for query_defects**

`tests/integration/tools-query-defects.test.ts`:
```ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { invokeTool } from '@server/tools/index';

describe.skipIf(!process.env.MANEX_API_KEY)('query_defects', () => {
  it('returns rows for PM-00008 cold_solder window', async () => {
    const res = await invokeTool('query_defects', { product_id: 'PM-00008', defect_code: 'COLD_SOLDER', limit: 50 },
      { session_id: 'SES-TEST', incident_id: 'INC-TEST', user_id: 'user_eng_anna' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Array.isArray((res.output as any).rows)).toBe(true);
    }
  });
});
```

Run: fails — tool not registered.

- [ ] **Step 2: Implement query_defects**

`server/tools/retrieval/query-defects.ts`:
```ts
import { z } from 'zod';
import { registerTool } from '../index';
import { manex } from '@server/db/client';

const Input = z.object({
  product_id: z.string().optional(),
  defect_code: z.string().optional(),
  section_id: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

const Output = z.object({
  rows: z.array(z.object({
    defect_id: z.string(),
    product_id: z.string(),
    ts: z.string(),
    defect_code: z.string().nullable(),
    severity: z.string().nullable(),
    detected_section_id: z.string().nullable(),
    reported_part_number: z.string().nullable(),
    cost: z.number().nullable(),
    notes: z.string().nullable(),
  })),
  total: z.number(),
  truncated: z.boolean(),
});

registerTool({
  name: 'query_defects',
  description: 'Query Manex defect table with filters. Returns rows sorted by ts desc, capped at limit.',
  input_schema: Input,
  output_schema: Output,
  async handler(input) {
    let q = manex().from('defect').select('*', { count: 'exact' }).order('ts', { ascending: false }).limit(input.limit);
    if (input.product_id)   q = q.eq('product_id', input.product_id);
    if (input.defect_code)  q = q.eq('defect_code', input.defect_code);
    if (input.section_id)   q = q.or(`detected_section_id.eq.${input.section_id},occurrence_section_id.eq.${input.section_id}`);
    if (input.date_from)    q = q.gte('ts', input.date_from);
    if (input.date_to)      q = q.lte('ts', input.date_to);
    const { data, count, error } = await q;
    if (error) throw new Error(`query_defects: ${error.message}`);
    const rows = (data ?? []).map((r: any) => ({
      defect_id: r.defect_id, product_id: r.product_id, ts: r.ts,
      defect_code: r.defect_code, severity: r.severity,
      detected_section_id: r.detected_section_id, reported_part_number: r.reported_part_number,
      cost: r.cost, notes: r.notes,
    }));
    return { rows, total: count ?? rows.length, truncated: (count ?? 0) > rows.length };
  },
});
```

- [ ] **Step 3: Run test → pass**

Run: `pnpm vitest run tests/integration/tools-query-defects.test.ts` → 1 passed.

- [ ] **Step 4: Implement pareto_defect_codes, get_incident, list_signals_for_incident**

Each similar pattern — single file, Zod I/O, real Supabase query. For `pareto_defect_codes`:
- Input: `{ product_id?, section_id?, window_days?, top_n?=10 }`
- Output: `{ items: [{ defect_code, count, pct_of_total }], total }`
- Impl: `.from('defect').select('defect_code')` with filters, group-by in app-layer.

For `get_incident` and `list_signals_for_incident`: query our Resolve `incident` + `signal` tables via manex client (same Postgres).

- [ ] **Step 5: Tests for each**

Add 3 integration tests. Each ~15 lines. Verify shape + at least non-empty rows on seeded data.

- [ ] **Step 6: Commit**

```bash
git add server/tools/retrieval server/tools/signal-incident tests/integration/tools-*
git commit -m "feat(tools): query_defects, pareto_defect_codes, get_incident, list_signals_for_incident (functional)"
```

### Task 3.3: Implement 4 more MVP tools (trace_batch, bom_parts, field_vs_factory_gap, retrieve_lessons)

**Files:**
- Create: `server/tools/retrieval/trace-batch.ts`, `bom-parts-for-product.ts`, `server/tools/cross-boundary/field-vs-factory-gap.ts`, `server/tools/semantic-vision-lessons/retrieve-lessons.ts`
- Test: `tests/integration/tools-trace-batch.test.ts`, `tests/integration/tools-retrieve-lessons.test.ts`

- [ ] **Step 1: trace_batch**

Input: `{ batch_id: string }` → Output: `{ batch, supplier, parts_installed: [{ product_id, install_ts, part_number }], defects: [...] }`. Joins `supplier_batch` + `part` + `part_installation` + `defect`. Write full query in handler.

- [ ] **Step 2: bom_parts_for_product**

Input: `{ product_id }` → Output: `{ parts: [{ part_number, batch_id, supplier, position_code }] }`. Uses view `v_product_bom_parts` if Harjot's migrations added it; else manual join.

- [ ] **Step 3: field_vs_factory_gap**

Input: `{ product_id, window_days=90 }` → Output: `{ factory_defect_count, field_claim_count, gap_ratio, field_claims: [...], factory_defects: [...] }`. This is the Story-3 signature tool.

- [ ] **Step 4: retrieve_lessons**

For M3, implement against a seeded `lesson` table. If pgvector extension not yet up (Harjot's 00012 migration), fall back to plain ILIKE on `signature_text` OR return stub-empty. Prefer real pgvector — write:
```ts
const { data } = await manex().rpc('retrieve_lessons_by_similarity', {
  query_embedding: emb,
  limit: input.top_k,
  min_cosine: 0.75,
});
```
(Assumes Harjot adds a SQL function `retrieve_lessons_by_similarity` — if not, inline `SELECT *, 1 - (embedding <=> :query_embedding) AS cosine FROM lesson WHERE engineer_validated='approved' AND superseded_by IS NULL ORDER BY embedding <=> :query_embedding LIMIT :top_k`.)

- [ ] **Step 5: Tests + commit**

Integration test for `trace_batch` on SB-00007 (known from Story 1 seeded data). Verify non-empty. Similar for `field_vs_factory_gap` on PM-00015 (Story 3 product).

```bash
git add server/tools/retrieval/trace-batch.ts server/tools/retrieval/bom-parts-for-product.ts server/tools/cross-boundary/field-vs-factory-gap.ts server/tools/semantic-vision-lessons/retrieve-lessons.ts tests/integration/tools-trace-batch.test.ts tests/integration/tools-retrieve-lessons.test.ts
git commit -m "feat(tools): trace_batch, bom_parts_for_product, field_vs_factory_gap, retrieve_lessons"
```

### Task 3.4: Stub 9 remaining tools

**Files:**
- Create: stubs for `find-related-incidents.ts`, `test-results-marginal.ts`, `operator-effect-analysis.ts`, `rework-timeline-by-section.ts`, `weekly-quality-summary.ts`, `semantic-search-signals.ts`, `classify-defect-image.ts`, `simulate-impact.ts`, `emit-lesson.ts`

- [ ] **Step 1: Write minimum-viable stubs**

Each stub: Zod I/O identical to spec §9.1, handler returns typed mock data. Example for `simulate_impact`:
```ts
registerTool({
  name: 'simulate_impact',
  description: 'Rule-based prior + lesson-similarity for predicted impact. STUB: returns heuristic.',
  input_schema: z.object({ initiative_template: z.record(z.unknown()), incident_context: z.record(z.unknown()) }),
  output_schema: z.object({
    expected_defect_reduction: z.number(),
    confidence: z.number(),
    horizon_days: z.number(),
    methodology_note: z.string(),
  }),
  async handler(input) {
    // Stub: heuristic estimate. Real impl (M6) uses lesson-embedding similarity.
    return {
      expected_defect_reduction: 0.35,
      confidence: 0.6,
      horizon_days: 90,
      methodology_note: 'Stub heuristic; replace with real simulator in M6',
    };
  },
});
```

For `classify_defect_image`: returns canned label map based on URL pattern match (`defect_01_cold_solder` → `cold_solder`).

For `semantic_search_signals`: no-op until pgvector live; return `{ rows: [], total: 0 }`.

For `emit_lesson`: write-gated stub — returns `{ lesson_id: 'LES-STUB-' + Date.now() }` without actually writing to DB.

- [ ] **Step 2: Commit**

```bash
git add server/tools/**/*.ts
git commit -m "feat(tools): stubs for 9 non-MVP tools with typed mock returns"
```

### Task 3.5: Build tools.auto.md from registry

**Files:**
- Modify: `scripts/prompts-build.ts` (extend) OR
- Create: `scripts/build-tools-md.ts`

- [ ] **Step 1: Extend prompts build to emit tools.auto.md**

Add to `scripts/prompts-build.ts` (after the walk):
```ts
// Generate tools.auto.md from registry
import { allTools } from '../server/tools/index';
import { zodToJsonSchema } from 'zod-to-json-schema';  // pnpm add zod-to-json-schema
await import('../server/tools/index');  // triggers registration side-effects
const tools = allTools();
const toolsMd = [
  '# Available tools',
  '',
  ...tools.map(t => `## \`${t.name}\`\n${t.description}\n\n**Input schema:**\n\`\`\`json\n${JSON.stringify(zodToJsonSchema(t.input_schema, { target: 'openApi3' }), null, 2)}\n\`\`\`\n`),
].join('\n');
writeFileSync('server/prompts/system/tools.auto.md', toolsMd);
```

Add `pnpm add zod-to-json-schema`.

- [ ] **Step 2: Run**

Run: `pnpm prompts:build` → expect `server/prompts/system/tools.auto.md` created + `generated/system.tools.ts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/prompts-build.ts server/prompts/system/tools.auto.md package.json
git commit -m "feat(prompts): auto-generate tools.auto.md from registry"
```

### Task 3.6: Investigate phase with ReAct loop

**Files:**
- Create: `server/agent/phases/investigate.ts`, `server/agent/stall-detector.ts`, `server/prompts/phase/investigate.md`
- Test: `tests/integration/investigate.test.ts`

- [ ] **Step 1: Write investigate.md**

`server/prompts/phase/investigate.md`:
```
You are investigating an incident using typed tools. Max 8 turns. At any turn you may call one or more tools, or emit a final JSON.

On each turn either:
A) call tool(s) via the SDK tool_use protocol with typed inputs, OR
B) emit the final result (wrapped in ```json ... ``` fence) matching:
{
  "evidence_ledger": [{ "tool_call_id": "...", "tool": "...", "summary": "...[[tc:id]]" }],
  "root_cause_hypotheses": [{ "hypothesis": "...", "evidence": [{ "tool_call_id": "..." }], "confidence": 0.0-1.0 }],
  "confidence": 0.0-1.0
}

Grounding:
- Every numeric / ID / KPI claim MUST have a [[tc:tool_call_id]] nearby (within 40 chars) in the "summary" text of evidence_ledger and in hypothesis descriptions.
- Inferences without direct tool evidence: mark with [[reasoning]], but NEVER near a number/ID.
- Use the archetype playbook's tool chain as a starting point, deviate only when signals contradict.
- If you stall or can't find evidence: call `request_hint` (synthetic tool — emit {"action":"request_hint","question":"..."}).

{{incident_summary}}
{{classify_output}}
{{playbook}}
{{lessons_prior}}
```

- [ ] **Step 2: Stall detector**

`server/agent/stall-detector.ts`:
```ts
import { createHash } from 'node:crypto';
import { stableStringify } from '@lib/stable-stringify';

export class StallDetector {
  private lastHash: string | null = null;
  check(toolName: string, input: unknown): { stalled: boolean; reason?: string } {
    const h = createHash('sha256').update(stableStringify({ t: toolName, i: input })).digest('hex');
    const stalled = h === this.lastHash;
    this.lastHash = h;
    return stalled ? { stalled: true, reason: `same (${toolName}, input) twice in a row` } : { stalled: false };
  }
}
```

Unit test:
```ts
// tests/unit/stall-detector.test.ts
import { describe, it, expect } from 'vitest';
import { StallDetector } from '@server/agent/stall-detector';

describe('StallDetector', () => {
  it('flags identical consecutive calls', () => {
    const d = new StallDetector();
    expect(d.check('x', { a: 1 }).stalled).toBe(false);
    expect(d.check('x', { a: 1 }).stalled).toBe(true);
  });
  it('ignores non-consecutive repeats', () => {
    const d = new StallDetector();
    d.check('x', {}); d.check('y', {}); expect(d.check('x', {}).stalled).toBe(false);
  });
});
```

Run: pass.

- [ ] **Step 3: Implement investigate**

`server/agent/phases/investigate.ts`:
```ts
import { callAnthropic } from '@server/models/anthropic';
import { SYSTEM_BASE_BLOCKS } from '@server/prompts/generated/system.base';
import { PHASE_INVESTIGATE } from '@server/prompts/generated/phase.investigate';
import { nonWriteTools, invokeTool } from '@server/tools/index';
import { StallDetector } from '@server/agent/stall-detector';
import type { Incident, Signal } from '@schemas/index';
import type Anthropic from '@anthropic-ai/sdk';

const MAX_TURNS = Number(process.env.INVESTIGATE_MAX_TURNS ?? 8);

type InvestigateInput = {
  session_id: string;
  incident: Incident;
  signals: Signal[];
  classifyOutput: { archetype: string; suggested_playbook: string };
  playbookText: string;
  lessonsBlock: string;
  onTurn?: (turn: any) => void;
};

export async function runInvestigate(input: InvestigateInput) {
  const tools = nonWriteTools().map(t => ({
    name: t.name,
    description: t.description,
    input_schema: (() => {
      const schema = (require('zod-to-json-schema') as any).zodToJsonSchema(t.input_schema, { target: 'openApi3' });
      return schema;
    })(),
  })) as Anthropic.Tool[];

  const sysBlocks = [
    ...SYSTEM_BASE_BLOCKS.map((text, i) => ({ type: 'text' as const, text, ...(i < SYSTEM_BASE_BLOCKS.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}) })),
    { type: 'text' as const, text: PHASE_INVESTIGATE
        .replace('{{incident_summary}}', JSON.stringify({ id: input.incident.id, title: input.incident.title, summary: input.incident.summary, primary_product_id: input.incident.primary_product_id }))
        .replace('{{classify_output}}', JSON.stringify(input.classifyOutput))
        .replace('{{playbook}}', input.playbookText)
        .replace('{{lessons_prior}}', input.lessonsBlock),
      cache_control: { type: 'ephemeral' as const } },
  ];

  const messages: Anthropic.MessageParam[] = [];
  const evidence: Array<{ tool_call_id: string; tool: string; summary: string }> = [];
  const stall = new StallDetector();
  const ctx = { session_id: input.session_id, incident_id: input.incident.id, user_id: 'system' };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await callAnthropic({
      model: 'claude-sonnet-4-6',
      system: sysBlocks,
      messages,
      tools,
      max_tokens: 3000,
    });

    const toolUses = res.content.filter((c: any) => c.type === 'tool_use');
    if (!toolUses.length) {
      // terminal emit — parse JSON block
      const textBlock = res.content.find((c: any) => c.type === 'text') as any;
      const fenced = textBlock?.text?.match(/```json\s*([\s\S]*?)```/);
      if (!fenced) throw new Error('investigate: no terminal JSON and no tool_use');
      const terminal = JSON.parse(fenced[1]);
      return { terminal, evidence, turns: turn + 1, usage: res.usage };
    }

    // Execute each tool_use
    const toolResults: any[] = [];
    for (const use of toolUses as any[]) {
      const stallCheck = stall.check(use.name, use.input);
      if (stallCheck.stalled) {
        toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify({ error: { code: 'stall_loop', message: stallCheck.reason, retryable: false } }), is_error: true });
        continue;
      }
      const result = await invokeTool(use.name, use.input, ctx);
      toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(result.ok ? result.output : { error: result.error }), is_error: !result.ok });
      if (result.ok) evidence.push({ tool_call_id: use.id, tool: use.name, summary: `${use.name}(${JSON.stringify(use.input).slice(0, 80)})` });
      input.onTurn?.({ turn, tool: use.name, ok: result.ok });
    }

    // Append assistant message + tool_result reply
    messages.push({ role: 'assistant', content: res.content as any });
    messages.push({ role: 'user', content: toolResults as any });
  }

  throw new Error('investigate: max_turns exceeded');
}
```

- [ ] **Step 4: Integration test for Story 1**

`tests/integration/investigate.test.ts`:
```ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { runInvestigate } from '@server/agent/phases/investigate';

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('investigate', () => {
  it('Story 1 terminates with evidence_ledger', async () => {
    const fx = JSON.parse(readFileSync('tests/fixtures/incidents/story-1.json', 'utf8'));
    const playbookText = readFileSync('server/prompts/playbooks/supplier.md', 'utf8');
    const res = await runInvestigate({
      session_id: 'SES-TEST-1',
      incident: fx.incident,
      signals: fx.signals,
      classifyOutput: { archetype: 'supplier', suggested_playbook: 'supplier' },
      playbookText,
      lessonsBlock: 'No prior lessons retrieved.',
    });
    expect(res.turns).toBeGreaterThan(0);
    expect(res.terminal.evidence_ledger.length).toBeGreaterThanOrEqual(2);
    expect(res.terminal.root_cause_hypotheses.length).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
```

Also write the supplier playbook:

`server/prompts/playbooks/supplier.md`:
```
## Supplier archetype playbook

### Typical signature
- Cluster of same defect_code on one product_id within a 1-3 week window
- Defect-code-to-part-number-to-supplier-batch chain resolvable
- Incoming inspection (incoming ESR, torque) shows marginal prior to rejects

### Investigation sequence (suggested)
1. `pareto_defect_codes` on the affected product(s) — identify dominant code
2. `query_defects` for that code over 30d — time-series confirms cluster
3. `bom_parts_for_product` — map the code to part_number
4. `trace_batch` on the implicated batch_id — identify supplier + install-window
5. `field_vs_factory_gap` — confirm containment vs. escape

### Root-cause template
"<n> defects with code <X> on <product_id> trace to supplier batch <SB-id> from <supplier>, installed in <date_range>."

### Typical initiatives
- Production / manex_native: add incoming-inspection step for defect_code
- Supplier / email_stub: issue 8D to supplier, attach trace data
- R&D / manex_native: update part spec with tighter tolerance

### Few-shot example (condensed, ~180 tokens)
Incident: 42 cold-solder defects on PM-00008, W48-W49.
Classify → supplier. Investigate:
- pareto → cold_solder is 74% of PM-00008 defects last 30d
- query_defects → all 42 events in W48-W49
- bom_parts_for_product → PRT-00012 (100µF cap) in position C14
- trace_batch → all 42 link to SB-00007 from SUP-00007 (ElektroParts), installed 2026-W47
- field_vs_factory_gap → 0 field claims yet → contained
Root cause: ElektroParts batch SB-00007 100µF capacitors installed W47 show high cold-solder incidence, likely ESR out-of-spec at incoming.
```

Also add drift.md, design.md, operator.md, unknown.md (~150 tokens each, similar shape).

- [ ] **Step 5: Run test**

Run: `pnpm vitest run tests/integration/investigate.test.ts`
Expected: 1 passed. Cost ~$0.05-0.10.

If it fails on "no terminal JSON" — refine `investigate.md` prompt to be stricter about JSON emission, or add a fallback message "Please emit the terminal JSON now" if no tool_use + no terminal JSON.

- [ ] **Step 6: Commit**

```bash
git add server/agent/phases/investigate.ts server/agent/stall-detector.ts server/prompts tests/integration/investigate.test.ts tests/unit/stall-detector.test.ts
git commit -m "feat(investigate): ReAct loop with stall detector + supplier playbook + Story 1 test"
```

---

## Milestone 4 — Compose + Propose

**Target: From Investigate output, generate 8D report + 2+ initiatives with closure predicates and simulate_impact-cited impact_estimate. Story 1 passes end-to-end through 4 phases.**

### Task 4.1: Compose phase

**Files:**
- Create: `server/agent/phases/compose.ts`, `server/prompts/phase/compose.md`, `schemas/compose-output.ts`
- Test: `tests/integration/compose.test.ts`

- [ ] **Step 1: Write compose.md + schema**

Content and shape per spec §7.1, §7.5. Compose takes compact input (evidence_ledger + hypotheses + selected tool summaries — NOT full transcript per locked decision). Outputs `{ report_8d: { D1..D8 with evidence[] }, visualizations: [...] }`.

- [ ] **Step 2: Test + implement**

Pattern identical to Task 2.2 and Task 3.6. Uses Sonnet 4.6. ~2500 output tokens.

- [ ] **Step 3: Commit**

```bash
git add server/agent/phases/compose.ts server/prompts/phase/compose.md schemas/compose-output.ts tests/integration/compose.test.ts
git commit -m "feat(compose): 8D report generation from evidence ledger"
```

### Task 4.2: Propose phase + evidence validator (layer 1)

**Files:**
- Create: `server/agent/phases/propose.ts`, `server/prompts/phase/propose.md`, `server/agent/evidence-validator.ts`, `schemas/propose-output.ts`
- Test: `tests/integration/propose.test.ts`, `tests/unit/evidence-validator.test.ts`

- [ ] **Step 1: Write propose.md**

Prompt must force Propose to invoke `simulate_impact` for every initiative's impact_estimate. Example in prompt:
```
For each initiative, call simulate_impact(template, incident_context) FIRST, then reference its tool_call_id in impact_estimate.evidence.
```

- [ ] **Step 2: Evidence validator (Layer 1 — structured)**

`server/agent/evidence-validator.ts`:
```ts
export type EvidenceClaim = { tool_call_id: string; note?: string };

export type ValidationError =
  | { code: 'missing_structured_evidence'; path: string }
  | { code: 'hallucinated_tool_call_id'; path: string; id: string }
  | { code: 'reasoning_near_number'; excerpt: string }
  | { code: 'uncited_number'; excerpt: string }
  | { code: 'uncited_id'; excerpt: string };

export function validateStructuredEvidence(
  obj: any,
  path: string,
  knownToolCallIds: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!Array.isArray(obj?.evidence) || obj.evidence.length === 0) {
    errors.push({ code: 'missing_structured_evidence', path });
  } else {
    for (let i = 0; i < obj.evidence.length; i++) {
      const id = obj.evidence[i]?.tool_call_id;
      if (typeof id !== 'string' || !knownToolCallIds.has(id)) {
        errors.push({ code: 'hallucinated_tool_call_id', path: `${path}.evidence[${i}]`, id });
      }
    }
  }
  return errors;
}

export function validateInlineMarkers(text: string, knownToolCallIds: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const numericRe = /(\d+\s*(?:µF|kg|mm|%|rows|days|€|W\d+|cells|ppm)|\b\d{2,}\b)/gi;
  const idRe = /\b(PRD|SB|PA|DEF|PM|SUP|FC|TR|PRT|INC|SES|INI|LES|IMP)-\d+\b/g;
  const tcRe = /\[\[tc:([^\]]+)\]\]/g;
  const reasoningRe = /\[\[reasoning\]\]/g;

  // Collect all [[tc:id]] positions + ids
  const tcPositions: Array<{ start: number; id: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = tcRe.exec(text))) {
    tcPositions.push({ start: m.index, id: m[1] });
    if (!knownToolCallIds.has(m[1])) errors.push({ code: 'hallucinated_tool_call_id', path: 'inline', id: m[1] });
  }
  const reasoningPositions: number[] = [];
  while ((m = reasoningRe.exec(text))) reasoningPositions.push(m.index);

  const nearMarker = (idx: number) => tcPositions.some(p => Math.abs(p.start - idx) <= 40) ||
    reasoningPositions.some(p => Math.abs(p - idx) <= 40);
  const nearReasoning = (idx: number) => reasoningPositions.some(p => Math.abs(p - idx) <= 40);

  while ((m = numericRe.exec(text))) {
    if (!nearMarker(m.index)) errors.push({ code: 'uncited_number', excerpt: text.slice(Math.max(0, m.index-20), m.index+30) });
    if (nearReasoning(m.index)) errors.push({ code: 'reasoning_near_number', excerpt: text.slice(Math.max(0, m.index-20), m.index+30) });
  }
  while ((m = idRe.exec(text))) {
    if (!tcPositions.some(p => Math.abs(p.start - m!.index) <= 40)) errors.push({ code: 'uncited_id', excerpt: text.slice(Math.max(0, m.index-20), m.index+30) });
  }
  return errors;
}
```

- [ ] **Step 3: Unit tests for validator**

```ts
// tests/unit/evidence-validator.test.ts
import { describe, it, expect } from 'vitest';
import { validateInlineMarkers, validateStructuredEvidence } from '@server/agent/evidence-validator';

describe('evidence-validator', () => {
  const known = new Set(['abc123', 'def456']);
  it('passes a well-cited sentence', () => {
    const errs = validateInlineMarkers('42 defects [[tc:abc123]] on PM-00008 [[tc:abc123]] in W48 [[tc:def456]]', known);
    expect(errs).toEqual([]);
  });
  it('flags uncited number', () => {
    const errs = validateInlineMarkers('42 defects on PM-00008 [[tc:abc123]]', known);
    expect(errs.some(e => e.code === 'uncited_number')).toBe(true);
  });
  it('flags hallucinated tc id', () => {
    const errs = validateInlineMarkers('foo [[tc:xyz999]]', known);
    expect(errs.some(e => e.code === 'hallucinated_tool_call_id')).toBe(true);
  });
  it('flags reasoning near number', () => {
    const errs = validateInlineMarkers('42 defects [[reasoning]]', known);
    expect(errs.some(e => e.code === 'reasoning_near_number')).toBe(true);
  });
  it('missing structured evidence', () => {
    const errs = validateStructuredEvidence({ hypothesis: 'x' }, 'path', known);
    expect(errs[0].code).toBe('missing_structured_evidence');
  });
});
```

Run: 5 passed.

- [ ] **Step 4: Wire validator into Propose + Compose terminals**

After Compose / Propose Zod parse succeeds, run validator over every free-text field (D1..D8 body_markdown, initiative rationale/description). If errors: retry once with message:
```
Your previous output contained un-cited claims:
{ errors as list }
Please add [[tc:ID]] markers or restructure.
```

Max 1 retry (per spec §10.3). If still fails: session.status='stalled', failure_reason='evidence_cite_unfixable'.

- [ ] **Step 5: Propose integration test**

Run the full Classify→Investigate→Compose→Propose on Story 1 fixture. Assert:
- propose.output.initiatives.length >= 1
- each initiative.impact_estimate has evidence[] referencing a `simulate_impact` tool_call_id
- all D-sections have evidence[]

Run: 1 passed. Cost ~$0.15.

- [ ] **Step 6: Commit**

```bash
git add server/agent/phases/compose.ts server/agent/phases/propose.ts server/agent/evidence-validator.ts server/prompts/phase/compose.md server/prompts/phase/propose.md schemas/propose-output.ts schemas/compose-output.ts tests/
git commit -m "feat(compose,propose,validator): 4-phase orchestrator end-to-end on Story 1"
```

### Task 4.3: Top-level orchestrator

**Files:**
- Create: `server/agent/orchestrator.ts`
- Test: `tests/integration/orchestrator.test.ts`

- [ ] **Step 1: runOrchestrator**

`server/agent/orchestrator.ts`:
```ts
import { manex } from '@server/db/client';
import { classifyIncident } from './phases/classify';
import { runInvestigate } from './phases/investigate';
import { runCompose } from './phases/compose';
import { runPropose } from './phases/propose';
import { invokeTool } from '@server/tools/index';
import type { sessionBus } from '@server/sse/event-bus';
import { readFileSync } from 'fs';

export async function runOrchestrator(sessionId: string, bus: typeof sessionBus) {
  // 1. Load session + incident + signals
  const { data: session } = await manex().from('session').select('*').eq('id', sessionId).single();
  if (!session) throw new Error(`session ${sessionId} not found`);
  const { data: incident } = await manex().from('incident').select('*').eq('id', session.incident_id).single();
  const { data: signals } = await manex().from('signal').select('*').eq('incident_id', session.incident_id).order('captured_ts');
  if (!incident) throw new Error('incident not found');

  const seq = { n: 0 };
  const emit = (event: string, payload: any) => {
    seq.n++;
    const ev = { seq: seq.n, event: event as any, ts: new Date().toISOString(), session_id: sessionId, payload };
    bus.emit(sessionId, ev);
    // also persist to session_event (write path — implemented in Task 5.3)
  };

  try {
    emit('phase_start', { phase: 'classify' });
    const classify = await classifyIncident({ incident: incident as any, signals: (signals as any) ?? [], retrievedLessons: [] });
    emit('phase_complete', { phase: 'classify', output: classify.output });

    // Retrieve lessons (after classify → signature_text)
    const retrieved = await invokeTool('retrieve_lessons', { incident_signature_text: classify.output.signature_text, top_k: 3 },
      { session_id: sessionId, incident_id: incident.id, user_id: 'system' });
    const lessons = retrieved.ok ? (retrieved.output as any).lessons ?? [] : [];

    const playbook = classify.output.suggested_playbook;
    const playbookText = readFileSync(`server/prompts/playbooks/${playbook}.md`, 'utf8');

    emit('phase_start', { phase: 'investigate' });
    const invest = await runInvestigate({
      session_id: sessionId,
      incident: incident as any,
      signals: (signals as any) ?? [],
      classifyOutput: { archetype: classify.output.archetype, suggested_playbook: playbook },
      playbookText,
      lessonsBlock: lessons.length ? lessons.map((l: any) => `- [${l.id}] ${l.title}\n${l.prompt_snippet}`).join('\n---\n') : 'No prior lessons retrieved.',
      onTurn: (t) => emit('turn_complete', t),
    });
    emit('phase_complete', { phase: 'investigate', evidence_count: invest.evidence.length });

    emit('phase_start', { phase: 'compose' });
    const compose = await runCompose({ incident: incident as any, classify: classify.output, investigate: invest });
    emit('phase_complete', { phase: 'compose', report_id: compose.report_id });

    emit('phase_start', { phase: 'propose' });
    const propose = await runPropose({ incident: incident as any, classify: classify.output, investigate: invest, compose });
    emit('phase_complete', { phase: 'propose', initiative_count: propose.initiatives.length });

    await manex().from('session').update({ status: 'succeeded', phase: 'complete', ended_at: new Date().toISOString() }).eq('id', sessionId);
    emit('session_complete', { });
  } catch (e: any) {
    await manex().from('session').update({ status: 'failed', phase: 'failed', ended_at: new Date().toISOString(), failure_reason: classifyFailure(e) }).eq('id', sessionId);
    emit('session_failed', { reason: e?.message });
    throw e;
  }
}

function classifyFailure(e: any): string {
  if (e?.message?.includes('max_turns')) return 'max_turns';
  if (e?.message?.includes('stall')) return 'stall_loop';
  if (e?.message?.includes('circuit')) return 'api_error_exhausted';
  return 'aborted_by_user';
}
```

- [ ] **Step 2: Smoke integration test**

`tests/integration/orchestrator.test.ts`:
```ts
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { sessionBus } from '@server/sse/event-bus';
import { runOrchestrator } from '@server/agent/orchestrator';
import { manex } from '@server/db/client';

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('orchestrator', () => {
  it('Story 1 end-to-end', async () => {
    const fx = JSON.parse(readFileSync('tests/fixtures/incidents/story-1.json', 'utf8'));
    // Upsert incident + signals + session via manex client (direct insert)
    await manex().from('incident').upsert(fx.incident);
    await manex().from('signal').upsert(fx.signals);
    await manex().from('session').insert({ id: 'SES-TEST-ORC-1', incident_id: fx.incident.id, phase: 'classify', status: 'running', started_at: new Date().toISOString(), created_by_user_id: 'user_eng_anna', total_tokens_in: 0, total_tokens_out: 0, total_cost_usd: 0 });

    const events: any[] = [];
    sessionBus.on('SES-TEST-ORC-1', e => events.push(e));
    await runOrchestrator('SES-TEST-ORC-1', sessionBus);

    expect(events.some(e => e.event === 'session_complete')).toBe(true);
    expect(events.filter(e => e.event === 'phase_start').length).toBe(4);
  }, 300_000);
});
```

- [ ] **Step 3: Run + commit**

Run: `pnpm vitest run tests/integration/orchestrator.test.ts` → 1 passed. Cost ~$0.15.

```bash
git add server/agent/orchestrator.ts tests/integration/orchestrator.test.ts
git commit -m "feat(orchestrator): top-level 4-phase runner with SSE events"
```

---

## Milestone 5 — SSE integration + session persistence

### Task 5.1: Session persistence via write-back

**Files:**
- Modify: `server/agent/orchestrator.ts` (persist each event + turn)
- Create: `server/db/queries/sessions.ts`

- [ ] **Step 1: Write session_event + session_turn on every emit**

Inside `emit()` in orchestrator:
```ts
await manex().from('session_event').insert({ session_id: sessionId, event_seq: seq.n, event_type: event, payload, ts: ev.ts });
```

For `turn_complete`: additionally insert into `session_turn` with derived fields.

- [ ] **Step 2: Commit**

```bash
git add server/agent/orchestrator.ts server/db/queries/sessions.ts
git commit -m "feat(session): persist events + turns to DB alongside bus emit"
```

### Task 5.2: API routes for incident investigate + session stream

**Files:**
- Create: `app/api/incident/[id]/investigate/route.ts`, `app/api/session/[id]/route.ts`, `app/api/session/[id]/stream/route.ts`

- [ ] **Step 1: Investigate endpoint**

`app/api/incident/[id]/investigate/route.ts`:
```ts
import { withGuard } from '@server/auth/guards';
import { manex } from '@server/db/client';
import { enqueueInvestigate } from '@server/worker/index';
import { nanoid } from 'nanoid';

export const POST = withGuard('engineer', async (req, { user, params }) => {
  const incidentId = params.id;
  // Check for already-running session
  const { data: running } = await manex().from('session').select('id').eq('incident_id', incidentId).eq('status', 'running').maybeSingle();
  if (running) return Response.json({ code: 'session_running', message: `session ${running.id} already running`, retryable: false }, { status: 409 });

  const sessionId = 'SES-' + nanoid(5).toUpperCase();
  await manex().from('session').insert({
    id: sessionId, incident_id: incidentId,
    phase: 'classify', status: 'running',
    started_at: new Date().toISOString(),
    total_tokens_in: 0, total_tokens_out: 0, total_cost_usd: 0,
    created_by_user_id: user.user_id,
    failure_reason: null,
  });
  enqueueInvestigate({ session_id: sessionId });
  return Response.json({ session_id: sessionId }, { status: 202 });
});
```

`pnpm add nanoid`.

- [ ] **Step 2: Session history endpoint**

`app/api/session/[id]/route.ts`:
```ts
import { withGuard } from '@server/auth/guards';
import { manex } from '@server/db/client';

export const GET = withGuard('engineer', async (req, { params }) => {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') ?? 0);
  const { data: session } = await manex().from('session').select('*').eq('id', params.id).single();
  if (!session) return Response.json({ code: 'not_found', message: 'session', retryable: false }, { status: 404 });
  const { data: turns } = await manex().from('session_turn').select('*').eq('session_id', params.id).order('turn_index');
  const { data: events } = await manex().from('session_event').select('*').eq('session_id', params.id).gt('event_seq', since).order('event_seq');
  return Response.json({ session, turns: turns ?? [], events: events ?? [] });
});
```

- [ ] **Step 3: SSE stream endpoint**

`app/api/session/[id]/stream/route.ts`:
```ts
import { sseResponse } from '@server/sse/stream';
import { sessionBus } from '@server/sse/event-bus';
import { manex } from '@server/db/client';
import { withGuard } from '@server/auth/guards';

export const GET = withGuard('engineer', async (req, { params }) => {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') ?? req.headers.get('last-event-id') ?? 0);
  return sseResponse(async (send) => {
    // Replay missed events
    const { data: missed } = await manex().from('session_event').select('*').eq('session_id', params.id).gt('event_seq', since).order('event_seq');
    for (const ev of missed ?? []) send(ev.event_type, ev.payload, ev.event_seq);

    // Subscribe to live bus
    const off = sessionBus.on(params.id, ev => send(ev.event, ev.payload, ev.seq));

    // Wait until session completes or 5min watchdog
    const timeout = new Promise<void>(r => setTimeout(r, 5 * 60 * 1000));
    await timeout;
    off();
  });
});
```

- [ ] **Step 4: Smoke test via curl**

Terminal 1: `pnpm dev`.
Terminal 2: Insert a Story 1 incident manually via Studio UI or psql, then:
```bash
curl -X POST http://localhost:3000/api/incident/INC-00001/investigate \
  -H "X-Demo-User: user_eng_anna"
# → { "session_id": "SES-ABC12" }

curl -N http://localhost:3000/api/session/SES-ABC12/stream \
  -H "X-Demo-User: user_eng_anna"
# streams phase_start → turn_complete → ... → session_complete
```

- [ ] **Step 5: Commit**

```bash
git add app/api/incident app/api/session package.json
git commit -m "feat(api): investigate endpoint + session history + SSE stream route"
```

---

## Milestone 6 — Backfill + Dispatcher + Closure (stub)

### Task 6.1: Backfill script — Mode 1 one-shot

**Files:**
- Create: `scripts/backfill-signals.ts`, `server/correlator/signal-to-incident.ts`

- [ ] **Step 1: Correlator minimum-viable impl**

`server/correlator/signal-to-incident.ts`:
Implement deterministic Phase 1 only (spec §5.1). Semantic Phase 2 can be stubbed (returns no match) until pgvector live. Enough for backfill to group Story 1 defects into one incident.

- [ ] **Step 2: Backfill script**

`scripts/backfill-signals.ts`:
```ts
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { manex } from '../server/db/client';
import { embed } from '../server/models/openai';
import { correlate } from '../server/correlator/signal-to-incident';

type SourceRow = any;

async function backfillTable(table: 'defect' | 'field_claim' | 'test_result', toSignal: (r: SourceRow) => any) {
  let offset = 0; const page = 200;
  while (true) {
    let q = manex().from(table).select('*').range(offset, offset + page - 1);
    if (table === 'test_result') q = q.in('overall_result', ['MARGINAL', 'FAIL']);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      const sig = toSignal(row);
      const idem = createHash('sha256').update(sig.source_system + ':' + sig.source_ref).digest('hex');
      const emb = await embed(sig.raw_text);
      const toInsert = { ...sig, embedding: emb, idempotency_key: idem, cluster_state: 'pending_cluster' };
      // Check if already ingested
      const { data: existing } = await manex().from('signal').select('id').eq('idempotency_key', idem).maybeSingle();
      if (existing) continue;
      const { data: inserted } = await manex().from('signal').insert(toInsert).select().single();
      if (!inserted) continue;
      await correlate(inserted);
    }
    offset += page;
  }
}

async function main() {
  await backfillTable('defect', d => ({
    id: `SIG-D-${d.defect_id}`, signal_type: 'factory_defect', source: 'backfill_defect', source_system: 'manex_defect',
    source_ref: `defect:${d.defect_id}`, created_at: new Date().toISOString(), captured_ts: d.ts,
    raw_text: `Factory defect on ${d.product_id}, code ${d.defect_code}, severity ${d.severity}. ${d.notes ?? ''}`,
    lang: 'en', product_id: d.product_id, defect_code: d.defect_code, section_id: d.detected_section_id ?? d.occurrence_section_id,
    reported_part_number: d.reported_part_number, severity: d.severity?.toLowerCase() ?? 'medium',
    raw_payload: d,
  }));
  await backfillTable('field_claim', f => ({
    id: `SIG-F-${f.field_claim_id}`, signal_type: 'field_claim', source: 'backfill_field_claim', source_system: 'manex_field_claim',
    source_ref: `field_claim:${f.field_claim_id}`, created_at: new Date().toISOString(), captured_ts: f.claim_ts,
    raw_text: f.complaint_text, lang: 'de',
    product_id: f.product_id, reported_part_number: f.reported_part_number, market: f.market,
    section_id: f.detected_section_id, severity: 'medium',
    raw_payload: f,
  }));
  await backfillTable('test_result', t => ({
    id: `SIG-T-${t.test_result_id}`, signal_type: 'marginal_test', source: 'backfill_test_result', source_system: 'manex_test_result',
    source_ref: `test_result:${t.test_result_id}`, created_at: new Date().toISOString(), captured_ts: t.ts,
    raw_text: `${t.overall_result} on ${t.test_key}=${t.test_value}${t.unit ?? ''} for ${t.product_id}`,
    lang: 'en', product_id: t.product_id, section_id: t.section_id, test_key: t.test_key,
    severity: t.overall_result === 'FAIL' ? 'high' : 'medium',
    raw_payload: t,
  }));
  console.log('backfill complete');
}
main();
```

- [ ] **Step 3: Run + verify**

Run: `pnpm backfill:seed`. Expected: many `✓` lines, no errors. Cost: ~$0.10 for embeddings (depends on seed volume).

Verify in Studio UI: `SELECT source, count(*) FROM signal GROUP BY source;` → expect counts for all 3 sources.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-signals.ts server/correlator/signal-to-incident.ts
git commit -m "feat(backfill): one-shot ingest from defect+field_claim+test_result"
```

### Task 6.2: Dispatcher — manex_native adapter

**Files:**
- Create: `server/dispatcher/adapters/manex-native.ts`, `server/dispatcher/index.ts`, `app/api/initiative/[id]/approve/route.ts`

- [ ] **Step 1: Manex-native adapter**

```ts
// server/dispatcher/adapters/manex-native.ts
import { manex } from '@server/db/client';
import { z } from 'zod';

const Input = z.object({
  product_id: z.string(),
  description: z.string(),
  assigned_to: z.string().optional(),
  due_date: z.string().datetime().optional(),
});

export async function dispatchManexNative(initiativeId: string, template: any) {
  const params = Input.parse(template.params);
  const { data, error } = await manex().from('product_action').insert({
    product_id: params.product_id,
    description: params.description,
    assigned_to: params.assigned_to,
    due_date: params.due_date,
  }).select().single();
  if (error) return { ok: false, error: { code: 'dispatch_error', message: error.message, retryable: false } };
  return { ok: true, target_ref: `product_action:${data.action_id}` };
}
```

Check exact `product_action` columns in docs/SCHEMA.md — adjust as needed.

- [ ] **Step 2: Approve endpoint**

`app/api/initiative/[id]/approve/route.ts` — wires dispatcher + idempotency key + transaction per spec §13.6. Cosign gate: checks `initiative.cosign_required && !initiative.co_signed` → 409.

- [ ] **Step 3: Smoke test**

Create a fake approved initiative via Studio; POST approve; verify `product_action` row appears in Manex table.

- [ ] **Step 4: Commit**

```bash
git add server/dispatcher app/api/initiative
git commit -m "feat(dispatcher): manex_native adapter + approve endpoint"
```

### Task 6.3: Closure-monitor cron stub

**Files:**
- Create: `server/worker/handlers/closure-sweep.ts`

Minimal: every 60s, `SELECT * FROM initiative WHERE status='dispatched' FOR UPDATE SKIP LOCKED LIMIT 50`. For each, log "would evaluate predicate". Don't actually evaluate in M6 — this is the interface point for Harjot. Ship as explicit stub so the worker starts even if evaluator not implemented.

- [ ] **Step 1: Write stub + commit**

```bash
git add server/worker/handlers/closure-sweep.ts server/worker/index.ts
git commit -m "feat(closure): cron stub wired into worker (evaluator is Harjot's scope)"
```

---

## Milestone 7 — Golden tests + demo prep + PR

### Task 7.1: Golden test — Story 1

**Files:**
- Create: `tests/golden/story-1-supplier-batch.test.ts`, `tests/fixtures/anthropic-vcr/story-1.json` (recorded)

- [ ] **Step 1: Record Anthropic responses**

Run the orchestrator once against real Anthropic, capture all responses via a VCR wrapper (e.g., `msw` or hand-rolled proxy). Save to `tests/fixtures/anthropic-vcr/story-1.json`.

- [ ] **Step 2: Golden test**

```ts
// tests/golden/story-1-supplier-batch.test.ts
import { describe, it, expect } from 'vitest';
// Load VCR cassette, mock anthropic client to replay
// Run orchestrator on Story 1 fixture
// Assert terminal shape + key content (supplier archetype, SB-00007 referenced, ≥2 initiatives)
```

Deterministic: same inputs → same recorded outputs → stable snapshot.

- [ ] **Step 3: Commit**

```bash
git add tests/golden tests/fixtures/anthropic-vcr
git commit -m "test(golden): Story 1 supplier-batch E2E with VCR replay"
```

### Task 7.2: Golden test — Story 3

**Files:**
- Create: `tests/golden/story-3-design-drift.test.ts`, `tests/fixtures/anthropic-vcr/story-3.json`, `tests/fixtures/incidents/story-3.json`

- [ ] **Step 1: Record + assert**

Same pattern as Task 7.1. Story 3 fixture: MC-200 field claims with zero factory defects. Expected archetype: `design`. Expected initiative domain: `rd`.

- [ ] **Step 2: Commit**

```bash
git add tests/golden/story-3-design-drift.test.ts tests/fixtures/anthropic-vcr/story-3.json tests/fixtures/incidents/story-3.json
git commit -m "test(golden): Story 3 design-drift E2E"
```

### Task 7.3: Demo choreography + PR to develop

**Files:**
- Create: `scripts/demo-reset.ts` — resets signal/incident/session tables + re-seeds fixtures

- [ ] **Step 1: Demo reset script**

Deletes all Resolve-owned rows (signal, incident, session, session_event, session_turn, initiative, dispatch_attempt, impact_measurement, lesson where seed_source != 'demo') and re-runs `backfill:seed`. Preserves seeded lessons.

- [ ] **Step 2: Run full E2E locally**

Full flow:
1. `pnpm db:migrate:remote`
2. `pnpm db:seed:demo`
3. `pnpm backfill:seed`
4. `pnpm dev`
5. Open browser / curl: trigger investigate on INC-00001 → see events stream
6. Approve an initiative → verify product_action row created

- [ ] **Step 3: Open PR from feat/joscha → develop**

```bash
git push origin feat/joscha
gh pr create --base develop --title "feat: LLM orchestrator pipeline (Joscha's slice)" --body "$(cat <<EOF
## Summary
- 4-phase LLM orchestrator (Classify/Investigate/Compose/Propose) with Anthropic prompt caching
- 10 functional tools + 9 typed stubs (see planning/specs/2026-04-18-llm-data-pipeline-design.md §9)
- Evidence-cite 3-layer validator
- SSE live streaming
- Backfill from Manex defect/field_claim/test_result into signals

## Test plan
- [ ] pnpm test (unit) — green
- [ ] pnpm test:integration (against real Manex) — green
- [ ] pnpm test:golden — Story 1 + Story 3 snapshots match
- [ ] Manual: investigate INC-00001 via /api/incident/INC-00001/investigate, SSE stream completes, initiatives proposed
- [ ] Manual: approve one initiative, verify product_action row in Manex

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Final commit**

```bash
git add scripts/demo-reset.ts
git commit -m "chore: demo reset script + hand-off to develop"
git push origin feat/joscha
```

---

## Self-Review Notes

**Coverage check (spec §section → plan task):**
- Spec §2 entry-points → Tasks 5.2, 6.1 (operator ingest + backfill)
- Spec §3 signal schema → Task 1.1, 1.4
- Spec §4 incident → Task 1.1, 1.4 (schema + migration)
- Spec §5 correlator → Task 6.1 (Phase 1 only; Phase 2 deferred to M8 or Harjot)
- Spec §6 session layer → Task 1.5, 5.1, 5.2
- Spec §7 orchestrator → Tasks 2.2, 3.6, 4.1, 4.2, 4.3
- Spec §8 prompts → Tasks 2.1, 3.5
- Spec §9 tools → Tasks 3.1, 3.2, 3.3, 3.4
- Spec §10 evidence-cite → Task 4.2
- Spec §11 lessons → Task 3.3 (retrieve only, emit_lesson stubbed)
- Spec §12 closure monitor → Task 6.3 (stub — handoff to Harjot)
- Spec §13 dispatcher → Task 6.2 (manex_native only; stubs deferred)
- Spec §14 API contracts → Tasks 0.1, 1.6, 5.2, 6.2
- Spec §15 error paths → Tasks 1.2, 4.2, 3.6 (stall, retry, circuit breaker)
- Spec §16 dev env → Tasks 0.1, 0.2, 0.3, 1.4, 1.5

**Deferred to teammates (explicit):**
- Full UI implementation per §14 (Lila)
- Remaining tool implementations (11 tools stubbed → Harsh)
- pgvector migration + closure predicate evaluator (Harjot)
- Detector SPC rules + Haiku triage (M6 or Harjot)
- Contribution pipeline §4.3 (deferred; 3 contrib tools stubbed, can wire when Lila's UI shows 9 cards)

**Risks:**
- Manex backend availability — health-check task 0.3 verifies at start; fallback unclear (no local Postgres in this plan; could add as M0 contingency if backend down)
- Prompt output format drift — mitigated by Zod parse + 1-retry; if Haiku refuses schema, Task 2.2 step 4 has rescue note
- Test time cost — ~$0.15 per full orchestrator run × 5 runs during development = ~$0.75. Golden tests use VCR to avoid hitting API in CI.

---

## Execution Handoff

**Plan complete and saved to `planning/plans/2026-04-18-llm-orchestrator-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Works well for M1-M5 where tasks are independent and each produces a testable unit.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints. Higher context cost but tighter integration feedback — preferable for M6-M7 where tasks interact with running dev-server state.

**Which approach?**
