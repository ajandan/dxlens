# Day 2 · 21 — Tool Layer (Extended)

> **Extends the v1 tool layer contract defined in [06 Architecture](../06-architecture.md).** No new contract is invented here; the v1 primitives are externalized to the LLM.

## Purpose

Expose the read-only tool primitives to the LLM as callable functions. The same interface that serves v1's panel rendering serves v2's copilot — the only difference is the caller.

## Principles

1. **Reuse v1 contracts.** No duplicate definitions. If the panel uses `get_node(path)`, the LLM uses `get_node(path)`.
2. **Read-only, permanently.** No `set_property`, no `trigger_action`, no `open_in_studio`. The threat model depends on this.
3. **Schemas are OpenAI-function-calling-compatible.** Portable to any tool-capable LLM without per-model glue.
4. **Idempotent and side-effect-free.** Calling a tool never mutates the tree, never issues network requests, never writes to disk.

## Tool catalog

Grouped by purpose. All tools are read-only.

### Tree navigation

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `get_tree` | none | `TreeNode` (root) | Full current tree. Large; prefer targeted tools. |
| `get_node` | `{ path: string }` | `TreeNode \| null` | Fetch a subtree by dotted path. |
| `list_cases` | none | `Array<{ id, className, lastUpdated }>` | Enumerate known cases. |
| `list_data_pages` | none | `Array<{ name, lastUpdated, paramHash? }>` | Enumerate known data pages. |
| `get_operator` | none | `TreeNode` | Operator subtree. |
| `get_current_view` | none | `TreeNode \| null` | Current view subtree. |

### Search and binding

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `search_clipboard` | `{ query: string, scope?: 'all' \| 'current-case' \| 'current-view' \| 'data-pages' \| 'operator' }` | `Array<{ path, name, valueSnippet, mode }>` | Substring search, scoped. |
| `get_field_binding` | `{ fieldName: string, caseId?: string }` | `BindingInfo \| null` | Trace a UI field to its data binding. |

### Snapshots

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `list_snapshots` | none | `Array<{ id, label, createdAt }>` | Enumerate retained snapshots. |
| `get_snapshot` | `{ id: string }` | `Snapshot \| null` | Fetch a snapshot. |
| `diff_snapshots` | `{ a: string, b: string, scope?: string }` | `DiffResult` | Compute diff. |

### Knowledge base

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `kb_search` | `{ query: string, category?: 'concepts' \| 'dx-api' \| 'patterns' \| 'pitfalls' }` | `Array<{ path, title, excerpt, score }>` | Keyword search over bundled KB. |
| `kb_fetch` | `{ path: string }` | `{ path, title, content }` | Fetch full KB entry markdown. |

## Tool schema example (OpenAI function calling)

```json
{
  "type": "function",
  "function": {
    "name": "get_node",
    "description": "Fetch a subtree of the Pega clipboard by dotted path (Pega-style, 1-indexed for arrays). Returns null if the path does not exist.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Pega dotted path. Examples: 'Cases[WORK-123].content.Customer', '.Customer.Address(1).City'."
        }
      },
      "required": ["path"]
    }
  }
}
```

Schemas for all tools live in `src/llm/tools.schema.json`, generated from the TypeScript definitions in `src/tools/`.

## Invocation mechanics

1. The LLM issues a tool call (OpenAI-style `tool_calls` array).
2. The chat controller parses the call, looks up the implementation in the v1 tool layer, and invokes it synchronously.
3. The result is returned to the LLM as a tool message.
4. The LLM continues reasoning, optionally calling more tools.
5. The chat controller enforces a cap: **maximum 6 tool calls per user question** in v2.0 (configurable). Prevents runaway loops.

## Citation generation

When the LLM's answer references data fetched via a tool, the chat renderer (spec 23) converts tool-traced facts into citations:

- Facts from `get_node`, `list_*`, `search_clipboard` → `[clipboard: <path>]`.
- Facts from `get_snapshot`, `diff_snapshots` → `[snapshot: <label>]`.
- Facts from `kb_fetch` → `[kb: <path>]`.

The citation rendering is deterministic: the tool call's return path becomes the citation target. This removes a whole class of "LLM cites wrong source" bugs.

## Error contract

Each tool may return an error:

```ts
type ToolError = { ok: false; error: string; code: 'NOT_FOUND' | 'INVALID_ARG' | 'OUT_OF_SCOPE' | 'INTERNAL' };
```

- `NOT_FOUND`: path/id doesn't exist. LLM should acknowledge absence to the user, not confabulate.
- `INVALID_ARG`: malformed input (e.g., bad path syntax). LLM should retry with corrected input.
- `OUT_OF_SCOPE`: the tool was called for something it can't do (defensive; should not happen with a correct schema).
- `INTERNAL`: unexpected failure. Rare; surfaced to the user.

## Testing

Every tool has:

- Unit tests against synthetic trees and snapshots.
- Contract tests that verify the schema matches the implementation signature.
- Smoke tests invoked by the chat controller with a stub LLM to verify end-to-end shape.

## Non-goals (permanent)

- **No write tools.** Ever. Forks can add them; the upstream project will not.
- **No tools that issue DX API calls.** The extension observes; it does not originate. Refresh in v1 is UI-initiated, not LLM-initiated.
- **No tools that access other browser state** (tabs, cookies, storage outside the extension).

## Related specs

- [06 Architecture](../06-architecture.md) — the v1 tool layer contract this extends.
- [Day 2 · 20 LLM integration](./20-llm-integration.md) — the caller.
- [Day 2 · 22 Knowledge base](./22-knowledge-base.md) — the target of `kb_search` / `kb_fetch`.
- [Day 2 · 23 Chat UX](./23-chat-ux.md) — citation rendering.
