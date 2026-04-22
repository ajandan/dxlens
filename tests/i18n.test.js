import { t as T, eq, ok, report } from './_harness.js';
import { createT, plural, verifyCatalog } from '../src/state/i18n.js';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const catalogPath = path.resolve(here, '..', 'src', 'i18n', 'messages.en.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const bundled = (await import('../src/i18n/messages.en.js')).messages;

T('createT: returns template unchanged for no-sub keys', () => {
  const t = createT({ 'a.b': 'Hello' });
  eq(t('a.b'), 'Hello');
});

T('createT: substitutes {name} placeholders', () => {
  const t = createT({ 'greet': 'Hello {name}, you have {n} tabs' });
  eq(t('greet', { name: 'Ada', n: 3 }), 'Hello Ada, you have 3 tabs');
});

T('createT: leaves unknown placeholders intact', () => {
  const t = createT({ 'x': 'Hi {missing}' });
  eq(t('x', { other: 1 }), 'Hi {missing}');
});

T('createT: missing key falls back to the key itself', () => {
  const t = createT({});
  eq(t('nope'), 'nope');
});

T('createT: catalog required', () => {
  try { createT(null); ok(false, 'expected throw'); } catch { /* good */ }
});

T('plural: picks _one for 1 and _many otherwise', () => {
  const t = createT({ 'x_one': '{n} item', 'x_many': '{n} items' });
  eq(plural(t, 'x', 1), '1 item');
  eq(plural(t, 'x', 0), '0 items');
  eq(plural(t, 'x', 5), '5 items');
});

T('verifyCatalog: missing keys are reported', () => {
  const { missing, unused } = verifyCatalog({ 'a': 'A' }, ['a', 'b', 'c']);
  eq(missing.sort(), ['b', 'c']);
  eq(unused, []);
});

T('verifyCatalog: unused keys are reported', () => {
  const { missing, unused } = verifyCatalog({ 'a': 'A', 'b': 'B' }, ['a']);
  eq(missing, []);
  eq(unused, ['b']);
});

T('messages.en.json: parses and has core app keys', () => {
  ok(catalog['app.title']);
  ok(catalog['toolbar.live']);
  ok(catalog['search.placeholder']);
});

T('messages.en.json: plural pairs exist', () => {
  for (const base of ['stats.events', 'search.matches', 'snapshots.count']) {
    ok(catalog[`${base}_one`], `${base}_one present`);
    ok(catalog[`${base}_many`], `${base}_many present`);
  }
});

T('messages.en.js: matches messages.en.json exactly', () => {
  const a = JSON.stringify(Object.keys(catalog).sort().map((k) => [k, catalog[k]]));
  const b = JSON.stringify(Object.keys(bundled).sort().map((k) => [k, bundled[k]]));
  eq(a, b);
});

report('i18n');
