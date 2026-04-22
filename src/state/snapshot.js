// Snapshot + diff (spec/03). Pure; no DOM, no chrome.*.
// Session-scoped, in-memory store (spec/03 §Retention: default cap 5, max 20).

export const DEFAULT_CAP = 5;
export const MAX_CAP = 20;

let now = () => Date.now();
let uid = 0;
export function __setNowForTests(fn) { now = fn; }
export function __resetIdsForTests() { uid = 0; }

function nextId() {
  uid += 1;
  return `snap_${now().toString(36)}_${uid.toString(36)}`;
}

function cloneTree(node) {
  // Structured clone would be ideal; stay explicit for node shape and portability.
  const out = {
    id: node.id,
    name: node.name,
    mode: node.mode,
    sourceUrls: node.sourceUrls ? node.sourceUrls.slice() : [],
    lastUpdated: node.lastUpdated,
    isPartial: !!node.isPartial,
    isStale: !!node.isStale
  };
  if ('value' in node) out.value = node.value;
  if (node.valueType) out.valueType = node.valueType;
  if (node.isTentative) out.isTentative = true;
  if (node.children) out.children = node.children.map(cloneTree);
  return out;
}

export function createSnapshot(tree, { label, eventCount = 0 } = {}) {
  const createdAt = now();
  return {
    id: nextId(),
    label: label || new Date(createdAt).toISOString(),
    createdAt,
    tree: cloneTree(tree),
    eventCount
  };
}

// ---- Store (per-tab factory) ----------------------------------------------

export function createStore({ cap = DEFAULT_CAP } = {}) {
  const items = []; // oldest → newest
  let limit = Math.max(1, Math.min(MAX_CAP, cap));

  return {
    add(snapshot) {
      items.push(snapshot);
      while (items.length > limit) items.shift();
      return snapshot;
    },
    remove(id) {
      const i = items.findIndex((s) => s.id === id);
      if (i < 0) return false;
      items.splice(i, 1);
      return true;
    },
    label(id, label) {
      const s = items.find((x) => x.id === id);
      if (!s) return false;
      s.label = label;
      return true;
    },
    get(id) { return items.find((s) => s.id === id) || null; },
    list() { return items.map((s) => ({ id: s.id, label: s.label, createdAt: s.createdAt, eventCount: s.eventCount })); },
    all() { return items.slice(); },
    setCap(n) {
      limit = Math.max(1, Math.min(MAX_CAP, n|0));
      while (items.length > limit) items.shift();
      return limit;
    },
    getCap() { return limit; },
    clear() { items.length = 0; }
  };
}

// ---- Diff (spec/03 §Diff algorithm) ----------------------------------------

/**
 * Returns a DiffResult describing changes from A (baseline) to B (comparison).
 * Complexity: O(N) in total node count (spec/03 requirement).
 *
 * Change types (per spec/03 §Change types):
 *   - 'added'         : in B, not in A
 *   - 'removed'       : in A, not in B
 *   - 'value_changed' : SV in both, values differ
 *   - 'mode_changed'  : property mode differs (e.g., PL → P)
 *   - 'unchanged'     : present in both, identical
 */
export function diffTrees(a, b) {
  const annotated = walk(a, b);
  const summary = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  visit(annotated, (n) => {
    if (n.__change === 'added') summary.added++;
    else if (n.__change === 'removed') summary.removed++;
    else if (n.__change === 'value_changed' || n.__change === 'mode_changed') summary.changed++;
    else summary.unchanged++;
  });
  return { tree: annotated, summary };
}

function walk(a, b) {
  // Both present at this id/position.
  if (a && b) {
    const modeChanged = a.mode !== b.mode;
    if (a.mode === 'SV' || b.mode === 'SV') {
      const valueChanged = !sameScalar(a, b);
      const n = annotate(b, modeChanged ? 'mode_changed' : (valueChanged ? 'value_changed' : 'unchanged'));
      if (valueChanged) n.__before = a.value;
      return n;
    }
    const children = correlateChildren(a.children || [], b.children || []);
    const n = annotate(b, modeChanged ? 'mode_changed' : undefined);
    n.children = children;
    // If any descendant changed, surface as 'changed' unless mode_changed already set.
    if (n.__change !== 'mode_changed' && children.some((c) => c.__change && c.__change !== 'unchanged')) {
      n.__change = 'changed';
    } else if (!n.__change) {
      n.__change = 'unchanged';
    }
    return n;
  }
  if (b && !a) return deepMark(b, 'added');
  /* a && !b */ return deepMark(a, 'removed');
}

function annotate(node, change) {
  const out = shallowClone(node);
  if (change) out.__change = change;
  return out;
}

function shallowClone(node) {
  const out = {};
  for (const k of Object.keys(node)) out[k] = node[k];
  return out;
}

function deepMark(node, change) {
  const n = shallowClone(node);
  n.__change = change;
  if (node.children) n.children = node.children.map((c) => deepMark(c, change));
  return n;
}

function sameScalar(a, b) {
  return a.mode === b.mode && a.value === b.value && (a.valueType || null) === (b.valueType || null);
}

/**
 * Correlate children between A and B:
 *   - For Page Lists whose first items expose pzInsKey on both sides, pair by pzInsKey.
 *   - Otherwise, pair by `name`. For P children that's the prop name; for PL/VL
 *     without pzInsKey that's `(1)`, `(2)`, …  — positional, which is fine.
 * Spec/03 notes the known limitation: reordered PLs without pzInsKey show as
 * change-in-place rather than reorder.
 */
function correlateChildren(as, bs) {
  const firstA = as[0], firstB = bs[0];
  const usePz = firstA && firstB && getPz(firstA) != null && getPz(firstB) != null;

  const mapA = new Map();
  const mapB = new Map();
  const pick = usePz ? getPz : (n) => n.name;
  for (const n of as) { const k = pick(n); if (k != null && !mapA.has(k)) mapA.set(k, n); }
  for (const n of bs) { const k = pick(n); if (k != null && !mapB.has(k)) mapB.set(k, n); }

  const seen = new Set();
  const out = [];
  for (const [bKey, bNode] of mapB) {
    out.push(walk(mapA.get(bKey) || null, bNode));
    seen.add(bKey);
  }
  for (const [aKey, aNode] of mapA) {
    if (seen.has(aKey)) continue;
    out.push(walk(aNode, null));
  }
  return out;
}

function getPz(node) {
  if (!node || !node.children) return null;
  const pz = node.children.find((c) => c.name === 'pzInsKey' && c.mode === 'SV');
  return pz ? pz.value : null;
}

function visit(node, fn) {
  fn(node);
  if (node.children) for (const c of node.children) visit(c, fn);
}

// ---- Copy-change helper (spec/03 §UI affordances: Copy change) -------------

export function formatChange(change, aLabel, bLabel) {
  if (!change || change.__change === 'unchanged') return '';
  const path = change.id || '(root)';
  switch (change.__change) {
    case 'added':
      return `"${path}" added in "${bLabel}"`;
    case 'removed':
      return `"${path}" removed in "${bLabel}"`;
    case 'value_changed':
      return `"${path}" changed from ${JSON.stringify(change.__before)} to ${JSON.stringify(change.value)} between "${aLabel}" and "${bLabel}"`;
    case 'mode_changed':
      return `"${path}" mode changed between "${aLabel}" and "${bLabel}"`;
    default:
      return `"${path}" changed between "${aLabel}" and "${bLabel}"`;
  }
}
