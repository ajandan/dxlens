// Captured-data footprint (spec/07 §What users see — "Show captured data footprint").
// Pure: given a tree root, report the in-memory cost per top-level zone and overall.

const TOP_LEVELS = ['Cases', 'DataPages', 'Operator', 'CurrentView'];

/**
 * Compute a footprint summary for the tree.
 *   nodes        — total TreeNode count across the whole tree.
 *   bytes        — rough byte cost (SV values + node metadata).
 *   perTopLevel  — { Cases: {nodes,bytes}, DataPages: {nodes,bytes}, ... }.
 */
export function measureTree(root) {
  const perTopLevel = Object.fromEntries(TOP_LEVELS.map((k) => [k, { nodes: 0, bytes: 0 }]));
  let totalNodes = 0;
  let totalBytes = 0;

  walk(root, (n) => {
    totalNodes++;
    totalBytes += byteCost(n);
  });

  if (root && Array.isArray(root.children)) {
    for (const top of root.children) {
      const bucket = perTopLevel[top.id];
      if (!bucket) continue;
      walk(top, (n) => {
        bucket.nodes++;
        bucket.bytes += byteCost(n);
      });
    }
  }

  return { nodes: totalNodes, bytes: totalBytes, perTopLevel };
}

/** Rough per-node byte cost. Deterministic; doesn't include JS engine overhead. */
export function byteCost(node) {
  if (!node) return 0;
  let bytes = 40; // fixed metadata overhead
  bytes += stringBytes(node.id);
  bytes += stringBytes(node.name);
  if (node.mode === 'SV') bytes += valueBytes(node.value);
  if (node.valueType) bytes += stringBytes(node.valueType);
  if (Array.isArray(node.sourceUrls)) {
    for (const u of node.sourceUrls) bytes += stringBytes(u);
  }
  return bytes;
}

function stringBytes(s) {
  if (s == null) return 0;
  return String(s).length * 2; // UTF-16 approximation
}
function valueBytes(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'string') return v.length * 2;
  if (typeof v === 'number') return 8;
  if (typeof v === 'boolean') return 1;
  try { return JSON.stringify(v).length * 2; } catch { return 64; }
}
function walk(node, fn) { if (!node) return; fn(node); if (node.children) for (const c of node.children) walk(c, fn); }
