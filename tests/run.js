// Aggregate runner: node tests/run.js → runs every suite in series.
// Suites call process.exit(1) on failure, so a successful run exits 0.

import './clipboard.test.js';
await microtask();
import('./classify.test.js');
await microtask();
import('./snapshot.test.js');
await microtask();
import('./search.test.js');
await microtask();
import('./tools.test.js');
await microtask();
import('./copy.test.js');
await microtask();
import('./settings.test.js');
await microtask();
import('./stats.test.js');
await microtask();
import('./refresh.test.js');
await microtask();
import('./live-state.test.js');
await microtask();
import('./no-egress.test.js');
await microtask();
import('./security.test.js');

function microtask() { return new Promise((r) => setTimeout(r, 0)); }
