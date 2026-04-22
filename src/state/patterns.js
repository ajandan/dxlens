// Shared URL patterns matcher (spec/01 §URL pattern matching).
// The capture layer (MAIN-world injected.js), the benchmark, and the options
// page all need the same matching function to stay consistent.

export const DEFAULT_PATTERNS = Object.freeze([
  '/prweb/api/application/v',
  '/prweb/api/v',
  '/prweb/PRRestService/',
  '/api/application/v',
  '/api/v1/',
  '/api/v2/',
  '/prweb/app/',
  '/constellation/api/'
]);

/**
 * Return true if `url` contains any of the substring patterns. Empty pattern
 * list matches nothing (fail-closed). Non-string inputs return false.
 */
export function matches(url, patterns) {
  if (typeof url !== 'string' || !url) return false;
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    if (typeof p === 'string' && p.length > 0 && url.indexOf(p) !== -1) return true;
  }
  return false;
}

/** Convenience: use the default pattern list. */
export function matchesDefault(url) { return matches(url, DEFAULT_PATTERNS); }
