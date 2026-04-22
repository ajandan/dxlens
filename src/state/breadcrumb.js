// Breadcrumb builder (spec/05 §Breadcrumb).
// Given a node id and the tree root, return an ordered crumb list where each
// crumb is the resolved display label for that ancestor, not just the raw id
// segment. e.g. "Cases.WORK-1.Customer" →
//   [
//     { id: 'Cases',              label: 'Cases' },
//     { id: 'Cases.WORK-1',       label: 'WORK-1 (MyCo-Work)' },
//     { id: 'Cases.WORK-1.Customer', label: 'Customer' }
//   ]

/**
 * @param {object} tree  root
 * @param {string} path  dotted id
 * @returns {Array<{ id: string, label: string }>}
 */
export function buildBreadcrumb(tree, path) {
  if (!tree || !path) return [];
  const parts = path.split('.');
  const crumbs = [];
  let running = '';
  let current = tree;
  for (let i = 0; i < parts.length; i++) {
    running = running ? running + '.' + parts[i] : parts[i];
    const child = current && current.children
      ? current.children.find((n) => n.id === running)
      : null;
    if (!child) {
      // Path doesn't resolve; fall back to raw segment for remaining levels.
      for (; i < parts.length; i++) {
        const id = parts.slice(0, i + 1).join('.');
        crumbs.push({ id, label: parts[i] });
      }
      break;
    }
    crumbs.push({ id: child.id, label: child.name });
    current = child;
  }
  return crumbs;
}
