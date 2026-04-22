// Copy-path and copy-value primitives (spec/02 §Operations on the tree).
// Pure. The id already carries the dotted 1-indexed Pega path (D-009).

import { isUnsafeKey } from './safe-keys.js';

/**
 * Returns the dotted Pega-style path for a node, or '' for the root.
 * Leading dot is added when the path looks like a top-level property starting
 * with a case/data-page top node, matching classic clipboard expectations.
 */
export function copyPath(node) {
  if (!node || !node.id) return '';
  return node.id;
}

/**
 * Returns a plain JS value representation of the subtree for copy-to-clipboard.
 * SV → primitive value.
 * P   → { [name]: value, … }
 * PL  → [ value_1, value_2, … ]
 * VL  → [ primitive_1, primitive_2, … ]
 * ROOT → same as P (descends into top-level folders).
 */
export function copyValue(node) {
  if (!node) return null;
  if (node.mode === 'SV') return node.value ?? null;
  const children = node.children || [];
  if (node.mode === 'PL' || node.mode === 'VL') {
    return children.map(copyValue);
  }
  // P or ROOT: keyed by child.name. Drop reserved prototype-pollution names.
  const out = {};
  for (const c of children) {
    if (isUnsafeKey(c.name)) continue;
    out[c.name] = copyValue(c);
  }
  return out;
}

/**
 * JSON string form, stable (alphabetized keys within Page nodes), for
 * clipboard-friendly output. Indent default 2.
 */
export function copyValueJson(node, indent = 2) {
  return JSON.stringify(sortKeys(copyValue(node)), null, indent);
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (isUnsafeKey(k)) continue;
      out[k] = sortKeys(v[k]);
    }
    return out;
  }
  return v;
}
