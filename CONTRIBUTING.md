# Contributing to DX Lens

Welcome. This project is designed to stay small, auditable, and focused. A
few conventions keep it that way.

## Before you start

- Read the spec you intend to touch under
  [`specs/`](./specs/) — architectural decisions and non-goals are stated
  plainly there. Start with
  [`specs/index.md`](./specs/index.md).
- Check [`TRACKER.md`](./TRACKER.md) to see per-module state and the open
  decision register.
- If you're proposing a change that deviates from a settled decision in
  [`specs/10-decisions.md`](./specs/10-decisions.md), open an issue first.

## Sign-off (DCO)

Every commit must carry a `Signed-off-by:` trailer (Developer Certificate of
Origin). `git commit -s -m "…"` does this for you. No CLA.

## Commit messages

- Short imperative subject (≤ 72 chars).
- Reference the spec section in the subject or body:
  `feat(tree): add property mode inference (spec/02 §4)`.
- Body explains the *why*, not the *what* — the diff already shows what
  changed.

## Running the test suite

Node 18+ required. No npm install, no build step.

```bash
for f in tests/*.test.js; do node "$f" || exit 1; done
```

All suites must pass before you open a PR. Release gates are enforced by
specific suites — see the README for the list.

## Conventions

- **Pure modules under `src/state/`.** No DOM, no `chrome.*`. If a module
  needs wall-clock time, accept a clock as an argument so tests can inject a
  fake.
- **Text-only rendering.** Never `innerHTML` captured data. All panel values
  go through `textContent` or structured DOM construction.
- **No outbound network calls** from any extension-context code. The source
  scanner (`tests/no-egress.test.js`) fails the build if a new one appears.
  The only outbound-shaped call the panel makes is a GET re-issued in the
  inspected page's own context via `chrome.devtools.inspectedWindow.eval`,
  allow-listed inside `refreshInPage`.
- **Zero persistent storage of captured data.** `chrome.storage.local` is
  reserved for user preferences.
- **Tracker.** Any new module under `src/state/` or new test suite requires a
  row in [`TRACKER.md`](./TRACKER.md) or the `tracker` suite fails.

## Proposing a spec change

1. Open an issue tagged `spec-change` describing the proposal and the option
   space.
2. Update the relevant spec(s), `specs/dependencies.md`, and add a record to
   `specs/10-decisions.md` if a settled decision is being altered.
3. In the PR, cite the issue number and spec section.

Breaking changes to the tool-layer contract (spec/06) require a `MAJOR`
version bump. Breaking changes to captured-event shape require a `MAJOR` bump
and a migration note in the release.

## Code review

A PR is ready when:

- Suites pass locally (including release gates).
- Commit history is tidy (squash if helpful).
- `TRACKER.md` reflects any added module or suite.
- The PR description references the relevant spec section and the issue (if
  any).

Thank you for helping keep DX Lens small and trustworthy.
