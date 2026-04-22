// Capture stats accumulator (spec/08 §Observability).
// Deterministic with an injectable clock. No DOM, no chrome.*.

const DEFAULT_WINDOW_MS = 10_000;

/**
 * Create a per-tab stats accumulator.
 *   opts.now         — () => epoch ms
 *   opts.windowMs    — rolling window for events/sec
 */
export function createStats({ now = () => Date.now(), windowMs = DEFAULT_WINDOW_MS } = {}) {
  let totalEvents = 0;
  let totalBytes = 0;
  let firstAt = 0;
  let lastAt = 0;
  /** @type {Array<{ at: number, bytes: number }>} */
  const window = [];

  function record(event) {
    const at = now();
    const bytes = estimateBytes(event);
    totalEvents += 1;
    totalBytes += bytes;
    if (firstAt === 0) firstAt = at;
    lastAt = at;
    window.push({ at, bytes });
    evict(at);
  }

  function evict(at) {
    const cutoff = at - windowMs;
    while (window.length && window[0].at < cutoff) window.shift();
  }

  function snapshot() {
    evict(now());
    const windowEvents = window.length;
    const windowBytes = window.reduce((sum, e) => sum + e.bytes, 0);
    const eventsPerSec = windowMs > 0 ? (windowEvents * 1000) / windowMs : 0;
    return {
      totalEvents,
      totalBytes,
      firstAt: firstAt || null,
      lastAt: lastAt || null,
      windowMs,
      windowEvents,
      windowBytes,
      eventsPerSec
    };
  }

  function reset() {
    totalEvents = 0;
    totalBytes = 0;
    firstAt = 0;
    lastAt = 0;
    window.length = 0;
  }

  return { record, snapshot, reset };
}

/**
 * Cheap, deterministic byte estimate for an event. JSON-stringify; fall back
 * to an upper bound on failure. Used for footprint reporting only.
 */
export function estimateBytes(event) {
  if (!event) return 0;
  try {
    // String bodies get their own length; other fields get a small constant overhead.
    let bytes = 0;
    if (typeof event.responseBody === 'string') bytes += event.responseBody.length;
    else if (event.responseBody !== undefined) bytes += JSON.stringify(event.responseBody).length;
    if (typeof event.requestBody === 'string') bytes += event.requestBody.length;
    else if (event.requestBody !== undefined) bytes += JSON.stringify(event.requestBody).length;
    bytes += (event.url || '').length;
    bytes += 32; // method, status, timings, misc overhead
    return bytes;
  } catch {
    return 256;
  }
}
