# RESOLVE — Wireframe & UI Brief

**Use this file as a single prompt for Anthropic Design Labs / Claude (or any design-gen tool).**
Paste the whole thing. Don't trim it. Everything here is load-bearing.

> You are generating a clickable high-fidelity wireframe for **Resolve** — a closed-loop quality intelligence product by **Manex AI (Qualitatio)**. Follow the brand, IA, screens, and interaction patterns below exactly. Where you have creative license, it is marked as **[design call]**. Where a spec is fixed, it is marked as **[fixed]**.

---

## 1. Product one-liner

> Resolve is the Qualitatio layer that turns every quality signal — from the factory floor or the customer — into a routed, tracked, measurable initiative. 8D and FMEA fall out of it automatically.

Tagline: **"Every voice becomes an initiative."**

Built for three user lenses on the same underlying canvas:
- **Floor lens** — line operator / foreman. Voice-first. Zero jargon. One-question prompts.
- **Engineer lens** — junior or senior quality engineer. Full reasoning canvas, graph, timeline, BOM traceability, edit mode.
- **Leadership lens** — plant director, central quality head. Pareto, cost exposure, open-initiative board, cross-plant incident map.

Three-act narrative that every screen must support:
**LISTEN** (signal capture + correlation) → **REASON** (multi-stakeholder canvas) → **RESOLVE** (domain agents dispatch initiatives).

---

## 2. Brand / visual language — mirror the Manex Qualitatio site

The product must feel like a native extension of **https://www.manex.ai**. Use the same visual vocabulary.

### 2.1 Palette [fixed]

```
/* Core */
--bg-deep:        #0B0F14   /* near-black, slightly blue; primary app background */
--bg-surface:     #111722   /* panels, cards */
--bg-elevated:    #1A2230   /* hover / elevated panels */
--bg-subtle:      #151B27   /* inset sections, inputs */

/* Ink */
--ink-primary:    #F4F6FA   /* body text on dark */
--ink-secondary:  #A8B2C3   /* secondary text */
--ink-muted:      #6B7689   /* tertiary, metadata */
--ink-inverse:    #0B0F14   /* text on light accents */

/* Signature accent — Manex neon */
--accent-500:     #C5F82A   /* electric lime — primary CTA, active state, AI output highlight */
--accent-600:     #A6DB14   /* hover */
--accent-300:     #E0FF6E   /* subtle glow / ring */
--accent-bg:      rgba(197,248,42,0.08)

/* Semantic */
--severity-low:      #5FC2A3   /* teal-green */
--severity-medium:   #F3C969   /* amber */
--severity-high:     #F48A5C   /* warm orange */
--severity-critical: #EB5E55   /* red; use sparingly */

/* Data-viz */
--viz-1: #C5F82A   /* primary series = accent */
--viz-2: #7AA7FF   /* cool blue */
--viz-3: #C59BFF   /* lavender */
--viz-4: #F48A5C   /* orange */
--viz-5: #5FC2A3   /* teal */

/* Lines / borders */
--border-subtle:  rgba(255,255,255,0.06)
--border-strong:  rgba(255,255,255,0.12)
```

Rules:
- Dark mode is the **default and primary**. A light mode is a stretch goal; don't spend time on it.
- The lime accent is precious. Use it for: primary CTAs, the single most important metric on a screen, the "live" indicator, and AI-generated content highlights. If the lime is everywhere it is nowhere.
- Never use pure black (`#000`) or pure white (`#FFF`). Use the ink and bg tokens.

### 2.2 Typography [fixed]

Primary: **Inter** (fallback: system-ui). Display sizes in **Satoshi** if available, else Inter tight-tracked.

```
Display XL    56 / 60   -0.02em   weight 600   (hero numbers like "20%")
Display L     40 / 48   -0.015em  weight 600
H1            32 / 40   -0.01em   weight 600
H2            24 / 32   -0.005em  weight 600
H3            18 / 28            weight 600
Body          14 / 22            weight 400/500
Micro         12 / 16   +0.02em  weight 500   (labels, eyebrow, tags)
Mono          13 / 20            weight 500   (IDs, timestamps, SQL, code) — JetBrains Mono
```

