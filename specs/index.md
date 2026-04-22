# DX Lens — Specification Index

This directory contains the specification for DX Lens, broken into focused documents by concern. Each spec is self-contained enough to implement against; see `dependencies.md` for the order in which they should be read and built.

## Status

| | |
|---|---|
| Spec version | 0.1 (draft) |
| Target product version | v1.0 (Day 1) + v2.0 (Day 2) |
| Phase | Pre-M1 |
| Last revised | 2026-04-21 |

## Day 1 — v1.x (core clipboard experience)

| # | Spec | Purpose |
|---|---|---|
| 00 | [Overview](./00-overview.md) | Vision, users, goals, non-goals, success metrics. |
| 01 | [Capture layer](./01-capture-layer.md) | DX API traffic interception (fetch + XHR, MAIN world). |
| 02 | [Clipboard tree](./02-clipboard-tree.md) | Unified state model, merge rules, property modes, dotted paths. |
| 03 | [Snapshot & diff](./03-snapshot-diff.md) | Capturing and comparing tree state over time. |
| 04 | [Search](./04-search.md) | Name/value/path matching across the tree. |
| 05 | [UX surface](./05-ux-surface.md) | DevTools panel, keyboard shortcut, settings, live/pause. |
| 06 | [Architecture](./06-architecture.md) | Components, Manifest V3, state isolation, tool layer contract. |
| 07 | [Privacy & security](./07-privacy-security.md) | Zero-egress model, permissions, trust guarantees. |
| 08 | [Non-functional](./08-non-functional.md) | Performance, compatibility, accessibility, distribution, licensing. |
| 09 | [Milestones](./09-milestones.md) | Ordered (not dated) delivery phases. |
| 10 | [Decisions](./10-decisions.md) | Settled architectural decisions and open decisions blocking progress. |
| 11 | [Risks](./11-risks.md) | Risk register with mitigations. |

## Day 2 — v2.x (debugging copilot)

Day 2 specs live under `day2/`. They are **not** implementation candidates until v1.x is stable. They exist now so v1 architectural choices don't foreclose them.

| # | Spec | Purpose |
|---|---|---|
| 20 | [LLM integration](./day2/20-llm-integration.md) | Local LLM endpoint, model picker, context strategy. |
| 21 | [Tool layer (extended)](./day2/21-tool-layer.md) | Tool contracts exposed to LLM; extends v1 internal tool layer. |
| 22 | [Knowledge base](./day2/22-knowledge-base.md) | KB structure, retrieval, contribution model. |
| 23 | [Chat UX & citations](./day2/23-chat-ux.md) | Chat panel, answer rendering, clipboard/KB deep-linking. |

## How to read

- **Implementing a feature?** Start at the spec for that feature, then read its dependencies from `dependencies.md`.
- **Onboarding?** Read in order 00 → 06 → 10 → whichever area you're picking up.
- **Reviewing a PR?** Check the spec cited in the commit message and verify the change aligns with it.

## How to change a spec

1. Open an issue proposing the change.
2. Update the relevant spec(s) and `dependencies.md` if dependencies shift.
3. Add a decision record entry to `10-decisions.md` if the change reverses or significantly alters a settled decision.
4. PR with the label `spec-change`.

Specs are versioned with the code. Breaking spec changes require a corresponding `MAJOR` bump in the extension version.

## Related

- [CLAUDE.md](../CLAUDE.md) — project context for Claude Code.
- README.md (not yet written) — public-facing.
