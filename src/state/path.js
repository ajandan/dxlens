// Pega dotted-path parsing (spec/02 §Dotted-notation paths, D-009).
// Grammar:
//   path      = segment ("." segment)*
//   segment   = name | name "(" index ")"
//   name      = one or more chars not in ".()"
//   index     = 1+ ASCII digit (1-indexed; 0 is invalid)
// Pure. No DOM, no chrome.*.

/** @typedef {{ name: string, index?: number }} PathSegment */

const SEGMENT_RE = /^([^.()]+)(?:\((\d+)\))?$/;

/**
 * Parse a dotted path into ordered segments.
 * Throws Error on malformed input (unbalanced parens, zero/negative index,
 * empty segment names).
 *
 * @param {string} path
 * @returns {PathSegment[]}
 */
export function parsePath(path) {
  if (path === '' || path == null) return [];
  if (typeof path !== 'string') throw new Error('path must be a string');
  const parts = path.split('.');
  const out = [];
  for (const raw of parts) {
    if (raw === '') throw new Error(`empty segment in path: ${path}`);
    const m = SEGMENT_RE.exec(raw);
    if (!m) throw new Error(`malformed segment "${raw}" in path: ${path}`);
    const name = m[1];
    if (m[2] !== undefined) {
      const idx = Number(m[2]);
      if (!Number.isInteger(idx) || idx < 1) throw new Error(`non-positive index in segment "${raw}"`);
      out.push({ name, index: idx });
    } else {
      out.push({ name });
    }
  }
  return out;
}

/**
 * Serialize an array of segments back to a dotted 1-indexed path.
 * @param {PathSegment[]} segments
 * @returns {string}
 */
export function joinSegments(segments) {
  if (!Array.isArray(segments)) throw new Error('segments must be an array');
  return segments.map((s) => {
    if (!s || typeof s.name !== 'string' || s.name === '') throw new Error('segment.name required');
    if (s.index != null) {
      if (!Number.isInteger(s.index) || s.index < 1) throw new Error(`non-positive index on segment "${s.name}"`);
      return `${s.name}(${s.index})`;
    }
    return s.name;
  }).join('.');
}

/**
 * Normalize a path string: parse + re-serialize. Throws on malformed input.
 * Useful for trimming whitespace-inside-segments problems at the edges.
 */
export function normalizePath(path) {
  return joinSegments(parsePath(path));
}

/** Simple splitter that doesn't validate — keeps backwards compatibility with
 *  the flat-string split used by search indexing. Prefer parsePath elsewhere. */
export function splitPath(path) {
  if (!path) return [];
  return path.split('.');
}

/** Returns true if `child` is a strict descendant of `ancestor` (by dotted ids). */
export function isDescendantPath(ancestor, child) {
  if (!ancestor) return !!child;
  if (!child || child === ancestor) return false;
  return child.startsWith(ancestor + '.');
}

/** Ancestor ids of a path in order from top to the direct parent. */
export function ancestorPaths(path) {
  const parts = splitPath(path);
  const out = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('.'));
  return out;
}

/** Parent path or '' for a top-level id. */
export function parentPath(path) {
  const i = path.lastIndexOf('.');
  return i < 0 ? '' : path.slice(0, i);
}