Eyebrow pattern (copy from manex.ai): short uppercase word in `--ink-muted`, above each H2. E.g. `LISTEN` then H2 `Incoming signals, all in one feed.`

### 2.3 Shape, elevation, motion

- **Radius**: panels 16px, cards 12px, inputs 10px, chips 999px (pill).
- **Elevation**: no drop shadows on panels; use 1px subtle borders and `--bg-elevated` for lift. Tooltips and popovers: soft shadow `0 8px 24px rgba(0,0,0,0.4)`.
- **Decorative motif**: Manex uses **hexagon patterns** as backdrops (see `hexagon shapes.svg` on their product page). Use a subtle hex grid at 4% opacity behind hero sections on the empty-state and landing-incident screens. Do not use hex patterns on working surfaces.
- **Motion**: 150ms standard ease-out. 250ms for panel slides. 400ms for canvas node transitions. Respect `prefers-reduced-motion`.

### 2.4 Component primitives

Use **shadcn/ui** as the base system. Extend with:
- `MetricTile` — display XL number + delta chip + micro label (directly inspired by the "Up to 20%" pattern on manex.ai).
- `SignalCard` — icon + source + time + severity ring + one-line text.
- `AgentChip` — pill with small agent icon + agent name + status dot.
- `LensSwitcher` — segmented control top-right, three options: Floor / Engineer / Leadership.
- `ConfidenceBar` — horizontal bar with gradient from `--ink-muted` to `--accent-500`, with numeric %.

---

## 3. Information architecture [fixed]

```
/                                   → Landing (Engineer lens by default, Lens switcher present)
/inbox                              → Incident Inbox (triage queue)
/incident/:id                       → Incident Canvas (Engineer lens primary)
/incident/:id/8d                    → 8D projection of canvas
/incident/:id/fmea                  → FMEA projection of canvas
/incident/:id/resolve               → Agent dispatch screen
/initiatives                        → Initiative Tracker (kanban + table)
/lessons                            → Lessons library (network-effect showcase)
/floor                              → Floor lens (mobile-first voice capture)
/leadership                         → Leadership dashboard (plant + network map)
/settings/connectors                → Signal source configuration
```

Global nav (left rail, collapsible):
1. Inbox (pending incidents count badge)
2. Incidents (all)
3. Initiatives (active count)
4. Lessons
5. — divider —
6. Connectors
7. Settings

Top bar: product logo (left), global search (center, keyboard shortcut `⌘K`), lens switcher (right), user avatar.

---

## 4. Screen-by-screen wireframes

For each screen below: **purpose**, **layout zones**, **components**, **empty state**, and **demo-flow note** (what must work for the judge demo).

### 4.1 Landing — Engineer lens [fixed structure]

**Purpose**: on login, show the engineer what needs their attention right now.

**Layout** (12-col grid, 1440 design width):
- Row 1 (full-width): **Pulse bar** — thin horizontal band under the topbar. Shows 4 live metrics with `MetricTile`:
  - `NEW INCIDENTS` today + delta vs yesterday
  - `OPEN INITIATIVES` count + avg age
  - `€ COST AT RISK` (sum of open incidents × severity-weighted cost estimate)
  - `LESSONS APPLIED` this week (how often network effect kicked in)
- Row 2 (8-col left, 4-col right):
  - Left: **"Needs your attention"** — list of top 5 incidents ranked by severity × cost × AI-confidence. Each row is an `IncidentRow`: severity ring, title, primary product, signal-count chip, last-updated, assigned-to avatar, open button.
  - Right: **"Rising patterns"** — 3 small cards, each showing an embedding-cluster trend the correlator noticed in the last 24h. Sparkline + one-sentence AI synopsis + "Investigate" button.
- Row 3 (full-width): **Recently resolved** — horizontal scroll carousel of 5 recent `LessonCard`s. Each card: signature, fix summary, days-open, outcome chip.

**Demo-flow note**: on load, the top incident in "Needs your attention" is the pre-seeded **Supplier Batch SB-00007** incident. Click → /incident/INC-00001. Second incident is the **Thermal drift / R33** story.

