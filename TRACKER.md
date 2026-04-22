# DX Lens — Progress Tracker

> Living document. Kept in sync with the source tree and test suites by
> `tests/tracker.test.js` — a scan of `src/state/` and `tests/*.test.js` must
> match the tables below or the suite fails.

Last updated: reflects current working tree. Version **1.0.0**.

## Milestones (from `specs/09-milestones.md`)

| M# | Name                         | Status       | Notes |
|----|------------------------------|--------------|-------|
| M0 | Spec drafting                | ✅ complete  | Pre-M1 spec set. |
| M1 | Capture spike                | ✅ complete  | MAIN-world fetch/XHR hook, content relay, SW buffer, panel live list, pattern-check microbench. |
| M2 | Tree MVP                     | ✅ complete  | O-001 applied (nested). O-002 resolved via heuristic in `current-view.js`. |
| M3 | Full v1 experience           | ✅ complete  | Snapshot/diff, search (+ scope), live/pause, change-glow, refresh, copy path/value, settings + options page. |
| M4 | v1.0 public release          | ✅ complete (pending CWS) | Performance gates green; accessibility polish (ARIA tree + activedescendant + aria-live); `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE` shipped; manifest + package bumped to **1.0.0**. Chrome Web Store submission is an external step. |
| M5 | v1.x stabilization           | ✅ built (pending adoption) | Side panel surface (v1.1), Firefox `browser_specific_settings` (v1.2 port), auto-snapshot around submit-like actions (O-005), options toggle. Rolling v1.x continues through bug fixes. |
| M6 | Day 2 begins                 | ⏳ open       | Tool layer externalization, KB seed, LLM spike. |
| M7 | v2.0 release                 | ⏳ open       | Chat panel, summarize-then-ask, citations. |

## Open decisions (from `specs/10-decisions.md`)

| ID     | Status  | Blocks | Applied so far |
|--------|---------|--------|----------------|
| O-001  | settled | —      | Assignments nested under `Cases.<id>.assignments` (current-lean applied). |
| O-002  | settled | —      | Heuristic picker resolves view from URL / `uiResources.root.config` / resources fallback / query param. |
| O-003  | settled | —      | Side panel shipped as v1.1 surface (`src/sidepanel/`). |
| O-005  | settled | —      | Auto-snapshot on submit-like actions in `auto-snapshot.js`, gated by `settings.autoSnapshot`. |
| O-006  | lean detect+fallback | v2.0 UX | Not applicable until M6. |

## Release gates (enforced at test time)

| Gate                                         | Suite                       | Source spec |
|----------------------------------------------|-----------------------------|-------------|
| Zero outbound requests from extension code   | `no-egress`                 | spec/07 D-003 |
| WCAG 2.1 AA contrast on panel / options / sidepanel | `color-contrast`     | spec/08 §Accessibility |
| Search latency <50 ms on 10k-node tree       | `search` (perf test)        | spec/08 §Performance |
| Single-case merge latency gate               | `perf-merge`                | spec/08 §Performance |
| 1-indexed dotted path grammar round-trip     | `path`                      | spec/02 / D-009 |
| Pattern list drift across inlined copies     | `patterns` (drift detector) | spec/01 §URL pattern matching |
| i18n catalog sync across `.json` and `.js`   | `i18n` (sync assertion)     | spec/08 §Internationalization |
| Tracker ↔ source/test tree consistency       | `tracker`                   | this file |
| Security regressions (proto-pollution, depth/width, URL scheme, same-origin refresh, frozen defaults, malformed percent) | `security` | spec/07 |

## Extension files (non-pure glue)

