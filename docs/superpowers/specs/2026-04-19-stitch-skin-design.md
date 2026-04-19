# Stitch Skin — Design Spec

**Branch:** `feat/stitch-skin` (worktree at `.worktrees/feat-stitch-skin/`)
**Base:** `develop` @ `8bc8e8f`
**Date:** 2026-04-19

## Goal

Adopt the visual language proposed by Google Stitch (purple-tinted surfaces,
deeper primary, editorial typography, hero blocks, denser archetype/severity
signalling) on the three Engineer-lens screens (`/inbox`, `/incidents`,
`/lessons`) while keeping the Manex.ai brand identity recognisable.

The user's complaint: "current frontend is very white and monotone." The fix:
add color and editorial character app-wide via tokens, restructure layouts
only where Stitch designed something new.

## Non-goals

- Restructure of Canvas, Initiatives, Floor, Settings, Dashboard, Connectors,
  or any incident detail view. They inherit new color tokens automatically;
  their layout, components and behaviour stay untouched.
- API / server / schema / DB changes. Pure frontend refresh.
- Touching `dashboard-prototype/` (standalone HTML).
- Real `/api/lessons` endpoint — uses existing `PROTOTYPE_DATA.lessons`
  fixtures.

## Decisions

| Decision | Choice |
|---|---|
| Token scope | Global — all pages inherit new palette |
| Layout / font / icon scope | Only the 3 Stitch screens get structural changes |
| Surfaces | Stitch's purple-tinted (`#fdf7ff` / `#f8f1ff` / `#f3eaff` / `#eee4ff`) |
| Primary | Stitch `#001f9d` |
| CTA | Existing `#1032cf` (matches Stitch primary-container) |
| Severity / Archetype hex | Unchanged (already identical in both palettes) |
| Body font | Plus Jakarta Sans body-wide (replaces DM Sans) |
| Mono font | JetBrains Mono (unchanged) |
| Icons | `lucide-react` everywhere (no Material Symbols) |
| Lessons data | Existing `PROTOTYPE_DATA.lessons` fixtures |
| Tests | Keep existing testIds; add new ones for Stitch-specific sections |

## Implementation Plan — 4 Sequential Commits

Each commit is independently demoable and revertable. If interrupted after
any commit, the app is in a coherent, ship-ready state.

### Commit 1 — Token Migration (~1h)

**File:** `web/src/app/globals.css`

- Replace DM Sans `@import` with Plus Jakarta Sans (all weights).
- Update `--sans` to `"Plus Jakarta Sans", ...`.
- Map background tokens to Stitch surfaces:
  - `--background`: `#f7f9fc` → `#fdf7ff`
  - `--bg-subtle`: `#f7f9fc` → `#f8f1ff`
  - `--bg-inset`: `#eef3f7` → `#f3eaff`
  - `--bg-elevated`: `#f5f8fb` → `#eee4ff`
- Map primary tokens:
  - `--primary` (oklch) → `#001f9d`
  - `--ink-primary`: `#160042` → `#210d4c`
- `--cta` (`#1032cf`) — unchanged, already matches Stitch primary-container.
- Severity (`--sev-*`), accent (`--accent`, `--accent-bg`), severity badges /
  chips / archetype CSS — unchanged. They reference the above variables and
  inherit automatically.

**Verification:** `pnpm test` still 257 passing (1 pre-existing DB failure
out of scope). Visual check via dev server: Inbox / Canvas / Initiatives all
show new palette without layout breaks.

### Commit 2 — Inbox Redesign (~2h)

**Files:**
- `web/src/components/themes/theme-inbox.tsx` (layout split)
- `web/src/components/themes/theme-card.tsx` (card anatomy)
- New: `web/src/components/themes/changed-since-yesterday.tsx`

**Layout shift:**
- Two-column grid: left "Triaged Themes" (`archetype !== "unknown"`), right
  narrower "Needs Triage" (`archetype === "unknown"`).
- Optional "What changed since yesterday" strip at top (`changed-since-yesterday`):
  client-side derives `n new themes / m new signals / k critical escalations`
  from themes with `last_activity_ts > 24h ago`. Hidden if no activity in
  window — no fake numbers.

