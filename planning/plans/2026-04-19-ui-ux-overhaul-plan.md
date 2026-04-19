# UI/UX Overhaul Plan — Safe Branch Execution (Frontend-Only)

> **Date:** 2026-04-19  
> **Scope lock:** Frontend-only. No backend, no LLM-agent logic changes, no API contract changes required.  
> **Personas:** Floor Worker (Markus) · Quality Engineer (M. Bauer) · Plant Leader (Director)

## 0) Executive Summary

Current state has two realities:
1. `dashboard-prototype/` contains strong interaction ideas but includes dead affordances and non-functional controls.
2. `web/` is production runtime but still closer to MVP and does not yet deliver the full “visualization rethought” flow.

This overhaul aligns both into one trustworthy experience with one critical path:
**Inbox → Canvas → 8D (editable) → Resolve (visible dispatch loop) → Initiatives/Lessons**.

This is a **major UX refactor**, not a full frontend rewrite.

## 0.1) Highest-Value Improvements to Prioritize (P0)

To maximize jury impact and user trust, prioritize these five first:
1. **Decision-flow UX instead of report UX**: explicit 4-stage guidance  
   `Problem exists → Where is it? → What to do? → Did it work?`.
2. **Evidence-first reasoning**: hypothesis nodes show direct child evidence; claims are visually traceable.
3. **Visible resolve loop**: dispatch shows staged per-agent outcomes before navigation.
4. **Cross-linked canvas interactions**: selecting one object (hypothesis/signal/timeline point) highlights related objects everywhere.
5. **Role-native language and density**: worker copy is operationally simple; leadership gets a true dense decision mode.

---

## 1) Safety First — Branch Strategy (Mandatory)

## 1.1 Goal
Keep the current version untouched until team approval. All overhaul work happens in a dedicated branch.

## 1.2 Required Git workflow

Run exactly this before implementation work:

```bash
git fetch origin

# Optional: create explicit backup pointer to current state
git branch backup/ui-before-overhaul-2026-04-19

# Create isolated implementation branch
git switch -c feat/ui-ux-overhaul-v1
```

If you want parallel comparison in VSCode (recommended):

```bash
git worktree add ../De.Constructors-ui-overhaul feat/ui-ux-overhaul-v1
```

Then open the new folder in a second VSCode window and do all edits there.

## 1.3 Merge gate
No merge to `develop` before all of these are true:
1. Demo walkthrough passes (Section 11).
2. Dead controls list is zero (Section 3).
3. Team sign-off by owner(s).

---

## 2) What Is Broken Today (Problem Statement)

## 2.1 Trust-breaking interaction bugs (must-fix)
1. 8D `Override` has no action.
2. Resolve dispatch does not show per-agent outcomes.
3. Landing “Investigate” CTA is dead.
4. Resolve `Flow` variant exists in tabs but not in rendering.
5. Lessons “Search” looks editable but is not an input.
6. Lessons cards hardcode the same incident link.
7. Initiative incident links are styled as links but click-blocked.
8. Dispatch sweep animation loops infinitely.

## 2.2 Strategic UX gaps
1. Reasoning chain is still weakly visualized (hypothesis nodes without direct evidence child nodes).
2. Floor variants are inconsistent (missing issue categories in chat mode, limited non-voice in minimal mode).
3. Leadership `Dense` mode is cosmetic only, not structurally denser.
4. `web/` and prototype are not aligned as one production story yet.

---

## 3) Non-Negotiables for This Overhaul

1. No visibly clickable control without behavior.
2. Every primary action returns visible feedback within 1.5s.
3. Touch-first minimum for critical controls: `44x44px`.
4. Worker language must avoid internal quality-system jargon.
5. Reasoning must be visually auditable: hypothesis → evidence.
6. Keep existing backend/API untouched in this phase.

---

## 4) Target Experience by Persona

## 4.1 Floor Worker (Markus)
- One-thumb reporting with tiles/voice/photo.
- Human language statuses (`Received`, `We're checking`, `Done`).
- Immediate reassurance after submit plus “system is working” progress hints.

## 4.2 Quality Engineer (M. Bauer)
- Strong incident canvas as primary reasoning workspace.
- Editable 8D sections (human override of AI draft).
- Resolve screen shows concrete dispatch outcomes per domain.

## 4.3 Plant Leader (Director)
- Decision-ready density mode (actual layout transformation).
- Clear benchmark context on metrics.
- Fast drilldown continuity (landing in a visibly filtered context).