**Empty state**: hex-pattern backdrop, one large line "All clear. No incidents above the threshold." plus a faint row of "Signal sources healthy" source chips.

---

### 4.2 Incident Inbox — /inbox [fixed structure]

**Purpose**: full triage queue, filterable, the QE's "work surface" before opening a canvas.

**Layout**:
- Left rail (240px): saved filters — "Mine", "Unassigned", "Critical", "From field", "From floor", "From supplier". Below: **Sources** multi-select (CRM, MES, Warranty, Voice, Social, Inbound-Inspection, SPC-Drift, EOL-Test).
- Main (flex):
  - Header: count, bulk-action bar (assign, dismiss, merge).
  - Table or dense card list [design call — prefer dense table with expandable row].
  - Columns: severity, title, primary product + article, signal sources (overlapping icon chips), signal count, first-seen, last-seen, assignee, status, AI-confidence.
- Right slide-over (320px, opens on row hover): quick preview — top 3 correlated signals, AI one-line summary, "Open canvas" CTA.

**Merging**: selecting 2+ rows shows a **"Merge into one incident"** action in the bulk bar. This is critical — correlator catches most, humans merge the rest.

**Demo-flow note**: show "From field" filter clicks from 12 field-claim signals → one click reveals they're all pointing at PM-00008 / batch SB-00007 → "Investigate as incident".

---

### 4.3 Incident Canvas — /incident/:id [THE HERO SCREEN]

This is the single most important screen in the product. Design it like Figma designs Figma: everything lives on one working surface.

**Layout** (full-bleed, no margins):
- Topbar (48px): back chevron, incident title (editable), severity chip, status chip, lens switcher.
- Tabbed view bar (40px) directly below topbar: **Canvas** (default) | **8D** | **FMEA** | **Ishikawa** | **Timeline** | **Resolve ▸**
- Three-panel canvas body:

```
┌───────────────────────────────────────────────────────────────────┐
│ LEFT RAIL (320px)           CANVAS (flex)         RIGHT RAIL (360)│
│ ─ Signals                   ┌─────────────────┐   ─ Contributions│
│   (scrollable list)         │  Root-Cause     │     (9 stakeholder│
│   group by source           │  Graph          │     domain panel) │
│                             │  React Flow     │                   │
│ ─ BOM traceability          │                 │   ─ AI Reasoning  │
│   (tree collapsed)          │  Timeline strip │     (live draft)  │
│                             │  (bottom 120px) │                   │
│                             └─────────────────┘                   │
└───────────────────────────────────────────────────────────────────┘
```

**Left rail — Signals**
- Header: "Signals" + count + filter pill row (All / Internal / External).
- Each signal is a `SignalCard`: source icon, time-ago, product/part ref, severity ring, one-line text (truncated). Click → focus this signal in the graph, show raw payload in a popover.
- At the bottom, a faint **"+ 3 near-miss test results you may want to include"** affordance surfacing MARGINAL tests the correlator scored as related. Click → adds them to the incident with a confirmation.

**Center — Root-Cause Graph [design call within constraints]**
- React Flow canvas, dark background, hex-grid backdrop at 3% opacity.
- Node types:
  - **Incident node** (center, large): rounded rectangle, severity ring, title.
  - **Hypothesis nodes** (up to 4 branches around incident): labeled Material / Process / Design / Operator. Each has a confidence bar. The top-ranked hypothesis glows with `--accent-500` ring.
  - **Evidence nodes** (children of hypotheses): signal chips with source icon, 1 line, click to open signal payload.
  - **Supporting-data nodes**: small chips like "batch defect rate: 14.2%", "test drift: 8σ", clickable to open the underlying query.
- Edge styling: confidence-weighted thickness, low-confidence dashed, high-confidence solid lime.
- User actions on graph:
  - Click node → focus panel + right-rail shows node detail.
  - Drag node → rearrange (persist per-user).
  - Right-click → "Challenge this hypothesis" (adds a counter-evidence prompt to the right rail) or "Promote to primary".
  - Tiny `+` button next to each hypothesis → "Ask AI to expand this branch".
