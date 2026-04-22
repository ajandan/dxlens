// MAIN-world fetch/XHR interception (spec/01 §Interception strategy).
// Runs at document_start, before the Constellation bundle.
// Read-only: original responses are returned unmodified (spec/07 §Core guarantees).
(() => {
  if (window.__dxlens_installed__) return;
  window.__dxlens_installed__ = true;

  const MARKER = '__dxlens__';
  // Kept in sync with src/state/patterns.js (source of truth); a drift-detector
  // test asserts both lists match. MAIN-world scripts cannot ESM-import.
  const DEFAULT_PATTERNS = [
    '/prweb/api/application/v',
    '/prweb/api/v',
    '/prweb/PRRestService/',
    '/api/application/v',
    '/api/v1/',
    '/api/v2/',
    '/prweb/app/',
    '/constellation/api/'
  ];
  let patterns = DEFAULT_PATTERNS;

  // Listen for pattern updates pushed from the SW via the isolated-world relay.
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__dxlens_config__ !== true) return;
    if (Array.isArray(d.patterns) && d.patterns.length > 0) {
      patterns = d.patterns.filter((p) => typeof p === 'string' && p.length > 0);
    }
  }, false);

  const MAX_BODY_BYTES = 2 * 1024 * 1024;
  const TRUNCATE_CHARS = 512 * 1024;

  const origDateNow = Date.now.bind(Date);
  const origFetch = window.fetch;
  const origPostMessage = window.postMessage.bind(window);

  const BIN_RE = /(^|;)\s*(image|audio|video|application\/octet-stream|application\/pdf)/i;

  function matches(url) {
    for (let i = 0; i < patterns.length; i++) {
      if (url.indexOf(patterns[i]) !== -1) return true;
    }
    return false;
  }

  function emit(event) {
    try {
      origPostMessage({ [MARKER]: true, event }, '*');
    } catch { /* never break the page */ }
  }

  function maybeTruncate(text) {
    if (typeof text !== 'string') return { value: text, truncated: false };
    if (text.length * 2 > MAX_BODY_BYTES) {
      return { value: text.slice(0, TRUNCATE_CHARS), truncated: true };
    }
    return { value: text, truncated: false };
  }

  function parseBody(text, contentType) {
    const t = maybeTruncate(text);
    const ct = contentType || '';
    const isJson = ct.indexOf('json') !== -1 ||
      (t.value.length > 0 && (t.value[0] === '{' || t.value[0] === '['));
    if (isJson) {
      try {
        return { body: JSON.parse(t.value), truncated: t.truncated };
      } catch { /* fall through to text */ }
    }
    return { body: t.value, truncated: t.truncated };
  }

  function parseMaybeJson(s) {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return s; }
  }

  // --- fetch ---
  function dxlensFetch(input, init) {
    let url = '';
    let method = 'GET';
    try {
      if (typeof input === 'string') {
        url = input;
      } else if (input && typeof input.url === 'string') {
        url = input.url;
        method = input.method || method;
      }
      if (init && init.method) method = String(init.method).toUpperCase();
    } catch { /* ignore */ }

    if (!url || !matches(url)) {
      return origFetch.apply(this, arguments);
    }

    const startedAt = origDateNow();
    let requestBody;
    try {
      if (init && typeof init.body === 'string') {
        requestBody = parseMaybeJson(init.body);
      }
    } catch { /* ignore */ }

    return origFetch.apply(this, arguments).then((response) => {
      const finishedAt = origDateNow();
      try {
        const ct = response.headers.get('content-type') || '';
        if (BIN_RE.test(ct)) {
          emit({
            kind: 'dx_response',
            url, method,
            status: response.status,
            durationMs: finishedAt - startedAt,
            requestBody,
            bodyUnavailable: true,
            startedAt, finishedAt
          });
          return response;
        }
        const clone = response.clone();
        clone.text().then((text) => {
          const { body, truncated } = parseBody(text, ct);
          emit({
            kind: 'dx_response',
            url, method,
            status: response.status,
            durationMs: finishedAt - startedAt,
            requestBody,
            responseBody: body,
            truncated: truncated || undefined,
            startedAt, finishedAt
          });
        }).catch(() => {
          emit({
            kind: 'dx_response',
            url, method,
            status: response.status,
            durationMs: finishedAt - startedAt,
            requestBody,
            bodyUnavailable: true,
            startedAt, finishedAt
          });
        });
      } catch { /* never break the page */ }
      return response;
    }, (error) => {
      const finishedAt = origDateNow();
      emit({
        kind: 'dx_error',
        url, method,
        durationMs: finishedAt - startedAt,
        requestBody,
        error: (error && error.message) || String(error),
        startedAt, finishedAt
      });
      throw error;
    });
  }
  // Install via defineProperty so any bundle that re-reads window.fetch gets
  // our wrapper. Also guards against a page assignment overwriting us.
  try {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      get() { return dxlensFetch; },
      set(v) { /* ignore replacement attempts — leave wrapper in place */ }
    });
  } catch {
    window.fetch = dxlensFetch;
  }

  // --- XHR ---
  const XhrProto = window.XMLHttpRequest.prototype;
  const origOpen = XhrProto.open;
  const origSend = XhrProto.send;

  XhrProto.open = function(method, url) {
    try {
      const u = String(url || '');
      this.__dxlens__ = {
        url: u,
        method: String(method || 'GET').toUpperCase(),
        matched: matches(u),
        startedAt: 0
      };
    } catch { /* ignore */ }
    return origOpen.apply(this, arguments);
  };

  XhrProto.send = function(body) {
    const meta = this.__dxlens__;
    if (!meta || !meta.matched) return origSend.apply(this, arguments);
    meta.startedAt = origDateNow();
    if (typeof body === 'string') meta.requestBody = parseMaybeJson(body);

    const onLoadEnd = () => {
      this.removeEventListener('loadend', onLoadEnd);
      try {
        const finishedAt = origDateNow();
        if (this.readyState !== 4) return;
        const ct = (this.getResponseHeader && this.getResponseHeader('content-type')) || '';
        const isBin = BIN_RE.test(ct);
        let responseBody, truncated, bodyUnavailable;
        if (isBin) {
          bodyUnavailable = true;
        } else {
          const text = typeof this.responseText === 'string' ? this.responseText : '';
          const parsed = parseBody(text, ct);
          responseBody = parsed.body;
          truncated = parsed.truncated || undefined;
        }
        emit({
          kind: 'dx_response',
          url: meta.url,
          method: meta.method,
          status: this.status,
          durationMs: finishedAt - meta.startedAt,
          requestBody: meta.requestBody,
          responseBody,
          truncated,
          bodyUnavailable,
          startedAt: meta.startedAt,
          finishedAt
        });
      } catch { /* never break the page */ }
    };

    const onError = () => {
      this.removeEventListener('error', onError);
      const finishedAt = origDateNow();
      emit({
        kind: 'dx_error',
        url: meta.url,
        method: meta.method,
        durationMs: finishedAt - meta.startedAt,
        requestBody: meta.requestBody,
        error: 'XHR error',
        startedAt: meta.startedAt,
        finishedAt
      });
    };

    this.addEventListener('loadend', onLoadEnd);
    this.addEventListener('error', onError);
    return origSend.apply(this, arguments);
  };

  // Re-wrap if the page replaces window.fetch after we install (spec/01 §Failure modes).
  setInterval(() => {
    if (window.fetch !== dxlensFetch) {
      try { window.fetch = dxlensFetch; } catch { /* ignore */ }
    }
  }, 5000);
})();
