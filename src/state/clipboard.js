// Pure clipboard-tree primitives (spec/02).
// No DOM, no chrome.*. Must remain testable in a plain browser context
// and importable from the service worker as a module.

import { isUnsafeKey } from './safe-keys.js';

// Hard caps: bound recursion against stack-blowing JSON, bound collection
// widths against pathological DX responses. Real Pega payloads stay well
// under these.
export const MAX_DEPTH = 100;
export const MAX_CHILDREN = 10_000;

// ---- Modes -----------------------------------------------------------------

export const MODE = Object.freeze({
  ROOT: 'ROOT',
  SV:   'SV',   // Single Value
  P:    'P',    // Page
  PL:   'PL',   // Page List
  VL:   'VL'    // Value List
});

/**
 * Infer a node's mode from a JSON value (spec/02 §Property mode inference).
 * Empty arrays return VL with isTentative=true; caller may flip to PL when
 * a later capture populates the array with objects.
 */
export function inferMode(value) {
  if (value === null || value === undefined) return { mode: MODE.SV, isTentative: false };
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return { mode: MODE.SV, isTentative: false };
  if (Array.isArray(value)) {
    if (value.length === 0) return { mode: MODE.VL, isTentative: true };
    const first = value[0];
    const firstIsObj = first !== null && typeof first === 'object' && !Array.isArray(first);
    return { mode: firstIsObj ? MODE.PL : MODE.VL, isTentative: false };
  }
  if (t === 'object') return { mode: MODE.P, isTentative: false };
  return { mode: MODE.SV, isTentative: false };
}

function valueType(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') {
    // Pega DX dates are frequently ISO strings or Pega's compact yyyymmddThhmmss.SSS GMT; keep detection loose.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) || /^\d{8}T\d{6}/.test(v)) return 'date-like';
    return 'string';
  }
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'null';
}

// ---- Paths (spec/02 §Dotted-notation paths, D-009) -------------------------

/**
 * Build a child path segment. 1-indexed for display; internal array indices
 * remain 0-based in data structures (D-009).
 */
export function joinPath(parentPath, childName, kind) {
  // kind: 'prop' | 'index'
  if (kind === 'index') return `${parentPath}(${childName + 1})`;
  if (!parentPath) return childName;
  return `${parentPath}.${childName}`;
}

// ---- Node construction -----------------------------------------------------

let now = () => Date.now();
export function __setNowForTests(fn) { now = fn; }

function makeNode(name, id, valueOrChildren, sourceUrl, depth) {
  const inferred = inferMode(valueOrChildren);
  const node = {
    id,
    name,
    mode: inferred.mode,
    sourceUrls: sourceUrl ? [sourceUrl] : [],
    lastUpdated: now(),
    isPartial: false,
    isStale: false
  };
  if (inferred.isTentative) node.isTentative = true;

  if (inferred.mode === MODE.SV) {
    node.value = valueOrChildren === undefined ? null : valueOrChildren;
    node.valueType = valueType(node.value);
  } else if (depth >= MAX_DEPTH) {
    // Collapse to an SV truncation marker rather than blow the stack on
    // maliciously-deep input.
    node.mode = MODE.SV;
    node.value = '[…truncated at max depth]';
    node.valueType = 'string';
    node.isPartial = true;
  } else {
    node.children = buildChildren(id, valueOrChildren, sourceUrl, inferred.mode, depth + 1);
    if (Array.isArray(valueOrChildren) && valueOrChildren.length > MAX_CHILDREN ||
        (!Array.isArray(valueOrChildren) && valueOrChildren && typeof valueOrChildren === 'object' &&
          Object.keys(valueOrChildren).length > MAX_CHILDREN)) {
      node.isPartial = true;
    }
  }
  return node;
}

function buildChildren(parentId, value, sourceUrl, parentMode, depth) {
  const kids = [];
  if (parentMode === MODE.P || parentMode === MODE.ROOT) {
    const keys = Object.keys(value);
    const n = Math.min(keys.length, MAX_CHILDREN);
    for (let i = 0; i < n; i++) {
      const k = keys[i];
      if (isUnsafeKey(k)) continue;
      kids.push(makeNode(k, joinPath(parentId, k, 'prop'), value[k], sourceUrl, depth));
    }
  } else if (parentMode === MODE.PL || parentMode === MODE.VL) {
    const n = Math.min(value.length, MAX_CHILDREN);
    for (let i = 0; i < n; i++) {
      // display label uses 1-index; id segment uses 1-index bracket notation per spec/02.
      kids.push(makeNode(`(${i + 1})`, joinPath(parentId, i, 'index'), value[i], sourceUrl, depth));
    }
  }
  return kids;
}

/** Build a subtree from an arbitrary JSON value rooted at the given path. */
export function buildSubtree(name, rootPath, value, sourceUrl) {
  return makeNode(name, rootPath, value, sourceUrl, 0);
}

// ---- Empty root tree --------------------------------------------------------

