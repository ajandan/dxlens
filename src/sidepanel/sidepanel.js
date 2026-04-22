// Side panel — full UI (spec/09 M5, Option B).
// Tree + Events + Snapshots + Compare + Search + Live/Pause + Refresh.
// Binds to the active tab; rebinds on chrome.tabs.onActivated.
// Same port protocol as the previous DevTools panel; nothing in background.js
// needs to change to serve either surface.

import { createT, plural } from '../state/i18n.js';
import { keyStep, flattenVisible } from '../state/keynav.js';
import { messages } from '../i18n/messages.en.js';

const t = createT(messages);

let tabId = null;
let port = null;

// ---- element handles -------------------------------------------------------

const el = (id) => document.getElementById(id);
const rows = el('rows');
const stats = el('stats');
const clearBtn = el('clear');
const reReadBtn = el('re-read');
const tabLabel = el('tab-label');
const treeEl = el('tree');
const diffTreeEl = el('diff-tree');
const diffSummary = el('diff-summary');
const diffFilter = el('diff-filter');
const diffBack = el('diff-back');
const breadcrumbEl = el('breadcrumb');
const detailEl = el('detail');
const liveToggle = el('live-toggle');
const refreshBtn = el('refresh');
const ctxmenu = el('ctxmenu');

const tabs = { tree: el('tab-tree'), events: el('tab-events'), snapshots: el('tab-snapshots'), compare: el('tab-compare') };
const panes = { tree: el('pane-tree'), events: el('pane-events'), snapshots: el('pane-snapshots'), compare: el('pane-compare') };

const searchInput = el('search-input');
const searchScope = el('search-scope');
const searchCount = el('search-count');

const snapTakeBtn = el('snap-take');
const snapCompareBtn = el('snap-compare');
const snapRows = el('snap-rows');
const snapCount = el('snap-count');

// ---- Tabs ------------------------------------------------------------------

function activateTab(which) {
  for (const name of Object.keys(tabs)) {
    const active = name === which;
    tabs[name].classList.toggle('active', active);
    tabs[name].setAttribute('aria-selected', String(active));
    panes[name].classList.toggle('hidden', !active);
  }
}
for (const name of Object.keys(tabs)) tabs[name].addEventListener('click', () => activateTab(name));

// ---- Events pane -----------------------------------------------------------

