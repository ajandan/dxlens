// Auto-snapshot detector (spec/03 §Auto-snapshot, O-005).
// Pure classifier: given a CaptureEvent, decide whether it is a "submit-like"
// user action that should bracket the tree state with before/after snapshots.
// The SW decides whether to actually snapshot (gated by a setting); this
// module only answers the question.

const CASE_POST_RE       = /\/api\/(?:application\/)?v\d+\/cases(?:\/([^/?#]+))?(?:\/|$|\?|#)/i;
const ASSIGN_ACTION_RE   = /\/api\/(?:application\/)?v\d+\/assignments\/([^/?#]+)\/actions\/[^/?#]+/i;
const CASE_PATCH_RE      = /\/api\/(?:application\/)?v\d+\/cases\/([^/?#]+)(?:\/|$|\?|#)/i;

/**
 * @typedef {{ submitLike: boolean, kind?: 'create'|'patch'|'assignment_action', caseId?: string, assignmentId?: string }} SubmitClass
 */

/**
 * @param {{ url: string, method: string, kind?: string }} event
 * @returns {SubmitClass}
 */
export function classifySubmit(event) {
  if (!event || event.kind !== 'dx_response') return { submitLike: false };
  const url = event.url || '';
  const method = (event.method || 'GET').toUpperCase();

  // Assignment action (Approve, Submit, etc.) — POST /assignments/<id>/actions/<name>.
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    const m = ASSIGN_ACTION_RE.exec(url);
    if (m) return { submitLike: true, kind: 'assignment_action', assignmentId: decodeURIComponent(m[1]) };
  }

  // Case patch — PATCH /cases/<id>.
  if (method === 'PATCH' || method === 'PUT') {
    const m = CASE_PATCH_RE.exec(url);
    if (m) return { submitLike: true, kind: 'patch', caseId: decodeURIComponent(m[1]) };
  }

  // Case creation — POST /cases (optionally with a caseId slug).
  if (method === 'POST') {
    const m = CASE_POST_RE.exec(url);
    if (m && !ASSIGN_ACTION_RE.test(url)) return { submitLike: true, kind: 'create', caseId: m[1] ? decodeURIComponent(m[1]) : undefined };
  }

  return { submitLike: false };
}
