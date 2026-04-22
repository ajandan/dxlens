# 00 — Overview

## Problem

When Pega introduced Constellation, the classic client-side **Clipboard** tool was removed from the portal. The server-side clipboard still exists — the rule engine continues to hold `pyWorkPage`, `pxRequestor`, data pages, and thread pages — but the **developer's window into it is gone**. Constellation is a React SPA consuming DX API v2; there is no server-rendered harness to host a clipboard viewer, and Pega has not shipped a replacement.

The result is a debugging gap. Questions the classic clipboard answered in seconds — what's on the current work page, what just changed on Submit, which data page is empty and why — now require reading raw Network payloads or falling back to the Tracer.

## Vision

> Recreate the feeling of the classic Pega Clipboard for Constellation applications, in a modern, privacy-preserving, open-source form.

DX Lens is a Chrome extension that intercepts DX API traffic, assembles it into a unified clipboard tree, and lets the developer walk that tree with the same mental model they used in the classic portal. Nothing leaves the browser. No Pega-side install. Works on any Constellation app.

## Users

| Persona | Primary use |
|---|---|
| Pega developer (CSSA / CLSA / LSA) | Debug case, assignment, data page, and UI behavior during build and test. |
| Pega SI consultant | Same, across multiple client engagements. |
| Pega BA / QA | Understand what the UI is showing vs. what the server sent, during UAT. |
| Pega architect | Audit DX payload shapes, verify field bindings, assess integration patterns. |

## Goals

**Product**
- Restore the classic clipboard's mental model in a Constellation context.
- Zero setup: install, open any Pega Constellation app, works.
- Zero data egress: clipboard contents never leave the user's machine.
- Work across Pega Infinity 23.x and 24.x without per-version configuration.

**Strategic**
- Establish an open reference tool for Constellation debugging that Pega has not produced.
- Build a tool-layer and KB substrate that supports a Day 2 AI copilot without architectural rewrite.
- Grow credible open-source presence in the Pega ecosystem.

## Non-goals

- Not a replacement for Dev Studio, Tracer, PLA, or PDC.
- Not a write/action tool. Read-only inspection only. Permanent.
- Not a hosted service. No backend, no accounts, no telemetry. Permanent.
- Not a general-purpose HTTP inspector. Pega-aware by design.
- Not a Pega rule editor.

## Experience principles

These carry from the classic clipboard and are the yardstick for every UX decision:

1. **One tree, not many views.**
2. **Page-centric vocabulary** — cases, data pages, operator, view.
3. **"Right now" state** — refresh gives the current moment.
4. **Property modes are first-class** — Single Value, Page, Page List, Value List as badges.
5. **Always reachable** — one keyboard shortcut from anywhere.
6. **Pega-literate** — dotted notation, Pega terminology, meaningful names.

## Day 1 vs Day 2

**Day 1 (v1.x)** ships the clipboard experience: capture, tree, snapshot/diff, search, DevTools panel. No AI. Fully useful standalone.

**Day 2 (v2.x)** layers a Pega-literate debugging copilot on top: local LLM, explain-only mode, tool layer for retrieval, community knowledge base.

Day 1 is designed so Day 2 is additive, not a rewrite. See spec 06 (Architecture) on the tool layer contract that anticipates Day 2.

## Success metrics

Directional, not KPIs.

| Metric | v1 (6 months post-launch) | v2 target |
|---|---|---|
| GitHub stars | 200+ | 1,000+ |
| Chrome Web Store installs | 500+ | 3,000+ |
| Active contributors | 3+ | 10+ (code + KB) |
| KB entries | n/a | 50+ at v2 launch, 150+ six months later |
| Ecosystem recognition | 1+ public reference | Referenced in PDN community content |

Open source tools succeed or fail on usefulness, not install counts.

## Related specs

- [01 Capture layer](./01-capture-layer.md) — how DX traffic becomes events.
- [02 Clipboard tree](./02-clipboard-tree.md) — how events become the unified tree.
- [06 Architecture](./06-architecture.md) — components and contracts.
- [07 Privacy & security](./07-privacy-security.md) — the trust model.
- [Day 2 specs](./day2/) — future AI layer.