let count = 0;
function fmtTime(ms) {
  const d = new Date(ms);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
function shortBody(ev) {
  if (ev.kind === 'dx_error') return ev.error || 'error';
  if (ev.bodyUnavailable) return '(binary / unavailable)';
  if (ev.responseBody == null) return '';
  if (typeof ev.responseBody === 'string') return ev.responseBody.slice(0, 200);
  try {
    const keys = Object.keys(ev.responseBody);
    return '{ ' + keys.slice(0, 6).join(', ') + (keys.length > 6 ? ', …' : '') + ' }';
  } catch { return ''; }
}
function appendRow(ev) {
  const tr = document.createElement('tr');
  if (ev.kind === 'dx_error') tr.classList.add('err');
  const cells = [
    { cls: 'time', text: fmtTime(ev.finishedAt || ev.startedAt || Date.now()) },
    { cls: 'method', text: ev.method || '' },
    { cls: 'status', text: ev.status != null ? String(ev.status) : (ev.kind === 'dx_error' ? 'ERR' : '') },
    { cls: 'url', text: ev.url || '', title: ev.url || '' },
    { cls: 'dur', text: ev.durationMs != null ? String(Math.round(ev.durationMs)) : '' },
    { cls: 'body', text: shortBody(ev) }
  ];
  for (const c of cells) {
    const td = document.createElement('td');
    td.className = c.cls;
    td.textContent = c.text;
    if (c.title) td.title = c.title;
    tr.appendChild(td);
  }
  rows.appendChild(tr);
  count++;
  stats.textContent = plural(t, 'stats.events', count);
}
function resetRows() { rows.textContent = ''; count = 0; stats.textContent = plural(t, 'stats.events', 0); }

// ---- Tree rendering --------------------------------------------------------

const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView']);
function toggle(id) { if (expanded.has(id)) expanded.delete(id); else expanded.add(id); }

let selectedId = null;
let searchMatches = new Set();
let searchAncestors = new Set();
let glowSince = 0;

function renderNode(node, opts = {}) {
  const elN = document.createElement('div');
  elN.className = 'node';
  elN.dataset.id = node.id || '';
  if (node.id) elN.id = `dxnode-${node.id.replace(/[^a-z0-9]/gi, '-')}`;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  if (!hasChildren && node.mode !== 'ROOT') elN.classList.add('leaf');
  if (node.isPartial) elN.classList.add('partial');
  if (node.isStale) elN.classList.add('stale');
  if (node.id === selectedId) elN.classList.add('selected');

  if (searchMatches.size > 0) {
    if (searchMatches.has(node.id)) elN.classList.add('hit');
    else if (!searchAncestors.has(node.id) && node.id !== '') elN.classList.add('dim');
  }

  if (!opts.diff && node.mode === 'SV' && typeof node.lastUpdated === 'number' && node.lastUpdated > glowSince) {
    elN.classList.add('glow');
  }

  if (opts.diff && node.__change) {
    if (node.__change === 'added') elN.classList.add('diff-added');
    else if (node.__change === 'removed') elN.classList.add('diff-removed');
    else if (node.__change === 'value_changed') elN.classList.add('diff-value');
    else if (node.__change === 'mode_changed') elN.classList.add('diff-mode');
  }

  const row = document.createElement('div');
  row.className = 'row';
  row.setAttribute('role', 'treeitem');
  if (hasChildren) row.setAttribute('aria-expanded', String(isExpanded(node, opts)));

  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = hasChildren ? (isExpanded(node, opts) ? '▾' : '▸') : '•';
  row.appendChild(caret);

  if (node.mode && node.mode !== 'ROOT') {
    const badge = document.createElement('span');
    badge.className = `badge ${node.mode}` + (node.isTentative ? ' tentative' : '');
    badge.textContent = node.mode;
    row.appendChild(badge);
  }

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = node.name;
  if (node.id) name.title = node.id;
  row.appendChild(name);

  if (node.mode === 'SV') {
    const v = document.createElement('span');
    v.className = 'value';
    v.textContent = ' = ' + formatValue(node.value);
    row.appendChild(v);
    if (opts.diff && node.__change === 'value_changed') {
      const before = document.createElement('span');
      before.className = 'muted';
      before.textContent = `  (was ${formatValue(node.__before)})`;
      row.appendChild(before);
    }
  } else if (hasChildren) {
    const countEl = document.createElement('span');
    countEl.className = 'value';
    countEl.textContent = ` (${node.children.length})`;
    row.appendChild(countEl);
  }

  const onRowClick = (e) => {
    if (e.target === caret) return;
    if (hasChildren && e.shiftKey) toggle(node.id);
    selectedId = node.id;
    refreshActive();
    updateBreadcrumb(node.id);
    updateDetail(node);
    updateRefreshEnabled();
  };
  const onCaret = (e) => { e.stopPropagation(); toggle(node.id); refreshActive(); };
  caret.addEventListener('click', onCaret);
  row.addEventListener('click', onRowClick);
  row.addEventListener('contextmenu', (e) => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, node); });

  elN.appendChild(row);

  if (hasChildren && isExpanded(node, opts)) {
    const kids = document.createElement('div');
    kids.className = 'children';
    kids.setAttribute('role', 'group');
    for (const c of node.children) {
      if (opts.diff && opts.onlyChanges && !subtreeHasChange(c)) continue;
      kids.appendChild(renderNode(c, opts));
    }
    elN.appendChild(kids);
  }
  return elN;
}

function isExpanded(node, opts) {
  if (opts && opts.forceExpand) return true;
  if (searchAncestors.has(node.id)) return true;
  return expanded.has(node.id);
}
function subtreeHasChange(node) {
  if (node.__change && node.__change !== 'unchanged') return true;
  if (node.children) for (const c of node.children) if (subtreeHasChange(c)) return true;
  return false;
}
function formatValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

let currentTree = null;
function setTree(tree) {
  glowSince = Date.now() - 2500;
  currentTree = tree;
  refreshTree();
  if (selectedId) {
    const n = findById(currentTree, selectedId);
    if (n) updateDetail(n);
  }
  updateRefreshEnabled();
}
function refreshTree() {
  if (!currentTree) return;
  treeEl.textContent = '';
  treeEl.appendChild(renderNode(currentTree));
}
function findById(root, id) {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    if (n.id === id) return n;
    if (n.children) for (const c of n.children) stack.push(c);
  }
  return null;
}

// ---- Breadcrumb + detail ---------------------------------------------------

function updateBreadcrumb(id) {
  breadcrumbEl.textContent = '';
  if (!id) return;
  const parts = id.split('.');
  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.slice(0, i + 1).join('.');
    const a = document.createElement('a');
    a.textContent = parts[i];
    a.addEventListener('click', () => {
      selectedId = prefix;
      const n = findById(currentTree, prefix);
      if (n) updateDetail(n);
      updateRefreshEnabled();
      refreshActive();
    });
    breadcrumbEl.appendChild(a);
    if (i < parts.length - 1) breadcrumbEl.appendChild(document.createTextNode(' › '));
  }
}

