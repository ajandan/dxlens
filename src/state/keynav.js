// Keyboard-navigation reducer for the tree (spec/05 §Operations, spec/08 §Accessibility).
// Pure: takes the flattened list of visible node ids, the current selection,
// and a key, returns the next selection plus optional expand/collapse signals.

/**
 * @typedef {{ id: string, depth: number, hasChildren: boolean, parentId: string|null }} VisibleRow
 */

/**
 * @param {{ rows: VisibleRow[], expanded: Set<string>, selectedId: string|null }} state
 * @param {string} key  — the KeyboardEvent.key value
 * @returns {{ selectedId: string|null, expand?: string, collapse?: string }}
 */
export function keyStep(state, key) {
  const { rows, expanded, selectedId } = state;
  if (!rows || rows.length === 0) return { selectedId };
  const idx = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1;
  const cur = idx >= 0 ? rows[idx] : rows[0];

  switch (key) {
    case 'ArrowDown':
      if (idx < 0) return { selectedId: rows[0].id };
      return { selectedId: rows[Math.min(rows.length - 1, idx + 1)].id };

    case 'ArrowUp':
      if (idx < 0) return { selectedId: rows[0].id };
      return { selectedId: rows[Math.max(0, idx - 1)].id };

    case 'ArrowRight':
      if (!cur) return { selectedId };
      if (cur.hasChildren && !expanded.has(cur.id)) return { selectedId: cur.id, expand: cur.id };
      // If already expanded or a leaf, move into first child / next row.
      if (cur.hasChildren && expanded.has(cur.id) && idx + 1 < rows.length) {
        return { selectedId: rows[idx + 1].id };
      }
      return { selectedId };

    case 'ArrowLeft':
      if (!cur) return { selectedId };
      if (cur.hasChildren && expanded.has(cur.id)) return { selectedId: cur.id, collapse: cur.id };
      if (cur.parentId) return { selectedId: cur.parentId };
      return { selectedId };

    case 'Home':
      return { selectedId: rows[0].id };
    case 'End':
      return { selectedId: rows[rows.length - 1].id };

    default:
      return { selectedId };
  }
}

/**
 * Flatten the tree into the visible-row representation used by keyStep.
 * Honors the provided expanded set; the root itself is not emitted.
 */
export function flattenVisible(root, expanded) {
  const rows = [];
  (function walk(node, parentId, depth) {
    if (!node) return;
    if (node.id !== '') { // skip synthetic root
      rows.push({
        id: node.id,
        depth,
        hasChildren: Array.isArray(node.children) && node.children.length > 0,
        parentId
      });
    }
    const showChildren = node.id === '' || expanded.has(node.id);
    if (showChildren && node.children) {
      for (const c of node.children) walk(c, node.id || null, depth + 1);
    }
  })(root, null, -1);
  return rows;
}
