# 10 — Decisions

## Purpose

Capture architectural decisions — settled and open — so future contributors understand what was chosen deliberately vs. what's still up for grabs.

Each decision has a status:

- **Settled** — decided, not up for re-litigation without a strong new reason.
- **Open** — still being evaluated; blocks specific work noted inline.
- **Deferred** — known decision needed, but later.

## Settled decisions

### D-001 — Manifest V3
**Settled.** Chrome has deprecated V2. No viable alternative for new extensions.

### D-002 — MAIN-world fetch/XHR interception
**Settled.** `chrome.webRequest` cannot read response bodies in MV3. `chrome.debugger` API is intrusive and shows a permanent "DX Lens is debugging this tab" banner — UX-hostile. MAIN-world wrapping is the only acceptable path. `chrome.debugger` remains available as an emergency fallback.

### D-003 — Zero outbound network requests
**Settled, permanent.** Product feature, not a v1 constraint. Applies forever. Day 2 loosens CSP only to permit user-configured localhost LLM endpoints.

### D-004 — No persistent storage of captured data
**Settled, permanent.** In-memory, tab-scoped, cleared on close. Settings (preferences) may be stored; captured DX data never is.

### D-005 — Read-only, explain-only
**Settled, permanent.** Tool layer exposes only read primitives. LLM in Day 2 explains behavior; does not suggest rule changes or execute actions. This is a hard boundary on the threat model.

### D-006 — Product name: DX Lens
**Settled.** Alternatives considered: *Clippy* (rejected: trademark risk with Microsoft's Copilot/Clippy revival; weak in enterprise contexts), *ConstelloScope* (rejected: too long, Pega-name-coupled), *PegaScope* (rejected: Pega trademark concern). DX Lens aligns with Pega's own "DX API" terminology, scales beyond the clipboard use case, and carries no trademark risk.

### D-007 — License: MIT code, CC-BY 4.0 docs & KB
**Settled.** Maximizes reuse. No CLA. DCO sign-off on commits.

### D-008 — Primary surface: DevTools panel
**Settled for v1.0.** Side panel deferred to v1.1. In-page overlay not planned.

### D-009 — Pega 1-indexed paths in displayed output
**Settled.** Internal data structures remain 0-indexed; display and copy-paste paths are 1-indexed to preserve classic-clipboard muscle memory.

### D-010 — Tool layer contract defined in v1
**Settled.** v1's internal tool primitives are the same interface v2 exposes to the LLM. v1 does not expose tools externally, but the contract is stable from M4 forward.

### D-011 — Bundle KB with extension at v2.0; split to external repo at v2.1
**Settled.** Bundling at v2.0 avoids the cold-start of a second repo and lets the first 50+ entries land without additional infrastructure. External repo at v2.1 enables KB evolution independent of extension releases.

### D-012 — Retrieval: BM25 (keyword) at v2.0, local embeddings at v2.x
**Settled.** Keyword works without model downloads, runs in-process, is good enough for a curated KB with good titles. `kb_search` contract remains stable when embeddings swap in.

### D-013 — Context strategy: summarize-then-ask at v2.0, tool-use at v2.x
**Settled.** Summarize-then-ask works on 7–8B local models (Phi-3, Llama 3.1 8B) — critical for adoption on laptops without heavy GPUs. Tool-use mode ships when users with capable models (Llama 3.1 70B, Qwen 2.5 14B) want the deeper traversal.

## Open decisions

### O-001 — Assignments: nested under case, or top-level sibling?
**Blocks:** M2.
**Options:**
- **A (nested):** Assignments under `Cases > <case> > assignments`. Faithful to classic clipboard (`pxAssignPage` lived near `pyWorkPage`).
- **B (top-level):** Assignments as a top-level sibling of Cases, matching DX v2's first-class treatment.
**Current lean:** A (nested). Preserves mental model; DX-first-class nature can still be expressed in the UI if needed.
**Decision owner:** AJ.
**Deadline:** before M2 starts.

### O-002 — "Current View" identification
**Settled (heuristic).** Implemented in `src/state/current-view.js`. The picker
consults signals in strong-to-weak order: (1) URL endpoint `/views/<id>`;
(2) `responseBody.uiResources.root.config.name + classID`; (3) `data.uiResources`
alt placement; (4) single-leaf `uiResources.resources.views`; (5) `viewID` query
parameter. Last-write-wins updates the `CurrentView` subtree with `viewId`,
`className`, `viewName`, and `bindings` extracted from `@P .path` values.
Further refinement gated on live DX sampling; the contract is stable.

### O-003 — Side panel surface in v1.0 or v1.1?
**Blocks:** nothing critical; v1.0 ships DevTools-only.
**Question:** Is side-panel (persistent sidebar) compelling enough to delay v1.0?
**Current lean:** v1.1. DevTools panel is the canonical home; side panel is additive.
**Decision owner:** AJ.

### O-004 — Cross-snapshot search
**Blocks:** nothing; not in v1 scope.
**Question:** Should search be able to match nodes across all snapshots, or stay tree-local?
**Current lean:** tree-local. Cross-snapshot is a separate feature with its own UI implications.

### O-005 — Auto-snapshot trigger heuristic
**Blocks:** v1.x auto-snapshot feature.
**Question:** How does the extension reliably identify "the user just clicked a submit-like button" without reading page DOM in invasive ways?
**Candidate approach:** Detect DX POST/PATCH requests on case endpoints; auto-snapshot before and after.
**Decision owner:** AJ.

### O-006 — Model picker UI at v2.0
**Blocks:** v2.0 UX.
**Question:** Detect Ollama's installed models automatically, or require user entry?
**Current lean:** Detect if available, fall back to user entry. Non-blocking.

## Deferred decisions

### DE-001 — Firefox port timing
**When to decide:** end of v1.x cycle.
**Current plan:** v1.2.

### DE-002 — KB licensing — CC-BY 4.0 vs CC-BY-SA
**When to decide:** before v2.0 ships the first KB content.
**Current plan:** CC-BY 4.0. Revisit if share-alike becomes important for ecosystem health.

### DE-003 — Telemetry for crash/error reporting
**When to decide:** only if adoption reveals real blind spots the user can't surface themselves.
**Current plan:** None. Permanent no is likely.

### DE-004 — Fine-tuned Pega model
**When to decide:** only after v2.x has prompt-based answers quality-tracked in the wild.
**Current plan:** v3, as a separate project. Not a DX Lens commitment.

### DE-005 — Action-capable agent mode
**When to decide:** never, unless the entire threat model is re-examined.
**Current plan:** Permanent non-goal. Fork for this.

## Process for new decisions

1. New architectural choice? Open an issue labeled `decision`.
2. Write up the options and the lean.
3. Add an entry here as **open**, with a decision owner and a deadline (or "when needed").
4. On decision, move to **settled** with a brief rationale.

## Related specs

- [00 Overview](./00-overview.md) — non-goals that come from settled decisions.
- [06 Architecture](./06-architecture.md) — where decisions materialize as components.
- [09 Milestones](./09-milestones.md) — which decisions gate which milestones.
