// Current View identification (spec/10 §O-002 — resolved via prioritized heuristic).
//
// Constellation renders its UI from a DX `uiResources` envelope. The "current
// view" is the view the React runtime is currently binding to. Without a
// single authoritative field the resolution is a heuristic over several
// candidate signals, ordered strong → weak.
//
// Sources, in precedence order:
//   1. URL endpoint `/views/<viewId>` — the request itself names the view.
//   2. responseBody.uiResources.root.config.name + classID — the envelope root
//      identifies what's being rendered.
//   3. responseBody.data.uiResources.root.config.* — alt placement in some
//      assignment / case responses.
//   4. uiResources.resources.views — single-leaf fallback when unambiguous.
//   5. Query-string `viewID` on the request URL.
//
// Returns null when no signal is found.
//
// Last-write-wins (spec/02 §Merge rules): the most recent identification wins.
// Bindings exposed on the CurrentView subtree are the field names referenced by
// the view root's children.children[].config.value expressions (Pega
// `@P .path` form), extracted as-is.

const VIEW_URL_RE = /\/api\/(?:application\/)?v\d+\/(?:[^/]+\/)+views\/([^/?#]+)/i;

function tryDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }

/**
 * @typedef {{
 *   viewId:    string,
 *   className?: string,
 *   viewName?: string,
 *   bindings:  string[],
 *   source:    string
 * }} CurrentViewInfo
 */

/**
 * Pick a CurrentViewInfo from a CaptureEvent. Returns null if no view can be
 * identified — callers should leave the existing CurrentView untouched.
 */
export function pickCurrentView(event) {
  if (!event || typeof event !== 'object') return null;
  const url = event.url || '';
  const body = event.responseBody;

  // (1) URL names the view outright.
  const urlMatch = VIEW_URL_RE.exec(url);
  if (urlMatch) {
    const viewId = tryDecode(urlMatch[1]);
    const { className, viewName, bindings } = extractFromEnvelope(body) || {};
    return {
      viewId,
      className,
      viewName: viewName || viewId,
      bindings: bindings || [],
      source: url
    };
  }

  // (2) & (3) uiResources.root.config
  const env = extractFromEnvelope(body);
  if (env && (env.viewName || env.className)) {
    return {
      viewId: env.viewName || env.className || '(unknown)',
      className: env.className,
      viewName: env.viewName,
      bindings: env.bindings || [],
      source: url
    };
  }

  // (4) single-leaf resources.views fallback
  const single = singleResourceView(body);
  if (single) return { ...single, source: url };

  // (5) viewID query param
  const viewID = queryParam(url, 'viewID') || queryParam(url, 'viewId');
  if (viewID) return { viewId: viewID, bindings: [], source: url };

  return null;
}

function extractFromEnvelope(body) {
  const ui = extractUiResources(body);
  if (!ui) return null;
  const root = ui.root || (ui.data && ui.data.root);
  if (!root || !root.config) return null;
  const className = root.config.classID || root.config.className || root.config.pyClassName;
  const viewName = root.config.name || root.config.viewName;
  const bindings = collectBindings(root).filter(Boolean);
  return { className, viewName, bindings };
}

function extractUiResources(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.uiResources && typeof body.uiResources === 'object') return body.uiResources;
  if (body.data && body.data.uiResources && typeof body.data.uiResources === 'object') return body.data.uiResources;
  return null;
}

function singleResourceView(body) {
  const ui = extractUiResources(body);
  if (!ui || !ui.resources || !ui.resources.views) return null;
  const views = ui.resources.views;
  const classes = Object.keys(views);
  if (classes.length !== 1) return null;
  const names = Object.keys(views[classes[0]] || {});
  if (names.length !== 1) return null;
  return {
    viewId: names[0],
    className: classes[0],
    viewName: names[0],
    bindings: []
  };
}

/**
 * Walk a view node tree and collect bound property references. Pega's
 * Constellation envelope uses `@P .path` style bindings in `config.value`.
 */
function collectBindings(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  if (node.config) {
    const v = node.config.value;
    if (typeof v === 'string') {
      const m = /^@P\s+\.?(.+)$/.exec(v.trim());
      if (m) acc.push(m[1].trim());
      else if (v.startsWith('.')) acc.push(v.slice(1));
    }
  }
  if (Array.isArray(node.children)) for (const c of node.children) collectBindings(c, acc);
  return acc;
}

function queryParam(url, name) {
  const q = url.indexOf('?');
  if (q < 0) return null;
  const pairs = url.slice(q + 1).split('&');
  for (const p of pairs) {
    const eq = p.indexOf('=');
    const k = eq < 0 ? p : p.slice(0, eq);
    if (k === name) return eq < 0 ? '' : tryDecode(p.slice(eq + 1));
  }
  return null;
}

/**
 * Read the current view id from a tree without mutating it. Returns null
 * when no CurrentView.viewId is present (e.g. before any view has been seen).
 */
export function readCurrentViewId(tree) {
  if (!tree || !Array.isArray(tree.children)) return null;
  const cv = tree.children.find((n) => n.id === 'CurrentView');
  if (!cv || !Array.isArray(cv.children)) return null;
  const vid = cv.children.find((n) => n.id === 'CurrentView.viewId');
  return vid && typeof vid.value === 'string' ? vid.value : null;
}

/**
 * Apply a CurrentViewInfo to the CurrentView top-level tree node (in place).
 * Replaces the subtree content (last-write-wins, per spec/02).
 */
export function mergeCurrentView(tree, info) {
  if (!tree || !info) return null;
  const cv = tree.children.find((n) => n.id === 'CurrentView');
  if (!cv) return null;

  // Build children under CurrentView from the info payload.
  const now = Date.now();
  const children = [];
  const pushSv = (name, value) => {
    if (value == null) return;
    children.push({
      id: `CurrentView.${name}`,
      name,
      mode: 'SV',
      value,
      valueType: typeof value === 'string' ? 'string' : typeof value,
      sourceUrls: info.source ? [info.source] : [],
      lastUpdated: now,
      isPartial: false,
      isStale: false
    });
  };
  pushSv('viewId', info.viewId);
  if (info.className) pushSv('className', info.className);
  if (info.viewName && info.viewName !== info.viewId) pushSv('viewName', info.viewName);

  if (Array.isArray(info.bindings) && info.bindings.length > 0) {
    children.push({
      id: 'CurrentView.bindings',
      name: 'bindings',
      mode: 'VL',
      children: info.bindings.map((b, i) => ({
        id: `CurrentView.bindings(${i + 1})`,
        name: `(${i + 1})`,
        mode: 'SV',
        value: b,
        valueType: 'string',
        sourceUrls: info.source ? [info.source] : [],
        lastUpdated: now,
        isPartial: false,
        isStale: false
      })),
      sourceUrls: info.source ? [info.source] : [],
      lastUpdated: now,
      isPartial: false,
      isStale: false
    });
  }

  cv.children = children;
  cv.sourceUrls = info.source ? [info.source] : [];
  cv.lastUpdated = now;
  cv.isPartial = false;
  cv.isStale = false;
  return cv;
}
