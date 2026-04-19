<div align="center">

# Resolve

### Every voice becomes an initiative.

**Closed-loop quality intelligence for Manex — turns any signal (internal anomaly or external customer voice) into a routed, tracked, measurable initiative. 8D and FMEA fall out as projections.**

*De.Constructors × Manex Hackathon · 2026*

</div>

---

![Demo — voice → inbox → canvas → Run AI → fishbone → dispatched](docs/readme-assets/demo.gif)

---

## The moat

Manufacturing root-cause is not a chatbot problem. It is a **bounded reasoning** problem over typed structured data, with adversarial hallucinations, multiple writer systems, and closure that has to be **measurable** — not stampable. Three things make this hard, and three things make ours different.

- **Orchestrated 4-phase pipeline, not free-form ReAct.** Classify (Haiku 4.5) → Investigate (Sonnet 4.6, bounded at 8 turns) → Compose (8D) → Propose. Each phase has a dedicated model, prompt cache tier, and typed output contract.
- **Typed Zod tool layer, no free-form SQL.** 12 read tools, 3 write tools. Write tools are gated — the Investigate loop cannot mutate state. An **evidence-cite post-validator** rejects any output whose claims don't reference a real `tool_call_id`.
- **Closure predicates, not checkboxes.** Every dispatched initiative carries a typed JSON predicate. A cron evaluates it against live data; only satisfied predicates reach the lesson embedding. A fix isn't closed because a human said so — it's closed because the metric moved.

---

## System architecture

End-to-end pipeline. Every box is a typed implementation unit. Incidents are durable between acts; lessons feed back into classification.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 40, "rankSpacing": 60}}}%%
flowchart TB
  subgraph LISTEN["🟦 ACT I — LISTEN"]
    direction TB
    subgraph SRC_INT["Internal sources"]
      S_VOICE["🎤 Worker voice<br/>(Whisper)"]
      S_EOL["🧪 EOL test<br/>FAIL / MARGINAL"]
      S_SPC["📉 SPC drift<br/>Cpk erosion"]
      S_SUPP["📦 Supplier<br/>inbound anomaly"]
      S_REWORK["🔧 Rework<br/>concentration"]
      S_MAINT["🛠 Maintenance FMEA"]
    end
    subgraph SRC_EXT["External sources"]
      S_FC["📞 Field claim"]
      S_WAR["🎫 Warranty / RMA"]
      S_NPS["⭐ NPS · reviews · social"]
      S_IOT["📡 IoT telemetry"]
    end
    IN1["Intake Normalizer (Zod)<br/>→ canonical signal row"]
    COR["🧲 Signal Correlator<br/>joins + pgvector cosine"]
    INC[("incident row")]
  end

  subgraph REASON["🟧 ACT II — REASON"]
    direction TB
    CLS["🟢 Classify · Haiku 4.5<br/>→ archetype + playbook"]
    INV["🟠 Investigate · Sonnet 4.6<br/>ReAct · max 8 turns"]
    TOOLS["🔧 Typed Tool Layer (Zod)<br/>retrieval · semantic · vision"]
    EV[("evidence cache")]
    STALL{"Confidence<br/>≥ 0.75?"}
    HINT["⚠ Stall → request_hint"]
    CM["🔵 Compose · Sonnet 4.6<br/>8D + render_hints"]
    PR["🟣 Propose · Sonnet 4.6<br/>initiatives + predicates"]
  end

  subgraph RESOLVE["🟪 ACT III — RESOLVE"]
    direction TB
    SIM["💡 Impact Simulator<br/>€ avoided · claims · confidence"]
    HITL["🔴 Engineer Review<br/>Accept / Amend / Reject"]
    subgraph AGENTS["Domain agents · parallel dispatch"]
      AG_PROD["🏭 Production"]
      AG_SUPP["📦 Supplier"]
      AG_RND["🔬 R&D"]
      AG_LOG["🚚 Logistics"]
      AG_CX["💬 CX response"]
    end
    WRITE[("initiative + product_action")]
    MON["🔁 Closure Monitor<br/>cron · typed predicates"]
    LESSON[("lesson embedding")]
  end

  S_VOICE & S_EOL & S_SPC & S_SUPP & S_REWORK & S_MAINT --> IN1
  S_FC & S_WAR & S_NPS & S_IOT --> IN1
  IN1 --> COR --> INC
  INC --> CLS --> INV
  INV <--> TOOLS
  TOOLS --> EV --> INV
  INV --> STALL
  STALL -- "no · max turns" --> HINT --> INV
  STALL -- "yes" --> CM --> PR
  PR --> SIM --> HITL
  HITL -- "approve" --> AGENTS
  AG_PROD & AG_SUPP & AG_RND & AG_LOG & AG_CX --> WRITE
  WRITE --> MON
  MON -- "satisfied" --> LESSON
  MON -- "deadline exceeded" --> INV
  LESSON -.retrieved on next incident.-> CLS

  classDef listen fill:#164e63,stroke:#06b6d4,color:#cffafe
  classDef reason fill:#7c2d12,stroke:#f97316,color:#fed7aa
  classDef resolve fill:#581c87,stroke:#a855f7,color:#e9d5ff

  class S_VOICE,S_EOL,S_SPC,S_SUPP,S_REWORK,S_MAINT,S_FC,S_WAR,S_NPS,S_IOT,IN1,COR,INC listen
  class CLS,INV,TOOLS,EV,STALL,HINT,CM,PR reason
  class SIM,HITL,AG_PROD,AG_SUPP,AG_RND,AG_LOG,AG_CX,WRITE,MON,LESSON resolve
