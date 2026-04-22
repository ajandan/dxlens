// Change history (spec/02 §Operations — "Show change history").
// Pure: walk the retained snapshot store and project a path's timeline so the
// panel can render a compact "what-changed-when" view for a selected node.

/**
 * @typedef {{
 *   snapshotId: string,
 *   label:      string,
 *   createdAt:  number,
 *   presence:   'absent' | 'present',
 *   mode?:      string,
 *   value?:     any,
 *   valueType?: string
 * }} HistoryEntry
 */

/**
 * Build a timeline for `nodePath` across the given snapshots (oldest-first).
 * Includes a row for every snapshot so the UI can render "absent" gaps.
 *
 * @param {Array<{ id: string, label: string, createdAt: number, tree: object }>} snapshots
 * @param {string} nodePath
 * @returns {HistoryEntry[]}
 */
export function changeHistory(snapshots, nodePath) {
  if (!Array.isArray(snapshots)) return [];
  if (!nodePath || typeof nodePath !== 'string') return [];

  const ordered = snapshots.slice().sort((a, b) => a.createdAt - b.createdAt);
  return ordered.map((s) => {
    const node = findById(s.tree, nodePath);
    if (!node) {
      return { snapshotId: s.id, label: s.label, createdAt: s.createdAt, presence: 'absent' };
    }
    if (node.mode === 'SV') {
      return {
        snapshotId: s.id, label: s.label, createdAt: s.createdAt, presence: 'present',
        mode: node.mode, value: node.value, valueType: node.valueType
      };
    }
    // For Page/PL/VL we report presence + a coarse shape marker rather than a
    // value, to keep memory bounded.
    return {
      snapshotId: s.id, label: s.label, createdAt: s.createdAt, presence: 'present',
      mode: node.mode
    };
  });
}

/**
 * Reduce a timeline to the contiguous transitions (collapsing repeated values).
 * Each transition records the first snapshot where the new state was seen.
 */
export function compressHistory(history) {
  const out = [];
  for (const entry of history) {
    const prev = out[out.length - 1];
    if (!prev || !sameState(prev, entry)) out.push(entry);
  }
  return out;
}

function sameState(a, b) {
  if (a.presence !== b.presence) return false;
  if (a.presence === 'absent') return true;
  if (a.mode !== b.mode) return false;
  if (a.mode === 'SV') return a.value === b.value && (a.valueType || null) === (b.valueType || null);
  return true;
}

function findById(root, id) {
  if (!root) return null;
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    if (n && n.id === id) return n;
    if (n && n.children) for (const c of n.children) stack.push(c);
  }
  return null;
}
