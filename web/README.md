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

## Worker

Closure monitor entrypoint is in `../workers/closure-monitor.ts`.
