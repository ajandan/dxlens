import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { t, eq, ok, throws, report } from './_harness.js';
import { parseHex, luminance, contrastHex, passesAA, AA_NORMAL } from '../src/state/color-contrast.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const panelCss = fs.readFileSync(path.resolve(here, '..', 'src', 'devtools', 'panel.css'), 'utf8');
const optionsCss = fs.readFileSync(path.resolve(here, '..', 'src', 'options', 'options.css'), 'utf8');
const sidepanelCss = fs.readFileSync(path.resolve(here, '..', 'src', 'sidepanel', 'sidepanel.css'), 'utf8');

// --- algorithm sanity ------------------------------------------------------

t('parseHex: 6-digit and 3-digit forms', () => {
  eq(parseHex('#000000'), { r: 0, g: 0, b: 0 });
  eq(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  eq(parseHex('1A73E8'), { r: 26, g: 115, b: 232 });
});

t('parseHex: rejects malformed', () => {
  throws(() => parseHex('#12345'));
  throws(() => parseHex('not-a-color'));
});

t('luminance: known boundaries', () => {
  eq(Math.round(luminance(parseHex('#ffffff')) * 100) / 100, 1);
  eq(Math.round(luminance(parseHex('#000000')) * 100) / 100, 0);
});

t('contrast: white-on-black is 21', () => {
  eq(Math.round(contrastHex('#ffffff', '#000000')), 21);
});

t('passesAA: #1a1a1a on #ffffff passes, #999 on #fff fails', () => {
  ok(passesAA('#1a1a1a', '#ffffff'));
  // #999 on #fff ≈ 2.85; under AA for normal text.
  eq(passesAA('#999999', '#ffffff'), false);
});

// --- CSS-token extraction + gate -------------------------------------------

/** Parse CSS variable assignments from a `:root` or @media block. Returns a map. */
function readTokens(css, sectionMatcher) {
  const section = extractSection(css, sectionMatcher);
  const tokens = {};
  const re = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let m; while ((m = re.exec(section)) !== null) tokens[m[1]] = m[2];
  return tokens;
}
function extractSection(css, matcher) {
  const i = css.search(matcher);
  if (i < 0) return '';
  const open = css.indexOf('{', i);
  if (open < 0) return '';
  let depth = 0;
  for (let k = open; k < css.length; k++) {
    if (css[k] === '{') depth++;
    else if (css[k] === '}') { depth--; if (depth === 0) return css.slice(open + 1, k); }
  }
  return '';
}

t('panel.css light defaults meet AA for text on background', () => {
  const tokens = readTokens(panelCss, /:root\s*{/);
  ok(tokens['--fg'], 'fg defined');
  ok(tokens['--bg'], 'bg defined');
  const ratio = contrastHex(tokens['--fg'], tokens['--bg']);
  ok(ratio >= AA_NORMAL, `panel light --fg/--bg contrast ${ratio.toFixed(2)} < ${AA_NORMAL}`);
});

t('panel.css dark (prefers-color-scheme) meets AA for text on background', () => {
  const tokens = readTokens(panelCss, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  ok(tokens['--fg'], 'dark fg defined');
  ok(tokens['--bg'], 'dark bg defined');
  const ratio = contrastHex(tokens['--fg'], tokens['--bg']);
  ok(ratio >= AA_NORMAL, `panel dark --fg/--bg contrast ${ratio.toFixed(2)} < ${AA_NORMAL}`);
});

t('options.css light and dark defaults meet AA for body text', () => {
  const light = readTokens(optionsCss, /:root\s*{/);
  const dark = readTokens(optionsCss, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  for (const [label, tokens] of [['light', light], ['dark', dark]]) {
    const ratio = contrastHex(tokens['--fg'], tokens['--bg']);
    ok(ratio >= AA_NORMAL, `options ${label} contrast ${ratio.toFixed(2)} < ${AA_NORMAL}`);
  }
});

t('sidepanel.css light and dark meet AA for body text', () => {
  const light = readTokens(sidepanelCss, /:root\s*{/);
  const dark = readTokens(sidepanelCss, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  for (const [label, tokens] of [['light', light], ['dark', dark]]) {
    const ratio = contrastHex(tokens['--fg'], tokens['--bg']);
    ok(ratio >= AA_NORMAL, `sidepanel ${label} contrast ${ratio.toFixed(2)} < ${AA_NORMAL}`);
  }
});

report('color-contrast');