function updateDetail(node) {
  detailEl.textContent = '';
  if (!node) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = t('detail.empty'); detailEl.appendChild(p); return; }
  const dl = document.createElement('dl');
  addDt(dl, 'Path', node.id || '(root)');
  addDt(dl, 'Mode', node.mode + (node.isTentative ? '?' : ''));
  if (node.mode === 'SV') {
    addDt(dl, 'Type', node.valueType || '—');
    addDt(dl, 'Value', formatValue(node.value));
  } else if (node.children) {
    addDt(dl, 'Children', String(node.children.length));
  }
  if (node.sourceUrls && node.sourceUrls.length) {
    addDt(dl, 'Source', node.sourceUrls[node.sourceUrls.length - 1]);
  }
  if (node.lastUpdated) {
    addDt(dl, 'Updated', new Date(node.lastUpdated).toLocaleTimeString());
  }
  if (node.isPartial) addDt(dl, 'Flags', 'partial');
  if (node.isStale) addDt(dl, 'Flags', 'stale');
  detailEl.appendChild(dl);

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.appendChild(makeBtn('Copy path', () => copyToClipboard(node.id || '')));
  actions.appendChild(makeBtn('Copy value', () => copyToClipboard(asValueString(node))));
  detailEl.appendChild(actions);
}
function addDt(dl, term, desc) {
  const dt = document.createElement('dt'); dt.textContent = term;
  const dd = document.createElement('dd'); dd.textContent = desc;
  dl.appendChild(dt); dl.appendChild(dd);
}
function makeBtn(text, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', fn); return b; }

function asValueString(node) {
  if (!node) return '';
  if (node.mode === 'SV') return formatValue(node.value);
  return JSON.stringify(nodeToPlain(node), null, 2);
}
function nodeToPlain(node) {
  if (!node) return null;
  if (node.mode === 'SV') return node.value ?? null;
  const children = node.children || [];
  if (node.mode === 'PL' || node.mode === 'VL') return children.map(nodeToPlain);
  const out = {}; for (const c of children) { if (c.name === '__proto__' || c.name === 'constructor' || c.name === 'prototype') continue; out[c.name] = nodeToPlain(c); } return out;
}
function copyToClipboard(text) {
  try { navigator.clipboard.writeText(text); } catch { /* ignore */ }
}

// ---- Context menu ----------------------------------------------------------

function openContextMenu(x, y, node) {
  ctxmenu.textContent = '';
  ctxmenu.appendChild(makeBtn('Copy path', () => { copyToClipboard(node.id || ''); closeContextMenu(); }));
  ctxmenu.appendChild(makeBtn('Copy value', () => { copyToClipboard(asValueString(node)); closeContextMenu(); }));
  ctxmenu.appendChild(makeBtn('Select node', () => {
    selectedId = node.id;
    updateBreadcrumb(node.id);
    updateDetail(node);
    updateRefreshEnabled();
    refreshActive();
    closeContextMenu();
  }));
  ctxmenu.style.left = `${x}px`;
  ctxmenu.style.top = `${y}px`;
  ctxmenu.classList.remove('hidden');
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}
function closeContextMenu() { ctxmenu.classList.add('hidden'); }

// ---- Diff rendering --------------------------------------------------------

let currentDiff = null;
function setDiff(result) {
  currentDiff = result;
  diffSummary.textContent = t('diff.summary', result.summary);
  renderDiff();
}
function renderDiff() {
  if (!currentDiff) return;
  diffTreeEl.textContent = '';
  diffTreeEl.appendChild(renderNode(currentDiff.tree, { diff: true, onlyChanges: diffFilter.checked, forceExpand: true }));
}
diffFilter.addEventListener('change', renderDiff);
diffBack.addEventListener('click', () => activateTab('snapshots'));

function refreshActive() {
  if (!panes.compare.classList.contains('hidden')) renderDiff();
  else refreshTree();
}

// ---- Search ----------------------------------------------------------------

let searchRequestId = 0;
let searchDebounce = null;

function runSearchRemote() {
  const q = searchInput.value;
  if (!q.trim()) {
    searchMatches = new Set();
    searchAncestors = new Set();
    searchCount.textContent = '';
    refreshActive();
    return;
  }
  if (!port) return;
  const requestId = ++searchRequestId;
  port.postMessage({ type: 'search', requestId, query: q, scope: searchScope.value, currentCaseId: pickCurrentCaseId() });
}
function pickCurrentCaseId() {
  if (selectedId && selectedId.startsWith('Cases.')) return selectedId.split('.')[1];
  if (!currentTree) return undefined;
  const cases = currentTree.children.find((n) => n.id === 'Cases');
  if (!cases || !cases.children || cases.children.length === 0) return undefined;
  return cases.children[cases.children.length - 1].id.replace(/^Cases\./, '');
}
searchInput.addEventListener('input', () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(runSearchRemote, 80); });
searchScope.addEventListener('change', runSearchRemote);
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchInput.value = ''; runSearchRemote(); } });

