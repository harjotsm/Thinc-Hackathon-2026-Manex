# CLAUDE.md — Context for AI agents working in this repo

This file tells any Claude instance (Claude Code, a sub-agent, an SDK session)
how to be useful here. Read this first.

## Project

**Resolve** — closed-loop quality intelligence layer for Manex.
Tagline: *Every voice becomes an initiative.*
24h hackathon build, Thinc! × Manex AI · April 2026.

## Start here

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — canonical architecture (source of truth)
- [docs/visualizations/architecture.html](docs/visualizations/architecture.html) — engineering dashboard
- [docs/visualizations/problem-flow.html](docs/visualizations/problem-flow.html) — problem understanding + persona journey

If any of these conflict with something you read elsewhere, the markdown wins.

## Branching (strict)

```
main          ← always deployable; only reached via PR from develop
  └── develop ← integration; all feat/* branches merge here first
       ├── feat/joscha   · LLM architecture, tools, agent, pitch
       ├── feat/lila     · frontend, canvas UX, generative UI
       ├── feat/harsh    · fullstack, visualizations, tool-layer
       └── feat/harjot   · backend, data layer, DevOps, closure monitor
```

**Never commit code directly to `main`.** Docs in `/` and `/docs` are the only
exception (README, CLAUDE.md, ARCHITECTURE.md, visualizations).

When editing code, default to the **owner's feature branch**. Ownership map:

| Concern | Owner | Branch |
|---|---|---|
| LLM orchestrator · tools · prompts · agent | Joscha | `feat/joscha` |
| Canvas UI · generative-UI components · shadcn | Lila | `feat/lila` |
| Tool-layer implementation · visualizations (React Flow/Recharts) | Harsh | `feat/harsh` |
| Data layer · pgvector · closure monitor · DevOps | Harjot | `feat/harjot` |

## Stack

Next.js 15 App Router · TypeScript · Tailwind · shadcn/ui ·
Supabase-JS (PostgREST) · Vercel AI SDK · Anthropic SDK ·
OpenAI SDK (Whisper + embeddings only) · pgvector · React Flow · Recharts · Zod.

## Domain vocabulary

Use these terms exactly. Do not substitute synonyms.

- **Signal** — one normalized incoming fact (internal production or external customer voice).
- **Incident** — cluster of signals worth reasoning about; the unit of UX.
- **Initiative** — dispatched action in a domain agent's system of record. Maps to Manex `product_action` (native) or an external target.
- **Lesson** — embedded signature of a resolved incident; powers the network effect via nearest-neighbor retrieval.
- **Archetype** — one of `supplier`, `drift`, `design`, `operator`, `unknown`.
- **Canvas** — the Incident workspace. 8D / FMEA / Ishikawa / Pareto are projections of it, not separate documents.
- **Lens** — one of `floor`, `engineer`, `leadership`. Each lens is a UI projection of the same underlying data.

## Architectural non-negotiables

These come from the Decisions section of ARCHITECTURE.md. Do not renegotiate them inside a feature branch without discussion.

1. **Orchestrated 4-phase pipeline** (Classify → Investigate → Compose → Propose). Not free-form ReAct.
2. **Typed tool layer with Zod** — no free-form SQL, ever.
3. **Evidence-cite contract** — every LLM claim references a `tool_call_id`; post-validator checks.
4. **Prompt caching on** the system prompt (Anthropic).
5. **pgvector for free text only** — structured queries stay SQL.
6. **Write tools gated** — not available inside the Investigate loop; orchestrator invokes them post-approval.
7. **Closure predicates** — typed JSON, evaluated by cron, not stampable.
8. **Max 8 tool-call iterations** per Investigate phase.

## Conventions

- Zod schemas for every tool, agent I/O, and API payload.
- All IDs follow Manex's prefix conventions (`PA-00101`, `PRD-00042`, etc.).
- German + English free text coexists in the data — the agent must handle both.
- Never mock the database for tests that touch the semantic layer — always run against the real seeded Postgres.
- Use `superpowers:brainstorming` before any creative work; `superpowers:test-driven-development` for features with clear specs.
- Commit messages: short imperative subject + optional body. No emoji.
- When in doubt about scope, favor narrower. This is a 24h sprint.

## Four data stories (the demo targets)

The seeded dataset contains four explicit root-cause stories. They are
documented in the Manex case docs (`docs/DATA_PATTERNS.md` in the Kontext
submodule). Do not guess them; read them.

1. **Supplier batch** — ElektroParts / SB-00007 / PM-00008 (100µF caps)
2. **Calibration drift** — VIB_TEST at Montage Linie 1, W49–W2
3. **Design thermal drift** — MC-200 / R33 / PM-00015 (field-only, no factory defects)
4. **Operator handling** — user_042, orders PO-00012/18/24

Demo lead recommended: Story 1 + Story 3. Stories 2 + 4 runnable but not primary.

## When working with Claude (guidance)

- Read `ARCHITECTURE.md` before proposing new structure.
- Never invent table or column names. Check the migrations in Kontext.
- If you are about to write a file to `main`, stop and ask.
- If a skill in the superpowers plugin applies, use it. (Brainstorming before creative work; TDD before feature work; systematic-debugging on bugs.)
- Prefer editing existing files over creating new ones.
- Prefer short, complete responses over long speculative ones.
