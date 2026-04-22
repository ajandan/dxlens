# CLAUDE.md

> Context file for Claude Code. Read this first when working in this repository.

## What this project is

**DX Lens** is an open-source Chrome extension that recreates the classic Pega Clipboard developer tool for Constellation applications. It intercepts DX API traffic, assembles it into a unified clipboard tree, and lets Pega developers inspect runtime state the way they did in the classic portal — without sending any data to a server.

- **Day 1 (v1.x):** Clipboard tree, snapshot/diff, search, DevTools panel. No AI.
- **Day 2 (v2.x):** Local LLM debugging copilot layered on the same tool primitives. Explain-only, read-only, citations mandatory.

## Architectural commitments (non-negotiable)

These decisions are made. Do not re-litigate without explicit approval.

1. **Manifest V3.** V2 is dead.
2. **MAIN-world fetch/XHR interception.** Not `chrome.webRequest` — MV3 cannot read response bodies there. Not `chrome.debugger` — intrusive and UX-hostile.
3. **Zero outbound network requests** from the extension itself, ever. No telemetry, no update checks, no analytics. This is a product feature.
4. **No persistent storage of captured data.** State is in-memory, tab-scoped, cleared on tab close.
5. **Read-only tool layer.** No write tools, no action tools, permanently. Threat model depends on this.
6. **Tool layer contract is defined in v1** even though v1 doesn't expose it externally. Same primitives serve v1's tree renderer and v2's LLM.
7. **Local LLM only for Day 2.** No hosted LLM support. Fork if needed.

## Repository layout

```
dx-lens/
├── CLAUDE.md                  ← this file
├── specs/                     ← product specs (read before building)
│   ├── index.md               ← start here
│   ├── dependencies.md        ← spec dependency graph
│   ├── 00..11-*.md            ← Day 1 specs
│   └── day2/
│       └── 20..23-*.md        ← Day 2 specs
├── src/                       ← (not yet created) extension source
├── kb/                        ← (Day 2) knowledge base entries
└── README.md                  ← (not yet created) public-facing
```

## Reading order for new contributors

1. `specs/index.md`
2. `specs/00-overview.md`
3. `specs/dependencies.md` — understand spec relationships
4. The spec covering the area you're about to touch
5. `specs/10-decisions.md` — to understand what's settled vs. open
6. `specs/11-risks.md` — to understand what breaks

## Working conventions for Claude Code

When implementing:

- **Never add outbound network calls** to anywhere other than the Pega app being inspected (Day 1) or a user-configured local LLM endpoint (Day 2). If a library wants to phone home, remove it.
- **Never add persistent storage of captured DX data.** Settings and user preferences can be stored via `chrome.storage.local`; clipboard state cannot.
- **Prefer pure functions in `src/state/`.** The tree-merge layer must be testable without DOM.
- **Respect the tool layer contract.** Every read primitive defined in `specs/06-architecture.md` section "Tool layer contract" should have a stable signature from v1 onward — Day 2 depends on this.
- **Cite specs in commit messages.** `feat(tree): add property mode inference (spec/02 §4)`.

When writing documentation:

- **No marketing voice.** These specs are working documents. Be direct.
- **No dated timelines.** Milestones are ordered (M1 before M2), never scheduled. Self-imposed dates kill side projects.
- **Prefer tables for mappings, prose for reasoning.**

## Licensing

- Code: **MIT**
- Knowledge base content (Day 2, `kb/`): **CC-BY 4.0**
- Trademark: none claimed. "Pega" is used descriptively; no affiliation with Pegasystems Inc.

## Project status

**Phase:** Pre-M1 (specs drafted, capture spike not yet started).
**Next milestone:** M1 — capture spike. See `specs/09-milestones.md`.

## Open decisions blocking forward progress

See `specs/10-decisions.md` for the full register. Top items:

- Assignments: nested under case, or top-level sibling? (Blocks M2.)
- Identifying "Current View" authoritatively from DX responses. (Blocks M2.)

## Author

Created by Ajanthan Arul. Contributions welcome under MIT.
