# 09 — Milestones

## Purpose

Define the ordered delivery phases for DX Lens. Milestones are **ordered, not dated**. Self-imposed dates kill open-source side projects. Date M1 only when you've done the capture spike and know what M2 really costs.

## Milestone sequence

### M1 — Capture spike

**Exit criteria:**

- MAIN-world fetch and XHR wrappers reliably capture DX traffic on a live Constellation app.
- Events postMessage across to isolated world and reach the service worker.
- Service worker receives events with tab attribution correct.
- **No tree yet.** Console dump only.
- Performance budget for pattern check (<2 ms) verified with a microbenchmark.

**Why this gate matters:** if capture is flaky, everything above is built on sand. M1 proves viability on real traffic volumes before anything else is written.

### M2 — Tree MVP

**Exit criteria:**

- Capture events feed the tree-merge layer.
- Tree renders with four top-level nodes (Cases, Data Pages, Operator, Current View).
- Cases and data pages populate correctly from real DX responses.
- Property mode inference works (SV/P/PL/VL badges).
- Dotted-notation paths correct, including 1-indexed Page List indices.
- DevTools panel registered and selectable.
- **Resolve open decisions:** assignment nesting (under case or top-level sibling), Current View identification from DX responses.

**Release candidate for:** internal dogfooding only. Not shared.

### M3 — Full v1 experience

**Exit criteria:**

- Snapshot and diff working end-to-end (spec 03).
- Search working with all scopes (spec 04).
- Keyboard shortcut opens panel (spec 05).
- Live / Pause / change-glow implemented.
- Settings page implemented.
- Refresh button working for selected case / data page.
- Copy path / copy value keyboard shortcuts and context menus.

**Release candidate for:** private beta with a handful of known Pega developers.

### M4 — v1.0 public release

**Exit criteria:**

- All performance budgets met on the reference Constellation app (spec 08).
- Accessibility audit passed (keyboard nav, ARIA, contrast, reduced motion).
- `SECURITY.md` written.
- `README.md` with demo GIF.
- `CONTRIBUTING.md` with clear contribution model.
- Chrome Web Store listing submitted (review may take up to 2 weeks).
- Repository tagged `v1.0.0`.

**Release:** public. Announce via LinkedIn, Pega community channels.

### M5 — v1.x stabilization

**Exit criteria:**

- Side panel surface (v1.1).
- Firefox port (v1.2).
- Top community-reported bugs resolved.
- Auto-snapshot on user-initiated submit actions (v1.x, see spec 03).
- At least one minor release has shipped through the Chrome Web Store review process successfully.

**Release:** rolling v1.x.

### M6 — Day 2 begins

**Exit criteria:**

- Tool layer contract externalized (spec 21).
- KB seed content written: 15–20 entries across concepts / dx-api / patterns / pitfalls (spec 22).
- KB retrieval (BM25) working.
- LLM integration spike: single round-trip through Ollama, context-stuffing strategy, getting an answer with citations on a toy case.

**Release candidate for:** dogfood only.

### M7 — v2.0 release

**Exit criteria:**

- Chat panel implemented (spec 23).
- Summarize-then-ask context strategy working on 7–8B local models.
- Citations (clipboard paths + KB entries) clickable and deep-linking into the tree.
- All existing v1 tests pass; v1 functionality untouched and uncompromised.
- Release notes emphasize the local-only / privacy-preserving nature of the LLM integration.

**Release:** public v2.0.

## Gate rules

- **Performance budgets** (spec 08) are checked at M4 and every `MINOR` release thereafter. Violations block the release.
- **Security & privacy claims** (spec 07) are verified at every release. The trust counter must continue to show zero outbound requests.
- **Tool-layer contract** (spec 06) is immutable once M4 ships. Changes require MAJOR version bump.

## What M0 was (for the record)

Pre-M1 phase: specification drafting (this document set). No code. Complete.

## Dependencies and risks

See [dependencies.md](./dependencies.md) for spec dependencies aligned to these milestones, and [11-risks.md](./11-risks.md) for risks that could reshape the sequence.

## Related specs

- [dependencies.md](./dependencies.md) — implementation order mapped to milestones.
- [10 Decisions](./10-decisions.md) — open decisions that gate specific milestones.
- [11 Risks](./11-risks.md) — risks that could delay or reshape milestones.
