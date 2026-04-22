# Security policy

DX Lens is a local-only developer tool. Its privacy and read-only guarantees
are product features, not implementation details — the threat model is stated
in [`specs/07-privacy-security.md`](./specs/07-privacy-security.md) and the
no-outbound rule is enforced at test time
([`tests/no-egress.test.js`](./tests/no-egress.test.js)).

## Reporting a vulnerability

Please report suspected vulnerabilities **privately**. Do not open a public
GitHub issue for security reports.

- Email: `agentic.aismith@gmail.com`, subject `[DX Lens Security]`.
- Include: affected version, reproduction steps, impact analysis, proposed fix
  if any.
- Response SLA: an initial acknowledgment within 5 business days.
- Embargo: coordinated disclosure with a 14-day window for the maintainer to
  patch before public disclosure. Extensions possible if the fix is complex,
  agreed with the reporter.

## In scope

- The extension as shipped through the Chrome Web Store or loaded unpacked
  from this repository.
- The tool-layer contract in `src/state/tools.js`.
- Any path that could cause the extension to make outbound network requests,
  persist captured data, or modify requests or responses.
- XSS or prototype-pollution vectors in the panel triggered by attacker-shaped
  DX payloads.

## Out of scope

- Issues that depend on a malicious Chrome build or a compromised host system.
- Reports that amount to "the extension sees data it is attached to" — that is
  the design; host permission is documented in
  [`specs/07-privacy-security.md`](./specs/07-privacy-security.md).
- Feature requests framed as security reports.

## Non-goals

- No bug-bounty programme. This is a side project with no budget.
- No security researcher hall of fame (yet). Credit in release notes on
  request.

## Cryptographic verification

Releases are unsigned through Chrome Web Store but git tags are annotated.
Clone the repository, verify the tag, and check the source against a pinned
release commit if you need integrity beyond the Chrome Web Store.
