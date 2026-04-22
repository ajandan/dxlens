# 04 — Search

## Purpose

Let developers find a specific property, value, or path in the tree instantly. With cases that have hundreds of fields, manual tree walking does not scale.

## Scope

Search operates on:

- **Node names** (property names).
- **Node values** (SV values, converted to string for matching).
- **Node paths** (dotted notation).

Search does **not** operate on:

- URLs of source DX responses.
- Timestamps.
- Metadata fields (mode badges, staleness flags).

Dedicated filters cover those cases when needed (spec 05).

## Matching rules

- Case-insensitive by default.
- Substring match (not fuzzy) for v1. Fuzzy is a deferred upgrade.
- Special-character-free query → plain substring on name + value + path.
- Query starting with `.` → treated as a path prefix match (`.Customer` matches `.Customer.Name` and `.Customer.Address(1).City`).
- Query wrapped in quotes (`"foo bar"`) → exact phrase match against values only. Useful when debugging stringy content.

Regex is deferred to v1.x to keep the surface small.

## Scope toggle

A dropdown next to the search box controls scope:

| Scope | Includes |
|---|---|
| All (default) | Every node in the tree. |
| Current case | Only nodes under the currently selected case. |
| Current view | Only nodes that the Current View references as bindings. |
| Data pages | Only nodes under Data Pages. |
| Operator | Only the Operator subtree. |

The scope toggle is sticky per tab — it stays where the user set it.

## Result presentation

- Tree auto-expands along ancestor paths of matched nodes.
- Matched nodes highlighted (amber underline).
- Non-matched siblings remain visible but dimmed. Users retain structural context rather than seeing a flat list.
- Result counter: `12 matches` shown next to the search box.
- Keyboard: `Enter` to jump to next match, `Shift+Enter` to jump to previous.
- `Esc` clears the search.

## Performance

- Search must feel instant — **<50 ms** from keystroke to highlighted tree on a 10,000-node tree.
- Implementation: pre-indexed at tree-build time. Index is a flat array of `{ id, name, value, path }` entries, filtered per keystroke. No heavy libraries in v1.
- Debounced at 80 ms to avoid re-filtering on every keystroke during rapid typing.

## In diff mode

Search works in diff mode too, but an implicit filter is added: matches are restricted to nodes that are visible given the current "Show all / Show only changes" toggle.

## Out of scope (Day 1)

- Saved searches.
- Regex queries.
- Fuzzy matching.
- Search history.
- Search across snapshots (search is tree-local, not snapshot-local).

## Related specs

- [02 Clipboard tree](./02-clipboard-tree.md) — the data being searched.
- [05 UX surface](./05-ux-surface.md) — where the search input lives.
