# Engineer Inbox — Theme Cards (Design Spec)

**Date:** 2026-04-19
**Owner:** Joscha (`feat/joscha`)
**Status:** Design approved, ready for implementation plan
**Targets:** Resolve · Engineer Lens · `/inbox` route

## Problem

Today's `/inbox` view shows 14 incidents in an 8-column dense table with persistent UI chrome (lens toggle, cards/table switch, maximize, filter sidebar, preview sidebar). Engineering users (M. Bauer persona) reported three concrete pain points:

- **A — Column overload.** Eight decision dimensions to scan in parallel for every row (Incident · Product · Sources · Signals · Last Seen · Owner · Status · AI Conf).
- **D — Chrome competing with content.** Multiple control bars and toggles before the data is visible.
- **E — Related incidents not clustered.** Linie-1 issues or PM-00012 issues are scattered across the list rather than bundled.

(Pain point B "no priority" and C "AI-active vs human-pending mixed" and F "AI Conf% has no implied action" were considered and explicitly de-prioritized by user.)

## Goals

1. Reduce scan-units by ≥50% on the demo dataset (14 incidents → ~6 themes).
2. Eliminate columns; render each unit as a self-contained semantic card.
3. Strip persistent UI chrome to two rows max (header + filter strip).
4. Group related incidents under shared theme signatures so the four canonical demo stories surface as the top themes.
5. Preserve existing drilldown behavior — clicking a theme should land the user on the existing incident canvas (or a pre-filtered incidents list).

## Non-goals

- Replacing the existing `/incident/[id]` canvas view.
- Changing the `incident` table schema.
- Adding persistent merge/split storage (deferred to post-hackathon).
- Real-time WebSocket / Supabase channels (polling is sufficient for demo).

## Theme Model

A **Theme** is defined by a **signature** = `(archetype, dominant_entity)`. The `incident` table does not have a dedicated `dominant_entity` column today, so v1 derives it from existing columns:

| Archetype  | dominant_entity source (v1)                              | Example signature        | Example title                  |
|------------|----------------------------------------------------------|--------------------------|--------------------------------|
| `supplier` | `incident.primary_part_number` ?? `primary_product_id`   | `(supplier, PM-00008)`   | "Supplier · PM-00008"          |
| `drift`    | `incident.primary_product_id`                            | `(drift, PM-00003)`      | "Drift · PM-00003"             |
| `design`   | `incident.primary_part_number` ?? `primary_product_id`   | `(design, PM-00012)`     | "Design · PM-00012"            |
| `operator` | `incident.primary_product_id`                            | `(operator, PM-00005)`   | "Operator · PM-00005"          |
| `unknown`  | `null`                                                   | `(unknown, —)`           | "Untriaged" (or LLM-generated) |

**Trade-off:** This coarser signature collapses incidents on the same product into one theme even if they originate at different stations/lines/batches. The four canonical demo stories still surface as distinct top themes (each lives on a different product). Future post-hackathon extension: add `incident.dominant_entity` column (or derive from `hypothesis_tree` JSONB) for finer granularity.

**Title generation:**
- For known archetypes: deterministic template per archetype (`<archetype-noun> · <dominant_entity>`).
- For `unknown` archetype only: optional LLM-generated title from clustered signal text. Cached. Falls back to "Untriaged" on failure or timeout (>2s).

**Ordering:**
1. Severity descending (sum of `incident.severity_score` across cluster members).
2. Recency tiebreaker (`MAX(signal.created_at)` across the cluster).

## Cluster Generation Strategy

**Primary (v1): Deterministic SQL aggregation.**
- `GROUP BY (incident.archetype, incident.dominant_entity)` on the `incident` table.
- No new tables, no migration.
- Window-bounded by `?window=7d` query param.
- Lens-bounded by `?lens=engineer|floor|leadership`.

**Augmentation (v1, optional polish): Embedding similarity hint.**
- For pairs of themes whose `centroid_embedding` (mean of member-incident embeddings) cosine-similarity is ≥0.85, render a "possibly related" badge between them.
- Computed app-side using existing `web/src/lib/cosine.ts` (since pgvector is unavailable on Manex PG — see auto-memory `project_pgvector_unavailable`).
- Does not change cluster membership; purely advisory in the UI.

**Deferred (post-hackathon):** Full embedding-based clustering replacing SQL. Requires algorithm validation; out of scope for 24h sprint.

## API

