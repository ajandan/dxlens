// Prototype-pollution guard.
// Any code that builds a plain JS object from attacker-controlled keys (DX
// response bodies here) must skip these reserved names, or a malicious
// payload like `{ "__proto__": { "polluted": true } }` would set the
// prototype of the produced object when assigned with bracket notation.

export const UNSAFE_KEYS = Object.freeze(['__proto__', 'constructor', 'prototype']);

export function isUnsafeKey(key) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * Defensively assign `obj[key] = value` if the key is safe; returns a boolean
 * so callers can choose to count or log drops.
 */
export function safeAssign(obj, key, value) {
  if (isUnsafeKey(key)) return false;
  obj[key] = value;
  return true;
}
