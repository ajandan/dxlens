# 11 — Risks

## Purpose

Risk register. Each risk has an impact, likelihood, mitigation, and owner. Reviewed at milestone gates.

## Scoring

| Impact | Meaning |
|---|---|
| H | Breaks a core guarantee or blocks a release. |
| M | Degrades quality or delays a milestone meaningfully. |
| L | Annoying, fixable post-release. |

| Likelihood | Meaning |
|---|---|
| H | Expected to happen. |
| M | Plausible. |
| L | Possible but not anticipated. |

## Register

### R-001 — Pega changes DX API shape in future Infinity release

**Impact:** H · **Likelihood:** H (inevitable, on some timescale)

**Description:** Pega ships new Infinity versions annually. DX API v2 payload shapes evolve. The tree-merge layer assumes specific response structures.

**Mitigation:**
- Tree-merge rules are centralized in one module with explicit version branches.
- KB entries (Day 2) carry `applies_to_pega_versions` metadata.
- Document supported Pega versions per extension release.
- Community contributors can PR merge-rule updates quickly.

**Owner:** AJ (maintainer). Community contributors encouraged.

### R-002 — Constellation uses WebSocket for server-push state

**Impact:** M · **Likelihood:** M

**Description:** In some scenarios Pega pushes updates via WebSocket rather than request/response. These frames are invisible to fetch/XHR interception, leaving a blind spot.

**Mitigation:**
- Evaluate coverage gap during M1 on real traffic.
- If significant, add WebSocket frame inspection in v1.1.
- Document the gap prominently if it persists.

**Owner:** AJ.

### R-003 — Fetch/XHR interception breaks on a Pega release

**Impact:** H · **Likelihood:** L

**Description:** Pega's bundler or React runtime could in principle wrap these globals itself, shadowing our wrappers.

**Mitigation:**
- Periodic re-wrap check detects and re-applies.
- `chrome.debugger` API reserved as emergency fallback (documented, not default).
- Regression test fires a known DX request and verifies event emission at every release.

**Owner:** AJ.

### R-004 — CSP on Pega pages blocks script injection

**Impact:** M · **Likelihood:** L

**Description:** Customer deployments may set strict CSP that blocks dynamic `<script>` insertion.

**Mitigation:**
- Use web-accessible resources for `injected.js` (`<script src>` instead of inline).
- Document the requirement in troubleshooting.

**Owner:** AJ.

### R-005 — Extension conflicts with other Pega-aware or developer-oriented extensions

**Impact:** L · **Likelihood:** M

**Description:** Multiple extensions wrapping fetch/XHR can interfere with each other.

**Mitigation:**
- Defensive wrapping: detect existing wrappers and preserve chain.
- Unique namespace (`__dxlens__`) in postMessages.
- Document known-conflict extensions in troubleshooting.

**Owner:** AJ.

### R-006 — Pega legal pushback on naming or positioning

**Impact:** M · **Likelihood:** L

**Description:** Use of "Pega" in descriptions, even nominally, could draw trademark complaints.

**Mitigation:**
- Name is DX Lens (not Pega-trademarked).
- Description uses "Pega" descriptively (nominative fair use).
- No Pega logos, trademarks, or official assets.
- Disclaimer: "Not affiliated with Pegasystems Inc."

**Owner:** AJ. Legal review before CWS submission.

### R-007 — LLM hallucinates Pega behavior (Day 2)

**Impact:** M · **Likelihood:** H (without KBs); M (with KBs)

**Description:** Base LLMs know little about Pega. Answers may be confident and wrong.

**Mitigation:**
- Citation requirement: every claim cites a clipboard path or KB entry. Uncited answers are a quality bug.
- KB grounding: knowledge base retrieval supplies Pega-specific context.
- Explain-only scope: wrong explanations are recoverable; wrong actions are not.
- In-UI disclaimer that the copilot is an assistant, not authoritative.

**Owner:** AJ.

### R-008 — Chrome Web Store rejects `<all_urls>` permission

**Impact:** H · **Likelihood:** M

**Description:** CWS review scrutinizes broad host permissions. Rejection would block distribution.

**Mitigation:**
- Thorough justification in store listing (see spec 07).
- Privacy guarantees stated prominently.
- "Trust" section in UI visible to reviewers.
- Fallback: user adds specific patterns per install. Acceptable degradation.

**Owner:** AJ. Engage CWS reviewer dialogue early if rejected.

### R-009 — Service worker termination loses in-flight state

**Impact:** L (per-user, per-tab) · **Likelihood:** H (MV3 behavior)

**Description:** MV3 service workers terminate after ~30 s idle. State in memory is lost.

**Mitigation:**
- Panel reconnect triggers `tree:replace` from whatever survives.
- v1 accepts the limitation and documents it.
- v1.x evaluates `chrome.storage.session` for short-term persistence if users report pain.

**Owner:** AJ.

### R-010 — Open-source bootstrap: no community forms

**Impact:** M (strategic, not product) · **Likelihood:** M

**Description:** Project lives or dies on whether other Pega developers engage. If none do, it remains a solo tool.

**Mitigation:**
- Demo GIF in README. Screenshots of the "aha" moments (snapshot diff).
- LinkedIn posts at each milestone, written for Pega audience.
- Pega community channels (LinkedIn groups, community forums).
- Clear `CONTRIBUTING.md` with `good-first-issue` labels.
- Seed KB (v2) doubles as content strategy.

**Owner:** AJ.

### R-011 — Scope creep in v1

**Impact:** M · **Likelihood:** H (always)

**Description:** Temptation to add features during M3 delays v1.0. "Just one more thing" is the default failure mode for open-source tools.

**Mitigation:**
- Spec lists non-goals and out-of-scope items explicitly.
- Decisions 10 records what was deferred and why.
- v1.0 scope is what's in specs today; deltas require explicit decision records.

**Owner:** AJ.

### R-012 — Local LLM performance on typical developer laptops (Day 2)

**Impact:** M · **Likelihood:** M

**Description:** 7–8B models on mid-range hardware may produce slow, frustrating first-token times.

**Mitigation:**
- Summarize-then-ask strategy keeps prompts small.
- Model picker recommends configurations honestly per task size.
- Documentation acknowledges that experience scales with hardware.
- Fallback: user can point at any OpenAI-compatible endpoint, including a workstation over LAN.

**Owner:** AJ.

## Review cadence

- Risks reviewed at every milestone gate.
- New risks added as they surface. Retired risks archived below the active register with a brief note on resolution.
- No risk is ignored because it's inconvenient. If a risk materializes and the mitigation fails, it's a decision moment (spec 10), not a risk update.

## Related specs

- [09 Milestones](./09-milestones.md) — when risks are reviewed.
- [10 Decisions](./10-decisions.md) — where risk-driven choices are recorded.
- [07 Privacy & security](./07-privacy-security.md) — specific risks around trust model.
