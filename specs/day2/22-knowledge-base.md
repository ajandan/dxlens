# Day 2 · 22 — Knowledge Base

> **Day 2 is not in scope for v1.** This spec is the substrate that makes the copilot Pega-literate.

## Purpose

Provide Pega domain knowledge to the LLM outside the system prompt, so the prompt stays small, the knowledge stays editable by non-experts, and the tool becomes more useful as the community contributes.

## Why a KB instead of a bigger prompt

- **Context budget.** Local 7–8B models have modest usable context. Every token spent on static knowledge is a token not spent on the current clipboard state.
- **Community contribution.** Markdown in `kb/` is PR-able by any Pega developer. Prompts are a maintainer-only surface.
- **Retrieval.** Fetching the 300 most relevant tokens beats stuffing 3,000 tokens of mostly-irrelevant context.
- **Versioning.** KB entries carry `applies_to_pega_versions`; prompts cannot.
- **Reuse.** The KB is an asset beyond the extension. MCP server, CLI tool, human documentation — same source.

## Structure

```
kb/
├── concepts/       evergreen platform vocabulary
│   ├── property-modes.md
│   ├── when-rules.md
│   ├── data-pages.md
│   ├── assignments.md
│   ├── stages-and-steps.md
│   └── ...
├── dx-api/         payload shapes, versioned
│   ├── v2/
│   │   ├── case-response.md
│   │   ├── assignment-response.md
│   │   ├── uiresources.md
│   │   └── ...
│   └── (older versions if ever relevant)
├── patterns/       "when you see X, it usually means Y"
│   ├── empty-dropdown.md
│   ├── submit-disabled.md
│   ├── field-not-visible.md
│   └── ...
└── pitfalls/       Pega-specific gotchas
    ├── clipboard-vs-dx.md
    ├── stale-data-pages.md
    └── ...
```

Four categories, chosen because they behave differently:

- **Concepts** are evergreen (property modes have meant the same thing for 15 years).
- **DX API** is versioned (payload shapes evolve per Infinity release).
- **Patterns** are the high-leverage debugging entries — this is where the community contributes most.
- **Pitfalls** are the crown jewels. Every senior Pega dev has a handful of them; collected in one place, they're novel.

## Entry format

Markdown with lightweight YAML frontmatter:

```markdown
---
title: Why is the Submit button disabled?
category: patterns
tags: [submit, when-rule, disabled, stage-gate]
applies_to_pega_versions: ["23.x", "24.x"]
---

# Why is the Submit button disabled?

When a Submit or next-stage action is disabled in a Constellation UI,
the cause is almost always one of:

1. A **when-rule** gating the action evaluates to false. Look in
   the case response at `uiResources.rules` for rules referenced by
   the action's configuration.

2. The **current stage** does not permit the action. Stages carry
   allowed actions; verify `caseInfo.content.pyWorkStatus` and the
   stage's action list.

3. The user's **access group** lacks privilege. This is invisible
   to the client; look at the response's `caseInfo.accessInfo`
   if provided.

4. A required field is unfilled. When-rules often check for
   completeness.

## How to debug

- Inspect the action definition: [clipboard: caseInfo.content.actions]
- Check the current stage: [clipboard: caseInfo.content.CurrentStage]
- Look for referenced rules in: [clipboard: uiResources.rules]
- Compare a "Before" snapshot (when enabled) against "After" (when disabled) to see what changed.

## Common false trails

- Client-side disabling in React state without a server-side reason.
  Rare, but possible in custom components.
- Network errors that leave the UI in a partial state. Check the
  capture log for recent failed DX calls.
```

Frontmatter fields:

| Field | Required | Purpose |
|---|---|---|
| `title` | yes | Display title; also primary search match target. |
| `category` | yes | One of `concepts`, `dx-api`, `patterns`, `pitfalls`. |
| `tags` | yes | Array of keywords for retrieval. |
| `applies_to_pega_versions` | yes | Array of version globs. |
| `deprecated_in` | no | Version where the knowledge stopped applying, if any. |
| `author` | no | Optional credit. |

## Retrieval

### v2.0: BM25 keyword retrieval

- Index built at extension load time. ~1 second on a 100-entry KB.
- Index fields: title (weight 3), tags (weight 2), body (weight 1).
- Query normalization: lowercasing, stopword removal, stemming (Porter).
- Returns top 5 results with scores; LLM picks and fetches via `kb_fetch`.

Advantages: no model download, in-process, good enough for Pega-vocabulary questions.

### v2.x: optional local embeddings

- Downloaded on first activation (opt-in): a small embedding model (~50–100 MB).
- Vector store in-memory, rebuilt on KB update.
- Returns top 5 results with cosine similarity.
- Better for questions phrased in non-Pega vocabulary ("why can't I continue" → retrieves `patterns/submit-disabled.md`).

`kb_search` contract remains identical; implementation swaps underneath.

## Distribution

### v2.0: bundled with extension

- KB ships as part of the extension package.
- Updates require extension release.
- Acceptable while the seed set is small and stable.

### v2.1+: external `dx-lens-kb` repo

- Standalone repo with its own README, contribution guide, review process.
- Extension fetches from the repo at install time or on manual refresh.
- Trust model: fetch is from a known pinned commit; updates require user approval.
- Licensing: CC-BY 4.0 throughout (separate from extension's MIT code license).

Transition happens when the KB outgrows maintainer-driven updates.

## Seed content

Before v2.0 ships, the maintainer writes 15–20 high-signal entries:

**Concepts (5):**
- Property modes (SV / P / PL / VL)
- Data pages (scope, load, refresh)
- When-rules
- Assignments and routing
- Stages and steps

**DX API (4):**
- Case response structure
- Assignment response structure
- Data view response structure
- uiResources resource layout

**Patterns (6):**
- Submit disabled
- Field not visible
- Empty dropdown
- Stale data page
- Unexpected stage transition
- Validation error without visible field

**Pitfalls (3):**
- Clipboard (server) vs DX response (client) — why they differ
- Missing in response ≠ missing on server
- Parameterized data pages appearing duplicated

Seed content is also publishable independently (LinkedIn posts, blog content) — dual purpose.

## Contribution model

- New entries as PRs into the KB location.
- Each entry reviewed for: correctness, citation discipline (KB entries themselves should cite clipboard paths where applicable), formatting, scope (one concept per entry, not mini-books).
- Contributors credited in frontmatter if they opt in.
- KB entries can link to each other: `see also [data-pages](../concepts/data-pages.md)`.

## Governance

- Maintainer has final merge authority.
- Disputed entries can stay open for community discussion; no rush.
- Incorrect entries are patched or removed; wrong knowledge is worse than no knowledge.

## Out of scope

- Wiki-style free-edit model. GitHub PR flow is the review surface.
- Video or rich media content. Markdown only.
- Localization of KB content in v2.0. Community can propose in v2.1.
- Automatic generation from Pega documentation. Copyright and quality concerns; human-curated only.

## Related specs

- [Day 2 · 21 Tool layer](./21-tool-layer.md) — `kb_search` and `kb_fetch` tools.
- [Day 2 · 20 LLM integration](./20-llm-integration.md) — how KB entries enter the prompt.
- [Day 2 · 23 Chat UX](./23-chat-ux.md) — how KB citations are rendered and linked.
