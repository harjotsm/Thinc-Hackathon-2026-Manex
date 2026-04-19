# Resolve by Manex — Context for Stitch

Paste this context alongside the Inbox / Incidents / Lessons screenshots so
Stitch can propose an improved visual design. Keep the copy **English + German**
mixed as-is — the real app runs in a German-speaking factory context and both
languages appear side-by-side in the data.

---

## 1 · What the product is

**Resolve** is a *closed-loop quality intelligence layer* that sits on top of
the existing Manex MES/SRM stack in manufacturing plants. Tagline:
**"Every voice becomes an initiative."**

Where the factory today has half a dozen disconnected systems (warranty portal,
SPC chart viewer, supplier portal, Jira, Excel), Resolve ingests every
production- or customer-voice into a single *signal stream*, clusters related
signals into *incidents*, and runs an AI orchestrator that reasons to a root
cause, proposes actions, and then watches the world to confirm the action
actually closed the problem. Resolved incidents become *lessons* that are
reused across all plants via semantic retrieval — that's the network effect.

The audience is three distinct personas who each see the same underlying data
through a different UI projection we call a **lens**:

- **Floor (Operator)** — Werkerhemd, tablet, voice-first. Needs the top
  next-action and an easy way to add a voice contribution. No tables, no
  filters.
- **Engineer (Quality Engineer)** — laptop, dense information. Triages the
  inbox, drives investigations, reviews AI reasoning & evidence trails,
  approves or overrides initiatives. Our primary lens.
- **Leadership** — portfolio view. Pareto by product/plant, trend, closure
  rate. Answers "where is my quality problem biggest, is it getting better?"

## 2 · Domain vocabulary (use these exact words — no synonyms)

| Term | Meaning | Key fields |
|---|---|---|
| **Signal** | one normalized incoming fact (internal SPC drift, warranty claim, SRM inspection fail, voice note) | `signal_id`, `source_system`, `signal_type`, `text_payload`, `captured_ts` |
| **Incident** | cluster of related signals worth reasoning about; the unit of UX | `incident_id`, `title`, `archetype`, `severity` (low/medium/high/critical), `status` (triage/reasoning/resolving/closed/dismissed) |
| **Archetype** | root-cause category the AI assigns | `supplier` · `drift` · `design` · `operator` · `unknown` |
| **Initiative** | dispatched corrective action in a domain system of record (MES, SRM, Jira, CRM…) | `title`, `domain`, `target_system`, `rationale`, `confidence`, `closure_predicate` |
| **Lesson** | embedded signature of a resolved incident; used for near-neighbor retrieval when a new incident looks similar | `lesson_id`, `signature`, `fix_summary`, `applied_count`, `trend` |
| **Canvas** | the full workspace for one incident (hypotheses, evidence, reasoning timeline, initiatives, contributions). 8D / FMEA / Ishikawa / Pareto are just *projections* of this same object, not separate documents. | |
| **Lens** | UI projection — `floor` / `engineer` / `leadership`. Same data, different density + affordances. | |

**Archetype colour code** (use these hues consistently across Inbox / Incidents
/ Canvas so a Quality Engineer recognises the category at a glance):

- Supplier → orange
- Drift → amber
- Design → pink
- Operator → violet
- Unknown → muted gray

**Severity colour code**: critical → red, high → orange, medium → amber,
low → emerald.

## 3 · The three screens Stitch is redesigning

### A · `/inbox` — Inbox (Engineer lens)

**Job-to-be-done:** "Give me the *themes* in my factory right now, so I know
what to work on first." An engineer opens the inbox at 08:00, scans it in 30
seconds, decides what to triage.

- Clusters incidents by a deterministic *signature* (e.g. `supplier:PM-00008`,
  `drift:reflow-stn04`). A *theme* is a cluster; a theme contains ≥1
  incident, each with ≥1 signal.
- Two groups visible:
  1. **Triaged themes** — archetype already inferred, sorted by severity.
  2. **Needs triage** — theme exists but AI hasn't classified yet.
- Each theme card shows: severity dot · archetype badge · title · incident
  count · signal count · tiny sparkline of recent signal volume · last
  activity time · confidence from latest report.
- Filter strip up top: lens (not really togglable here, just shown), window
  (1d / 7d / 30d), archetype, severity, product.
- Clicking a theme drills to `/incidents?theme=<signature>`.
- Data: `GET /api/themes?lens=engineer&window=7d&archetype=…`.

**Pain points today**: the card layout feels like a feed — hard to scan the
*pipeline* of work. Sparkline too small. Archetype colour fills are soft and
similar between archetypes. No sense of *priority ordering* beyond severity
dot.

### B · `/incidents` — Incidents list

**Job-to-be-done:** "Now that I picked a theme, show me the individual
incidents so I can pick one to investigate." Also serves as the global
search/filter surface across all incidents.