```

---

## Data + LLM architecture

The orchestrator — evidence-grounded, cached, bounded. Four phases with dedicated models. Typed Zod tool layer. Evidence-cite post-validator. pgvector lesson retrieval biases classification. Anthropic prompt cache reuses ~90% of tokens across turns.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 40, "rankSpacing": 55}}}%%
flowchart TB
  IN["📥 Incident<br/>seed signals + BOM"]:::io
  IN --> CLS

  subgraph CLASSIFY["🟢 PHASE 1 · Classify · Haiku 4.5"]
    direction TB
    LES_GET["retrieve_lessons(top=3)<br/>cosine · pgvector"]:::classify
    CLS["archetype + confidence<br/>+ playbook"]:::classify
  end
  LES_GET -.prior.-> CLS

  CLS --> INV_LOOP

  subgraph INVESTIGATE["🟠 PHASE 2 · Investigate · Sonnet 4.6 · max 8 turns"]
    direction TB
    INV_LOOP{"Agent loop<br/>think → tool_use → observe"}:::investigate
    TOOLS["🔧 Typed Tool Layer (Zod)<br/>retrieval · semantic · vision"]:::investigate
    EV[("evidence cache<br/>hash(args) → result")]:::investigate
    CONF{"confidence ≥ 0.75<br/>or max turns?"}:::investigate
  end

  INV_LOOP <--> TOOLS
  TOOLS --> EV --> INV_LOOP
  INV_LOOP --> CONF
  CONF -- "no" --> STALL["stall → request_hint"]:::investigate
  STALL --> INV_LOOP
  CONF -- "yes" --> CM

  subgraph COMPOSE["🔵 PHASE 3 · Compose · Sonnet 4.6"]
    direction TB
    CM["Evidence bundler<br/>cited-only"]:::compose
    D8["8D filler · D1..D8<br/>evidence[] per claim"]:::compose
  end
  CM --> D8 --> PR

  subgraph PROPOSE["🟣 PHASE 4 · Propose · Sonnet 4.6"]
    direction TB
    PR["Initiative composer<br/>1..N candidates"]:::propose
    PRED["Closure predicate<br/>typed discriminated union"]:::propose
  end
  PR --> PRED --> VAL

  VAL["🛡 Evidence-cite validator<br/>every tool_call_id must exist"]:::guard
  VAL -- "ok" --> DONE["✅ Engineer Review"]:::io
  VAL -- "missing id · 1 retry" --> PR

  classDef classify fill:#14532d,stroke:#10b981,color:#bbf7d0
  classDef investigate fill:#7c2d12,stroke:#f97316,color:#fed7aa
  classDef compose fill:#1e40af,stroke:#3b82f6,color:#dbeafe
  classDef propose fill:#581c87,stroke:#a855f7,color:#e9d5ff
  classDef io fill:#1f2937,stroke:#6b7280,color:#e5e7eb
  classDef guard fill:#4a044e,stroke:#d946ef,color:#fae8ff
```

