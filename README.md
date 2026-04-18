# Resolve — De.Constructors × Manex Hackathon 2026

> **Every voice becomes an initiative.**

Closed-loop quality intelligence layer for Manex. Turns any incoming signal —
internal production anomaly or external customer voice — into a routed, tracked,
measurable initiative. 8D and FMEA fall out as projections.

## Canonical reference

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the complete merged architecture
- **[docs/visualizations/architecture.html](docs/visualizations/architecture.html)** — engineering dashboard (open locally in browser)
- **[docs/visualizations/problem-flow.html](docs/visualizations/problem-flow.html)** — problem flow + persona journey

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

**Never commit directly to `main`.** Push feature branches to origin, PR into
`develop`, merge `develop` → `main` only when green and deployable.

## Stack

Next.js 15 · TypeScript · Supabase-JS · Tailwind · shadcn/ui · Vercel AI SDK ·
Anthropic SDK · OpenAI (Whisper + embeddings) · pgvector · React Flow · Recharts.