## 4.4 Stage-Oriented Interaction Model (all personas)
Each persona sees a projection of the same 4 stages:
1. **Problem exists**: pulse/inbox/risk radar.
2. **Where is the problem?**: hotspot/canvas/heatmap drilldown.
3. **How to solve it?**: top actions/hypothesis workbench/scenario cards.
4. **Did it work?**: personal feedback/evidence trail/impact board.

---

## 5) UI/UX Design Instructions (System-Wide)

## 5.1 Interaction rules
1. Link styling only when navigation happens.
2. Disabled state must be explicit (`cursor`, muted, helper text).
3. Variant tabs must map to distinct layouts; otherwise remove variant.

## 5.2 Motion rules
1. No infinite one-off success overlays.
2. Use staged status reveals for system automation moments.
3. Keep transitions short (`120–250ms`) except staged dispatch timeline.

## 5.3 Copy rules
1. Floor lens: no internal terms (`incident`, `triage`, `initiative`, `LLM`).
2. Engineer lens: technical precision allowed (`evidence`, `hypothesis`, `confidence`).
3. Leadership lens: concise business language (`at risk`, `time-to-close`, `impact`).

## 5.4 Visual rules
1. Keep severity semantics stable across screens.
2. Monospace only for IDs/refs; body remains readable sans.
3. Dense mode must reduce cognitive + spatial load, not just padding.

---

## 6) Implementation Plan (Phased, Frontend-Only)

## P0 Track — Highest Impact First (must finish before broader polish)
- [ ] Implement all trust fixes from Phase A.
- [ ] Implement hypothesis evidence-child nodes + cross-highlighting from Phase B.
- [ ] Implement staged resolve result log from Phase A/8.2.
- [ ] Ensure worker-language statuses from Phase C.
- [ ] Implement true leadership dense layout from Phase D.

## Phase A — Trust & Dead-Affordance Cleanup (highest priority)

### A1) Fix dead controls
- [ ] Wire Landing “Investigate →” to route action.
- [ ] Implement 8D `Override` local edit mode per D-section.
- [ ] Add simulated Resolve dispatch result log (staggered).
- [ ] Remove or implement Resolve `Flow` variant.
- [ ] Convert Lessons search shell to real input + local filter.
- [ ] Fix Lessons incident mapping (data-driven).
- [ ] Fix Initiative incident links (real navigation or plain text).
- [ ] Stop sweep animation after finite cycles/unmount.

### A2) Make action outcomes explicit
- [ ] Add toast/inline feedback for `Re-draft` and `Revision history` actions in 8D.
- [ ] Ensure visible feedback after any CTA click in critical workflow.

## Phase B — Engineer Reasoning Surface Upgrade

### B1) Hypothesis evidence chain
- [ ] Add evidence child nodes under active hypothesis (SIG id + snippet + severity dot).
- [ ] Clicking a hypothesis focuses matching evidence in signal rail/timeline.
- [ ] Add evidence trace links in 8D/AI summary cards (`claim -> evidence ids`) with visible highlight in canvas.

### B2) Canvas linkage behavior
- [ ] Ensure graph, signal list, timeline can cross-focus each other.
- [ ] Maintain 3-panel structure and readable hierarchy.
- [ ] Add coordinated brushing behavior:
  - click signal -> highlight linked hypothesis + timeline point
  - click timeline point -> highlight signal + owning hypothesis
  - click contribution -> highlight impacted hypotheses

## Phase C — Floor Worker Usability

### C1) Variant consistency
- [ ] Chat variant exposes all issue categories.
- [ ] Minimal variant gets either category chips or explicit “switch to tiles” helper.

### C2) Feedback language
- [ ] Map worker statuses to human wording:
  - `Triaged` → `Received`
  - `Investigating` → `We're checking`
  - `Resolved` → `Done`
- [ ] Add lightweight “AI is working” progress text under my reports.

## Phase D — Leadership Readability & Control

### D1) Dense mode must be real
- [ ] Implement dedicated dense layout (grid changes, selective sparkline suppression, compressed strips).
- [ ] Add scenario compare card (`without action` vs `with action`) with explicit baseline/target labels.

### D2) Context cues
- [ ] Add benchmark baseline in sparklines.
- [ ] Add explanatory hover details for all key metrics.
- [ ] Replace plain map/browser tooltip patterns with custom hover cards.

### D3) Drilldown continuity
- [ ] If drilldown filter exists, show persistent filter banner/chip on destination view with clear reset.

## Phase E — Porting Alignment to `web/`

- [ ] Port approved prototype behavior into `web/src/app` routes in the same interaction model.
- [ ] Keep `dashboard-prototype/` as reference snapshot; production truth is `web/`.

---

## 7) File-Level Worklist

