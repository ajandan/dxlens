# 02 — Clipboard Tree

## Purpose

Transform the stream of raw DX API events from the Capture Layer into a single, unified tree that reflects the current state of the application the way the classic Pega Clipboard did. The tree is the product's core surface — everything else (search, snapshot, diff, chat, citations) operates on it.

## Tree structure

```
📋 Clipboard
├── 📄 Cases
│   └── <pzInsKey> (<pyClassName>)
│       ├── content           ← modern pyWorkPage
│       ├── assignments       ← open assignments for this case
│       ├── stages            ← stage / step structure
│       └── actions           ← available actions
├── 📑 Data Pages
│   └── <D_PageName>
├── 👤 Operator               ← what DX exposes of pxRequestor
│   ├── userID
│   ├── accessGroup
│   └── application
└── 🧩 Current View           ← the view the UI is currently bound to
    └── fields, layouts, visibility
```

The top-level nodes are **fixed**. Cases, Data Pages, Operator, and Current View always exist even if empty — so the tree shape is predictable and the user's mental model is stable.

## Merge rules

Capture events are folded into the tree, **not appended**. The tree is a current-state projection, not a log.

| Source | Target node | Merge behavior |
|---|---|---|
| `GET /api/application/v*/cases/<id>` | `Cases > <id>` | Replace entire case node. |
| `PATCH /api/application/v*/cases/<id>` | `Cases > <id>` | Merge response into case node; patched fields marked changed. |
| `GET /api/application/v*/assignments/<id>` | `Cases > <case_id> > assignments > <assignment_id>` | Replace assignment node. Case parent is the assignment's owning case if discoverable; otherwise assignment lives under a synthetic case node `[unknown]`. |
| `GET /api/application/v*/data_views/<D_name>` | `Data Pages > <D_name>` | Replace. Parameterized data pages disambiguated by serialized param hash. |
| `*/view/*` references in any response | `Current View` | Last-write-wins; the most recently referenced view is considered current. |
| Operator info in any response | `Operator` | Merge all DX-exposed operator fields. |

**Open decision (see spec 10):** whether assignments are nested under cases (faithful to classic clipboard) or live as a top-level sibling node (faithful to DX v2's first-class treatment). Current proposal is nested; revisit at M2.

## Node model

Every node carries:

```ts
type TreeNode = {
  id: string;                  // stable path, e.g. ".Customer.Address(1)"
  name: string;                // display label
  mode: 'SV' | 'P' | 'PL' | 'VL' | 'ROOT';
  value?: Primitive;           // for SV nodes only
  valueType?: 'string' | 'number' | 'boolean' | 'date-like' | 'null';
  children?: TreeNode[];       // for P, PL, VL, ROOT
  sourceUrls: string[];        // URLs of DX responses that contributed
  lastUpdated: number;         // epoch ms
  isPartial: boolean;          // true if node was seen but not fully populated
  isStale: boolean;            // true if sourceUrl has been re-fetched and this wasn't in the new response
};
```

## Property mode inference

Modes are inferred from JSON shape:

| JSON shape | Mode | Label |
|---|---|---|
| Primitive (string, number, boolean, null) | **SV** | Single Value |
| Object | **P** | Page |
| Array of objects | **PL** | Page List |
| Array of primitives | **VL** | Value List |
| Empty array | **VL** (tentative) | Value List (or Page List — unknown until populated) |

Empty arrays are ambiguous by shape alone. The inference is tentative and displayed with a `?` badge. If a subsequent capture fills the array with objects, the mode flips to PL silently.

Mode badges appear next to node names in the UI. This is the feature that most makes the tree *feel* Pega rather than *feel* JSONView.

## Dotted-notation paths

Paths use Pega conventions, not JSONPath:

| Position | Classic Pega | DX Lens | Not |
|---|---|---|---|
| Object property | `.Customer.Name` | `.Customer.Name` | `$.Customer.Name` |
| Array index (Page List) | `.Customer.Address(1).City` | `.Customer.Address(1).City` | `$.Customer.Address[0].City` |
| Array index (Value List) | `.pyTags(2)` | `.pyTags(2)` | `$.pyTags[1]` |
| Top level | `pyWorkPage.Customer` | `Cases > WORK-123.Customer` (display) `Cases[WORK-123].Customer` (path-copy form) | — |

**Index base:** Pega is 1-indexed. DX Lens preserves 1-indexing in displayed paths for muscle-memory compatibility, while internal data structures remain 0-indexed.

Path generation is a pure function of node position in the tree. Copy-to-clipboard outputs the dotted form.

## Staleness and partial nodes

Because capture is eventually consistent with the server, the tree reflects only what the client has seen. Two markers make this honest:

- **Partial** — the node appeared in a response but not all its expected children are populated. Shown with a dashed border and a tooltip explaining what's missing.
- **Stale** — the source URL has been re-fetched and this node is no longer in the new response. Shown dimmed. Retained for one refresh cycle then purged unless the user snapshotted.

Users can see exactly what the client knows vs. does not. No false authority.

## Operations on the tree

| Operation | Behavior |
|---|---|
| Expand / collapse | Keyboard: Right/Left. Mouse: click caret. |
| Navigate | Up/Down arrows. Home/End jump to first/last sibling. |
| Copy path | Right-click → Copy path. Dotted-notation form. |
| Copy value | Right-click → Copy value. For SV: raw value. For P/PL/VL: JSON subtree. |
| Reveal in snapshot diff | Right-click → Show change history (spec 03). |
| Reveal view binding | Right-click → Jump to Current View (if this property is bound). |
| Focus | Click to select. Breadcrumb updates. |

## Out of scope (Day 1)

- Editing values. The tree is read-only.
- Triggering DX calls from the tree (e.g., clicking a data page to refresh). Covered in Refresh UI, spec 05.
- Custom groupings (user-defined folders). Not in v1.
- Property annotations (notes, bookmarks). Not in v1.

## Related specs

- [01 Capture layer](./01-capture-layer.md) — upstream event producer.
- [03 Snapshot & diff](./03-snapshot-diff.md) — operates on tree state.
- [04 Search](./04-search.md) — operates on tree nodes.
- [05 UX surface](./05-ux-surface.md) — how the tree is rendered.
- [10 Decisions](./10-decisions.md) — assignment nesting decision, Current View identification.
