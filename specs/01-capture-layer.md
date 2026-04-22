# 01 — Capture Layer

## Purpose

Intercept every DX API request and response on pages where the user is running a Pega Constellation application, and emit structured events that downstream components (the clipboard tree, the snapshot store) can consume.

This is the layer the entire product stands on. If capture is unreliable, everything above it is garbage.

## Scope

**In scope**

- HTTP(S) requests issued by the Constellation React app via `fetch` or `XMLHttpRequest`.
- Response bodies (JSON), status, headers we care about, timing.
- Request bodies for POST/PUT/PATCH.
- URL pattern matching to distinguish DX API traffic from other XHRs on the page.

**Out of scope (Day 1)**

- WebSocket frames. Pega's push update channel in some scenarios. Tracked as a risk; evaluated in v1.1.
- `chrome.webRequest` observation. MV3 cannot read response bodies; path foreclosed.
- `chrome.debugger` API. Intrusive (user sees "DX Lens is debugging this tab"), UX-hostile. Reserved as fallback only.

## Interception strategy

Inject a script into the page's **MAIN world** (not the extension's isolated content-script world) that wraps `window.fetch` and `window.XMLHttpRequest` before the Constellation React bundle executes. Wrappers observe requests and responses non-invasively (pass-through proxy) and emit events via `window.postMessage`. A content script in the isolated world listens and forwards to the service worker.

Why MAIN world:
- Constellation bundles use these globals. Wrapping them in isolated world does nothing.
- Must execute at `document_start` so it wraps the globals before the app code loads.
- The cost of running in MAIN world is a slightly more careful contract (page can, in principle, see our wrappers). Acceptable; we emit no secrets.

## URL pattern matching

Default patterns (editable in settings):

```
/prweb/api/application/v*
/prweb/api/v*
/prweb/PRRestService/
/api/application/v*
```

Requests not matching any pattern are ignored. The wrapper does not inspect their bodies, does not time them, does not emit events for them.

**Rationale:** narrow capture keeps the memory footprint low and makes the tool genuinely Pega-specific rather than a generic network inspector. A user running DX Lens on gmail.com sees nothing and costs nothing.

## Event schema

Every matched request emits one event after the response resolves (or error, if it fails):

```ts
type CaptureEvent = {
  kind: 'dx_response' | 'dx_error';
  tabId: number;                     // injected by service worker, not wrapper
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
  status?: number;                   // undefined for dx_error
  durationMs: number;
  requestBody?: unknown;             // parsed JSON if JSON; omitted otherwise
  responseBody?: unknown;            // parsed JSON; text fallback; binary omitted
  error?: string;                    // for dx_error only
  startedAt: number;                 // epoch ms
  finishedAt: number;                // epoch ms
};
```

Events are fire-and-forget. The capture layer does not retry, does not batch, does not persist. It emits into the postMessage channel and is done.

## Response body handling

- JSON content-type: parse. If parse fails, emit with `responseBody` as the raw string.
- Text content-type: emit as string.
- Binary (image, pdf, octet-stream): omit `responseBody` entirely. Emit the event for timing visibility; the tree renderer will ignore it.
- Streaming responses (chunked, server-sent events): read the `.clone()` once and discard. Streaming frames are not captured in v1.
- Size guard: bodies larger than 2 MB are emitted with a `truncated: true` flag and the first 512 KB. Prevents memory blowup on accidental large payloads.

The original response is **never modified**. The wrapper returns the original response untouched so app behavior is byte-identical to what it would be without the extension.

## Performance budget

- The fetch/XHR wrapper must add **<2 ms** to the request-response cycle on non-matched URLs (pure pattern check + passthrough).
- For matched URLs, added overhead must stay **<5 ms** for responses up to 100 KB.
- Memory: event buffer is bounded to 500 events per tab (configurable). Oldest events evict first.

Benchmarks must be established during M1 on a representative Constellation app. Budget is a release gate.

## Failure modes & fallbacks

| Failure | Behavior |
|---|---|
| Page CSP blocks inline script injection | Fall back to injecting the script as a web-accessible resource via `<script src>`. Manifest declares it accessible. |
| Wrapper cannot clone response (streaming) | Skip body, emit event with `bodyUnavailable: true`. |
| Page restores `window.fetch` after our wrap | Detected via periodic check; re-wrap. Logged in console. |
| Manifest V3 service worker is terminated | Buffer is lost. Documented limitation; v1 accepts it, v1.x considers `chrome.storage.session` for short-term persistence. |
| Capture adds measurable lag | Auto-disable capture and surface a warning in the panel. Capture resumes on user acknowledgment. |

## What capture does not know

Capture is deliberately dumb about Pega semantics. It does not:

- Identify cases, data pages, or assignments.
- Infer property modes.
- Correlate responses.
- Diff snapshots.

All of that is the job of the **Clipboard Tree** layer ([02](./02-clipboard-tree.md)), which consumes capture events and builds meaning. Keeping capture dumb means we can change the tree's semantics without touching the interception code — and it means the tree layer is pure/testable without needing real network traffic.

## Related specs

- [02 Clipboard tree](./02-clipboard-tree.md) — consumer of capture events.
- [06 Architecture](./06-architecture.md) — MAIN-world / isolated-world / service-worker comms.
- [07 Privacy & security](./07-privacy-security.md) — what we do NOT do with captured data.
- [08 Non-functional](./08-non-functional.md) — performance budget gates.