- Below the graph, a 120px **Timeline strip**: horizontally scrollable, all signals plotted at their timestamps + build date of the product + rework events + field-claim dates. Color-coded by source. Click any dot → focus in graph.

**Right rail — Contributions + AI reasoning**
- Top half: **"Stakeholder contributions"** — a vertical list of 9 domain cards (Market Research, Central Quality, Plant Q — indirect, Plant Q — direct, Process Planner, Technology Planning, Supplier Quality, Business Analytics, Marketing). Each shows:
  - Domain name + small domain icon
  - Status: `Pending` (muted) | `Live` (pulsing dot) | `Contributed` (check) | `Dismissed` (strikethrough)
  - One-line AI-fetched contribution preview, click to expand.
  - "Request again" icon button.
- Bottom half: **AI Reasoning drawer** — always visible, scrollable. Shows the current best-effort problem statement + ranked hypotheses + AI's chain of reasoning references (hover over a claim to see the underlying signal ID). Lime bar on the left edge marks AI-generated content. A **"Regenerate"** button and a **"Ground on additional data"** prompt at the bottom.

**Floating action bar** (bottom center): `Add signal` | `Annotate` | `Share` | **`Dispatch to Resolve →`** (primary CTA, lime).

**Demo-flow note**: opening INC-00001 (supplier batch) shows all four signal sources already correlated, hypothesis tree with "Material — bad supplier batch" at 82% confidence, right rail with Supplier Quality contribution live ("ESR screening data shows batch SB-00007 out of spec. Supplier: ElektroParts GmbH."). The `Dispatch to Resolve →` button is primed.

---

### 4.4 8D / FMEA projections — /incident/:id/8d and /fmea [fixed]

These are **auto-generated from the canvas** — no manual typing. The page renders like a document but every field has a small pencil icon to override.

**8D layout**:
- Header: "8D Report — <incident title>". Export PDF button (top right), "Re-draft from canvas" button.
- 8 sections in classic 8D order (D1..D8), each a card:
  - D1 Team
  - D2 Problem description (AI-drafted, lime left-bar)
  - D3 Interim containment
  - D4 Root cause
  - D5 Chosen corrective action
  - D6 Implement & verify
  - D7 Prevent recurrence
  - D8 Congratulate team
- Right sidebar (240px): provenance map — every section shows "Sourced from: signals SIG-001, SIG-012, contribution CTR-08". Click any reference → jumps back to canvas with that node focused.
- Revision history dropdown at top ("v3 · auto-drafted 2 min ago").

**FMEA layout**:
- Top metadata strip: product, article, team, date.
- Main table: Failure Mode | Effect | Severity (S) | Cause | Occurrence (O) | Current Control | Detection (D) | RPN (live computed) | Recommended Action | Responsibility | Due | Action Taken | Resulting RPN.
- Rows auto-populated from hypotheses. RPN computed live. Cells above threshold (e.g. RPN>120) glow amber/red.
- Below table: heatmap visualization — severity × occurrence grid with bubbles sized by detection.

**Demo-flow note**: toggling from Canvas to 8D mid-demo should feel like "the report writes itself." Make the transition a 250ms slide, not a hard route.

---

### 4.5 Resolve screen — /incident/:id/resolve [fixed]

**Purpose**: dispatch the chosen corrective actions into the five domain agents. This is where "closed-loop" becomes tangible.

**Layout** (two-column):
- Left (7/12): **Agent panels — five stacked cards**, one per agent.
  Each `AgentPanel` has:
  - Agent header: icon, name, target system badge (e.g. "MES", "SRM", "Jira", "ERP", "CRM"), status dot.
  - AI-drafted action body — editable rich text (shadcn `Textarea` wrapped in a card with lime left-bar).
  - Structured fields: owner (user picker), due date, priority.
  - Tool preview: the JSON-ish preview of what the agent will POST (collapsible). E.g. for Production Agent: the `product_action` INSERT payload.
  - **Impact projection chip**: "+ prevents ~8 claims over 12 weeks" (from Impact Simulator).
  - Toggle: "Include in dispatch" ✓ (all on by default).
