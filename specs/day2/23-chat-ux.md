# Day 2 · 23 — Chat UX & Citations

> **Day 2 is not in scope for v1.**

## Purpose

Define the user-facing chat experience. The chat is a second primary surface alongside the tree — not a sidebar afterthought. Its UX quality determines whether developers actually adopt the copilot.

## Layout

The v2 panel layout extends v1's:

```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar  [Live / Pause]  [📷]  [🔍...]    [💬 Ask]  [⚙]     │
├───────────────┬──────────────────────────┬───────────────────┤
│ Tree          │ Detail                   │ Chat              │
│               │                          │                   │
│ 📋 Clipboard  │ Property: .Customer.Name │ ┌─────────────┐   │
│ ├─📄 Cases    │ Mode: SV · Type: string  │ │ Ask a       │   │
│ │  └─WORK-123 │ Value: "AJ"              │ │ question... │   │
│ ...           │                          │ └─────────────┘   │
│               │                          │                   │
│               │                          │ 🤖 Submit is...   │
│               │                          │    disabled       │
│               │                          │    because...     │
│               │                          │                   │
└───────────────┴──────────────────────────┴───────────────────┘
```

Three panes, split roughly 35/35/30 (resizable). The chat pane is toggleable — hidden by default for users who want v1 behavior; shown on click of the `💬 Ask` toolbar button or keyboard shortcut `Alt+/`.

## Chat input

- Single textarea, auto-resizing up to 6 lines, then scrolls.
- `Enter` sends. `Shift+Enter` newline.
- Placeholder cycles example prompts: "Why is Submit disabled?", "What changed between snapshots?", "Where does this field's value come from?"
- Small context indicator below input: "Current case: WORK-123 · 2 snapshots available". Tells the user what the LLM sees.

## Message rendering

### User message

Plain text, right-aligned, subtle background. No formatting.

### Assistant message

Streamed token-by-token as the LLM emits. Rendered with:

- **Inline markdown** — `**bold**`, `*italic*`, backticks for code, bulleted lists.
- **Citations as pills** — `[clipboard: .Customer.Status]` renders as a clickable pill with an icon (clipboard icon for clipboard citations, book icon for KB citations, camera icon for snapshot citations).
- **Code blocks** — rendered with monospace but **no syntax highlighting library** in v2.0 to keep the bundle small.
- **Thinking indicator** — if the LLM is making tool calls mid-response, a subtle "Checking clipboard..." line appears between the user message and the final answer.

### Citation behavior

Clicking a citation pill:

- `[clipboard: <path>]` → Tree pane jumps to and highlights that node.
- `[kb: <path>]` → Slides out a drawer from the right with the KB entry's rendered markdown. Drawer dismissible with `Esc`.
- `[snapshot: <label>]` → Enters Compare mode with that snapshot pre-selected as A.

Hovering a pill:

- Shows a tooltip with the raw path or KB title.
- Subtly highlights the target in the tree (if a clipboard citation), previewing the jump.

## Uncited claims

Claims in an assistant response that don't trace to a tool call are flagged. Two approaches:

- **v2.0 (strict):** System prompt instructs the LLM to refuse to make claims without citations. If it does anyway, post-process strips them and adds a quiet note: "Some content was removed because it wasn't traceable to clipboard or KB. This is a safety measure."
- **v2.x (nuanced):** Uncited claims are allowed but visually marked (italic, lighter color). User judgment applies.

v2.0 ships strict. Experience will inform v2.x.

## Follow-up questions

Chat is single-turn in v2.0 — each question is independent. No conversation memory carries into the next prompt.

**Why:** local LLMs on consumer hardware degrade noticeably with longer contexts. Single-turn keeps quality and latency consistent.

**Exception:** a "Try again with more context" button under each assistant message re-runs with the previous question plus the pinned node(s) the user selected. Effectively a controlled, one-shot memory.

## Pinning clipboard nodes to the question

Right-click a tree node → "Add to next question". The node's path is pinned below the chat input as a chip. The pinned node(s) are injected into the digest as priority context.

This is the bridge between the tree UX and the chat UX: the user curates context instead of the LLM guessing.

## Empty state & onboarding

First time the chat pane opens:

- Endpoint status check: "Connected to Ollama at http://localhost:11434" (green) or "Not reachable" (red with link to setup docs).
- Model picker if multiple models detected.
- Three example questions, each clickable to auto-fill the input.
- One-line reminder: "Your clipboard contents never leave your machine."

## Progress and cancellation

- Streaming responses show a subtle cursor at the end.
- A "Stop" button replaces the send button while streaming; click cancels the LLM call and preserves the partial response marked as incomplete.
- Timeout default 60 s, configurable.

## Accessibility

- Chat history is a live region (`aria-live="polite"`) so screen readers announce new messages.
- Citation pills are real buttons with accessible names.
- Keyboard navigation between messages with `Alt+↑` / `Alt+↓`.
- Reduced motion disables streaming animation (message appears whole when complete).

## Error states

| Condition | Display |
|---|---|
| LLM endpoint unreachable | Message bubble with clear error + link to settings. |
| Model unavailable | Specific message with the exact `ollama pull` command. |
| Tool call failed | Inline notice: "Couldn't fetch \<target\> — proceeding without it." |
| Budget exceeded | Message: "Response was too long. Try a narrower question." |

Errors are informational, not modal. The user stays in the flow.

## Keyboard shortcuts (chat-specific)

| Shortcut | Action |
|---|---|
| `Alt+/` | Toggle chat pane. |
| `Enter` (in input) | Send. |
| `Shift+Enter` | Newline. |
| `Esc` (in drawer) | Close KB drawer. |
| `Alt+↑` / `Alt+↓` | Previous / next message. |

## Out of scope (v2.0)

- Conversation threads (multi-turn with memory).
- Voice input.
- Exporting chat transcripts.
- Suggested follow-up questions generated by the LLM.
- Rich media in responses (images, tables rendered from data).

## Out of scope (permanent)

- Action buttons in chat responses ("Click here to fix"). The LLM does not act. (Spec 05 and 10.)

## Related specs

- [Day 2 · 20 LLM integration](./20-llm-integration.md) — the engine behind this UI.
- [Day 2 · 21 Tool layer](./21-tool-layer.md) — the tools whose results become citations.
- [Day 2 · 22 Knowledge base](./22-knowledge-base.md) — KB content surfaced via citation pills.
- [05 UX surface](../05-ux-surface.md) — the v1 layout this extends.
