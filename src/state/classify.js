// Pure URL/body classifier for DX API events (spec/02 §Merge rules).
// Maps a CaptureEvent to a semantic kind and the ids needed to place it in the tree.

import { isUnsafeKey } from './safe-keys.js';

/** Defensive decodeURIComponent: invalid percent sequences fall back to raw input. */
function tryDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

const CASE_RE       = /\/api\/(?:application\/)?v\d+\/cases\/([^/?#]+)(?:\/|$|\?|#)/i;
const ASSIGNMENT_RE = /\/api\/(?:application\/)?v\d+\/assignments\/([^/?#]+)(?:\/|$|\?|#)/i;
const DATAVIEW_RE   = /\/api\/(?:application\/)?v\d+\/data[_-]?views\/([^/?#]+)(?:\/|$|\?|#)/i;
const VIEW_RE       = /\/api\/(?:application\/)?v\d+\/(?:[^/]+\/)+views\/([^/?#]+)(?:\/|$|\?|#)/i;

/**
 * @param {{ url: string, method: string, requestBody?: any, responseBody?: any }} ev
 * @returns {{
 *   kind: 'case'|'assignment'|'data_view'|'view'|'other',
 *   caseId?: string,
 *   className?: string,
 *   assignmentId?: string,
 *   dataPageName?: string,
 *   paramHash?: string,
 *   viewId?: string,
 *   isPatch: boolean
 * }}
 */
export function classify(ev) {
  const url = ev && ev.url ? ev.url : '';
  const method = (ev && ev.method) ? ev.method.toUpperCase() : 'GET';
  const isPatch = method === 'PATCH' || method === 'PUT' || method === 'POST';

  // View must be tested before case: `/cases/X/views/Y` matches both, view is more specific.
  let m = VIEW_RE.exec(url);
  if (m) return { kind: 'view', viewId: tryDecode(m[1]), isPatch };

  m = ASSIGNMENT_RE.exec(url);
  if (m) return { kind: 'assignment', assignmentId: tryDecode(m[1]), isPatch };

  m = DATAVIEW_RE.exec(url);
  if (m) {
    const paramHash = hashParams(ev.requestBody) || hashQuery(url);
    return { kind: 'data_view', dataPageName: tryDecode(m[1]), paramHash, isPatch };
  }

  m = CASE_RE.exec(url);
  if (m) {
    return {
      kind: 'case',
      caseId: tryDecode(m[1]),
      className: extractClassName(ev.responseBody),
      isPatch
    };
  }

  return { kind: 'other', isPatch };
}

function extractClassName(body) {
  if (!body || typeof body !== 'object') return undefined;
  return (
    body.pyClassName ||
    body.className ||
    (body.data && (body.data.pyClassName || body.data.className)) ||
    (body.caseInfo && (body.caseInfo.pyClassName || body.caseInfo.className)) ||
    (body.data && body.data.caseInfo && (body.data.caseInfo.pyClassName || body.data.caseInfo.className)) ||
    undefined
  );
}

function hashParams(body) {
  if (!body || typeof body !== 'object') return undefined;
  try {
    const s = JSON.stringify(body);
    if (!s || s === '{}' || s === '[]') return undefined;
    return djb2(s);
  } catch { return undefined; }
}

function hashQuery(url) {
  const q = url.indexOf('?');
  if (q < 0) return undefined;
  return djb2(url.slice(q + 1));
}

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Operator-field pickers — loose, covers common DX v2 shapes.
const OPERATOR_KEYS = ['pxRequestor', 'operator', 'userInfo', 'user'];

export function extractOperator(body) {
  if (!body || typeof body !== 'object') return null;
  for (const k of OPERATOR_KEYS) {
    if (body[k] && typeof body[k] === 'object') return normalizeOperator(body[k]);
  }
  if (body.data && typeof body.data === 'object') return extractOperator(body.data);
  return null;
}

function normalizeOperator(raw) {
  const out = {};
  const mapping = {
    userID:       ['userID', 'pyUserIdentifier', 'id', 'email'],
    accessGroup:  ['accessGroup', 'pyAccessGroup', 'pxAccessGroup'],
    application:  ['application', 'pyApplication', 'pxApplication']
  };
  for (const [canonical, candidates] of Object.entries(mapping)) {
    for (const c of candidates) {
      if (typeof raw[c] === 'string' && raw[c]) { out[canonical] = raw[c]; break; }
    }
  }
  // Carry through any other primitive fields for visibility; skip nested objects
  // to keep the node shallow and reject prototype-pollution keys.
  for (const [k, v] of Object.entries(raw)) {
    if (isUnsafeKey(k)) continue;
    if (out[k] != null) continue;
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
