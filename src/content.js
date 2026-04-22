// Isolated-world relay (spec/06 §Inter-component communication).
// Listens for MAIN-world postMessage events and forwards to the service worker
// after validating the event shape — a page script could postMessage with
// `__dxlens__: true` and spoof capture events; we drop anything that doesn't
// match the schema.

(() => {
  const MARKER = '__dxlens__';
  const ALLOWED_KINDS = new Set(['dx_response', 'dx_error']);
  const MAX_STRING = 4 * 1024 * 1024;           // 4 MB per string field hard ceiling
  const ALLOWED_TOP_KEYS = new Set([
    'kind', 'url', 'method', 'status', 'durationMs',
    'requestBody', 'responseBody',
    'error', 'startedAt', 'finishedAt',
    'truncated', 'bodyUnavailable'
  ]);

  function isFinitePositive(n) { return typeof n === 'number' && isFinite(n) && n >= 0; }

  function validate(ev) {
    if (!ev || typeof ev !== 'object') return false;
    if (!ALLOWED_KINDS.has(ev.kind)) return false;
    if (typeof ev.url !== 'string' || ev.url.length === 0 || ev.url.length > MAX_STRING) return false;
    if (typeof ev.method !== 'string' || ev.method.length > 16) return false;
    if (ev.status !== undefined && typeof ev.status !== 'number') return false;
    if (!isFinitePositive(ev.durationMs)) return false;
    if (!isFinitePositive(ev.startedAt)) return false;
    if (!isFinitePositive(ev.finishedAt)) return false;
    if (ev.kind === 'dx_error' && typeof ev.error !== 'string') return false;
    for (const k of Object.keys(ev)) if (!ALLOWED_TOP_KEYS.has(k)) return false;
    return true;
  }

  // Forward settings pushed from the SW into the MAIN world (patterns, etc.).
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'config') return;
    try {
      window.postMessage({ __dxlens_config__: true, patterns: msg.patterns }, '*');
    } catch { /* ignore */ }
  });

  // Ask the SW for the current settings on startup.
  try { chrome.runtime.sendMessage({ type: 'config:request' }); } catch { /* ignore */ }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data[MARKER] !== true || !data.event) return;
    if (!validate(data.event)) return;
    try {
      chrome.runtime.sendMessage({ type: 'capture', event: data.event });
    } catch { /* SW may be terminating; drop silently */ }
  }, false);
})();
