# DX Lens v1.0.0

*First public release. Experimental — feedback welcome.*

---

## What this is

The classic Pega Clipboard developer tool, rebuilt for Constellation applications as a Chrome / Firefox extension. Runs **100% locally**. Observes the DX API traffic the browser is already making, assembles it into a unified clipboard tree, and renders it in the browser's side panel.

Nothing the extension sees ever leaves the browser.

---

## What's included

### Unified clipboard tree
- **Cases, Assignments, Data Pages, Operator, Current View** in one tree.
- Property-mode badges (**SV / P / PL / VL**) matching the classic portal, with tentative-mode marker for empty arrays.
- **1-indexed dotted paths** (`Customer.Address(1).City`) — classic Clipboard muscle memory works.

### Capture & lifecycle
- **MAIN-world `fetch` + `XHR` interception** at `document_start` — zero page-code changes required.
- Per-tab in-memory state, cleared on tab close.
- **Live / Pause** toggle with queued-count badge. Pause the tree while you inspect; resume to replay buffered events.
- **Re-read** to rebind to the active tab. **Clear** to reset capture.

### Search
- Over node names, values, and paths.
- Scopes: all / current case / current view / data pages / operator.
- <50 ms on a 10k-node tree (enforced by the `search` test suite).
- 80 ms input debounce; hit count live.

### Snapshots & diff
- Manual snapshot via **Take snapshot** (Ctrl/Cmd+S).
- **Auto-snapshot on submit** — POST `/cases`, PATCH `/cases/<id>`, POST `/assignments/<id>/actions/<name>` bracket the tree with "before" and "after" snapshots.
- **Auto-snapshot on screen change** — navigating to a new view preserves the previous screen's tree labelled `screen: <viewId>`.
- **Compare A vs B** produces a tree diff with added / removed / value-changed markers; PL items correlate by `pzInsKey` when present.

### Events log
- Every DX request / response with time, method, status, duration, URL, body preview.
- Body captured up to a configurable size limit (default 2 MiB).

### Options
- URL match patterns (defaults cover `/prweb/api/` and `/prweb/PRRestService/`).
- Snapshot retention cap.
- Body-size limit.
- Theme (DevTools / dark / light) and reduced-motion preference.
- Auto-snapshot toggle (default **on** so screen history accumulates).

---

## Privacy commitments (non-negotiable)

1. **Zero outbound network requests** from the extension itself. No telemetry, analytics, update pings, or crash reports. Enforced at test time by [`tests/no-egress.test.js`](./tests/no-egress.test.js).
2. **Zero persistent storage of captured data.** Only user preferences persist (via `chrome.storage.local`).
3. **Strictly read-only.** DX Lens never writes back to the Pega app and never modifies requests or responses. The Refresh button re-issues a GET the app would itself issue — nothing more.

Full threat model: [`specs/07-privacy-security.md`](./specs/07-privacy-security.md).
Full privacy policy: [`PRIVACY.md`](./PRIVACY.md).

---

## Technical highlights

- **Manifest V3.** Chrome 116+ / Firefox 128+.
- **Side-panel UI** (not a DevTools panel) — visible alongside the Pega app, not hidden behind F12.
- **Zero-dependency** extension code. No build step, no bundler.
- **95 unit tests** with Node's built-in test runner; release gates cover no-egress, WCAG AA contrast, search latency, merge latency, path grammar, and i18n catalog sync.
- **Tool-layer contract** — every read primitive (`get_tree`, `list_cases`, `get_node`, `search_clipboard`, `diff_snapshots`, …) has a stable signature. Same layer will drive the v2 local-LLM copilot.

---

## What's intentionally out

Decisions we're happy about, that someone may ask about:

- **No hosted-LLM integration, ever.** v2 is local-LLM only. If you need cloud inference, fork.
- **No write tools.** DX Lens observes; it does not act. This is load-bearing for the threat model.
- **No persistent history.** Tab close discards everything — by design.
- **No `chrome.webRequest` capture.** Can't read response bodies on MV3. We use MAIN-world `fetch`/`XHR` wrappers instead.
- **No `chrome.debugger` capture.** Too intrusive; attaching the debugger is a UX / security cost we don't accept.
- **No headers beyond `content-type`.** No `authorization`, no `cookie`, no session tokens ever enter the tree or buffer.
- **No diff of scalar streams / binary bodies.** Diff operates on the assembled clipboard tree only.

---

## Known limitations

- **Broad host permissions** (`<all_urls>`): needed because Pega Constellation tenants can be hosted on any domain. The v1 Chrome Web Store listing will therefore go through in-depth review. v1.1 will offer a per-site opt-in flow to narrow this.
- **Constellation identification of "Current View"** is heuristic (spec/10 O-002); rare payload shapes may miss the view id.
- **Firefox port** is included in the manifest but not yet submitted to AMO.
- **Internationalisation** ships with English only; the catalog structure is ready for more locales.

---

## Install

### Unpacked (recommended for v1.0)
```
git clone https://github.com/ajandan/dxlens
cd dxlens
# chrome://extensions → Developer mode → Load unpacked → select this folder
```

### Chrome Web Store
Pending review. A listing link will be added to the repo once approved.

---

## Upgrade path to v2.x

v2 is a **local-LLM debugging copilot** layered on the same read-only tool primitives. No migration needed — v1 tool-layer signatures are stable. v2 will:

- Add a chat surface alongside the tree, driven by a user-configured local LLM endpoint (Ollama, LM Studio, llama.cpp server).
- Ship a knowledge-base corpus (CC-BY 4.0) the model can cite.
- Enforce explain-only, read-only, citations-mandatory behaviour.
- Never integrate with hosted providers. No OpenAI / Anthropic / Google LLM support. Fork if you need it.

See [`specs/day2/`](./specs/day2/) for the v2 specification set.

---

## Credits & licensing

- Created by **Ajanthan Arul**.
- "Pega" is used descriptively — no affiliation with Pegasystems Inc.
- Code: MIT. Specs & knowledge base: CC-BY 4.0.

## Feedback

File issues at https://github.com/ajandan/dxlens/issues. Security reports via the channel in [`SECURITY.md`](./SECURITY.md) — private, not public issues.
