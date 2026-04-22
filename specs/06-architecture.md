# 06 — Architecture

## Purpose

Define the extension's components, how they communicate, and the tool-layer contract that serves both v1's internal rendering and v2's LLM — so Day 2 is additive, not a refactor.

## Manifest V3

Manifest V3 is required (Chrome deprecates V2). Implications:

- Background is a **service worker**, not a persistent page. State in the service worker must assume termination.
- `chrome.webRequest` cannot read response bodies → MAIN-world fetch/XHR wrapping is the only viable path (see spec 01).
- No remote code. All scripts ship with the extension.
- Content Security Policy is strict. Inline scripts are not allowed in extension pages.

## Components

```
┌───────────────────────────────────────────────────────────────┐
│ Chrome browser                                                │
│  ┌─────────────────────────┐    ┌──────────────────────────┐  │
│  │ Pega Constellation tab  │    │ DevTools (attached)      │  │
│  │                         │    │                          │  │
│  │  MAIN world             │    │  ┌────────────────────┐  │  │
│  │   ┌─────────────────┐   │    │  │ DX Lens panel      │  │  │
│  │   │ injected.js     │   │    │  │  panel.html/js/css │  │  │
│  │   │ (fetch+XHR hook)│   │    │  └──────────┬─────────┘  │  │
│  │   └────────┬────────┘   │    │             │            │  │
│  │            │ postMessage │    │             │ port       │  │
│  │  Isolated world          │    │             │            │  │
│  │   ┌────────▼────────┐   │    │  ┌──────────▼──────────┐ │  │
│  │   │ content.js      │◄──┼────┼──┤ devtools.js (reg.)  │ │  │
│  │   └────────┬────────┘   │    │  └─────────────────────┘ │  │
│  └────────────┼────────────┘    └──────────────────────────┘  │
│               │ chrome.runtime.sendMessage                    │
│  ┌────────────▼────────────────────────────────────────────┐  │
│  │ Service worker (background.js)                          │  │
│  │  - Per-tab event buffer                                 │  │
│  │  - Port management (DevTools panel <-> tab)             │  │
│  │  - Tree-merge layer (state/clipboard.js)                │  │
│  │  - Tool layer (tools/*.js)                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

| Component | World | Responsibility |
|---|---|---|
| `injected.js` | Page MAIN | Wraps fetch/XHR. Emits events via `window.postMessage`. No extension API access. |
| `content.js` | Page isolated | Injects `injected.js`. Relays `postMessage` events to service worker via `chrome.runtime.sendMessage`. |
| `background.js` (service worker) | Extension | Buffers events per tab. Merges into tree model. Exposes tool API to panel via `chrome.runtime.connect` port. |
| `devtools.js` | DevTools | Registers the panel. Trivial. |
| `panel.html/js/css` | DevTools panel | Renders tree, search, snapshot, diff. Consumes tool API. |
| `options.html/js` | Extension options page | Settings UI. |
| `state/clipboard.js` | Extension | Pure functions: event → tree updates. Testable without DOM. |
| `tools/*.js` | Extension | Read primitives exposed to panel (and, in Day 2, to LLM). |

## Inter-component communication

| From | To | Channel | Message shape |
|---|---|---|---|
| `injected.js` | `content.js` | `window.postMessage` | `{ __dxlens__: true, event: CaptureEvent }` |
| `content.js` | service worker | `chrome.runtime.sendMessage` | `CaptureEvent` (with `tabId` stamped by sw) |
| Service worker ↔ panel | — | Long-lived port `chrome.runtime.connect({ name: "panel:<tabId>" })` | Tree updates (push), tool calls (req/res) |

### Port protocol

On connect, service worker sends a `hello` with the current tree state. Subsequent messages:

**From SW to panel:**
- `{ type: 'tree:update', patch: TreePatch }` — incremental tree changes.
- `{ type: 'tree:replace', tree: TreeNode }` — full replacement (after major event or reconnect).
- `{ type: 'stats', stats: { events, bytes, since } }`.

**From panel to SW (tool calls):**
- `{ type: 'tool:call', id: string, name: string, args: unknown }`
- SW replies: `{ type: 'tool:result', id: string, ok: true, value: unknown }` or `{ ok: false, error: string }`.

All tool calls use this single RPC path. This is exactly the shape that will be exposed to LLMs in Day 2 (spec 21).

## Tool layer contract

These read primitives are defined in v1 and remain stable into v2. v1's panel consumes them directly. v2's LLM consumes them as tool calls via the same contract.

```ts
interface ClipboardTools {
  get_tree(): TreeNode;
  get_node(path: string): TreeNode | null;
  list_cases(): Array<{ id: string; className: string; lastUpdated: number }>;
  list_data_pages(): Array<{ name: string; lastUpdated: number }>;
  get_operator(): TreeNode;
  get_current_view(): TreeNode | null;

  list_snapshots(): Array<{ id: string; label: string; createdAt: number }>;
  get_snapshot(id: string): Snapshot | null;
  diff_snapshots(a: string, b: string, scope?: string): DiffResult;

  search_clipboard(query: string, opts?: SearchOptions): SearchResult[];
  get_field_binding(fieldName: string, caseId?: string): BindingInfo | null;
}
```

**v1 does not expose these externally.** They are an internal contract. But every primitive used by the panel goes through this interface, so v2's LLM tool layer is an adapter, not a rewrite.

**No write operations, ever.** This is not a v1 omission; it's a permanent boundary.

## State isolation

- Each tab has its own event buffer, tree, snapshot set.
- Closing a tab disposes all associated state.
- No cross-tab communication. No shared cache.
- Settings (URL patterns, snapshot retention, theme) are global and stored in `chrome.storage.local`. Captured data is never stored there.

## Service-worker lifecycle

MV3 service workers can be terminated after ~30 s of inactivity. Implications:

- **Tree and snapshot state is in-memory only.** If the worker is terminated, state is lost for tabs not actively viewed.
- Panel port activity keeps the worker alive.
- When the panel reconnects after a worker restart, it does a full `tree:replace` from whatever survives (empty tree if nothing).

Accepted limitation for v1. v1.x may investigate `chrome.storage.session` for short-term buffer persistence if users report this as painful.

## Error handling

- Capture errors are logged to the panel's "Capture log" (hidden by default, toggle in settings).
- Tool call errors return `{ ok: false, error }`; the panel shows a non-modal toast.
- Service worker uncaught exceptions are caught at the top level and logged; the worker does not crash the extension.

## Out of scope (v1)

- Cross-browser abstraction layer. Firefox port (v1.2) will use a shim.
- Hot reload / dev mode.
- Telemetry hooks (not building the capability, not needed).

## Related specs

- [01 Capture layer](./01-capture-layer.md) — upstream of the architecture.
- [05 UX surface](./05-ux-surface.md) — the panel component's UX.
- [07 Privacy & security](./07-privacy-security.md) — permissions and isolation.
- [Day 2 &middot; 21 Tool layer](./day2/21-tool-layer.md) — v2 extensions to this contract.
