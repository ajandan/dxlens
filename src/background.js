// Service worker (spec/06). Per-tab event buffer, clipboard tree, snapshots.
// In-memory only; captured data is never persisted (spec/07).

import {
  emptyTree,
  mergeCaseReplace,
  mergeCasePatch,
  mergeAssignment,
  mergeDataPage,
  mergeOperator,
  getNodeByPath
} from './state/clipboard.js';
import { classify, extractOperator } from './state/classify.js';
import { createStore, createSnapshot } from './state/snapshot.js';
import { pickCurrentView, mergeCurrentView, readCurrentViewId } from './state/current-view.js';
import { dispatchTool } from './state/tools.js';
import { createLiveState } from './state/live-state.js';
import { createStats } from './state/stats.js';
import { mergeSettings, DEFAULT_SETTINGS } from './state/settings.js';
import { planRefreshFrom } from './state/refresh.js';
import { measureTree } from './state/footprint.js';
import { classifySubmit } from './state/auto-snapshot.js';

const BUFFER_CAP = 500;
const SETTINGS_KEY = 'dxlens.settings';

/** @type {Map<number, Array<object>>} */
const buffers = new Map();
/** @type {Map<number, object>} */
const trees = new Map();
/** @type {Map<number, ReturnType<typeof createStore>>} */
const stores = new Map();
/** @type {Map<number, number>} */
const eventCounts = new Map();
/** @type {Map<number, ReturnType<typeof createLiveState>>} */
const liveStates = new Map();
/** @type {Map<number, ReturnType<typeof createStats>>} */
const statsByTab = new Map();
/** @type {Map<number, chrome.runtime.Port>} */
const panelPorts = new Map();

// Side panel opens on action-click (spec/09 M5, spec/05 v1.1 deferral reversed).
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
} catch { /* side panel API not available on all browsers */ }

let settings = { ...DEFAULT_SETTINGS };

async function loadSettings() {
  try {
    const raw = await chrome.storage.local.get(SETTINGS_KEY);
    settings = mergeSettings(raw[SETTINGS_KEY] || {});
    for (const s of stores.values()) s.setCap(settings.snapshotCap);
    broadcastSettings();
  } catch { /* ignore */ }
}

async function saveSettings(partial) {
  settings = mergeSettings({ ...settings, ...partial });
  try { await chrome.storage.local.set({ [SETTINGS_KEY]: settings }); }
  catch { /* ignore */ }
  for (const s of stores.values()) s.setCap(settings.snapshotCap);
  broadcastSettings();
  broadcastPatterns();
}

function broadcastSettings() {
  for (const [tabId, port] of panelPorts) {
    try { port.postMessage({ type: 'settings', settings }); } catch { /* ignore */ }
  }
}

loadSettings();

// ---- per-tab accessors -----------------------------------------------------

function getBuffer(tabId) {
  let buf = buffers.get(tabId);
  if (!buf) { buf = []; buffers.set(tabId, buf); }
  return buf;
}
function getTree(tabId) {
  let t = trees.get(tabId);
  if (!t) { t = emptyTree(); trees.set(tabId, t); }
  return t;
}
function getStore(tabId) {
  let s = stores.get(tabId);
  if (!s) { s = createStore({ cap: settings.snapshotCap }); stores.set(tabId, s); }
  return s;
}
function getLive(tabId) {
  let l = liveStates.get(tabId);
  if (!l) { l = createLiveState(); liveStates.set(tabId, l); }
  return l;
}
function getStats(tabId) {
  let s = statsByTab.get(tabId);
  if (!s) { s = createStats(); statsByTab.set(tabId, s); }
  return s;
}

function bumpEventCount(tabId) {
  eventCounts.set(tabId, (eventCounts.get(tabId) || 0) + 1);
}
function readEventCount(tabId) { return eventCounts.get(tabId) || 0; }

// ---- event application ----------------------------------------------------

function applyEventToTree(tabId, event) {
  const tree = getTree(tabId);
  const c = classify(event);
  const body = event.responseBody;
  const source = event.url;

  switch (c.kind) {
    case 'case':
      if (c.isPatch) mergeCasePatch(tree, c.caseId, body, source);
      else           mergeCaseReplace(tree, c.caseId, c.className, body, source);
      break;
    case 'assignment':
      mergeAssignment(tree, c.assignmentId, body, source);
      break;
    case 'data_view':
      mergeDataPage(tree, c.dataPageName, c.paramHash, body, source);
      break;
    case 'view':
      // O-002 resolved — current view resolution is handled via pickCurrentView
      // on every dx_response below.
      break;
  }
  const op = extractOperator(body);
  if (op) mergeOperator(tree, op, source);
  const view = pickCurrentView(event);
  if (view) mergeCurrentView(tree, view);
  return tree;
}

