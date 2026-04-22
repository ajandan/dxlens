// Search over the clipboard tree (spec/04). Pure; no DOM.
// Index is flat and pre-computed at tree-build time (or lazily per search).

export const SCOPE = Object.freeze({
  ALL: 'all',
  CURRENT_CASE: 'current_case',
  CURRENT_VIEW: 'current_view',
  DATA_PAGES: 'data_pages',
  OPERATOR: 'operator'
});

/**
 * Build a flat search index from the tree (spec/04 §Performance).
 * Each entry: { id, name, value, path, nameLc, valueLc, pathLc }.
 */
export function buildIndex(tree) {
  const out = [];
  visit(tree, (node) => {
    const id = node.id;
    const name = node.name;
    const value = node.mode === 'SV' ? stringify(node.value) : undefined;
    const entry = {
      id, name,
      value,
      path: id,
      nameLc: name ? name.toLowerCase() : '',
      valueLc: value != null ? value.toLowerCase() : '',
      pathLc: id ? id.toLowerCase() : ''
    };
    out.push(entry);
  });
  return out;
}

function visit(node, fn) {
  fn(node);
  if (node.children) for (const c of node.children) visit(c, fn);
}

function stringify(v) {
  if (v === null || v === undefined) return 'null';
  return String(v);
}

/**
 * Run a search over an index. Returns array of entries (not nodes).
 * Matching rules (spec/04 §Matching rules):
 *   - Empty query → no results (caller decides to show all).
 *   - "quoted phrase" → exact phrase match against values only.
 *   - Leading "." → path prefix match.
 *   - Otherwise → case-insensitive substring on name + value + path.
 */
export function runSearch(index, query, { scope = SCOPE.ALL, currentCaseId } = {}) {
  if (!query || !query.trim()) return [];
  const q = query.trim();

  const matcher = chooseMatcher(q);
  const scoped = filterScope(index, scope, currentCaseId);
  return scoped.filter(matcher);
}

function chooseMatcher(q) {
  if (q.length >= 2 && q.startsWith('"') && q.endsWith('"')) {
    const phrase = q.slice(1, -1).toLowerCase();
    if (!phrase) return () => false;
    return (e) => e.valueLc.includes(phrase);
  }
  if (q.startsWith('.')) {
    const prefix = q.toLowerCase();
    // Match "inside" a dotted path: anywhere a segment boundary hits.
    return (e) => ('.' + e.pathLc).includes(prefix);
  }
  const needle = q.toLowerCase();
  return (e) =>
    e.nameLc.includes(needle) ||
    e.valueLc.includes(needle) ||
    e.pathLc.includes(needle);
}

function filterScope(index, scope, currentCaseId) {
  switch (scope) {
    case SCOPE.ALL:
      return index;
    case SCOPE.CURRENT_CASE: {
      if (!currentCaseId) return [];
      const prefix = `Cases.${currentCaseId}`;
      return index.filter((e) => e.id === prefix || e.id.startsWith(prefix + '.'));
    }
    case SCOPE.CURRENT_VIEW:
      // O-002 unresolved: CurrentView subtree is empty until resolved. Scope
      // is accepted for API parity; returns whatever lives under CurrentView.
      return index.filter((e) => e.id === 'CurrentView' || e.id.startsWith('CurrentView.'));
    case SCOPE.DATA_PAGES:
      return index.filter((e) => e.id === 'DataPages' || e.id.startsWith('DataPages.'));
    case SCOPE.OPERATOR:
      return index.filter((e) => e.id === 'Operator' || e.id.startsWith('Operator.'));
    default:
      return index;
  }
}

/**
 * Convenience for the panel: returns ancestor ids that must be expanded to
 * make every match visible in the tree (spec/04 §Result presentation).
 */
export function ancestorsToExpand(matches) {
  const set = new Set();
  for (const m of matches) {
    const parts = splitPath(m.id);
    // Walk up: progressively shorter path prefixes are ancestors.
    for (let i = 0; i < parts.length - 1; i++) {
      const anc = joinParts(parts.slice(0, i + 1));
      if (anc) set.add(anc);
    }
  }
  // Root and fixed top-levels are always expanded by the UI.
  return set;
}

// ---- Path-segment helpers (1-indexed arrays; spec/02 §Dotted notation) -----

/** Split "Cases.WORK-1.Items(2).pzInsKey" → ["Cases","WORK-1","Items(2)","pzInsKey"]. */
export function splitPath(path) {
  if (!path) return [];
  return path.split('.');
}
export function joinParts(parts) {
  return parts.join('.');
}