export function emptyTree() {
  return {
    id: '',
    name: 'Clipboard',
    mode: MODE.ROOT,
    children: [
      { id: 'Cases',        name: 'Cases',        mode: MODE.P, children: [], sourceUrls: [], lastUpdated: 0, isPartial: false, isStale: false },
      { id: 'DataPages',    name: 'Data Pages',   mode: MODE.P, children: [], sourceUrls: [], lastUpdated: 0, isPartial: false, isStale: false },
      { id: 'Operator',     name: 'Operator',     mode: MODE.P, children: [], sourceUrls: [], lastUpdated: 0, isPartial: false, isStale: false },
      { id: 'CurrentView',  name: 'Current View', mode: MODE.P, children: [], sourceUrls: [], lastUpdated: 0, isPartial: false, isStale: false }
    ],
    sourceUrls: [],
    lastUpdated: now(),
    isPartial: false,
    isStale: false
  };
}

// ---- Finders ---------------------------------------------------------------

function findChild(parent, childId) {
  if (!parent.children) return null;
  for (const c of parent.children) if (c.id === childId) return c;
  return null;
}

function upsertChild(parent, child) {
  if (!parent.children) parent.children = [];
  const idx = parent.children.findIndex((c) => c.id === child.id);
  if (idx >= 0) parent.children[idx] = child;
  else parent.children.push(child);
  parent.lastUpdated = now();
}

function getTop(tree, id) {
  return findChild(tree, id);
}

// ---- Deep merge (for PATCH) ------------------------------------------------

/**
 * Merge a captured JSON object into an existing TreeNode subtree (spec/02 merge
 * rules: PATCH merges; changed fields are marked on the node tree by updating
 * lastUpdated on touched ancestors).
 */
function mergeSubtree(node, value, sourceUrl) {
  const incoming = buildSubtree(node.name, node.id, value, sourceUrl);
  // If mode differs entirely (object → primitive or vice versa), replace.
  if (incoming.mode !== node.mode) {
    copyMeta(incoming, node);
    replaceInPlace(node, incoming);
    return;
  }
  if (node.mode === MODE.SV) {
    node.value = incoming.value;
    node.valueType = incoming.valueType;
    node.lastUpdated = now();
    pushSource(node, sourceUrl);
    return;
  }
  // P / PL / VL: merge children by id.
  const byId = new Map((node.children || []).map((c) => [c.id, c]));
  const merged = [];
  for (const child of (incoming.children || [])) {
    const existing = byId.get(child.id);
    if (!existing) {
      merged.push(child);
    } else {
      mergeSubtree(existing, extractValue(child), sourceUrl);
      merged.push(existing);
      byId.delete(child.id);
    }
  }
  // Leftover children in byId: keep (they weren't re-specified in the PATCH).
  for (const leftover of byId.values()) merged.push(leftover);
  node.children = merged;
  node.lastUpdated = now();
  pushSource(node, sourceUrl);
  // Empty-array tentativeness: if we now have PL children, clear tentative flag.
  if (node.isTentative && node.children.length > 0) {
    const first = node.children[0];
    if (first && first.mode !== MODE.SV) {
      node.mode = MODE.PL;
      delete node.isTentative;
    }
  }
}

function extractValue(node) {
  if (node.mode === MODE.SV) return node.value;
  if (node.mode === MODE.PL || node.mode === MODE.VL) {
    return (node.children || []).map((c) => extractValue(c));
  }
  const obj = {};
  for (const c of (node.children || [])) obj[c.name] = extractValue(c);
  return obj;
}

function copyMeta(target, source) {
  target.sourceUrls = Array.from(new Set([...(source.sourceUrls || []), ...(target.sourceUrls || [])]));
  target.isPartial = source.isPartial || false;
  target.isStale = false;
}

function replaceInPlace(target, src) {
  target.mode = src.mode;
  target.children = src.children;
  target.value = src.value;
  target.valueType = src.valueType;
  target.sourceUrls = src.sourceUrls;
  target.lastUpdated = src.lastUpdated;
  if (src.isTentative) target.isTentative = true; else delete target.isTentative;
}

function pushSource(node, url) {
  if (!url) return;
  if (!node.sourceUrls) node.sourceUrls = [];
  if (!node.sourceUrls.includes(url)) node.sourceUrls.push(url);
}

// ---- Top-level merges (spec/02 merge table) --------------------------------

/** Unwrap a DX v2 case envelope: { data: { caseInfo: {…} } } → caseInfo.
 *  Restricted to the canonical shape; other bodies pass through untouched so
 *  we don't hide sibling content when a server returns a non-envelope form. */
function unwrapCaseBody(body) {
  if (!body || typeof body !== 'object') return {};
  if (body.data && body.data.caseInfo && typeof body.data.caseInfo === 'object') return body.data.caseInfo;
  return body;
}