- Right (5/12): **Impact Simulator panel** (sticky).
  - Headline metric: `Expected claims avoided: 11` (Display L, lime).
  - Secondary: `€ cost avoided (range): €48k – €92k`.
  - Below: stacked bar comparing "Without action" vs "With this dispatch".
  - Bottom: "Similar past incidents" — 3 `LessonCard`s retrieved by embedding similarity, each with outcome. This is the **network-effect** showcase.
- Bottom center sticky CTA: **`Dispatch 5 initiatives →`** (lime, disabled until every agent has an owner + due date).

**Post-dispatch state**: the CTA morphs into a progress panel showing each agent's post result (success/failure) with links to external IDs created (e.g. "Jira ticket OPS-4127 created"). A confetti burst is tacky — skip it. A subtle lime sweep across the screen is fine. Then auto-route to /initiatives with the new initiatives highlighted.

**Demo-flow note**: dispatch the Supplier Batch incident → watch 5 initiatives post, route to /initiatives with all 5 highlighted in a "new" group.

---

### 4.6 Initiative Tracker — /initiatives [fixed structure]

**Purpose**: kanban + table of all initiatives across incidents.

**Layout**:
- Header: filters — by incident, by agent, by owner, by target system, by status.
- Main view toggle: **Board** (default) | **Table** | **Timeline**.
- Board columns: `To do` | `In progress` | `Blocked` | `Verifying` | `Closed`.
- `InitiativeCard`: title, agent icon, target-system badge, owner avatar, due-date chip (color-coded), linked incident link (top-right), impact-chip.
- Click a card → right slide-over with full detail, comments thread, "Measure impact" CTA (opens the measurement form — metric, value, confidence, method).

**Lessons generation**: on moving a card to `Closed`, a prompt appears: "Capture as a lesson?" (defaults to yes). Lesson is saved with an embedding. Show a small "⚡ Added to lesson library" toast.

---

### 4.7 Lessons Library — /lessons [fixed]

**Purpose**: the network-effect showcase. Every past resolution, searchable by signature or similarity.

**Layout**:
- Header: search input (semantic search, driven by pgvector). Placeholder: "Search by symptom, part, supplier, fix…".
- Main body: masonry grid of `LessonCard`s. Card contents:
  - Signature block — short AI-extracted symptom description.
  - Fix summary.
  - Tags (domain, product family, severity).
  - Stat: "Applied 14× across 3 plants".
  - Tiny graph: recurrence trend after the lesson was applied.
- Right sidebar: "Top matches for your current incident" (shown when navigated from /incident/:id).

---

### 4.8 Floor lens — /floor [MOBILE-FIRST, REONIC-WINNING SCREEN]

**Purpose**: foreman on the line flags something weird, no training required.

Design at **390×844 (iPhone 14)**; desktop/tablet is a max-width 480px view.

**Layout** (5 stacked sections, scroll vertically):
1. **Greeting strip** (72px): lime avatar dot, "Hi Markus — Montage Linie 1 · Shift 2". Nothing else.
2. **Big voice button** (200x200, centered, circular, lime ring with animated pulse when idle). Label above: "Report something weird". Label below: "Tap and hold to talk". On tap-hold: ring grows, waveform appears, Whisper transcribes live in a subtle text strip below.
3. **Quick chips** — six preset prompts (horizontal scroll): "Scratch on housing" | "Strange noise on test" | "Batch looks off" | "Wrong label" | "Heat warning" | "Other". Tapping a chip prefills the voice input.
4. **My open reports** — a vertical list (max 3 shown) of reports this user submitted today. Each row: status dot (Triaged / Investigating / Resolved), one-line summary, time-ago. Tap → opens a simplified incident view with only: title, current status, AI's one-sentence "what we're checking", and a "Tell me when done" toggle (push notification opt-in).
5. **Footer**: lens switcher only available to users with multi-lens permission; otherwise this is the whole app.

**Design call — invisible AI**: the foreman never sees the word "AI", "LLM", "incident", "hypothesis", "8D", or "initiative". Copy must stay at a middle-school reading level, use "what we noticed / what we're checking / what happens next".