// ---- Snapshots -------------------------------------------------------------

let snapshots = [];
let selA = null, selB = null;
function renderSnapshots() {
  snapRows.textContent = '';
  snapCount.textContent = plural(t, 'snapshots.count', snapshots.length);
  for (const s of snapshots) {
    const tr = document.createElement('tr');
    tr.appendChild(radioCell('A', s.id, selA, (id) => { selA = id; updateCompareBtn(); }));
    tr.appendChild(radioCell('B', s.id, selB, (id) => { selB = id; updateCompareBtn(); }));
    tr.appendChild(tdText(s.label));
    tr.appendChild(tdText(new Date(s.createdAt).toLocaleTimeString()));
    tr.appendChild(tdText(String(s.eventCount)));
    const act = document.createElement('td');
    const del = makeBtn('Delete', () => { if (port) port.postMessage({ type: 'snapshot:delete', id: s.id }); });
    act.appendChild(del);
    tr.appendChild(act);
    snapRows.appendChild(tr);
  }
  updateCompareBtn();
}
function radioCell(group, id, selected, onPick) {
  const td = document.createElement('td');
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = `sel-${group}-${tabId || 'x'}`;
  input.checked = selected === id;
  input.addEventListener('change', () => onPick(id));
  label.appendChild(input);
  td.appendChild(label);
  return td;
}
function tdText(text) { const td = document.createElement('td'); td.textContent = text; return td; }
function updateCompareBtn() { snapCompareBtn.disabled = !(selA && selB && selA !== selB); }

snapTakeBtn.addEventListener('click', () => { if (port) port.postMessage({ type: 'snapshot:take', label: defaultLabel() }); });
function defaultLabel() { return new Date().toLocaleTimeString(); }
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (port) port.postMessage({ type: 'snapshot:take', label: defaultLabel() }); }
});

let compareRequestId = 0;
snapCompareBtn.addEventListener('click', () => {
  if (!selA || !selB || !port) return;
  tabs.compare.classList.remove('hidden');
  port.postMessage({ type: 'snapshot:compare', requestId: ++compareRequestId, a: selA, b: selB });
});

// ---- Live / Pause ----------------------------------------------------------

let paused = false;
function updateLiveButton(queued, dropped) {
  liveToggle.setAttribute('aria-pressed', String(paused));
  if (paused) {
    liveToggle.textContent = queued > 0 ? t('toolbar.paused_with_queue', { queued }) : t('toolbar.paused');
    if (dropped > 0) liveToggle.title = `${dropped} events dropped due to queue cap`;
  } else {
    liveToggle.textContent = t('toolbar.live');
    liveToggle.title = '';
  }
}
liveToggle.addEventListener('click', () => {
  paused = !paused;
  if (port) port.postMessage({ type: paused ? 'live:pause' : 'live:resume' });
});

// ---- Refresh ---------------------------------------------------------------

let refreshRequestId = 0;
function updateRefreshEnabled() {
  const id = selectedId || '';
  const ok = id.startsWith('Cases.') || id.startsWith('DataPages.');
  refreshBtn.disabled = !ok;
  refreshBtn.title = ok ? t('toolbar.refresh_hint_enabled') : t('toolbar.refresh_hint_disabled');
}
refreshBtn.addEventListener('click', () => {
  if (!selectedId || !port) return;
  port.postMessage({ type: 'refresh:plan', requestId: ++refreshRequestId, nodeId: selectedId });
});

// Runs inside the inspected page's MAIN world via chrome.scripting; our own
// fetch wrapper captures the re-issued GET the normal way.
function refreshInPage(url) {
  try {
    var u = new URL(url, window.location.href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    if (u.origin !== window.location.origin) return;
    fetch(u.href, { credentials: 'include', method: 'GET' }).catch(function () {});
  } catch (e) {}
}
function triggerPageRefresh(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
  if (tabId == null) return;
  try {
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: refreshInPage,
      args: [url]
    }).catch(() => {});
  } catch { /* ignore */ }
}

