# Resolve — De.Constructors × Manex Hackathon 2026

> **Every voice becomes an initiative.**

Closed-loop quality intelligence layer for Manex. Turns any incoming signal —
internal production anomaly or external customer voice — into a routed, tracked,
measurable initiative. 8D and FMEA fall out as projections.

## Canonical reference

- **[planning/ARCHITECTURE.md](planning/ARCHITECTURE.md)** — the complete merged architecture
- **[planning/visualizations/architecture.html](planning/visualizations/architecture.html)** — engineering dashboard (open locally in browser)
- **[planning/visualizations/problem-flow.html](planning/visualizations/problem-flow.html)** — problem flow + persona journey
- **[CLAUDE.md](CLAUDE.md)** — context for Claude Code / SDK agents working in this repo

## Team & ownership

| Person | Focus | Branch |
|---|---|---|
| Joscha | LLM architecture · tools · root-cause agent · pitch | `feat/joscha` |
| Lila | Frontend · canvas UX · generative-UI components | `feat/lila` |
| Harsh | Fullstack · visualizations · tool-layer implementation | `feat/harsh` |
| Harjot | Backend · data layer · DevOps · closure monitor | `feat/harjot` |

## Branching

```
main     ← always deployable · only merged from develop via PR
  └── develop  ← integration branch · all feature branches merge here first
       ├── feat/joscha
       ├── feat/lila
       ├── feat/harsh
       └── feat/harjot
```

**Never commit code directly to `main`.** Push feature branches to origin, PR into
`develop`, merge `develop` → `main` only when green and deployable.

## Stack

Next.js 15 · TypeScript · Supabase-JS · Tailwind · shadcn/ui · Vercel AI SDK ·
Anthropic SDK · OpenAI (Whisper + embeddings) · pgvector · React Flow · Recharts.

## Voice pipeline setup (web)

- `OPENAI_API_KEY` must be set in `web/.env.local` before starting the web app (`npm run dev` in `web/`), otherwise voice server paths fail fast on startup/import.
- Run the live voice smoke test from `web/` with an audio fixture path:

```bash
VOICE_SMOKE_AUDIO_PATH=/absolute/path/to/sample.wav npm run test:voice-smoke
```

---

# Manex Challenge Environment (scaffold)

This repo also contains the **Manex-provided challenge scaffold** — Postgres schema,
seed data, docker compose, deploy scripts, and data-generation. Use it to spin up
your team's isolated stack.

## What you get from the scaffold

- A **PostgreSQL database** mirroring Manex production (19 tables, strict subset).
- **Synthetic but realistic data** (~7,000 rows) containing **four explicit
  root-cause stories** — documented up front, no treasure hunt.
  See [docs/DATA_PATTERNS.md](docs/DATA_PATTERNS.md).
- **Three ways to access the data** — REST (PostgREST), SQL editor in the browser
  (Supabase Studio), or direct Postgres from any client.
- Your **own isolated stack** — teams cannot interfere with each other.
- **Illustrative defect images** served as static files, referenced from
  the data.
- A **handout** (`team-<your-team>.txt`) with all URLs, credentials, and
  API keys you need.

## Start here (challenge docs)

1. [docs/CASE.md](docs/CASE.md) — the challenge, evaluation criteria, and context.
2. [docs/QUICKSTART.md](docs/QUICKSTART.md) — connect in < 5 minutes.
3. [docs/API_REFERENCE.md](docs/API_REFERENCE.md) — endpoints, examples in curl / JS / Python.
4. [docs/SCHEMA.md](docs/SCHEMA.md) — entities, fields, ER diagram.
5. [docs/DATA_PATTERNS.md](docs/DATA_PATTERNS.md) — the four stories in the dataset.

## Defect images

`image_url` values in the dataset are relative paths (for example,
`/defect_images/defect_01_cold_solder.jpg`). Prepend the assets host +
port from your handout to render them, e.g.:

```text
http://<host>:9000 + image_url
```

Use the full URL in `<img src>` tags to display them in your UI.

## LLM access

Bring your own API key (OpenAI / Anthropic / Gemini). If you don't have
one, ask the organizers for a shared key — a modest budget is set aside.

## Ground rules (scaffold)

- Seed tables are **read-protected from deletes** — you cannot
  `DELETE FROM product` or `TRUNCATE defect`. This is a feature, not a bug.
- You **can** `INSERT`/`UPDATE` on `product_action` and `rework`
  (the closed-loop write targets).
- You **can** `CREATE TABLE` for your own entities — PostgREST will
  auto-expose them.
- If seed data looks wrong, ask an organizer to reset your stack.

## Questions?

Ask the organizers — in person, or on the hackathon chat. Good luck!
