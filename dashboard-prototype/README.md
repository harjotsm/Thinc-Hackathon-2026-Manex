# Dashboard Prototype (reference)

> Raw React prototype imported from design handoff — **not wired to the backend yet**.

**Source:** Imported 2026-04-18 from `~/Downloads/Dashboard`.
**Owner:** Lila (`feat/lila` branch).
**Purpose:** Visual + interaction reference for the final Next.js app at [web/](../web/). Engineers adapting the live app should treat this as the target design.

## Contents

- `Resolve Wireframe.html` — opening wireframe / landing
- `app.jsx` — root app shell
- `canvas.jsx` — Incident Canvas (§3.1 of architecture)
- `data.jsx` — mock dataset / fixtures
- `icons.jsx` — icon library
- `landing_inbox.jsx` — engineer inbox view
- `other_screens.jsx` — misc screens (leadership, operator, etc.)
- `resolve_eightd.jsx` — 8D report projection
- `styles.css` — design tokens
- `assets/` — images
- `uploads/` — example defect images / screenshots
- `_floor_preserve.txt` — design notes (preserve as-is)

## Integration path

1. **Don't edit this folder directly during integration** — it's a reference snapshot. Edits happen in [web/src/app/](../web/src/app/).
2. Translate each `.jsx` into Next.js App-Router `.tsx` pages/components under `web/src/app/(lens)/*`.
3. Port `styles.css` design tokens into `web/src/app/globals.css` + shadcn/ui theme config.
4. Replace `data.jsx` mocks with real API calls to the routes defined in [planning/specs/2026-04-18-llm-data-pipeline-design.md §14](../planning/specs/2026-04-18-llm-data-pipeline-design.md).
5. Once a screen is fully ported + wired, delete the corresponding `.jsx` here to mark progress.
