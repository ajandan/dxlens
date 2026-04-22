// Consistency gate for TRACKER.md. Fails if the tracker drifts from the
// actual source tree or test set — so adding a module or a suite without
// updating the tracker breaks CI.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { t, eq, ok, report } from './_harness.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tracker = fs.readFileSync(path.join(root, 'TRACKER.md'), 'utf8');

function listFiles(dir, pred) {
  return fs.readdirSync(dir).filter(pred).map((f) => f);
}

const stateModules = listFiles(path.join(root, 'src', 'state'), (f) => f.endsWith('.js')).sort();
const testSuites = listFiles(path.join(root, 'tests'), (f) => f.endsWith('.test.js'))
  .map((f) => f.replace(/\.test\.js$/, ''))
  .sort();

t('tracker: every src/state/*.js module is referenced', () => {
  const missing = stateModules.filter((m) => !tracker.includes('`' + m + '`'));
  eq(missing, []);
});

t('tracker: every test suite is referenced', () => {
  // Match via the `suite` backtick-wrapped token used in column 1 of the
  // "Test suites" table.
  const missing = testSuites.filter((s) => !tracker.includes('`' + s + '`'));
  eq(missing, []);
});

t('tracker: no stale module listed that no longer exists', () => {
  const modulePattern = /\|\s*`([a-z0-9-]+\.js)`/g;
  const referenced = new Set();
  let m; while ((m = modulePattern.exec(tracker)) !== null) {
    // Only consider entries that appear in the "Pure state modules" table: those are the .js under src/state.
    referenced.add(m[1]);
  }
  // Allow tracker to reference non-state files (injected.js, etc.) — we only
  // assert that every state module listed here exists on disk.
  const existing = new Set(stateModules);
  const stateReferenced = [...referenced].filter((n) => existing.has(n) || !n.startsWith('messages.'));
  const nonexistent = stateReferenced.filter((n) => !existing.has(n) &&
    !['injected.js', 'content.js', 'background.js', 'devtools.js', 'panel.js', 'options.js', 'pattern-bench.js', 'messages.en.js'].includes(n));
  eq(nonexistent, []);
});

t('tracker: has the required top-level sections', () => {
  for (const heading of [
    '## Milestones',
    '## Open decisions',
    '## Release gates',
    '## Extension files',
    '## Pure state modules',
    '## Test suites',
    '## How to keep this doc honest'
  ]) {
    ok(tracker.includes(heading), `missing section: ${heading}`);
  }
});

t('tracker: Total row matches the sum of suite counts in this file (spot-check)', () => {
  // Extract integer counts from lines like `| \`suite\` | desc | N |`
  const rowRe = /^\|\s*`([a-z0-9-]+)`\s*\|[^|]*\|\s*(\d+)\s*\|\s*$/gm;
  let m;
  let total = 0;
  while ((m = rowRe.exec(tracker)) !== null) total += Number(m[2]);
  const totalMatch = /\*\*Total\*\*\s*\|.*?\|\s*\*\*(\d+)\*\*/m.exec(tracker);
  ok(totalMatch, 'Total row present');
  eq(Number(totalMatch[1]), total);
});

report('tracker');
