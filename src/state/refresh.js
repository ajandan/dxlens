// Refresh planner (spec/05 §Refresh, spec/07 §Core guarantees #3).
// Pure: given a selected tree node, compute the GET URL that the Constellation
// app would itself issue to refresh that entity. Never invents a write.

/** Only re-issue http(s) URLs. Rejects javascript:, data:, file:, blob:, etc. */
function isSafeRefreshUrl(u) {
  if (typeof u !== 'string' || !u) return false;
  return /^https?:\/\//i.test(u);
}

/**
 * Plan a refresh for the given node. Returns { method, url } when the node is a
 * case or data page with a known source URL; returns null otherwise.
 *
 * The strategy is "re-issue what we saw":
 *   - For a case subtree, pick a previously observed GET URL on that case id.
 *   - For a data page, pick a previously observed GET URL on that data page.
 * This is deliberately deterministic — no URL is synthesized, only re-played.
 */
export function planRefresh(node) {
  if (!node || !node.id) return null;

  if (isCaseSubtree(node)) {
    const caseNode = walkUp(node, isCaseRoot);
    const url = firstGetUrlContaining(caseNode, caseIdSegment(caseNode));
    return url ? { method: 'GET', url } : null;
  }

  if (isDataPageSubtree(node)) {
    const dpNode = walkUp(node, isDataPageRoot);
    const url = firstGetUrlContaining(dpNode, dataPageSegment(dpNode));
    return url ? { method: 'GET', url } : null;
  }

  return null;
}

// ---- predicates ------------------------------------------------------------

function isCaseRoot(n) {
  return typeof n.id === 'string' && /^Cases\.[^.]+$/.test(n.id);
}
function isCaseSubtree(n) {
  return typeof n.id === 'string' && /^Cases\./.test(n.id);
}
function isDataPageRoot(n) {
  return typeof n.id === 'string' && /^DataPages\.[^.]+$/.test(n.id);
}
function isDataPageSubtree(n) {
  return typeof n.id === 'string' && /^DataPages\./.test(n.id);
}

// ---- navigation helpers ----------------------------------------------------

/**
 * Walk up the subtree is not possible without parent pointers; instead the
 * planner expects to be handed the subtree root or any descendant; since the
 * node we have holds its own `id`, we climb by id using the provided node's
 * own subtree — we can't. Parent pointers aren't kept on the shared node
 * structure (tree is built top-down). Callers therefore pass the subtree root
 * itself whenever possible; when a descendant is given, we fall back by
 * stripping id segments, and the caller must also pass the root via
 * `planRefreshFrom(tree, node)` below.
 */
function walkUp(node, predicate) { return predicate(node) ? node : null; }

/**
 * Walk the provided root to find the first node matching the predicate whose
 * id is an ancestor of `descendant.id`. Lets callers start from any node.
 */
export function planRefreshFrom(root, descendant) {
  if (!root || !descendant || !descendant.id) return null;
  const ancestor = findAncestor(root, descendant.id, (n) => isCaseRoot(n) || isDataPageRoot(n));
  if (!ancestor) return null;
  return planRefresh(ancestor);
}

function findAncestor(root, id, match) {
  let best = null;
  (function walk(n) {
    if (!n) return;
    if (typeof n.id === 'string' && (id === n.id || id.startsWith(n.id + '.')) && match(n)) {
      if (!best || n.id.length > best.id.length) best = n;
    }
    if (n.children) for (const c of n.children) walk(c);
  })(root);
  return best;
}

// ---- url helpers ------------------------------------------------------------

function caseIdSegment(caseNode) {
  if (!caseNode) return '';
  return caseNode.id.replace(/^Cases\./, '');
}
function dataPageSegment(dpNode) {
  if (!dpNode) return '';
  // Strip any paramHash suffix `[abc]` for matching.
  return dpNode.id.replace(/^DataPages\./, '').replace(/\[[^\]]+\]$/, '');
}

/** Find the most recently-seen GET URL on this node or its descendants that
 *  contains the `needle` substring. */
function firstGetUrlContaining(node, needle) {
  if (!node || !needle) return null;
  let best = null;
  let bestTs = -1;
  (function walk(n) {
    const urls = n.sourceUrls || [];
    for (const u of urls) {
      if (!isSafeRefreshUrl(u)) continue;
      if (u && u.includes(encodeURIComponent(needle)) || (u && u.includes(needle))) {
        const ts = n.lastUpdated || 0;
        if (ts > bestTs) { best = u; bestTs = ts; }
      }
    }
    if (n.children) for (const c of n.children) walk(c);
  })(node);
  return best;
}
