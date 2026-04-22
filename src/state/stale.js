// Stale detector (spec/02 §Staleness and partial nodes).
//   "Stale — the source URL has been re-fetched and this node is no longer in
//    the new response. Shown dimmed. Retained for one refresh cycle then
//    purged unless the user snapshotted."
//
// Pure: given the previous subtree rooted at some id (e.g. a specific case)
// and the freshly-built subtree for the same id, mark isStale on nodes that
// disappeared. Returns the merged root with staleness applied.

/**
 * @param {object} prevSubtree   the node to update (mutated in place)
 * @param {object} nextSubtree   freshly-built equivalent subtree
 * @returns {{ stale: number, kept: number }}
 */
export function markStale(prevSubtree, nextSubtree) {
  const counts = { stale: 0, kept: 0 };
  if (!prevSubtree) return counts;
  if (!nextSubtree) {
    // Entire subtree disappeared.
    markAll(prevSubtree, counts);
    return counts;
  }

  const nextIds = new Set();
  walk(nextSubtree, (n) => n.id && nextIds.add(n.id));

  walk(prevSubtree, (n) => {
    if (!n.id) return;
    if (nextIds.has(n.id)) { n.isStale = false; counts.kept++; }
    else { n.isStale = true; counts.stale++; }
  });
  return counts;
}

/**
 * Drop previously-stale nodes that stayed stale through another cycle. Pass in
 * the current subtree; returns a new subtree with isStale nodes removed. Spec
 * wording: "Retained for one refresh cycle then purged."
 *
 * Uses a "generation" counter stamped on each node when it first becomes
 * stale; callers pass the current generation. Nodes whose staleGen < current
 * are dropped; stale nodes with no generation get tagged with current and
 * retained for one cycle.
 */
export function sweepStale(root, currentGen) {
  if (!root) return root;
  if (!root.children) return root;
  root.children = root.children.filter((c) => {
    if (c.isStale) {
      if (c.staleGen == null) { c.staleGen = currentGen; return true; }
      if (c.staleGen < currentGen) return false; // purge
    }
    sweepStale(c, currentGen);
    return true;
  });
  return root;
}

function walk(node, fn) {
  fn(node);
  if (node.children) for (const c of node.children) walk(c, fn);
}
function markAll(node, counts) {
  node.isStale = true;
  counts.stale++;
  if (node.children) for (const c of node.children) markAll(c, counts);
}
