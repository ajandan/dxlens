// Field-binding lookup (spec/06 §Tool layer contract — `get_field_binding`).
// Pure: finds the first case-subtree node whose `name` matches `fieldName`,
// optionally scoped to a single case. Returns a compact BindingInfo or null.

/**
 * @typedef {{
 *   path:        string,
 *   caseId:      string,
 *   mode:        string,
 *   value?:      any,
 *   valueType?:  string,
 *   sourceUrls:  string[],
 *   viewBound?:  boolean
 * }} BindingInfo
 */

/**
 * @param {object} tree  clipboard root
 * @param {string} fieldName  property name to search for (case-sensitive)
 * @param {{ caseId?: string, preferViewBindings?: boolean }} [opts]
 * @returns {BindingInfo|null}
 */
export function getFieldBinding(tree, fieldName, opts = {}) {
  if (!tree || !fieldName) return null;
  const cases = tree.children.find((n) => n.id === 'Cases');
  if (!cases || !cases.children) return null;

  const viewBindings = opts.preferViewBindings !== false ? collectViewBindings(tree) : new Set();

  const targets = opts.caseId
    ? cases.children.filter((c) => c.id === `Cases.${opts.caseId}`)
    : cases.children;

  for (const caseNode of targets) {
    const hit = findNamed(caseNode, fieldName);
    if (hit) {
      const caseId = caseNode.id.replace(/^Cases\./, '');
      const info = {
        path: hit.id,
        caseId,
        mode: hit.mode,
        sourceUrls: Array.isArray(hit.sourceUrls) ? hit.sourceUrls.slice() : []
      };
      if (hit.mode === 'SV') {
        info.value = hit.value;
        if (hit.valueType) info.valueType = hit.valueType;
      }
      if (viewBindings.size > 0) {
        const relative = hit.id.slice(`Cases.${caseId}.`.length);
        if (viewBindings.has(relative) || viewBindings.has('.' + relative)) info.viewBound = true;
      }
      return info;
    }
  }
  return null;
}

/**
 * Enumerate all fields by name across cases. Useful for the future reveal
 * affordance when a user types `.FieldName` in search.
 */
export function listFieldBindings(tree, fieldName) {
  if (!tree || !fieldName) return [];
  const out = [];
  const cases = tree.children.find((n) => n.id === 'Cases');
  if (!cases || !cases.children) return out;
  for (const caseNode of cases.children) {
    const caseId = caseNode.id.replace(/^Cases\./, '');
    walk(caseNode, (n) => {
      if (n.name === fieldName) {
        out.push({
          path: n.id,
          caseId,
          mode: n.mode,
          value: n.mode === 'SV' ? n.value : undefined,
          sourceUrls: Array.isArray(n.sourceUrls) ? n.sourceUrls.slice() : []
        });
      }
    });
  }
  return out;
}

function collectViewBindings(tree) {
  const out = new Set();
  const cv = tree.children.find((n) => n.id === 'CurrentView');
  if (!cv || !cv.children) return out;
  const bindings = cv.children.find((c) => c.name === 'bindings');
  if (!bindings || !bindings.children) return out;
  for (const b of bindings.children) if (b.mode === 'SV' && typeof b.value === 'string') out.add(b.value);
  return out;
}

function findNamed(root, name) {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n !== root && n.name === name) return n;
    if (n.children) for (const c of n.children) stack.push(c);
  }
  return null;
}

function walk(node, fn) {
  fn(node);
  if (node.children) for (const c of node.children) walk(c, fn);
}
