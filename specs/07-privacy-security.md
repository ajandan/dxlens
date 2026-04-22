# 07 — Privacy & Security

## Purpose

Define the trust model. This spec matters more than most because the extension will be used against enterprise applications containing PHI, PII, and confidential case content. Users must be able to trust the tool absolutely — and the tool must make that trust verifiable.

## Core guarantees

1. **Zero outbound network requests from the extension itself.** DX Lens does not phone home. Does not fetch updates. Does not report telemetry. Does not transmit captured data anywhere.
2. **Zero persistent storage of captured data.** Clipboard state, snapshots, events, and all derived structures live in memory, scoped to the tab. Tab close discards them. The user's disk is not written to with any DX payload content.
3. **Read-only interaction with the Pega app.** The extension does not modify DX requests, does not inject new requests (except the explicit user-initiated Refresh in v1.x, which re-issues a GET the app would issue itself), does not alter response bodies the app receives.
4. **No cross-tab data flow.** Tab A's clipboard state is not visible from Tab B, ever.

These are product features, not implementation accidents. They are stated prominently in the README, Chrome Web Store listing, and settings panel.

## Threat model

| Actor | Capability | Concern |
|---|---|---|
| Pega app (legitimate) | Runs code in the same origin as the page. | Can in principle call our MAIN-world wrappers. But we emit no secrets and accept no commands. |
| Malicious DX payload | Attacker-controlled response body. | Could include JSON that tries to exploit our tree renderer. Concern: XSS in the panel. Mitigation: the panel renders all values as text, never as HTML; no `innerHTML` from captured data. |
| Malicious co-installed extension | Can message our extension, try to read state. | Mitigation: `externally_connectable` not set; our extension accepts messages only from its own components. |
| Network attacker (MITM) | — | Not applicable. Extension makes no outbound network calls. |
| Filesystem attacker | Read local state. | Not applicable. No captured data on disk. |

## Permissions

The extension's manifest declares:

| Permission | Why |
|---|---|
| `storage` | Persist user settings (patterns, theme, shortcuts) — **not** captured data. |
| `scripting` | Inject the MAIN-world wrapper script. |
| `<all_urls>` host permission | Pega Constellation apps run on customer-specific enterprise domains. Narrower patterns would force per-install configuration. |

Not declared:

| Permission | Why not |
|---|---|
| `webRequest` | Not used. MV3 can't read bodies. |
| `webRequestBlocking` | Not used. Extension is non-modifying. |
| `cookies` | Not used. |
| `history` | Not used. |
| `tabs` (unless required for devtools APIs) | Avoid unless necessary. |
| `debugger` | Reserved as emergency fallback; not declared in v1. |

### Host permission justification (Chrome Web Store)

The store listing explains:

> DX Lens inspects DX API traffic on Pega Constellation applications. Because Pega apps run on customer-specific enterprise domains that vary between installations, a static list of host patterns is not feasible. The extension is inert on non-Pega pages: no event is emitted, no body is read, no memory is used beyond the URL-pattern check.

Chrome Web Store reviewers scrutinize `<all_urls>`. The narrow-scope behavior above is the defense.

## Content Security Policy

Extension pages (`panel.html`, `options.html`) declare a strict CSP:

```
default-src 'self';
script-src 'self';
style-src 'self';
connect-src 'self';
```

`connect-src 'self'` prevents the panel from making fetches to any external origin. Verifiable by inspection. This is the technical enforcement of "zero outbound."

**Day 2 amendment:** `connect-src` will be extended to include the user-configured LLM endpoint (default `http://localhost:11434`). This is the only planned loosening, and it targets localhost by default.

## Data minimization

- The capture layer matches URLs before reading bodies. Non-matching requests are ignored entirely — no body read, no memory allocated, no event emitted.
- Request and response bodies larger than 2 MB are truncated.
- Headers are not captured in v1 except for `content-type` (needed for body parsing). No `authorization`, no `cookie`, no session tokens enter the tree or buffer.

## What users see

The settings panel includes a **"Trust" section** prominently linked from the main panel:

- Live counter: "Outbound requests made by DX Lens this session: **0**." Always zero. If this counter ever shows a non-zero number, something is wrong and the user can see it.
- Button: "Show captured data footprint" — displays current in-memory usage per tab.
- Link to the privacy section of the README, which contains the explicit guarantees in plain language.

## Incident response

If a vulnerability is discovered:

- Security issues reported privately via a `SECURITY.md` process (to be written before v1.0).
- Coordinated disclosure; 14-day embargo window for maintainer to patch.
- Users notified via Chrome Web Store description change and GitHub release notes.

## Related specs

- [01 Capture layer](./01-capture-layer.md) — capture boundaries.
- [06 Architecture](./06-architecture.md) — where state lives.
- [Day 2 &middot; 20 LLM integration](./day2/20-llm-integration.md) — CSP amendment for localhost LLM.