**Card anatomy:**
- Severity dot stays (testId `severity-dot`).
- Archetype pill stays (testId `archetype-pill`) — Stitch tint background +
  indicator dot style.
- Sparkline switches from line to **bar-chart** (7 buckets as mini bars,
  archetype-coloured).
- Confidence value as large mono display (`font-mono text-2xl font-bold`).
- Incident chips remain.

**New testIds:** `triaged-themes-section`, `needs-triage-section`,
`changed-since-yesterday`.

### Commit 3 — Incidents Redesign (~2h)

**Files:**
- `web/src/components/incidents/incidents-table.tsx`
- `web/src/components/incidents/incident-row.tsx`
- `web/src/components/incidents/incidents-filter-strip.tsx`
- `web/src/components/incidents/theme-breadcrumb.tsx`
- New: `web/src/components/incidents/incidents-kpi-block.tsx`

**Layout shift:**
- Filter strip: `STATUS / ARCHETYPE / SEVERITY` mono eyebrow labels +
  chip-style buttons (replaces shadcn Selects).
- Theme breadcrumb: pill format "Filtered by `<signature>` ✕".
- Table rows: bigger severity dot, archetype pill in Stitch tint style,
  confidence rendered as `<Progress>` bar.
- New block UNDER table: "Supplier Impact Analysis" hero card (1 col) + 3
  KPI cards (`Avg Confidence` / `Mean Resolution` / `Active Alerts`).
  Values computed client-side from `incidents` array.

**New testIds:** `supplier-impact-card`, `kpi-avg-confidence`,
`kpi-mean-resolution`, `kpi-active-alerts`.

### Commit 4 — Lessons Page (~1h)

**Files:**
- New: `web/src/components/lessons/lessons-screen.tsx`
- Update: `web/src/app/lessons/page.tsx` (replace `PrototypeLessonsScreen`
  with new `LessonsScreen`).

`PrototypeLessonsScreen` in `prototype/workspace-screens.tsx` stays
untouched (no other page uses it currently, no risk).

**Layout:**
- Hero block: large mono numbers (`324 / 4521× / 3 plants`) — `324`
  hardcoded as catalog total constant; `4521×` derived from
  `PROTOTYPE_DATA.lessons.reduce((s, l) => s + l.applied, 0)`; `3` from
  `PROTOTYPE_DATA.plants.length`.
- Glass quote card right-side: "Wissen wird durch Teilung vermehrt." (DE
  original + EN translation underneath).
- Tag filter row: chip buttons from existing `tagsByLesson` map. "All
  Lessons" + per-tag toggle.
- Card grid: 3-col responsive (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
  Each card:
  - Mono ID pill
  - Status pill: `Resolved` (green) or `Recurring` (red + warning icon)
  - Signature in archetype colour; `border-l-4` archetype border on
    non-resolved cards
  - Fix summary
  - Usage counter + mini sparkline (recurring → red, resolved → green)
  - Hover: View Details / Escalate Analysis affordance

**New testIds:** `lessons-hero`, `lesson-card`, `tag-filter`.

## Risks

- Plus Jakarta Sans body-wide may have subtle metric differences from DM
  Sans → check Canvas dense panels for line-height regressions in dev server.
- Token shift to purple-tinted surfaces: AppShell sidebar uses `bg-card`
  which now resolves to `#fdf7ff` — sidebar will look slightly purple too.
  Acceptable per "color scheme coherent across all pages".
- Existing component tests use `getByTestId` for a fixed set of IDs. Keeping
  them in new components is non-negotiable; CI signal must stay green
  throughout.
- DB integration test (`themes/route.integration.test.ts`) is already
  failing locally (Postgres not seeded). Out of scope, not regressed.

## Out of Scope

- Lessons API + DB schema (Harjot's lane).
- Floor lens visual update (no Stitch design provided).
- Initiative kanban / Canvas redesign (separate Stitch pass would be needed).
- Dark mode token swap (existing `.dark` block stays untouched).
- Accessibility audit beyond keeping focus rings present.