- Table-style list. Each row: incident ID (link to canvas), title, archetype
  badge, severity dot, signal count, last activity, confidence bar, owner
  avatar.
- Header has: filter strip (status, archetype, severity, product, window),
  full-text search, theme breadcrumb when filtered ("Filtered by
  supplier:PM-00008 · clear").
- Clicking an incident opens the full Canvas at `/incident/[incidentId]`.
- Data: `GET /api/incidents?status=&archetype=&severity=&theme=&q=&window_days=30&page=…`.

**Pain points today**: dense but visually flat — every row looks the same, no
signalling of which incident is "hot" vs "cold". Confidence bar is subtle.
Filter strip competes visually with the list itself.

### C · `/lessons` — Lessons library

**Job-to-be-done:** "What did we learn last time? Can I reuse a known fix?"
Browsed by engineers *during* an investigation, and by leadership as a measure
of organisational learning (how often are we reusing lessons across plants).

- Top hero block: "324 lessons · applied 4,521× across 3 plants" — shows
  network-effect metric.
- Tag filter row: `solder`, `supplier`, `SB-00007`, `thermal`, `R33`,
  `torque`, `calibration`, `rework`, `operator`.
- Card grid (responsive, ~300px min card width). Each card: lesson ID · short
  signature · fix summary · applied-count badge · outcome tag (resolved /
  recurring) · small trend sparkline.
- Data (hackathon): prototype fixtures. Production: `lesson` table JOIN
  `lesson_usage` counts, with embeddings for similarity.

**Pain points today**: very flat grid, no sense of *recency* or *importance*.
Tag chips are purely filter, no weight indication. Recurring lessons (bad!
should be investigated further) don't visually stand out from resolved ones
(good!).

## 4 · API surface these screens actually call

| Endpoint | Verb | Used by |
|---|---|---|
| `/api/themes` | GET | Inbox |
| `/api/incidents` | GET | Incidents list |
| `/api/incident/[id]/report` | GET | Canvas (drilldown from both) |
| `/api/incident/[id]/signals` | GET | Canvas |
| `/api/incident/[id]/investigate` | POST | "Run AI" button on Canvas |
| `/api/initiatives` | GET | Kanban (adjacent screen) |
| `/api/lessons` | GET | Lessons (will exist post-hackathon) |
| `/api/intake/voice` | POST | Floor lens voice capture |

Pages use `revalidate = 30` so server components re-render with fresh data
every 30s. The UI also polls after "Run AI" to show a live banner.

## 5 · Tech & design constraints Stitch must respect

- **Stack**: Next.js 16 (App Router), React 19, Tailwind v4, **shadcn/ui**,
  base-ui primitives for dialogs/popovers, `lucide-react` icons, Recharts for
  charts, React Flow for graphs. Stitch's output will be hand-ported into
  shadcn component usage — so designs that map cleanly to `Card`, `Badge`,
  `Button`, `Separator`, `Avatar`, `Table`, `Dialog` are welcome.
- **Typography**: DM Sans (UI), JetBrains Mono (IDs, numbers, code blocks).
- **Brand palette** (already wired as CSS variables):
  - accent `#639fc4` (cool blue) · cta `#1032cf` (strong blue)
  - ink primary `#160042` · ink secondary `#3a3f55` · ink muted `#6b7080`
  - surface `#ffffff` · subtle `#f7f9fc` · inset `#eef3f7` · tint `#e1eef4`
  - severity: low `#5fc2a3` · med `#f3c969` · high `#f48a5c` · crit `#eb5e55`
- **Locale**: German labels in data ("Werk München", "Kondensator 100µF",
  "Batch SB-00009"). Mixed DE/EN UI copy is fine and realistic.
- **Density**: engineers want *information density* (think Linear, Height,
  Attio), NOT consumer-grade white space. Make the screens scannable in 3-5
  seconds, not aesthetically sparse.
- **Must keep**: archetype colour code, severity dots, test IDs that mirror
  semantic structure (no brittle layout-coupled IDs).

## 6 · What we want from Stitch

- **A better visual hierarchy** across all three screens so engineers know,
  without reading, what is urgent / new / resolved / in-progress.
- **Cohesion**: Inbox cards, Incident rows, Lesson cards all share the same
  archetype + severity visual language.
- **Signal over decoration**: fewer, more meaningful visual elements —
  sparklines, progress rings, confidence bars should *mean* something and be
  big enough to read.
- **Empty states** that look like intentional design, not "no data" text.
- **Filter UX** that doesn't visually dominate the content it filters.
- **Focus states** for keyboard navigation (engineers live on keyboard).

Feel free to propose **new affordances** (e.g. grouping by plant, pinning
hot themes, a "what changed since yesterday" strip on inbox) as long as they
can be implemented with the APIs listed in §4.

Out of scope for this Stitch pass: the Canvas (incident detail page) and the
Kanban — those are being iterated separately.
