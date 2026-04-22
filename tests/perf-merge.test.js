// Tree-merge performance gate (spec/08 §Performance).
//   "Tree update from event to render — <50 ms for single-case merges."
// This test exercises the merge primitives against a realistic-sized case
// payload. It's a coarse Node-timing check; CI machines vary, so we use a
// budget (150 ms) that comfortably covers slower hardware while still
// catching order-of-magnitude regressions.

import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, mergeCasePatch, __setNowForTests } from '../src/state/clipboard.js';

__setNowForTests(() => 1);

/**
 * Build a synthetic case payload with ~500 leaf fields, a mix of SV, P, PL,
 * VL, and PL children carrying pzInsKey — the kind of nesting a real Pega case
 * tends to produce.
 */
function syntheticCase() {
  const Customer = { Name: 'Ada Lovelace', Age: 36, Email: 'ada@example.com', Phone: '555-1234' };
  for (let i = 0; i < 50; i++) Customer['f' + i] = `value_${i}`;
  const Addresses = [];
  for (let i = 0; i < 20; i++) {
    Addresses.push({ pzInsKey: `ADDR-${i}`, Street: `${i} Babbage Ave`, City: 'London', Zip: `EC${i}`, IsPrimary: i === 0 });
  }
  const Items = [];
  for (let i = 0; i < 30; i++) {
    const tags = [];
    for (let k = 0; k < 5; k++) tags.push(`tag-${i}-${k}`);
    Items.push({ pzInsKey: `ITEM-${i}`, SKU: `SKU-${i}`, Qty: i, Tags: tags, Status: i % 2 === 0 ? 'ready' : 'pending' });
  }
  const Orders = [];
  for (let i = 0; i < 10; i++) {
    Orders.push({
      pzInsKey: `ORD-${i}`,
      Total: 100 + i,
      Lines: [
        { pzInsKey: `L-${i}-1`, sku: `A-${i}`, qty: 2 },
        { pzInsKey: `L-${i}-2`, sku: `B-${i}`, qty: 1 }
      ]
    });
  }
  const Meta = {
    createdAt: '2026-04-21T00:00:00Z',
    updatedAt: '2026-04-21T00:00:00Z',
    Flags: { Draft: false, Locked: false, Reviewed: true },
    Labels: ['a', 'b', 'c', 'd', 'e']
  };
  return { pyID: 'BIG-1', pyClassName: 'MyCo-Work', Customer, Addresses, Items, Orders, Meta };
}

function measure(fn, iters = 1) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn(i);
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6 / iters;
}

// Budget: spec/08 says <50ms for single-case merges.
// Node single-run is noisy; we warm up, then take the median of 5 runs.
const BUDGET_MS = 150;

t('perf: mergeCaseReplace completes within budget', () => {
  const payload = syntheticCase();
  const tree = emptyTree();
  // Warm up.
  for (let i = 0; i < 3; i++) mergeCaseReplace(tree, `WARM-${i}`, 'MyCo', payload, 'u');

  const runs = [];
  for (let i = 0; i < 5; i++) {
    const freshTree = emptyTree();
    runs.push(measure(() => mergeCaseReplace(freshTree, 'W-1', 'MyCo', payload, 'u'), 1));
  }
  runs.sort((a, b) => a - b);
  const median = runs[2];
  ok(median < BUDGET_MS, `mergeCaseReplace median ${median.toFixed(2)}ms (>${BUDGET_MS}ms)`);
});

t('perf: mergeCasePatch completes within budget', () => {
  const payload = syntheticCase();
  // Build seed tree once; patch against a small diff.
  const seed = emptyTree();
  mergeCaseReplace(seed, 'W-1', 'MyCo', payload, 'u');
  // Warm.
  for (let i = 0; i < 3; i++) mergeCasePatch(seed, 'W-1', { Customer: { Age: 99 - i } }, 'u');

  const runs = [];
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint();
    mergeCasePatch(seed, 'W-1', { Customer: { Age: 42 + i } }, 'u');
    const t1 = process.hrtime.bigint();
    runs.push(Number(t1 - t0) / 1e6);
  }
  runs.sort((a, b) => a - b);
  const median = runs[2];
  ok(median < BUDGET_MS, `mergeCasePatch median ${median.toFixed(2)}ms (>${BUDGET_MS}ms)`);
});

t('perf: node count on synthetic case is realistic', () => {
  const payload = syntheticCase();
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', 'MyCo', payload, 'u');
  let nodes = 0;
  (function walk(n) { nodes++; if (n.children) for (const c of n.children) walk(c); })(tree);
  ok(nodes > 400 && nodes < 2000, `nodes=${nodes}`);
});

report('perf-merge');