function pushEventLive(tabId, event) {
  bumpEventCount(tabId);
  getStats(tabId).record(event);
  const tree = event.kind === 'dx_response' ? applyEventToTree(tabId, event) : getTree(tabId);
  const port = panelPorts.get(tabId);
  if (port) {
    try {
      port.postMessage({ type: 'event', event });
      port.postMessage({ type: 'tree:replace', tree });
    } catch { /* ignore */ }
  }
}

function pushEvent(tabId, event) {
  const buf = getBuffer(tabId);
  buf.push(event);
  if (buf.length > BUFFER_CAP) buf.splice(0, buf.length - BUFFER_CAP);

  // Auto-snapshot bracketing (spec/03 §Auto-snapshot, O-005).
  let submitCls = { submitLike: false };
  if (settings.autoSnapshot && !getLive(tabId).isPaused()) {
    // Screen-change: snapshot the OLD tree before a new view is merged in,
    // so the user gets a history of previous screens.
    const nextView = pickCurrentView(event);
    const prevViewId = readCurrentViewId(getTree(tabId));
    if (nextView && prevViewId && nextView.viewId !== prevViewId) {
      const label = `screen: ${prevViewId}`;
      const snap = createSnapshot(getTree(tabId), { label, eventCount: readEventCount(tabId) });
      getStore(tabId).add(snap);
      const p = panelPorts.get(tabId);
      if (p) sendSnapshots(p, tabId);
    }

    submitCls = classifySubmit(event);
    if (submitCls.submitLike) {
      const label = `auto: before ${submitCls.kind}${submitCls.caseId ? ` ${submitCls.caseId}` : ''}`;
      const snap = createSnapshot(getTree(tabId), { label, eventCount: readEventCount(tabId) });
      getStore(tabId).add(snap);
      const p = panelPorts.get(tabId);
      if (p) sendSnapshots(p, tabId);
    }
  }

  const live = getLive(tabId);
  const passthrough = live.absorb(event);
  if (passthrough) {
    pushEventLive(tabId, passthrough);
    if (settings.autoSnapshot && submitCls.submitLike) {
      const label = `auto: after ${submitCls.kind}${submitCls.caseId ? ` ${submitCls.caseId}` : ''}`;
      const snap = createSnapshot(getTree(tabId), { label, eventCount: readEventCount(tabId) });
      getStore(tabId).add(snap);
      const p = panelPorts.get(tabId);
      if (p) sendSnapshots(p, tabId);
    }
  } else {
    // Paused: just notify the panel of new event + queue depth.
    const port = panelPorts.get(tabId);
    if (port) {
      try {
        port.postMessage({ type: 'event', event });
        port.postMessage({ type: 'live:state', paused: true, queued: live.queuedCount(), dropped: live.droppedCount() });
      } catch { /* ignore */ }
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  const tabId = sender && sender.tab && sender.tab.id;
  if (msg.type === 'capture' && msg.event && typeof tabId === 'number') {
    pushEvent(tabId, { ...msg.event, tabId });
    return;
  }
  if (msg.type === 'config:request' && typeof tabId === 'number') {
    try { chrome.tabs.sendMessage(tabId, { type: 'config', patterns: settings.urlPatterns }); } catch {}
    return;
  }
});

// Broadcast updated patterns to every tab on settings change.
function broadcastPatterns() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (typeof tab.id === 'number') {
        try { chrome.tabs.sendMessage(tab.id, { type: 'config', patterns: settings.urlPatterns }); } catch {}
      }
    }
  });
}

function callTool(tabId, name, args) {
  return dispatchTool({ tree: getTree(tabId), store: getStore(tabId) }, name, args);
}

// ---- Panel port ------------------------------------------------------------

function sendSnapshots(port, tabId) {
  try { port.postMessage({ type: 'snapshots:update', snapshots: getStore(tabId).list() }); }
  catch { /* ignore */ }
}

function sendStats(port, tabId) {
  try { port.postMessage({ type: 'stats', stats: getStats(tabId).snapshot() }); }
  catch { /* ignore */ }
}

function sendFootprint(port, tabId) {
  try { port.postMessage({ type: 'footprint', footprint: measureTree(getTree(tabId)) }); }
  catch { /* ignore */ }
}