**Demo-flow note**: the voice capture hits /api/signals, correlator groups it with pre-seeded floor signals. A toast after submission: "Thanks — we're looking into it. Similar reports: 3." Tap the toast → opens INC-00001. **This is the moment that wins Reonic.**

---

### 4.9 Leadership lens — /leadership [fixed]

**Purpose**: the director sees the whole picture in 10 seconds.

**Layout**:
- Top row — 4 `MetricTile`s (full-width): `Open incidents`, `€ at risk`, `Avg time-to-close (days)`, `Claims avoided this quarter`. Each with 30-day sparkline.
- Second row (8/4 split):
  - Left: **Incident Pareto** — horizontal bar chart of defect codes ranked by cost impact. Top-3 bars in lime.
  - Right: **Plant heatmap card** — a small stylized factory-floor map with sections colored by incident density. Honest distractor call-out: a subtle annotation next to "Pruefung Linie 2" reads "*detection bias — not a root cause*" so the judges know we saw through it.
- Third row: **Cross-plant incident map** — stretch; world map with dots at plant cities, each dot sized by open-incident count. Click → drill into that plant's /inbox.
- Fourth row: **Open initiatives board** — compact kanban summary, 5 swimlanes same as /initiatives but aggregated.

---

### 4.10 Connectors — /settings/connectors [fixed structure]

**Purpose**: show that signals come from many sources. Judges see this and get the "multi-source" story immediately.

**Layout**:
- Grid of connector cards. Each:
  - Logo / icon, connector name (e.g. "MES — end-of-line tests", "Warranty CRM", "Supplier Inbound Inspection", "Voice of Floor", "NPS / CX", "Social Listening", "IoT Telemetry", "FMEA Registry").
  - Status dot: Connected / Partial / Disconnected.
  - "Signals ingested (24h)" counter.
  - Last sync time.
- Sections: **Internal — Production** | **Internal — Supply Chain** | **External — Customer** | **External — Market**.
- Top banner: "12 sources connected · 3 pending". This mirrors Manex's "12 data silos" slide directly.

---

## 5. Shared components library [fixed]

### 5.1 SignalCard
```
┌──────────────────────────────────────────┐
│ [src icon] Warranty  ·  3 days ago       │
│ ● (severity ring)                         │
│ "Totalausfall nach 4 Wochen Betrieb"     │
│ PRD-00712 · PM-00008 · ElektroParts      │
│                                   [open] │
└──────────────────────────────────────────┘
```
Source icons: MES chip, CRM chip, Warranty chip, Voice chip (microphone), Social chip, Inbound-Inspection chip, SPC-Drift chip, EOL-Test chip, FMEA-Anticipated chip. Use Lucide icons + a single-letter badge in accent color.

### 5.2 AgentChip
```
[●] [P] Production Agent  →  MES
```
Five agents, five icons:
- Production Agent — factory icon
- Supplier Agent — truck icon
- R&D / Dev Agent — flask icon
- Logistics Agent — package icon
- Customer-Response Agent — mail icon

### 5.3 HypothesisNode (React Flow custom node)
```
┌──────────────────────────────┐
│  [MATERIAL]                  │
│  Supplier batch SB-00007     │
│  ▰▰▰▰▰▰▰▰▱▱  82%            │
│  5 evidence · 2 contradict   │
└──────────────────────────────┘
```
Active = lime border + glow. Dashed border = AI speculation. Solid border = confirmed.

### 5.4 LessonCard
```
┌─────────────────────────────────────┐
│ ⚡ LESSON                            │
│ "Cold solder cluster from a         │
│  specific supplier batch"           │
│  Fix: Quarantine batch, add ESR     │
│  inbound screen, supplier 8D        │
│  Applied 14× · 3 plants             │
│  Outcome ● Resolved                 │
└─────────────────────────────────────┘
```

### 5.5 MetricTile
```
NEW INCIDENTS
   14      ↑ 3 vs yesterday
   ▁▃▂▅▇▆▄
```
Large number uses Display XL. Delta chip uses severity colors.

