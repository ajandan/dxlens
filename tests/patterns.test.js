import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { t, eq, ok, report } from './_harness.js';
import { DEFAULT_PATTERNS, matches, matchesDefault } from '../src/state/patterns.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..', 'src');

t('DEFAULT_PATTERNS: frozen list has DX endpoints', () => {
  ok(DEFAULT_PATTERNS.includes('/prweb/api/application/v'));
  ok(DEFAULT_PATTERNS.includes('/api/application/v'));
  ok(Object.isFrozen(DEFAULT_PATTERNS));
});

t('matches: matches any listed substring', () => {
  const pats = ['/api/application/v', '/prweb/PRRestService/'];
  ok(matches('https://acme/prweb/api/application/v2/cases/W-1', pats));
  ok(matches('https://acme/prweb/PRRestService/foo', pats));
});

t('matches: rejects unmatched URLs', () => {
  eq(matches('https://google.com', DEFAULT_PATTERNS), false);
  eq(matches('https://mail.example/api/v3/messages', ['/prweb/api/application/v']), false);
});

t('matches: fails closed on empty list or bad input', () => {
  eq(matches('https://x', []), false);
  eq(matches('https://x', null), false);
  eq(matches('', DEFAULT_PATTERNS), false);
  eq(matches(null, DEFAULT_PATTERNS), false);
});

t('matches: skips non-string entries defensively', () => {
  // mixed defensive input shouldn't blow up
  ok(matches('https://x/api/application/v2/y', [null, 42, '/api/application/v']));
});

t('matchesDefault: uses bundled defaults', () => {
  ok(matchesDefault('https://acme/prweb/api/v1/cases'));
  eq(matchesDefault('https://random.example'), false);
});

t('matches: URL-encoded still matches pattern substring', () => {
  ok(matches('https://x/prweb/api/application/v2/cases/WORK%2D1', DEFAULT_PATTERNS));
});

t('drift-detector: injected.js + bench replicate every DEFAULT_PATTERNS string', () => {
  const mirrors = [
    path.join(srcRoot, 'injected.js'),
    path.join(srcRoot, 'bench', 'pattern-bench.js')
  ];
  for (const file of mirrors) {
    const src = fs.readFileSync(file, 'utf8');
    for (const p of DEFAULT_PATTERNS) {
      ok(src.includes(p), `${path.relative(srcRoot, file)} missing pattern "${p}"`);
    }
  }
});

report('patterns');