## 7.1 Primary files (prototype fixes)
- `dashboard-prototype/landing_inbox.jsx`
- `dashboard-prototype/canvas.jsx`
- `dashboard-prototype/resolve_eightd.jsx`
- `dashboard-prototype/other_screens.jsx`
- `dashboard-prototype/data.jsx`
- `dashboard-prototype/styles.css`

## 7.2 Production alignment files (web)
- `web/src/app/(engineer)/...`
- `web/src/app/(operator)/capture/page.tsx`
- `web/src/app/(manager)/dashboard/page.tsx`
- `web/src/app/globals.css`

(Exact route/component split can follow existing app router structure.)

---

## 8) UX Specifics — Required Behaviors

## 8.1 8D Override interaction
1. Click `Override` on section Dn.
2. Section body swaps to `<textarea>` prefilled with current text.
3. Buttons: `Save` (persist local state), `Cancel` (revert local edit).
4. Edited section gets subtle “edited” chip.

## 8.2 Resolve dispatch simulation
After clicking dispatch:
1. Show progress panel with 5 lines.
2. Reveal one success line every ~400ms.
3. Keep visible for ~1.5–2.0s after last line.
4. Then navigate to initiatives screen.

## 8.3 Lessons search behavior
- Real input with immediate client-side filtering over:
  - lesson id
  - symptom
  - fix text
  - tags
  - incident id mapping

## 8.4 Evidence child nodes in graph
- Active hypothesis displays compact list of linked evidence nodes directly under/inside node area.
- Node row contains:
  - severity marker
  - `SIG-xxxx`
  - truncated text snippet

## 8.4b Evidence-first claim tracing
- Every major claim card (8D + AI reasoning summary) shows linked evidence IDs.
- Clicking a linked evidence ID triggers a visible highlight in canvas components.
- If no evidence exists, render explicit `insufficient evidence` state (never silent omission).

## 8.5 Floor status language mapping
- Render worker-friendly labels in UI; keep internal labels only in source data if needed.

## 8.6 Leadership dense layout
- Must alter composition, not only spacing:
  - 2-column compressed upper area
  - reduced ornaments
  - number-first readout
  - persistent scenario compare block (`without action` / `with action`)

## 8.7 Action-vs-Outcome clarity (frontend simulation)
- Show scenario delta in simple, legible terms:
  - risk trend
  - estimated claims avoided
  - cost band
- Values may be mocked/frontend-derived in this phase, but labels must clearly indicate projection.

---

## 9) Acceptance Criteria (Definition of Done)

1. No dead CTA in primary workflow.
2. Engineer can complete full journey in one pass:
   - Inbox → Canvas → 8D edit → Resolve dispatch feedback → Initiatives.
3. Floor can report all issue categories in all offered variants.
4. Selecting hypothesis/signal/timeline point visibly cross-highlights related objects.
5. Leadership dense mode materially increases information per viewport.
6. Action-vs-outcome compare is visible (`without action` vs `with action`).
7. Animations are finite unless explicitly live-state indicators.
8. Old baseline remains intact on original branch until merge decision.

---

## 10) Execution Checklist (Branch-Safe)

- [ ] Create branch `feat/ui-ux-overhaul-v1`.
- [ ] Optional: create backup branch `backup/ui-before-overhaul-2026-04-19`.
- [ ] Implement Phases A–D.
- [ ] Run manual walkthrough (Section 11).
- [ ] Open PR from `feat/ui-ux-overhaul-v1` to integration branch only after team sign-off.
- [ ] Keep old branch untouched until explicit merge approval.

---

## 11) Manual Demo Walkthrough (Must Pass)

1. Open landing, click rising pattern `Investigate →`.
2. Arrive in canvas; select hypotheses; see evidence linkage.
3. Go to 8D, override D4 root-cause text, save.
4. Go to Resolve, dispatch, observe staged per-agent success messages.
5. Land in initiatives with visible continuity.
6. Switch to floor view, submit issue via non-voice path.
7. Switch to leadership, toggle dense mode and verify real layout change.

---

## 12) Risks and Guardrails

1. **Risk:** Prototype and `web/` diverge further.  
   **Guardrail:** Treat `web/` as final runtime target; prototype is reference only.
2. **Risk:** Cosmetic-only work consumes time.  
   **Guardrail:** Prioritize dead controls + journey continuity first.
3. **Risk:** Hard-to-compare iterations.  
   **Guardrail:** Keep separate branch and optional worktree; no direct overwrite of baseline.

---

## 13) Decision Log (Current)

1. Major UX uplift is required for challenge differentiation.
2. Full frontend rewrite is rejected (too risky).
3. Chosen path is targeted major UX refactor on isolated branch.
4. Baseline remains preserved until explicit merge decision.