/** GET /cases/<id> — replace entire case node. */
export function mergeCaseReplace(tree, caseId, className, body, sourceUrl) {
  const caseBody = unwrapCaseBody(body);
  const casesNode = getTop(tree, 'Cases');
  const id = `Cases.${caseId}`;
  const displayName = className ? `${caseId} (${className})` : caseId;
  const node = buildSubtree(displayName, id, caseBody, sourceUrl);
  upsertChild(casesNode, node);
  return node;
}

/** PATCH /cases/<id> — merge response into case node. */
export function mergeCasePatch(tree, caseId, body, sourceUrl) {
  const caseBody = unwrapCaseBody(body);
  const casesNode = getTop(tree, 'Cases');
  const id = `Cases.${caseId}`;
  let node = findChild(casesNode, id);
  if (!node) {
    node = buildSubtree(caseId, id, caseBody, sourceUrl);
    upsertChild(casesNode, node);
  } else {
    mergeSubtree(node, caseBody, sourceUrl);
  }
  return node;
}

/**
 * GET /assignments/<id> — nest under owning case if discoverable, else under
 * synthetic "[unknown]" case (spec/02 §Merge rules; O-001 lean A).
 */
export function mergeAssignment(tree, assignmentId, body, sourceUrl) {
  const casesNode = getTop(tree, 'Cases');
  const caseId = pickCaseIdFromAssignment(body, assignmentId) || '[unknown]';
  const caseNodeId = `Cases.${caseId}`;
  let caseNode = findChild(casesNode, caseNodeId);
  if (!caseNode) {
    caseNode = buildSubtree(caseId, caseNodeId, {}, sourceUrl);
    caseNode.isPartial = true;
    upsertChild(casesNode, caseNode);
  }
  // assignments child on the case.
  const assignmentsId = `${caseNodeId}.assignments`;
  let assignmentsNode = findChild(caseNode, assignmentsId);
  if (!assignmentsNode) {
    assignmentsNode = buildSubtree('assignments', assignmentsId, {}, sourceUrl);
    upsertChild(caseNode, assignmentsNode);
  }
  const assignmentNodeId = `${assignmentsId}.${assignmentId}`;
  const node = buildSubtree(assignmentId, assignmentNodeId, body || {}, sourceUrl);
  upsertChild(assignmentsNode, node);
  return node;
}

function pickCaseIdFromAssignment(body, assignmentId) {
  if (body && typeof body === 'object') {
    const candidates = ['caseID', 'caseId', 'pxRefObjectKey', 'pyID', 'pzInsKey'];
    for (const k of candidates) {
      if (typeof body[k] === 'string' && body[k]) return body[k];
    }
    if (body.data && typeof body.data === 'object') {
      const hit = pickCaseIdFromAssignment(body.data, null);
      if (hit) return hit;
    }
    if (body.caseInfo && typeof body.caseInfo === 'object') {
      const hit = pickCaseIdFromAssignment(body.caseInfo, null);
      if (hit) return hit;
    }
  }
  // Fallback: Pega assignment ids have the form "ASSIGN-XXX <CLASS> <CASE-ID>!<FLOW_NAME>".
  // Extract the case key from that — avoids parking follow-up assignments under [unknown].
  if (typeof assignmentId === 'string') {
    const m = /^ASSIGN-[A-Z]+\s+(.+?)!/.exec(assignmentId);
    if (m) return m[1].trim();
  }
  return null;
}

/** GET /data_views/<name> — replace data page. */
export function mergeDataPage(tree, dataPageName, paramHash, body, sourceUrl) {
  const dpNode = getTop(tree, 'DataPages');
  const display = paramHash ? `${dataPageName} [${paramHash}]` : dataPageName;
  const id = paramHash ? `DataPages.${dataPageName}[${paramHash}]` : `DataPages.${dataPageName}`;
  const node = buildSubtree(display, id, body || {}, sourceUrl);
  upsertChild(dpNode, node);
  return node;
}

/** Operator fields appearing in any response — merge into Operator page. */
export function mergeOperator(tree, operatorFields, sourceUrl) {
  if (!operatorFields || typeof operatorFields !== 'object') return null;
  const op = getTop(tree, 'Operator');
  mergeSubtree(op, operatorFields, sourceUrl);
  return op;
}

// ---- Small helpers for callers ---------------------------------------------

export function getNodeByPath(tree, path) {
  if (!path) return tree;
  // BFS by id equality (ids are precomputed paths).
  const stack = [tree];
  while (stack.length) {
    const n = stack.pop();
    if (n.id === path) return n;
    if (n.children) for (const c of n.children) stack.push(c);
  }
  return null;
}

export function listCases(tree) {
  const node = getTop(tree, 'Cases');
  if (!node || !node.children) return [];
  return node.children.map((c) => ({
    id: c.id,
    name: c.name,
    lastUpdated: c.lastUpdated
  }));
}

export function listDataPages(tree) {
  const node = getTop(tree, 'DataPages');
  if (!node || !node.children) return [];
  return node.children.map((c) => ({
    name: c.name,
    lastUpdated: c.lastUpdated
  }));
}
