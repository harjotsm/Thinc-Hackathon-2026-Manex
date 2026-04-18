# Resolve MVP (web)

Next.js frontend + API layer for the Listen → Reason → Resolve prototype.

## Quick start

1. Configure env:

```bash
cp .env.example .env.local
```

2. Apply migration from repo root:

```bash
psql "postgres://<team_writer...>" -f ../supabase/migrations/00003_resolve_core.sql
psql "postgres://<team_writer...>" -f ../supabase/migrations/00004_resolve_workflow_atomic.sql
psql "postgres://<team_writer...>" -f ../supabase/migrations/00005_resolve_semantic_helpers.sql
```

3. Run app:

```bash
npm run dev
```

## Main routes

- `/` Home
- `/capture` Operator lens
- `/dashboard` Leadership lens
- `/investigate/<incidentId>` Engineer lens

## API routes

- `POST /api/intake/capture`
- `GET /api/intake/query`
- `POST /api/agent/run`
- `GET /api/agent/stream?incident_id=...`
- `POST /api/initiative/approve`
- `POST /api/demo/seed`
- `POST /api/workers/closure-monitor` (optional `Authorization: Bearer $CRON_SECRET`)

## Worker

Closure monitor entrypoint is in `../workers/closure-monitor.ts`.
