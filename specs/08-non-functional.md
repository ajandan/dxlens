# 08 — Non-Functional Requirements

## Purpose

Define the cross-cutting quality requirements that apply to every part of DX Lens. These are release gates, not aspirations.

## Performance

| Area | Budget | Measured how |
|---|---|---|
| Pattern-check overhead (non-matched URLs) | <2 ms added per request | Microbenchmark on synthetic fetch load |
| Full capture overhead (matched URLs, ≤100 KB body) | <5 ms added per request | Compared against baseline on representative Constellation app |
| Tree update from event to render | <50 ms for single-case merges | Panel-side timing |
| Search keystroke → highlighted tree | <50 ms on 10,000-node tree | Panel-side timing |
| Panel open → first tree render | <300 ms | From panel registration to first paint |
| Idle memory footprint (per tab) | <50 MB | Chrome Task Manager |
| Memory per 500 events | <20 MB | Worst-case with large payloads |

**Release gate:** all budgets must be hit on the reference Constellation app at M4. Budget violations block the release.

## Compatibility

| Target | v1.0 | v1.x | v2.0 |
|---|---|---|---|
| Chrome | 114+ | 114+ | 114+ |
| Edge (Chromium) | Works unchanged | Works unchanged | Works unchanged |
| Firefox | Not supported | v1.2 adds support via MV3 shim | Supported |
| Safari | Not supported | Not planned | Not planned |
| Pega Infinity 23.x | Yes | Yes | Yes |
| Pega Infinity 24.x | Yes | Yes | Yes |
| Pega Infinity 25.x | Best effort, verified late 2026 | Verified | Verified |
| Constellation UI | Yes (primary target) | Yes | Yes |
| Classic UI-Kit portal | No (out of scope) | No | No |

## Accessibility

- Full keyboard navigation for every interactive element (tree, search, toolbar, snapshots, settings).
- WCAG 2.1 AA color contrast on both themes.
- ARIA roles on tree (`role="tree"` / `role="treeitem"` with `aria-expanded`, `aria-selected`, `aria-level`).
- Focus ring always visible.
- Color is never the sole signal — change markers, staleness, and modes also use text badges and icons.
- Respects `prefers-reduced-motion` (disables change-glow animation, snapshot transitions).
- Screen reader tested with NVDA (Windows) and VoiceOver (macOS) at v1.0 release.

## Internationalization

- v1: English only.
- i18n architecture in place — all user-visible strings in a single `messages.en.json` file loaded via a tiny helper. No hardcoded strings in components.
- Translations welcomed as community contributions from v1.1 onward.

## Distribution

| Channel | v1.0 | v1.x | v2.0 |
|---|---|---|---|
| GitHub repository | Yes | Yes | Yes |
| Chrome Web Store | At v1.0 stable | Yes | Yes |
| Firefox Add-ons (AMO) | No | v1.2 | Yes |
| Edge Add-ons | Works via CWS; listed separately if adoption warrants | Yes | Yes |
| Unpacked / dev install | Yes (primary during beta) | Yes | Yes |

GitHub is the canonical home. Store listings point back to it.

## Licensing

| Artifact | License |
|---|---|
| Code | MIT |
| Documentation (incl. specs) | CC-BY 4.0 |
| Knowledge base content (Day 2, `kb/`) | CC-BY 4.0 |
| Icons and branding | CC-BY 4.0 |

No CLA required. Contributions governed by the Developer Certificate of Origin (DCO) — sign-off on every commit.

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`.
- `MAJOR` bump for: spec-breaking changes, tool-layer contract breaks, Manifest V3 → next manifest.
- `MINOR` for features.
- `PATCH` for fixes.
- Spec changes that break the tool-layer contract require a `MAJOR` bump.

## Observability (for the user, not the maintainer)

- Panel shows capture stats: events/sec, total bytes, tabs currently captured.
- Panel shows the "Trust" section (see spec 07) with outbound-request counter.
- Console warnings for capture failures are muted behind a "Show capture log" toggle so normal users don't see noise.

**No telemetry flows to the maintainer.** This is intentional and permanent (spec 07).

## Build & ship

- Build tool: Vite (or esbuild if Vite feels heavy).
- No runtime framework for the panel in v1 — vanilla TypeScript with a light component helper. Rationale: smaller bundle, faster cold start, easier to audit by readers of the source who want to verify privacy claims.
- React may be reconsidered at v1.x if panel complexity justifies it.
- Bundle size target: <200 KB uncompressed for the panel, <50 KB for the content/injected scripts combined.

## Testing

- Unit tests for pure modules: tree merge, diff algorithm, search index, path generation.
- Integration tests: headless Chrome with a mock Pega app emitting synthetic DX responses.
- Manual smoke test against a real Constellation app (Pega's public demo or a local PRPC instance) before each minor release.

## Related specs

- [01 Capture layer](./01-capture-layer.md) — performance budget source.
- [05 UX surface](./05-ux-surface.md) — accessibility and theming implementation.
- [07 Privacy & security](./07-privacy-security.md) — observability boundaries.
- [09 Milestones](./09-milestones.md) — when gates apply.
