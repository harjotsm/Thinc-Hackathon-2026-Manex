# Resolve MVP — Backend Handoff

This document explains:
1. What was implemented in the backend.
2. How teammates can start everything and use it immediately.

---

## What is implemented

## 1. Resolve schema and workflow SQL

Added/updated migrations:

- `supabase/migrations/00003_resolve_core.sql`
  - Core tables:
    - `signal`
    - `incident`
    - `incident_signal`
    - `contribution`
    - `initiative`
    - `impact_measurement`
    - `lesson`
  - Challenge-environment compatible embedding storage (`JSONB`).

- `supabase/migrations/00004_resolve_workflow_atomic.sql`
  - RPC `resolve_approve_initiative(...)`:
    - writes `product_action`
    - writes `initiative`
    - moves incident to `resolving`
  - RPC `resolve_apply_closure_result(...)`:
    - marks initiative done/reopen
    - writes `impact_measurement`
    - closes/reopens incident state

- `supabase/migrations/00005_resolve_semantic_helpers.sql`
  - RPC `resolve_semantic_neighbors(...)` for semantic neighbor lookup
    (token similarity fallback for environments without `pgvector` extension).

## 2. Backend API routes (Next.js)

Implemented routes:

- Intake
  - `POST /api/intake/capture`
  - `GET /api/intake/query`

- Incident
  - `GET /api/incident/[incidentId]`
  - `GET /api/incident/[incidentId]/signals`

- Reasoning orchestration
  - `POST /api/agent/run`
  - `GET /api/agent/stream?incident_id=...`

- Resolve
  - `POST /api/initiative/approve`

- Worker trigger
  - `POST /api/workers/closure-monitor`

- Demo bootstrap
  - `POST /api/demo/seed` (`story1`, `story3`, `all`)

## 3. Agent backend behavior

- 4-phase orchestrator: classify → investigate → compose → propose
- Typed tool layer for defect/claim/batch/summary lookups
- Evidence contract validator:
  - every claim/initiative evidence ID must map to a real `tool_call_id`

## 4. Domain-agent split

Separate initiative generation modules:

- `production`
- `supplier`
- `rnd`

Each emits target system, owner hint, rationale, confidence, and closure predicate.

## 5. Closure monitor

- Shared runner: `web/src/server/workers/closure-monitor.ts`
- Entrypoint script: `workers/closure-monitor.ts`
- HTTP trigger route (for cron/webhook): `POST /api/workers/closure-monitor`

---

## Startup guide for teammates

## A) Prerequisites

From repo root:

```bash
cd /Users/harjot/Thinc-Hackathon-2026-Manex
```

Backend/frontend dependencies in `web/`:

```bash
cd web
npm install
```

---

## B) Configure environment

Create/update:

```bash
cp -f .env.example .env.local
```

Set these values in `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://34.89.205.150:8005
NEXT_PUBLIC_SUPABASE_ANON_KEY=<TEAM_API_KEY>
MANEX_API_URL=http://34.89.205.150:8005
MANEX_SERVICE_ROLE_KEY=<TEAM_API_KEY>
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
CRON_SECRET=
```

> Use your team key from handout for both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `MANEX_SERVICE_ROLE_KEY`.

---

## C) Apply migrations (remote team DB)

Use Dockerized `psql` (works even if local `psql` is missing):

```bash
cd /Users/harjot/Thinc-Hackathon-2026-Manex
DB_URL='postgres://team_writer_deconstructors:<PASSWORD>@34.89.205.150:5435/hackathon'

docker run --rm -v "$PWD:/work" postgres:15-alpine psql "$DB_URL" -v ON_ERROR_STOP=1 -f /work/supabase/migrations/00003_resolve_core.sql
docker run --rm -v "$PWD:/work" postgres:15-alpine psql "$DB_URL" -v ON_ERROR_STOP=1 -f /work/supabase/migrations/00004_resolve_workflow_atomic.sql
docker run --rm -v "$PWD:/work" postgres:15-alpine psql "$DB_URL" -v ON_ERROR_STOP=1 -f /work/supabase/migrations/00005_resolve_semantic_helpers.sql
```

Reload PostgREST schema cache:

```bash
docker run --rm postgres:15-alpine psql "$DB_URL" -c "NOTIFY pgrst, 'reload schema';"
```

---

## D) Start the app

```bash
cd /Users/harjot/Thinc-Hackathon-2026-Manex/web
npm run dev
```

Open:

- `http://localhost:3001/` (or port shown in terminal)
- `http://localhost:3001/capture`
- `http://localhost:3001/dashboard`

---

## E) Quick end-to-end test

1. Seed stories:

```bash
curl -X POST http://localhost:3001/api/demo/seed \
  -H "Content-Type: application/json" \
  -d '{"scenario":"all"}'
```

2. Copy an `incidentId` from response.
3. Open:
   - `http://localhost:3001/investigate/<incidentId>`
4. Click:
   - **Run Reasoning**
   - **Approve** on one initiative

This validates the full path:
`signal -> incident -> reasoning -> initiative -> product_action`.

---

## Troubleshooting

- **`psql: command not found`**  
  Use dockerized `psql` commands above.

- **`404` for new table/function endpoints**  
  Run `NOTIFY pgrst, 'reload schema';`.

- **Permission errors on new tables**  
  Re-run `00003` grants or execute:
  `GRANT SELECT, INSERT, UPDATE, DELETE ON signal, incident, incident_signal, contribution, initiative, impact_measurement, lesson TO team_writer;`

- **Old UI appears unchanged**  
  Restart dev server and hard refresh browser.