**What makes the pipeline work**

| | |
|---|---|
| **Anthropic prompt cache** | Static system-prompt tier (domain vocab, tool specs, playbook). ~90% token reuse, ~5× cost reduction across turns. |
| **Typed Zod tool layer** | 12 read tools, 3 write tools. Write tools gated post-approval. No free-form SQL, ever. Bounded at 8 turns. |
| **pgvector** | Free-text signatures embedded (`FLOAT8[]`, 1536-dim, cosine). Structured queries stay in SQL. |
| **Lessons loop** | Resolved incidents embed their signature; retrieved on Classify to bias the archetype prior. Cross-plant network effect. |
| **Evidence-cite contract** | Every claim cites a `tool_call_id`. Validator blocks output with orphaned refs — one retry, second failure = hard error. |
| **Closure predicates** | Typed JSON, evaluated by cron. A resolution is not stampable; it has to measurably close. |

---

## The four data stories

The seeded dataset contains four explicit root-cause stories — no treasure hunt.

| # | Story | Trace |
|---|---|---|
| 1 | **Supplier batch** | ElektroParts / SB-00007 / PM-00008 (100µF caps) |
| 2 | **Calibration drift** | VIB_TEST at Montage Linie 1, W49–W2 |
| 3 | **Design thermal drift** | MC-200 / R33 / PM-00015 (field-only) |
| 4 | **Operator handling** | user_042, orders PO-00012 / 18 / 24 |

Demo targets stories 1 and 3. See [docs/DATA_PATTERNS.md](docs/DATA_PATTERNS.md) for the full reasoning paths.

---

## Stack

Next.js 16 App Router · TypeScript · Tailwind v4 · shadcn/ui ·
Anthropic SDK (Haiku 4.5 + Sonnet 4.6) · OpenAI SDK (Whisper + embeddings only) ·
Postgres + pgvector · Supabase-JS (PostgREST) · Vercel AI SDK · Zod · React Flow · Recharts.

---

## Run locally

```bash
# 1. clone + install
git clone https://github.com/Deconstructors/De.Constructors.git
cd De.Constructors/web
pnpm install

# 2. env — copy and fill (see web/.env.example)
#   DATABASE_URL=...          Manex stack from your handout
#   ANTHROPIC_API_KEY=...
#   OPENAI_API_KEY=...        (Whisper + embeddings only)

# 3. dev
pnpm dev                      # http://localhost:3000
```

Full Manex scaffold, schema, and access details live in [docs/SCAFFOLD.md](docs/SCAFFOLD.md).

---

## Docs

- **[planning/ARCHITECTURE.md](planning/ARCHITECTURE.md)** — canonical architecture (source of truth)
- **[planning/visualizations/architecture.html](planning/visualizations/architecture.html)** — engineering dashboard
- **[planning/visualizations/problem-flow.html](planning/visualizations/problem-flow.html)** — problem flow + persona journey
- **[docs/SCAFFOLD.md](docs/SCAFFOLD.md)** — Manex challenge environment (Postgres schema, seed data, API)
- **[docs/DATA_PATTERNS.md](docs/DATA_PATTERNS.md)** — the four data stories in detail
- **[CLAUDE.md](CLAUDE.md)** — context for Claude Code / SDK agents working in this repo

---

## Team

| Person | Focus | Branch |
|---|---|---|
| Joscha | LLM architecture · tools · root-cause agent · pitch | `feat/joscha` |
| Lila | Frontend · canvas UX · generative-UI components | `feat/lila` |
| Harsh | Fullstack · visualizations · tool-layer implementation | `feat/harsh` |
| Harjot | Backend · data layer · DevOps · closure monitor | `feat/harjot` |

Branching: `feat/*` → `develop` → `main` via PR. `main` is always deployable. Never commit code directly to `main`.
