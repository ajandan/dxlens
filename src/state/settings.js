// Pure settings module (spec/05 §Settings, spec/07 §Data minimization).
// chrome.storage.local wiring lives in the service worker; this module stays
// testable in Node.

import { MAX_CAP as SNAP_MAX_CAP } from './snapshot.js';

export const MIN_SNAPSHOTS = 1;
export const MIN_BODY_LIMIT_BYTES = 16 * 1024;        // 16 KB
export const MAX_BODY_LIMIT_BYTES = 8 * 1024 * 1024;  //  8 MB

export const DEFAULT_SETTINGS = Object.freeze({
  urlPatterns: Object.freeze([
    '/prweb/api/application/v',
    '/prweb/api/v',
    '/prweb/PRRestService/',
    '/api/application/v'
  ]),
  snapshotCap: 5,
  bodyLimitBytes: 2 * 1024 * 1024,
  theme: 'devtools', // 'devtools' | 'dark' | 'light'
  reducedMotion: 'auto', // 'auto' | 'on' | 'off'
  autoSnapshot: true // spec/03 §Auto-snapshot (v1.x) — on by default so screen history accumulates
});

const VALID_THEMES = ['devtools', 'dark', 'light'];
const VALID_MOTION = ['auto', 'on', 'off'];

/**
 * Return a fully-populated, validated settings object by merging a partial
 * update over the defaults. Clamps numeric fields; drops unknown keys.
 */
export function mergeSettings(partial = {}) {
  // Spread clones primitives; urlPatterns is frozen so we fork a mutable copy.
  const out = { ...DEFAULT_SETTINGS, urlPatterns: DEFAULT_SETTINGS.urlPatterns.slice() };
  if (Array.isArray(partial.urlPatterns)) {
    const cleaned = partial.urlPatterns
      .filter((p) => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim());
    if (cleaned.length > 0) out.urlPatterns = cleaned;
  }
  if (typeof partial.snapshotCap === 'number' && Number.isFinite(partial.snapshotCap)) {
    out.snapshotCap = clamp(Math.floor(partial.snapshotCap), MIN_SNAPSHOTS, SNAP_MAX_CAP);
  }
  if (typeof partial.bodyLimitBytes === 'number' && Number.isFinite(partial.bodyLimitBytes)) {
    out.bodyLimitBytes = clamp(Math.floor(partial.bodyLimitBytes), MIN_BODY_LIMIT_BYTES, MAX_BODY_LIMIT_BYTES);
  }
  if (typeof partial.theme === 'string' && VALID_THEMES.includes(partial.theme)) {
    out.theme = partial.theme;
  }
  if (typeof partial.reducedMotion === 'string' && VALID_MOTION.includes(partial.reducedMotion)) {
    out.reducedMotion = partial.reducedMotion;
  }
  if (typeof partial.autoSnapshot === 'boolean') out.autoSnapshot = partial.autoSnapshot;
  return out;
}

/**
 * Return { ok, errors: string[] } describing whether the supplied object
 * conforms to the expected shape. Strict: unknown keys cause failure.
 */
export function validateSettings(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { ok: false, errors: ['settings must be an object'] };
  }
  const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
  for (const k of Object.keys(obj)) if (!allowed.has(k)) errors.push(`unknown key: ${k}`);

  if (!Array.isArray(obj.urlPatterns) || obj.urlPatterns.length === 0) {
    errors.push('urlPatterns must be a non-empty array');
  } else if (!obj.urlPatterns.every((p) => typeof p === 'string' && p.trim().length > 0)) {
    errors.push('urlPatterns entries must be non-empty strings');
  }

  if (typeof obj.snapshotCap !== 'number' || !Number.isFinite(obj.snapshotCap) ||
      obj.snapshotCap < MIN_SNAPSHOTS || obj.snapshotCap > SNAP_MAX_CAP) {
    errors.push(`snapshotCap must be a number in [${MIN_SNAPSHOTS}, ${SNAP_MAX_CAP}]`);
  }

  if (typeof obj.bodyLimitBytes !== 'number' || !Number.isFinite(obj.bodyLimitBytes) ||
      obj.bodyLimitBytes < MIN_BODY_LIMIT_BYTES || obj.bodyLimitBytes > MAX_BODY_LIMIT_BYTES) {
    errors.push(`bodyLimitBytes must be a number in [${MIN_BODY_LIMIT_BYTES}, ${MAX_BODY_LIMIT_BYTES}]`);
  }

  if (!VALID_THEMES.includes(obj.theme)) errors.push(`theme must be one of ${VALID_THEMES.join(', ')}`);
  if (!VALID_MOTION.includes(obj.reducedMotion)) errors.push(`reducedMotion must be one of ${VALID_MOTION.join(', ')}`);
  if (typeof obj.autoSnapshot !== 'boolean') errors.push('autoSnapshot must be a boolean');

  return { ok: errors.length === 0, errors };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
