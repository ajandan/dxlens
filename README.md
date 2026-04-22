# DX Lens

DX Lens is a Chrome extension that recreates the classic Pega Clipboard
developer tool for Constellation applications. It intercepts DX API traffic,
assembles it into a unified clipboard tree, and lets Pega developers inspect
runtime state the way they did in the classic portal — **without sending any
data to a server**.

## Privacy guarantees

These are product features, not aspirations.

1. **Zero outbound network requests from the extension itself.** No telemetry,
   no update checks, no analytics. Enforced at test time by
   [`tests/no-egress.test.js`](./tests/no-egress.test.js).
2. **Zero persistent storage of captured data.** Clipboard state, snapshots,
   and events live in memory, scoped to the tab. Tab close discards them.
   Only user preferences are persisted (via `chrome.storage.local`).
3. **Read-only interaction with the Pega app.** DX Lens observes; it does not
   modify requests or responses. The toolbar Refresh button re-issues a GET
   the app would itself issue — nothing more.

Full threat model in [`specs/07-privacy-security.md`](./specs/07-privacy-security.md).

## What you get

- A DevTools panel titled **DX Lens** alongside Elements / Network / Sources.
- A unified tree: **Cases**, **Data Pages**, **Operator**, **Current View**.
- Property-mode badges (SV / P / PL / VL) with the tentative-mode marker for
  empty arrays.
- Snapshot + diff — take a snapshot before an action, take another after, see
  exactly what changed. PL items correlate by `pzInsKey` when present.
- Search over node names, values, and paths, with scope (all / current case /
  data pages / operator / current view) and 80 ms debounce.
- Live / Pause toggle with a queued-count badge.
- 1-indexed dotted-notation paths matching classic clipboard muscle memory.
- Options page for URL patterns, snapshot cap, body-size limit, theme, and
  reduced motion.
- Side panel surface (v1.1) and Firefox support (v1.2) — see
  [`specs/09-milestones.md`](./specs/09-milestones.md).

## Install

### From source (unpacked)

1. Clone this repository.
2. `chrome://extensions` → toggle **Developer mode**.
3. **Load unpacked** → select the repository root.
4. Open DevTools on a Pega Constellation app → **DX Lens** panel.

### Chrome Web Store

The store listing ships with v1.0. See GitHub releases for the download link
once published.

## How it works

```
Pega Constellation tab (page MAIN world)
  └── injected.js  ── wraps window.fetch + XMLHttpRequest at document_start
      └── postMessage { __dxlens__, event }
          └── content.js  (page isolated world)
              └── chrome.runtime.sendMessage
                  └── background.js  (service worker)
                      ├── per-tab event buffer (cap 500, FIFO)
                      ├── classify + merge into a clipboard tree
                      ├── snapshot store (cap configurable)
                      └── port to the panel
```

Architecture details in [`specs/06-architecture.md`](./specs/06-architecture.md).

## Running tests

Node 18+ required.

```bash
for f in tests/*.test.js; do node "$f" || exit 1; done
```

Or run a single suite:

```bash
node tests/clipboard.test.js
```

Release gates enforced by tests:

- **No outbound network calls** from extension code (`no-egress`)
- **WCAG AA contrast** on both themes (`color-contrast`)
- **Search latency** <50 ms on a 10k-node tree (`search`)
- **Single-case merge latency** gate (`perf-merge`)
- **1-indexed dotted-path grammar** round-trip (`path`)
- **Pattern list** drift between `injected.js` / `bench` / the shared module
  (`patterns`)
- **i18n catalog sync** between `.json` and `.js` (`i18n`)
- **Tracker consistency** vs. source tree and test set (`tracker`)

## Roadmap

- **Day 1 (v1.x)** — clipboard tree, snapshot/diff, search, DevTools panel.
  No AI. Side panel (v1.1), Firefox port (v1.2), auto-snapshot (v1.x).
- **Day 2 (v2.x)** — local-LLM debugging copilot. Explain-only, read-only,
  citations mandatory. No hosted LLM support.

Progress and per-module status live in [`TRACKER.md`](./TRACKER.md).

## Licensing

- Code: MIT (see [`LICENSE`](./LICENSE)).
- Specs, knowledge base, tracker: CC-BY 4.0.

No CLA. Contributions governed by the Developer Certificate of Origin (DCO) —
see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Security

Please report vulnerabilities privately. See [`SECURITY.md`](./SECURITY.md).

## Project status

Pre-Chrome-Web-Store. All Day 1 spec work is implemented; all 29 test suites
pass; release gates are green. See [`TRACKER.md`](./TRACKER.md) for the
up-to-the-commit state.

## Credits

Created by Ajanthan Jeyakumar. "Pega" is used descriptively; no affiliation
with Pegasystems Inc.
