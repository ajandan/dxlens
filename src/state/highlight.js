// Search highlight helper (spec/04 §Result presentation — matches visually
// distinguished inside node labels and values).
// Pure: given a string and the same query used by search.runSearch, return the
// ordered ranges [{text, hit}] for the panel to render.
//
// Matching rules mirror search.js: quoted phrase → exact substring; leading
// "." → path prefix (hits the full needle inside the text); plain substring.

/**
 * @param {string} text
 * @param {string} query
 * @returns {Array<{ text: string, hit: boolean }>}
 */
export function highlightRanges(text, query) {
  if (text == null) return [{ text: '', hit: false }];
  const s = String(text);
  const needle = normalizeQuery(query);
  if (!needle) return [{ text: s, hit: false }];

  const sLc = s.toLowerCase();
  const needleLc = needle.toLowerCase();
  if (!needleLc || needleLc.length > sLc.length) return [{ text: s, hit: false }];

  const ranges = [];
  let i = 0;
  while (i < s.length) {
    const hit = sLc.indexOf(needleLc, i);
    if (hit < 0) {
      ranges.push({ text: s.slice(i), hit: false });
      break;
    }
    if (hit > i) ranges.push({ text: s.slice(i, hit), hit: false });
    ranges.push({ text: s.slice(hit, hit + needleLc.length), hit: true });
    i = hit + needleLc.length;
    if (i === hit) i++; // defensive against zero-length matches
  }
  return ranges.length ? ranges : [{ text: s, hit: false }];
}

/** Extract the matchable substring out of a raw query. */
function normalizeQuery(query) {
  if (typeof query !== 'string') return '';
  const q = query.trim();
  if (!q) return '';
  if (q.length >= 2 && q.startsWith('"') && q.endsWith('"')) return q.slice(1, -1);
  if (q.startsWith('.')) return q.slice(1); // path-prefix queries highlight the trailing needle in text
  return q;
}