| Path                               | Role                                  | Tests covering behavior |
|------------------------------------|---------------------------------------|-------------------------|
| `manifest.json`                    | MV3 manifest, CSP, permissions, hooks, Firefox `browser_specific_settings` | manual (browser) |
| `src/injected.js`                  | MAIN-world fetch/XHR wrapper          | `no-egress` (exclusion), `patterns` (drift) |
| `src/content.js`                   | Isolated-world relay                  | manual (browser) |
| `src/background.js`                | Service worker orchestration + auto-snapshot + sidePanel behavior | `pipeline` (mirrors ingestion path), `no-egress` |
| `src/devtools/devtools.html/.js`   | Panel registration                    | manual (browser) |
| `src/devtools/panel.html/.css/.js` | DevTools panel UI                     | `color-contrast` (CSS gate); logic → via state modules |
| `src/sidepanel/sidepanel.html/.css/.js` | Side-panel surface (v1.1)         | `color-contrast` (CSS gate) |
| `src/options/options.html/.css/.js`| Options page                          | `color-contrast`, `settings` |
| `src/bench/pattern-bench.html/.js` | Pattern-match microbenchmark          | `patterns` (drift) |
| `src/i18n/messages.en.json`        | Canonical catalog                     | `i18n` |
| `src/i18n/messages.en.js`          | Bundled catalog for runtime import    | `i18n` (sync) |

## Pure state modules (`src/state/*`)

Every module is pure (no DOM, no `chrome.*`) and import-safe in Node.

| Module                | Purpose                                          | Spec                                     | Test suite        | Count |
|-----------------------|--------------------------------------------------|------------------------------------------|-------------------|-------|
| `auto-snapshot.js`    | Submit-like event classifier                     | spec/03 §Auto-snapshot, O-005             | `auto-snapshot`   |  7    |
| `binding.js`          | `get_field_binding` — find field by name in case | spec/06 §Tool layer                       | `binding`         |  7    |
| `breadcrumb.js`       | Resolve crumb labels for a node path             | spec/05 §Breadcrumb                       | `breadcrumb`      |  4    |
| `capture-log.js`      | Bounded level-tagged ring buffer                 | spec/06 §Error handling                   | `capture-log`     |  9    |
| `classify.js`         | URL/body → event kind, ids, paramHash            | spec/02 §Merge rules                      | `classify`        |  9    |
| `clipboard.js`        | Tree shape, mode inference, paths, merge rules   | spec/02                                   | `clipboard`       | 18    |
| `color-contrast.js`   | WCAG luminance / contrast + AA check             | spec/08 §Accessibility                    | `color-contrast`  |  9    |
| `copy.js`             | copyPath / copyValue / copyValueJson             | spec/02 §Operations                       | `copy`            |  7    |
| `current-view.js`     | Current-view picker + CurrentView subtree merge  | spec/02 §Merge rules, O-002               | `current-view`    | 10    |
| `footprint.js`        | `measureTree` — bytes/nodes per top-level zone   | spec/07 §Footprint                        | `footprint`       |  5    |
| `format.js`           | formatSvValue, nodeToPlain/Json, fmtBytes/Time   | spec/02 / spec/05                         | `format`          |  9    |
| `highlight.js`        | Search hit → `{text,hit}[]` ranges               | spec/04 §Result presentation              | `highlight`       |  9    |
| `history.js`          | Per-path timeline across snapshots               | spec/02 §Operations                       | `history`         |  5    |
| `i18n.js`             | `createT` / `plural` / `verifyCatalog`           | spec/08 §Internationalization             | `i18n`            | 11    |
| `keynav.js`           | Arrow/Home/End tree reducer + flattenVisible     | spec/05 §Operations, spec/08 §A11y        | `keynav`          | 10    |
| `live-state.js`       | Pause queue (FIFO, cap, drop counter)            | spec/05 §Live/Pause                       | `live-state`      |  5    |
| `path.js`             | Dotted 1-indexed Pega path parser / joiner       | spec/02 / D-009                           | `path`            | 15    |
| `patterns.js`         | Shared URL pattern matcher + defaults            | spec/01 §URL pattern matching             | `patterns`        |  8    |
| `pipeline.js`         | End-to-end ingestion harness + footprint helper  | spec/08 §Testing                          | `pipeline`        |  8    |
| `refresh.js`          | Plan GET URL for selected case / data page       | spec/05 §Refresh, spec/07 §Read-only      | `refresh`         |  5    |
| `safe-keys.js`        | Prototype-pollution guard (`__proto__`, etc.)    | spec/07 §Threat model                     | `security` (shared) |  —    |
| `search.js`           | Index + runSearch + scope + ancestorsToExpand    | spec/04                                   | `search`          | 10    |
| `settings.js`         | Defaults, mergeSettings, validateSettings        | spec/05 §Settings, spec/07 §Minimization  | `settings`        | 12    |
| `snapshot.js`         | Snapshot store + diffTrees + formatChange        | spec/03                                   | `snapshot`        | 10    |
| `stale.js`            | markStale + sweepStale generations               | spec/02 §Staleness                        | `stale`           |  4    |
| `stats.js`            | Per-tab stats with rolling window                | spec/08 §Observability                    | `stats`           |  6    |
| `timing.js`           | `debounce` / `throttle` with injectable clock    | spec/04 §Performance, spec/05             | `timing`          |  8    |
| `tools.js`            | Pure `dispatchTool` over the clipboard contract  | spec/06 §Tool layer contract              | `tools`           | 11    |

