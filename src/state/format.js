// Display formatters. Pure, no DOM. Shared between panel rendering and any
// copy-to-clipboard / export paths. Source of truth for how values stringify.

import { isUnsafeKey } from './safe-keys.js';

/** Format a Single-Value node's value for inline tree display. */
export function formatSvValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

/**
 * Project a node subtree to a plain JS value (SV → primitive, P → keyed
 * object, PL/VL → array). Matches copy.copyValue but lives here so panel
 * doesn't pull in the copy module.
 */
export function nodeToPlain(node) {
  if (!node) return null;
  if (node.mode === 'SV') return node.value == null ? null : node.value;
  const children = node.children || [];
  if (node.mode === 'PL' || node.mode === 'VL') return children.map(nodeToPlain);
  const out = {};
  for (const c of children) {
    if (isUnsafeKey(c.name)) continue;
    out[c.name] = nodeToPlain(c);
  }
  return out;
}

/** JSON rendering of a node subtree; indent default 2. */
export function nodeToJson(node, indent = 2) {
  return JSON.stringify(nodeToPlain(node), null, indent);
}

/** Short label for a row in the events list or breadcrumb. */
export function shortLabel(ev) {
  if (!ev) return '';
  if (ev.kind === 'dx_error') return ev.error || 'error';
  if (ev.bodyUnavailable) return '(binary / unavailable)';
  if (ev.responseBody == null) return '';
  if (typeof ev.responseBody === 'string') return ev.responseBody.slice(0, 200);
  try {
    const keys = Object.keys(ev.responseBody);
    return '{ ' + keys.slice(0, 6).join(', ') + (keys.length > 6 ? ', \u2026' : '') + ' }';
  } catch { return ''; }
}

/** Bytes → B / KB / MB string. */
export function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** HH:MM:SS.mmm in local time. */
export function fmtTime(ms) {
  const d = new Date(ms);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