// ---- Keyboard nav ----------------------------------------------------------

function syncActiveDescendant() {
  if (selectedId) treeEl.setAttribute('aria-activedescendant', `dxnode-${selectedId.replace(/[^a-z0-9]/gi, '-')}`);
  else treeEl.removeAttribute('aria-activedescendant');
}
treeEl.addEventListener('keydown', (e) => {
  const handled = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!handled.includes(e.key)) return;
  if (!currentTree) return;
  e.preventDefault();
  const rows = flattenVisible(currentTree, expanded);
  const r = keyStep({ rows, expanded, selectedId }, e.key);
  if (r.expand) expanded.add(r.expand);
  if (r.collapse) expanded.delete(r.collapse);
  if (r.selectedId !== selectedId) {
    selectedId = r.selectedId;
    const n = findById(currentTree, selectedId);
    if (n) { updateBreadcrumb(n.id); updateDetail(n); updateRefreshEnabled(); }
    syncActiveDescendant();
  }
  refreshActive();
});

// ---- Port wiring + active-tab rebind --------------------------------------

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ? tab.id : null;
}

function connect() {
  if (tabId == null) { stats.textContent = 'no active tab'; return; }
  tabLabel.textContent = `tab ${tabId}`;
  port = chrome.runtime.connect({ name: `panel:${tabId}` });
  port.onMessage.addListener(onPortMessage);
  port.onDisconnect.addListener(() => { stats.textContent = t('stats.disconnected'); port = null; });
}

function disconnect() {
  if (port) try { port.disconnect(); } catch {}
  port = null;
}

function hardReset() {
  resetRows();
  currentTree = null;
  treeEl.textContent = '';
  selectedId = null;
  updateBreadcrumb('');
  updateDetail(null);
  updateRefreshEnabled();
  snapshots = []; selA = null; selB = null; renderSnapshots();
}

async function boot() {
  disconnect();
  hardReset();
  tabId = await activeTabId();
  connect();
}

reReadBtn.addEventListener('click', boot);

clearBtn.addEventListener('click', () => {
  if (port) try { port.postMessage({ type: 'clear' }); } catch { /* ignore */ }
  // Don't hardReset here — wait for the SW's `cleared` broadcast so the tree
  // redraw matches the authoritative server-side state.
});

chrome.tabs.onActivated.addListener(async () => {
  const next = await activeTabId();
  if (next !== tabId) boot();
});

function onPortMessage(msg) {
  if (!msg) return;
  switch (msg.type) {
    case 'hello':
      resetRows();
      for (const ev of (msg.buffer || [])) appendRow(ev);
      break;
    case 'event':
      appendRow(msg.event);
      break;
    case 'cleared':
      hardReset();
      searchInput.value = '';
      runSearchRemote();
      break;
    case 'tree:replace':
      setTree(msg.tree);
      break;
    case 'snapshots:update':
      snapshots = msg.snapshots || [];
      if (!snapshots.some((s) => s.id === selA)) selA = null;
      if (!snapshots.some((s) => s.id === selB)) selB = null;
      renderSnapshots();
      break;
    case 'snapshot:diff':
      if (msg.ok) { setDiff(msg.result); activateTab('compare'); }
      else diffSummary.textContent = `error: ${msg.error}`;
      break;
    case 'search:result': {
      if (msg.requestId !== searchRequestId) break;
      const matches = msg.matches || [];
      searchMatches = new Set(matches.map((m) => m.id));
      searchAncestors = new Set();
      for (const m of matches) {
        const parts = m.id.split('.');
        for (let i = 1; i < parts.length; i++) searchAncestors.add(parts.slice(0, i).join('.'));
      }
      searchAncestors.add('');
      searchCount.textContent = matches.length ? plural(t, 'search.matches', matches.length) : t('search.no_matches');
      refreshActive();
      break;
    }
    case 'live:state':
      paused = !!msg.paused;
      updateLiveButton(msg.queued || 0, msg.dropped || 0);
      break;
    case 'stats':
      if (msg.stats) {
        const s = msg.stats;
        stats.textContent = `${s.totalEvents} evt · ${(s.eventsPerSec || 0).toFixed(1)}/s · ${kb(s.totalBytes)}`;
      }
      break;
    case 'refresh:plan':
      if (msg.plan && msg.plan.url) triggerPageRefresh(msg.plan.url);
      break;
    case 'settings': /* no UI binding needed in side panel */ break;
  }
}

function kb(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// init
updateRefreshEnabled();
updateLiveButton(0, 0);
boot();