## Test suites

| Suite              | Covers                                 | Count |
|--------------------|----------------------------------------|-------|
| `auto-snapshot`    | Submit-like classifier                 |  7    |
| `binding`          | Field-binding lookup                   |  7    |
| `breadcrumb`       | Breadcrumb builder                     |  4    |
| `capture-log`      | Bounded level log                      |  9    |
| `classify`         | URL/body classifier                    |  9    |
| `clipboard`        | Tree merge + path grammar              | 18    |
| `color-contrast`   | WCAG utilities + CSS token gate        |  9    |
| `copy`             | Copy path/value/json                   |  7    |
| `current-view`     | View identification heuristic          | 10    |
| `footprint`        | Tree measurement                       |  5    |
| `format`           | Display formatters                     |  9    |
| `highlight`        | Search highlight ranges                |  9    |
| `history`          | Snapshot-timeline projection           |  5    |
| `i18n`             | Translator + catalog sync              | 11    |
| `keynav`           | Keyboard-nav reducer                   | 10    |
| `live-state`       | Pause queue                            |  5    |
| `no-egress`        | spec/07 D-003 source scan              |  3    |
| `path`             | Dotted 1-indexed grammar               | 15    |
| `patterns`         | URL matcher + drift detector           |  8    |
| `perf-merge`       | Single-case merge latency              |  3    |
| `pipeline`         | End-to-end ingestion + stale/footprint |  8    |
| `refresh`          | Refresh URL planner                    |  5    |
| `search`           | Index + scoped queries + perf          | 10    |
| `security`         | Proto-pollution / depth / scheme gate  | 14    |
| `settings`         | Defaults/merge/validate + autoSnapshot | 12    |
| `snapshot`         | Store + diff                           | 10    |
| `stale`            | Stale marker + sweep                   |  4    |
| `stats`            | Rolling window                         |  6    |
| `timing`           | Debounce / throttle                    |  8    |
| `tools`            | Tool dispatch contract                 | 11    |
| `tracker`          | This file ↔ source/test consistency    |  5    |
| **Total**          |                                        | **256** |

## How to keep this doc honest

- `tests/tracker.test.js` scans `src/state/*.js` and every `tests/*.test.js` and
  asserts each appears in the Modules / Test-suites tables above. Adding a new
  module without updating this file → red CI.
- Pass counts are maintained by hand; update when you add / change assertions.
  They are advisory; the authoritative source is running the suites.
- Open decisions mirror `specs/10-decisions.md`; update both in the same change
  when a decision flips.
