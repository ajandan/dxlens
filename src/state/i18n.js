// Tiny i18n helper (spec/08 §Internationalization).
// Runtime-local: message catalog is provided at construction so this module
// stays pure and Node-testable. Production callers import the bundled
// messages.en.json and pass it in.

/**
 * Create a translator bound to a message catalog.
 * @param {Record<string, string>} catalog
 */
export function createT(catalog) {
  if (!catalog || typeof catalog !== 'object') throw new Error('catalog required');
  const known = new Set(Object.keys(catalog));

  function t(key, subs) {
    const template = catalog[key];
    if (template == null) {
      // Missing keys fall back to the key itself; that makes absent translations
      // conspicuous without crashing the panel.
      return key;
    }
    return substitute(template, subs);
  }

  t.has = (key) => known.has(key);
  t.keys = () => Array.from(known);
  return t;
}

function substitute(template, subs) {
  if (!subs) return template;
  return template.replace(/\{(\w+)\}/g, (m, name) => {
    const v = subs[name];
    return v == null ? m : String(v);
  });
}

/**
 * Plural helper: pick `_one` for n === 1, `_many` otherwise.
 *   t.plural('stats.events', n) → t('stats.events_one' | 'stats.events_many', { n })
 */
export function plural(t, baseKey, n) {
  const key = n === 1 ? `${baseKey}_one` : `${baseKey}_many`;
  return t(key, { n });
}

/**
 * Verify every key referenced in `used` exists in the catalog, and optionally
 * warn about catalog entries not used anywhere. Returns { missing, unused }.
 */
export function verifyCatalog(catalog, used) {
  const have = new Set(Object.keys(catalog || {}));
  const want = new Set(used);
  const missing = [];
  for (const k of want) if (!have.has(k)) missing.push(k);
  const unused = [];
  for (const k of have) if (!want.has(k)) unused.push(k);
  return { missing, unused };
}