function sendLiveState(port, tabId) {
  const live = getLive(tabId);
  try {
    port.postMessage({ type: 'live:state', paused: live.isPaused(), queued: live.queuedCount(), dropped: live.droppedCount() });
  } catch { /* ignore */ }
}

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name || !port.name.startsWith('panel:')) return;
  const tabId = Number(port.name.slice('panel:'.length));
  if (!Number.isFinite(tabId)) { port.disconnect(); return; }

  panelPorts.set(tabId, port);
  try {
    port.postMessage({ type: 'hello', tabId, buffer: getBuffer(tabId) });
    port.postMessage({ type: 'tree:replace', tree: getTree(tabId) });
    port.postMessage({ type: 'settings', settings });
    sendSnapshots(port, tabId);
    sendStats(port, tabId);
    sendFootprint(port, tabId);
    sendLiveState(port, tabId);
  } catch { /* ignore */ }

  port.onMessage.addListener(async (msg) => {
    if (!msg) return;

    if (msg.type === 'clear') {
      buffers.set(tabId, []);
      trees.set(tabId, emptyTree());
      stores.get(tabId)?.clear();
      eventCounts.set(tabId, 0);
      statsByTab.get(tabId)?.reset();
      liveStates.get(tabId)?.clear();
      try {
        port.postMessage({ type: 'cleared' });
        port.postMessage({ type: 'tree:replace', tree: getTree(tabId) });
        sendSnapshots(port, tabId);
        sendStats(port, tabId);
        sendLiveState(port, tabId);
      } catch { /* ignore */ }

    } else if (msg.type === 'snapshot:take') {
      const snap = createSnapshot(getTree(tabId), { label: msg.label, eventCount: readEventCount(tabId) });
      getStore(tabId).add(snap);
      eventCounts.set(tabId, 0);
      sendSnapshots(port, tabId);

    } else if (msg.type === 'snapshot:delete') {
      getStore(tabId).remove(msg.id);
      sendSnapshots(port, tabId);

    } else if (msg.type === 'snapshot:label') {
      getStore(tabId).label(msg.id, msg.label);
      sendSnapshots(port, tabId);

    } else if (msg.type === 'snapshot:compare') {
      try {
        const result = callTool(tabId, 'diff_snapshots', { a: msg.a, b: msg.b });
        port.postMessage({ type: 'snapshot:diff', requestId: msg.requestId, ok: true, result });
      } catch (e) {
        port.postMessage({ type: 'snapshot:diff', requestId: msg.requestId, ok: false, error: (e && e.message) || String(e) });
      }

    } else if (msg.type === 'search') {
      try {
        const matches = callTool(tabId, 'search_clipboard', { query: msg.query, scope: msg.scope, currentCaseId: msg.currentCaseId });
        port.postMessage({ type: 'search:result', requestId: msg.requestId, matches });
      } catch (e) {
        port.postMessage({ type: 'search:result', requestId: msg.requestId, matches: [], error: (e && e.message) || String(e) });
      }

    } else if (msg.type === 'live:pause') {
      getLive(tabId).pause();
      sendLiveState(port, tabId);

    } else if (msg.type === 'live:resume') {
      const { flushed } = getLive(tabId).resume();
      for (const ev of flushed) pushEventLive(tabId, ev);
      sendLiveState(port, tabId);

    } else if (msg.type === 'settings:update') {
      await saveSettings(msg.partial || {});

    } else if (msg.type === 'settings:reset') {
      await saveSettings({ ...DEFAULT_SETTINGS });

    } else if (msg.type === 'refresh:plan') {
      try {
        const node = msg.nodeId ? getNodeByPath(getTree(tabId), msg.nodeId) : null;
        const plan = planRefreshFrom(getTree(tabId), node);
        port.postMessage({ type: 'refresh:plan', requestId: msg.requestId, plan });
      } catch (e) {
        port.postMessage({ type: 'refresh:plan', requestId: msg.requestId, error: (e && e.message) || String(e) });
      }

    } else if (msg.type === 'tool:call') {
      try {
        const value = callTool(tabId, msg.name, msg.args);
        port.postMessage({ type: 'tool:result', id: msg.id, ok: true, value });
      } catch (e) {
        port.postMessage({ type: 'tool:result', id: msg.id, ok: false, error: (e && e.message) || String(e) });
      }
    }
  });

  port.onDisconnect.addListener(() => {
    if (panelPorts.get(tabId) === port) panelPorts.delete(tabId);
  });
});

// Periodic stats + footprint push (every 2 s when a panel is connected).
setInterval(() => {
  for (const [tabId, port] of panelPorts) {
    sendStats(port, tabId);
    sendFootprint(port, tabId);
  }
}, 2000);

chrome.tabs.onRemoved.addListener((tabId) => {
  buffers.delete(tabId);
  trees.delete(tabId);
  stores.delete(tabId);
  eventCounts.delete(tabId);
  liveStates.delete(tabId);
  statsByTab.delete(tabId);
  const port = panelPorts.get(tabId);
  if (port) { try { port.disconnect(); } catch { /* ignore */ } }
  panelPorts.delete(tabId);
});
