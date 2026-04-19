# Manex Challenge Environment — Scaffold docs

This repo contains the **Manex-provided challenge scaffold** — Postgres schema,
seed data, docker compose, deploy scripts, and data-generation. Use it to spin up
your team's isolated stack.

## What you get from the scaffold

- A **PostgreSQL database** mirroring Manex production (19 tables, strict subset).
- **Synthetic but realistic data** (~7,000 rows) containing **four explicit
  root-cause stories** — documented up front, no treasure hunt.
  See [DATA_PATTERNS.md](DATA_PATTERNS.md).
- **Three ways to access the data** — REST (PostgREST), SQL editor in the browser
  (Supabase Studio), or direct Postgres from any client.
- Your **own isolated stack** — teams cannot interfere with each other.
- **Illustrative defect images** served as static files, referenced from
  the data.
- A **handout** (`team-<your-team>.txt`) with all URLs, credentials, and
  API keys you need.

## Start here (challenge docs)

1. [CASE.md](CASE.md) — the challenge, evaluation criteria, and context.
2. [QUICKSTART.md](QUICKSTART.md) — connect in < 5 minutes.
3. [API_REFERENCE.md](API_REFERENCE.md) — endpoints, examples in curl / JS / Python.
4. [SCHEMA.md](SCHEMA.md) — entities, fields, ER diagram.
5. [DATA_PATTERNS.md](DATA_PATTERNS.md) — the four stories in the dataset.

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

## Ground rules

- Seed tables are **read-protected from deletes** — you cannot
  `DELETE FROM product` or `TRUNCATE defect`. This is a feature, not a bug.
- You **can** `INSERT`/`UPDATE` on `product_action` and `rework`
  (the closed-loop write targets).
- You **can** `CREATE TABLE` for your own entities — PostgREST will
  auto-expose them.
- If seed data looks wrong, ask an organizer to reset your stack.

## Questions?

Ask the organizers — in person, or on the hackathon chat.