### 5.6 LensSwitcher
Segmented control, three options. Persists to URL query `?lens=engineer|floor|leadership` and to localStorage. On Floor lens, rest of app chrome hides — fullscreen mobile experience.

---

## 6. Interaction patterns [fixed]

- **⌘K everywhere**: global command palette. Actions: "Open incident…", "Switch lens", "Dispatch incident…", "Search lessons…", "Go to connector…".
- **AI content is always marked**: a 2px lime left-bar and a tiny sparkle glyph. Clicking the bar opens the provenance popover.
- **Hover → preview, click → open**: every signal, every initiative, every lesson follows this rule. Never force a full navigation for a quick look.
- **Optimistic updates**: dispatching agents, moving kanban cards, assigning owners all update instantly then reconcile.
- **Undo bar**: 10-second undo bar at bottom-center after destructive actions (dismiss incident, remove signal, move to closed).
- **Keyboard**:
  - `J/K` next/prev in any list
  - `E` assign to me
  - `R` go to Resolve screen from current canvas
  - `?` opens shortcut cheatsheet

---

## 7. Empty / loading / error states [fixed]

**Loading**: skeleton blocks, 800ms shimmer. No spinners.
**Empty** (no incidents): hex-pattern hero with a single line "Quiet on the floor. Your signal sources are healthy." + "See connectors →" button.
**Error** (API down): inline top banner in `--severity-high` tint with last-sync time and "Retry" CTA. Never a full-screen error — the product should degrade gracefully.
**Offline**: mark affected surfaces with a muted overlay and a "Queued — will sync when online" ribbon. Floor lens specifically must queue voice signals locally.

---

## 8. Demo-flow storyboard (for the judges)

The wireframes must support this 3-minute demo verbatim. Design every screen with these moments in mind.

1. **0:00 – Open the Floor lens on a phone.** Voice capture: *"Hi, this housing on Linie 1 has a scratch and it's the third one this shift."* Submit. Toast appears: *"Thanks — we're looking into it. Similar reports: 2."*
2. **0:20 – Swap to laptop, Engineer lens, Landing page.** Top "Needs your attention" row — the supplier batch incident is row 1. Click.
3. **0:35 – Incident Canvas loads.** Narrate: *"17 signals correlated across field claims, inbound inspection, and near-miss EOL tests. Hypothesis tree: Material — supplier batch SB-00007 at 82% confidence. Right rail: contributions from Supplier Quality, Central Quality, and Business Analytics landed in the last 2 minutes."*
4. **1:10 – Toggle to 8D view.** *"The 8D report is already written. Click any sentence to see which signal it came from."*
5. **1:30 – Back to canvas, click Dispatch.** Resolve screen, 5 agent panels pre-drafted. *"Production Agent quarantines affected serials. Supplier Agent fires an 8D to ElektroParts. R&D Agent files a spec revision. Customer-Response Agent drafts proactive outreach."*
6. **2:00 – Show Impact Simulator.** *"11 claims avoided, €48–92k."* Click **Dispatch 5 initiatives**.
7. **2:10 – Jump to Initiatives board.** 5 new cards highlighted.
8. **2:20 – Open Lessons library.** Search "cold solder supplier" — the matching lesson shows "Applied 14× across 3 plants". *"Every incident resolved anywhere makes the next one faster. That's the network effect."*
9. **2:45 – Switch to Leadership lens.** Pareto + plant heatmap with the honest "detection bias" annotation on Pruefung Linie 2. *"We built a tool that doesn't fool you."*
10. **3:00 – Close**: *"Resolve is the layer that turns every voice into an initiative. 8D and FMEA are side effects. This is Qualitatio, closing the loop."*

Every screen above must be demo-ready within 48 hours. If a component is not in the demo flow, it is a stretch goal — prototype it, don't polish it.

---

## 9. Priority order for the wireframe build

If Design Labs can only render N screens, render them in this order:

