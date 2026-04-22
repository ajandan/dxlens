# 03 — Snapshot & Diff

## Purpose

Let developers capture the tree state at a moment in time, then compare two snapshots to answer the most common Constellation debugging question:

> What changed when I clicked \<thing\>?

This is the feature that most justifies the "modern" in "modern clipboard." The classic clipboard couldn't do this. DX Lens can, because it already has the event stream and the merged tree.

## Model

A **snapshot** is an immutable copy of the entire clipboard tree at a moment, with metadata.

```ts
type Snapshot = {
  id: string;                    // uuid
  label: string;                 // user-editable, default: ISO timestamp
  createdAt: number;             // epoch ms
  tree: TreeNode;                // deep copy of root
  eventCount: number;            // number of capture events since previous snapshot
};
```

Snapshots are **session-scoped**. They live in memory for the lifetime of the tab. Closing the tab discards them. v1 does not persist snapshots across sessions.

**Rationale for session-scoped:** classic clipboard was ephemeral; persistence would require decisions about what to retain, where to store it, and how to reconcile with the zero-persistence privacy stance. Deferred to a later version with explicit opt-in.

## Retention

- Default maximum: **5 snapshots per tab**. Configurable in settings up to 20.
- Eviction: oldest first, FIFO.
- The current live tree does **not** count as a snapshot. Taking a snapshot copies the current tree and adds it to the retained set.

## Operations

### Take snapshot

- Button in the panel toolbar.
- Keyboard: `Cmd/Ctrl + S` while panel is focused.
- Immediately captures the current tree, assigns it a default label (e.g., `Before Submit`, editable inline), returns to live mode.

Taking a snapshot does **not** pause live capture. Events continue to flow into the live tree.

### Compare

- Panel mode toggle: Live | Compare.
- In Compare mode, user selects two snapshots (A = baseline, B = comparison).
- The tree renders in **diff mode**: a single annotated tree showing the union of nodes from A and B, colored by change type.

### Change types

| Change | Color (dark theme) | Color (light theme) | Meaning |
|---|---|---|---|
| Added in B | Green underline | Green underline | Node present in B, not in A. |
| Removed in B | Red strikethrough | Red strikethrough | Node present in A, not in B. |
| Value changed | Amber fill on the value | Amber background | SV node present in both; value differs. |
| Mode changed | Amber badge highlight | Amber badge highlight | Property mode differs (e.g., array became object). |
| Unchanged | Default | Default | Present in both, identical. |

A summary header above the tree shows: `+N added · -N removed · ~N changed · =N unchanged`.

## Diff algorithm

- Tree walk, keyed by node `id` (dotted path, which is stable).
- SV nodes compared by value and type.
- P / PL / VL nodes compared structurally by child set.
- PL child correlation: by `pzInsKey` if present, otherwise by array index. (Known limitation: reordered Page Lists without `pzInsKey` will show as change-in-place rather than reorder. Documented.)
- Complexity: O(N) in total node count across both trees. No quadratic fallbacks.

## UI affordances in diff mode

- **Filter toggle:** Show all / Show only changes. Default is "only changes" — the developer almost always wants the signal, not the noise.
- **Expand-all / collapse-all** buttons.
- **Jump to next change** keyboard shortcut (`N`).
- **Click a changed node** → side panel shows before/after values side by side.
- **Copy change** → produces a short text summary: `".Customer.Status" changed from "Pending" to "Open" between "Before Submit" and "After Submit"`. Useful for pasting into Slack or bug reports.

## Auto-snapshot (Day 1.x, not v1.0)

Deferred to v1.1 after feedback: the ability to automatically take a snapshot when the user clicks a submit-like button in Constellation. Requires identifying "submit-like" actions reliably, which is a separable problem from snapshot/diff mechanics. Flagged in risks.

## Out of scope (Day 1)

- Persistence of snapshots across tab close.
- Export / import of snapshots as files.
- Multi-way diff (A vs B vs C).
- Diffing across different cases. (Snapshots are whole-tree; comparing a case in snapshot A to a different case in snapshot B is not a supported operation.)

These are all straightforward additions but add UI complexity. v1 stays focused on the core workflow.

## Related specs

- [02 Clipboard tree](./02-clipboard-tree.md) — the data being snapshotted.
- [05 UX surface](./05-ux-surface.md) — panel modes, toolbar, shortcuts.
- [Day 2 &middot; 21 Tool layer](./day2/21-tool-layer.md) — `diff_snapshots` tool exposed to LLM.
