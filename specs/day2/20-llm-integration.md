# Day 2 · 20 — LLM Integration

> **Day 2 is not in scope for v1.** This spec exists so v1 architecture doesn't foreclose it.

## Purpose

Integrate a local LLM so developers can ask natural-language questions about the clipboard state and get Pega-literate explanations grounded in the tree and the knowledge base.

## Principles

1. **Local only.** The LLM endpoint runs on the user's machine (Ollama, LM Studio, llama.cpp server) or on their LAN. No hosted model support, ever. Clipboard contents never leave the user's control.
2. **Explain, not act.** The LLM answers questions. It does not suggest rule changes, does not execute DX calls, does not modify state. Tool layer (spec 21) enforces this by exposing only read primitives.
3. **Cited or silent.** Every claim cites a clipboard path or KB entry. Uncited claims are a quality bug.
4. **Usable on a laptop.** Default context strategy must work on 7–8B models. Bigger models get a better experience, not a different product.

## LLM endpoint

- **Default:** `http://localhost:11434/v1/chat/completions` (Ollama's OpenAI-compatible endpoint).
- **Configurable** in settings: full URL + optional API key header. Extension supports any OpenAI-Chat-Completions-compatible endpoint.
- **Security:** CSP is extended (spec 07) to allow `connect-src` to the configured endpoint. Default remains localhost; users may widen if they point at a LAN workstation.

## Model picker

- Extension detects installed models if the endpoint is Ollama (using `GET /api/tags`).
- Dropdown lists detected models; free-text entry available for non-Ollama endpoints.
- Per-model recommendation hints shown alongside: `Phi-3 Mini (fast, small context)`, `Llama 3.1 8B (recommended)`, `Qwen 2.5 14B (tool-use capable)`.
- User's choice is persisted in settings per endpoint.

## Context strategy

### v2.0: summarize-then-ask

The extension prepares a compact context packet before sending the question to the LLM:

```
SYSTEM_PROMPT (static)
CLIPBOARD_DIGEST (dynamic, derived from current tree)
  - Active case(s): id, class, current stage, current assignment
  - Recent deltas: last 5 property changes with before/after
  - Current view: fields, visibility, any disabled controls
  - Data pages in scope: names, sizes, last updated
RELEVANT_KB_ENTRIES (dynamic, retrieved via kb_search against the question)
  - 1–3 entries, full markdown
USER_QUESTION
```

Digest target size: ~2,000 tokens. KB entries target ~1,000 tokens. Leaves headroom even on small context windows.

If the question clearly needs a deeper field the digest omitted, the response includes a note: "I don't see X in the summary; expand the \<relevant node\> and re-ask." In v2.0 this is human-in-the-loop; in v2.x (tool-use mode) the LLM fetches it itself.

### v2.x: tool-use

For LLMs that reliably call tools (Llama 3.1 8B/70B, Qwen 2.5, Mistral Nemo, GPT-OSS equivalents), the extension exposes the full tool layer (spec 21) and the LLM navigates the tree itself via `get_node`, `search_clipboard`, `kb_search`, etc.

Toggle between strategies in settings. Tool-use defaults off in v2.0 because not every local model is reliable at it; becomes default at v2.x once field-tested.

## System prompt

Versioned in the repo at `src/llm/prompts/system.md`. Contributors can PR improvements.

Core directives (paraphrased):

- You are a Pega Constellation debugging assistant.
- You analyze the clipboard state provided and explain behavior to a developer.
- You do not suggest changes to rules or data.
- You do not execute actions.
- Cite the clipboard path (`[clipboard: .path]`) or KB entry (`[kb: path/name]`) for every claim.
- If the information is insufficient, say so and suggest what to refresh, click, or populate.
- Use Pega vocabulary: pages, property modes, data pages, when-rules.

System prompt also includes a short Pega glossary (30–50 lines) covering vocabulary base LLMs don't know. KBs (spec 22) carry the deeper knowledge; the glossary is just enough for the LLM to understand the *digest* it's reading.

## Streaming

- Responses stream token by token where the endpoint supports it.
- Chat UI renders progressively (spec 23).
- Citations are parsed and linkified as they arrive.

## Error handling

| Error | Behavior |
|---|---|
| Endpoint unreachable | Non-modal toast: "Local LLM not reachable. Check \<endpoint\>." Link to settings. |
| Model not installed (Ollama) | Toast with the exact `ollama pull <model>` command. |
| Token budget exceeded | Retry with a smaller digest (top-3 recent deltas instead of top-5). Tell the user if still too large. |
| Timeout | 60 s default, configurable. Surface as non-fatal. |
| Stream error mid-response | Keep the partial answer visible, mark as incomplete, offer retry. |

## Privacy boundary (reminder from spec 07)

The LLM call is the **only** outbound network activity the extension ever performs. The "Trust" section in the main panel updates to show: "Outbound requests this session: N (local LLM at http://localhost:11434)". Transparent and auditable.

If the user configures a non-localhost endpoint, a one-time confirmation dialog warns that clipboard data will be sent to that address. This confirmation is required; it cannot be skipped via settings.

## Out of scope (v2.0)

- Multi-turn agentic loops (plan → act → observe → repeat). The LLM is single-turn Q&A.
- Conversation memory across questions (each question is independent; UI may show history but no state carries into the next prompt).
- Fine-tuning tooling.
- Hosted/cloud models.

## Related specs

- [Day 2 · 21 Tool layer](./21-tool-layer.md) — the tools available to the LLM.
- [Day 2 · 22 Knowledge base](./22-knowledge-base.md) — the KB the LLM retrieves from.
- [Day 2 · 23 Chat UX](./23-chat-ux.md) — the user-facing chat experience.
- [07 Privacy & security](../07-privacy-security.md) — CSP amendment and trust model.
