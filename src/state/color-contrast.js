// WCAG 2.1 relative-luminance + contrast-ratio checker (spec/08 §Accessibility).
// Pure. Implements the algorithm verbatim from WCAG:
//   https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
//   https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

/** Parse "#rrggbb" or "#rgb" into {r,g,b} 0–255. Throws on malformed input. */
export function parseHex(hex) {
  if (typeof hex !== 'string') throw new Error('hex must be a string');
  let s = hex.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) throw new Error(`invalid hex color: ${hex}`);
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16)
  };
}

/** WCAG relative luminance (0..1) for an RGB color. */
export function luminance({ r, g, b }) {
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between two RGB colors (≥1, up to 21). */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Convenience: contrastRatio of two hex strings. */
export function contrastHex(a, b) {
  return contrastRatio(parseHex(a), parseHex(b));
}

/** WCAG AA thresholds. */
export const AA_NORMAL = 4.5;
export const AA_LARGE  = 3.0;

/** Pass/fail helper for normal text at AA. */
export function passesAA(fgHex, bgHex) {
  return contrastHex(fgHex, bgHex) >= AA_NORMAL;
}
