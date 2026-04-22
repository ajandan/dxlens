# 05 — UX Surface

## Purpose

Define where DX Lens lives in the Chrome UI, how the user opens it, and how the panel is laid out.

## Primary surface: DevTools panel

DX Lens's primary home is a Chrome DevTools panel titled **DX Lens**, sitting alongside Elements, Network, Sources, etc.

**Rationale:** DevTools is the honest home for a developer tool, matches the classic clipboard's "opened from dev links" muscle memory, and has the right ergonomics (detachable, tabbed, keyboard-first).

Non-goals for v1:
- Side panel (Chrome's persistent sidebar). Deferred to v1.1.
- In-page overlay (floating widget). Not planned.
- Popup (browser action). Not suitable for the interaction density this tool needs.

## Opening the panel

Three paths:

1. **Open DevTools → DX Lens tab.** Standard.
2. **Keyboard shortcut:** `Alt+Shift+C` (Cmd+Shift+C on macOS if not colliding; rebindable). Opens DevTools if closed, focuses the DX Lens tab.
3. **Right-click in page → "Inspect with DX Lens"** context menu item. Opens panel, selects the node currently focused by the app (if identifiable).

Shortcut rebinding lives in the extension's options page, using Chrome's native command API so users can see and manage it alongside other extension shortcuts at `chrome://extensions/shortcuts`.

## Panel layout

Three horizontal zones, top to bottom:

```
┌──────────────────────────────────────────────────────────┐
│ Toolbar                                                  │
│   [●Live / ⏸Pause]  [📷Snapshot]  [🔍Search...]  [⚙]    │
├──────────────────────────────────────────────────────────┤
│ Breadcrumb:  Cases > WORK-123 > content > Customer       │
├───────────────────┬──────────────────────────────────────┤
│ Tree              │ Detail                               │
│                   │                                      │
│ 📋 Clipboard      │ Property: .Customer.Name             │
│ ├─📄 Cases        │ Mode: SV · Type: string              │
│ │  └─WORK-123     │ Value: "Ajanthan Jeyakumar"          │
│ │    ├─content    │                                      │
│ │    │  ├─ID      │ Source: GET /api/.../cases/WORK-123  │
│ │    │  └─Customer│ Last updated: 2 seconds ago          │
│ │    ...          │                                      │
│ ├─📑 Data Pages   │                                      │
│ ...               │                                      │
└───────────────────┴──────────────────────────────────────┘
```

### Zone 1 — Toolbar

Left: Live/Pause toggle (see below).
Middle: Snapshot button (+ snapshot selector dropdown when in Compare mode).
Right: Search box, settings gear.

### Zone 2 — Breadcrumb

Always visible. Shows the path of the currently selected node in dotted notation, with each segment clickable to jump to that ancestor.

### Zone 3 — Tree + Detail split

- Tree on the left (resizable split, default 50/50).
- Detail pane on the right shows the full node info for the current selection: mode, type, value, source URL, last-updated, staleness markers, copy buttons.

If no node is selected, the Detail pane shows a welcome panel with current capture stats: `14 cases · 6 data pages · 312 nodes · capturing since 10:42 AM`.

## Live / Pause mode

| Mode | Behavior |
|---|---|
| **Live** (default) | Capture events apply to the tree in real time. Tree nodes that just changed briefly glow (2-second fade). |
| **Pause** | Capture events are still recorded, but do not apply to the visible tree. A count badge appears on the Pause button: `⏸ Paused · 12 events queued`. |

Unpausing applies queued events in order, all at once, with the change-glow animations disabled (to avoid a visual storm). User can also click "Apply 12 queued events" in the breadcrumb zone.

## Change glow

When a node's value or structure changes during live mode:

- The node's background briefly highlights (amber, 200 ms fade-in, 1.8 s hold, 500 ms fade-out).
- Parent nodes show a small dot indicator if they contain a recently changed descendant, for 5 seconds.
- In diff mode, change glow is disabled (the diff is already the highlight).

This is the closest thing to "time-based change perception" without a full timeline — cheap, useful, easy to implement.

## Refresh

- Button in the toolbar: `↻ Refresh`.
- Behavior: when a case is currently selected, triggers a DX `GET` for that case via a known endpoint pattern. When no specific context is identifiable, disabled with tooltip `Select a case or data page to refresh it`.
- **Never modifies** anything — refresh is read-only by design.

## Settings

A minimal options page (extension options, separate from the panel):

- URL patterns to capture (editable list, defaults shown).
- Keyboard shortcut rebinding (deep link to `chrome://extensions/shortcuts`).
- Snapshot retention count (default 5, max 20).
- Panel theme (Dark / Light / Follow DevTools).
- Capture body size limit (default 2 MB).
- Reset to defaults button.

**Not in settings in v1:** Telemetry (none), Cloud sync (none), Accounts (none). Keep the surface pristine.

## Theming

DX Lens respects the DevTools theme by default (Chrome exposes this). Manual override in settings. Two themes:

- **Dark (default):** charcoal background, amber accents, JetBrains Mono for tree and code, system sans for chrome.
- **Light:** near-white background, burnt-orange accents, same typography.

No purple gradients, no Material defaults. Aesthetic is developer tool, not consumer app.

## Accessibility

- Full keyboard navigation (tree, search, toolbar, snapshots).
- ARIA roles on tree nodes (`role="tree"` / `role="treeitem"`).
- Focus ring visible on all interactive elements.
- Color is never the sole signal — change markers also use icons and text badges.
- Respects `prefers-reduced-motion` (disables glow animation).

## Out of scope (v1.0)

- Side panel surface.
- In-page overlay.
- Multi-pane layouts (tree + tree + detail).
- Saved layouts.
- Theme customization beyond dark/light.

## Related specs

- [02 Clipboard tree](./02-clipboard-tree.md) — the content of the tree zone.
- [03 Snapshot & diff](./03-snapshot-diff.md) — toolbar Snapshot button and Compare mode.
- [04 Search](./04-search.md) — search box behavior.
- [08 Non-functional](./08-non-functional.md) — accessibility, performance gates.