**New endpoint:** `GET /api/themes`

```ts
// web/src/server/schemas/theme.ts
export const themeSchema = z.object({
  signature: z.string(),                    // "supplier:SB-00007"
  archetype: z.enum(["supplier","drift","design","operator","unknown"]),
  dominant_entity: z.string().nullable(),   // "SB-00007" or null for unknown
  title: z.string(),                        // "Cold solder · SB-00007"
  title_source: z.enum(["template","llm","fallback"]),
  incidents: z.array(incidentSummarySchema), // id, title, severity, last_seen
  stats: z.object({
    n_incidents: z.number().int(),
    n_signals: z.number().int(),
    n_sources: z.number().int(),
    products: z.array(z.string()),
    lines: z.array(z.string()),
  }),
  confidence_avg: z.number().min(0).max(1), // weighted by incident severity
  severity_max: z.enum(["low","medium","high"]),
  last_seen: z.string().datetime(),
  related_signatures: z.array(z.string()),  // from embedding hint
  signal_buckets_7d: z.array(z.number().int()), // for sparkline (7 buckets)
});

export const themesResponseSchema = z.object({
  themes: z.array(themeSchema),
  generated_at: z.string().datetime(),
  window_days: z.number().int(),
  lens: z.enum(["engineer","floor","leadership"]),
});
```

**Query params:**
- `lens` (required): `engineer | floor | leadership`. Filters which archetypes are surfaced (Floor: `process | operator`; Leadership: aggregated further).
- `window` (default `7d`): `1d | 7d | 30d`.
- `archetype` (optional, repeatable): filter to subset.
- `product` (optional): filter by product ID.
- `severity` (optional): `low | medium | high`.

**Caching / freshness:**
- Server route uses `revalidate: 30` (Next.js ISR-style polling; 30s freshness window is acceptable for a triage view).

**Implementation pattern:** Mirror existing `web/src/app/api/incidents/route.ts` for Zod validation, error shape, and Supabase server-client usage. Reuse `web/src/lib/supabase-server.ts`.

## Frontend

### Components

**`<ThemeCard>`** — single semantic unit, default compact (~64px tall):
- Archetype pill (color-coded by archetype family)
- Title (signature-derived)
- Sub-meta line: `<product> · N incidents · N signals · N sources · <lines>`
- Confidence bar (0–100%) with archetype-tinted fill
- Right arrow (drilldown affordance)
- Optional: `<RelatedBadge>` if `related_signatures` is non-empty

**`<ThemeCard expanded>`** — hover/click expanded variant (~140px tall):
- Everything from compact, plus
- Incident chips (clickable, deep-link to `/incident/[id]`)
- Sparkline of `signal_buckets_7d` (Recharts area chart, 7 points)
- Top hypothesis snippet (if available from incident summary)

**`<FilterStrip>`** — pill-row replacing collapsible sidebar:
- `[All archetypes ▾]` `[Last 7d ▾]` `[All products ▾]` `[All severities ▾]`
- Active filter highlighted; selecting opens a popover with options.

**`<ThemeMergeBar>`** — appears when ≥2 cards are selected (existing "Select 2+ to merge" hint, but ephemeral):
- Client-side React state holds the merged-view; server is not informed.
- For the demo, this is enough to show the interaction story without persisting overrides.

### Page

**`web/src/app/(engineer)/inbox/page.tsx`** becomes a Server Component:
1. Reads search params (lens, window, filters).
2. Calls `/api/themes` with appropriate query string.
3. Renders header (title + meta line + ⌘K search input + lens toggle), `<FilterStrip>`, then a vertical list of `<ThemeCard compact>` items.
4. No persistent right-side preview, no cards/table toggle, no maximize button.

### Chrome reduction (before → after)

- 3 toolbar rows → **2** (header + filter strip)
- Removed: Cards/Table toggle, Maximize, "Click row · Select 2+ to merge" hint, persistent left filter sidebar, persistent right preview sidebar.
- Kept: Lens toggle (Engineer / Floor / Leadership), search (now ⌘K-centric), "Show notes" link.

### Drilldown

Click on a `<ThemeCard>` navigates to `/incidents?theme=<signature>` — pre-applies the theme as a filter on the existing incidents list view. From there, click an incident → existing `/incident/[id]` canvas (no change).

Decision: do **not** introduce a new `/themes/[signature]` route. Reusing the incidents list with a filter is one less surface to maintain.

### Lens awareness