1. **Incident Canvas** (4.3) — this is the hero, everything else is secondary
2. **Floor lens** (4.8) — this is the Reonic-winning screen
3. **Resolve screen** (4.5) — this proves "closed-loop"
4. **Landing (Engineer)** (4.1) — first impression
5. **8D projection** (4.4) — proves "report writes itself"
6. **Initiatives board** (4.6) — proves tracking
7. **Leadership dashboard** (4.9) — proves business value
8. **Lessons library** (4.7) — proves network effect
9. **Connectors** (4.10) — proves multi-source
10. **Incident Inbox** (4.2) — proves triage

---

## 10. Do / Don't for the generator

**Do**
- Use dark mode by default, lime accent sparingly.
- Echo Manex's manex.ai patterns: big stat tiles with "Up to X%" language, step-numbered flows, hex motifs, tab-based feature showcase.
- Treat AI output as a first-class object — mark it, give it provenance.
- Put the canvas at the heart; make 8D, FMEA, Ishikawa, Pareto all projections of it.
- Design the Floor lens like Superhuman designs email. Opinionated. Minimal. Fast.

**Don't**
- Don't build another Excel replica. The 8D view exists as an export, not a primary workspace.
- Don't scatter lime across the UI. It dies fast.
- Don't use dropdowns where tabs or segmented controls would do.
- Don't show LLM / AI / agent jargon on the Floor lens.
- Don't draw a fishbone diagram as the default reasoning surface — the graph is the primary, fishbone is a projection.

---

## 11. Technical handoff notes (for the build after wireframing)

- Target stack: **Vite + React + TS + Tailwind + shadcn/ui + React Flow + Recharts**. Lucide icons.
- All canvas state is URL-persistable; deep links must work (`/incident/INC-00001?focus=hypothesis-material`).
- Responsive breakpoints: 390 (floor lens), 768 (tablet view of engineer lens is acceptable — not primary), 1280+ (primary engineer/leadership).
- Dark mode via Tailwind `dark:` + CSS vars above (set on `:root`).
- Accessibility: every interactive node in the React Flow graph must have keyboard focus, aria-labels, and skip links. Contrast AA minimum, AAA for body text. Floor-lens voice button must have both tap-and-hold and tap-to-toggle modes.

---

## 12. Reference imagery (from manex.ai — to feed into the generator)

- Hero dashboard mockups: `main Dashboard.png`, `graph.png`, `defects.png` (from the product page).
- Step-numbered flow: the "Step 1 / Step 2 / Step 3 / Step 4" pattern on the product page.
- Hexagon motif: `hexagon shapes.svg` — background decoration pattern.
- Testimonial card layout: pull for the Lessons library card framing.
- Stat tile pattern: "Up to 20% / 70% / 35%" hero stat tiles.

When generating, sample the Manex site thumbnails directly: https://www.manex.ai/en and https://www.manex.ai/en/product. Reference their color warmth, photography, and card framing. Do not copy their marketing copy — only the visual vocabulary.

---

## 13. How to use this brief with Anthropic Design Labs / Claude

**Prompt recipe:**

> You are generating a clickable high-fidelity wireframe kit for a product called **Resolve**, built by Manex AI. Follow the brief below exactly. For each screen in section 4, produce one frame. Render in dark mode using the tokens in section 2.1. Use the component primitives in section 5. Match the visual vocabulary of https://www.manex.ai/en (lime accent, hexagon motifs, stat tiles, step-numbered flows). Deliver screens in the priority order in section 9. When you must make an aesthetic call, prefer dense, information-rich, data-forward layouts over airy marketing pages. Every screen must support the demo flow in section 8.
>
> [paste sections 1 through 12 here verbatim]

**Then iterate screen-by-screen:**

> Generate screen 4.3 — Incident Canvas — at 1440×900. Follow the three-panel layout. Use the pre-seeded incident INC-00001 (supplier batch SB-00007, PM-00008, ElektroParts GmbH) as the content. Hypothesis ranking: Material 82% (primary, lime glow), Process 38%, Design 24%, Operator 9%. Right-rail contributions: Supplier Quality (live), Central Quality (contributed), Business Analytics (live), others pending.

Repeat for each screen. Keep the content consistent across all screens (same incident IDs, part numbers, supplier name) so the demo flows without visual breaks.

---

*End of brief.*