| Lens         | Theme filtering                                                         |
|--------------|-------------------------------------------------------------------------|
| `engineer`   | All archetypes; default sort by severity-then-recency.                  |
| `floor`      | Only `process`, `operator`, `drift`; severity floor `medium`+.          |
| `leadership` | Aggregated to product-level themes (drops `dominant_entity`).           |

The confidence bar visual is identical across lenses in v1; lens-specific styling deferred.

## Demo Story Mapping (sanity check)

The four canonical demo stories map directly to top themes:

| # | Story                          | Resulting theme signature              |
|---|--------------------------------|----------------------------------------|
| 1 | Supplier batch SB-00007        | `(supplier, PM-00008)`                 |
| 2 | Calibration drift VIB_TEST L1  | `(drift, PM-00003)`                    |
| 3 | Thermal R33 PM-00012           | `(design, PM-00012)`                   |
| 4 | Operator user_042              | `(operator, PM-00005)`                 |

All four stories surface as top themes by severity. Lead recommendation (Story 1 + Story 3) becomes self-evident from the inbox header.

## Effort Estimate

| Item                                           | Estimate |
|------------------------------------------------|----------|
| `/api/themes` endpoint + Zod schema + tests    | 2h       |
| `<ThemeCard>` (compact + expanded variants)    | 2h       |
| `inbox/page.tsx` Server Component refactor     | 1.5h     |
| `<FilterStrip>` with popovers                  | 1h       |
| Chrome cleanup (⌘K, removals)                  | 1h       |
| Sparkline buckets (Recharts)                   | 1h       |
| Drilldown wiring (`/incidents?theme=`)         | 1h       |
| Embedding-similarity hint augmentation         | 1h       |
| LLM-titles for `unknown` archetype + cache     | 0.5h     |
| Ephemeral merge interaction (client state)     | 0.5h     |
| Polling (`revalidate: 30`)                     | 0.25h    |
| **Total v1**                                   | **~12h** |

Parallelizable across two devs. Fits inside the 24h hackathon window with margin.

## Risks & Mitigations

| Risk                                                                | Mitigation                                                                                  |
|---------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `incident.dominant_entity` column doesn't exist yet                 | Fallback: derive from `incident.metadata->>'dominant_entity'` JSONB; add migration if absent. Verify against current schema before implementation. |
| Cluster aggregation slow on large datasets                          | Demo is bounded (~14 incidents). Add SQL index on `(archetype, dominant_entity)` if needed. |
| Embedding-similarity centroid is noisy with few member incidents    | Skip the hint when cluster has <2 members.                                                  |
| LLM title call exceeds 2s for "unknown" theme                       | Hard timeout, fallback to "Untriaged". Cache by signature.                                  |
| Floor/Leadership lens variations under-specified                    | v1 ships engineer lens fully; floor/leadership use same data, lighter filter only.          |

## Testing

- **Snapshot:** Given the seeded 14-incident dataset, `/api/themes?lens=engineer&window=7d` returns exactly 6 themes including the four story signatures above.
- **Edge:** Single-incident theme renders correctly (no incident-chip overflow).
- **Edge:** All-incidents-same-archetype produces correct grouping (no duplicate themes).
- **Edge:** Empty result set renders an empty state (call-to-action: "All clear — no open themes in the last 7 days").
- **Component:** `<ThemeCard compact>` renders within 64px height for typical content.
- **Determinism:** Two consecutive requests with identical params return identical `themes[].signature` arrays.

Per CLAUDE.md non-negotiables: integration tests must hit a real seeded Postgres, never mock the database for semantic-layer tests.

## Open Questions

1. ~~Does `incident.dominant_entity` exist?~~ **Resolved:** It does not. v1 derives signature from `(archetype, primary_product_id)` (with `primary_part_number` preferred for `supplier` / `design`). Documented in Theme Model section.
2. Lens-specific archetype filtering for Floor and Leadership — confirm the mapping above with Lila/Harjot before shipping cross-lens.
3. ⌘K search scope — should it search themes specifically, or fall through to global incidents/lessons/signals? (v1 default: global; theme matches highlighted at top.)

## Out of Scope (Explicit, post-hackathon)

- Persistent merge/split with `theme_override` table + migration.
- Real-time SSE / Supabase channels for inbox updates.
- Full embedding-based cluster replacement of SQL aggregation.
- Multi-tenant theme labeling / per-user theme preferences.
