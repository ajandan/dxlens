import { t, eq, ok, report } from './_harness.js';
import { buildSubtree, __setNowForTests } from '../src/state/clipboard.js';
import { markStale, sweepStale } from '../src/state/stale.js';

__setNowForTests(() => 1);

function findById(root, id) {
  const stack = [root];
  while (stack.length) { const n = stack.pop(); if (n.id === id) return n; if (n.children) for (const c of n.children) stack.push(c); }
  return null;
}

t('markStale: nodes present in next are kept, missing are stale', () => {
  const prev = buildSubtree('case', 'Cases.W-1', { Customer: { Name: 'Ada', Age: 30 }, Tags: ['a', 'b'] }, 'u');
  const next = buildSubtree('case', 'Cases.W-1', { Customer: { Name: 'Ada' }, Tags: ['a'] }, 'u'); // Age removed; second tag removed
  const r = markStale(prev, next);
  ok(findById(prev, 'Cases.W-1.Customer.Name').isStale === false);
  ok(findById(prev, 'Cases.W-1.Customer.Age').isStale === true);
  ok(findById(prev, 'Cases.W-1.Tags(2)').isStale === true);
  ok(r.stale >= 2);
  ok(r.kept >= 3);
});

t('markStale: when next is absent, whole subtree is stale', () => {
  const prev = buildSubtree('root', 'X', { a: 1, b: 2 }, 'u');
  const r = markStale(prev, null);
  eq(findById(prev, 'X').isStale, true);
  eq(findById(prev, 'X.a').isStale, true);
  eq(findById(prev, 'X.b').isStale, true);
  ok(r.stale >= 3);
});

t('sweepStale: stale node survives one generation then is purged', () => {
  const prev = buildSubtree('case', 'C', { a: 1, b: 2 }, 'u');
  const next = buildSubtree('case', 'C', { a: 1 }, 'u'); // b missing
  markStale(prev, next);
  // Gen 1: nodes staleGen gets stamped; b is retained.
  sweepStale(prev, 1);
  ok(findById(prev, 'C.b'), 'b retained for one cycle');
  eq(findById(prev, 'C.b').staleGen, 1);
  // Gen 2: b's staleGen (1) < currentGen (2) → purged.
  sweepStale(prev, 2);
  eq(findById(prev, 'C.b'), null);
});

t('markStale: resurrected node clears isStale on re-appearance', () => {
  const prev = buildSubtree('case', 'C', { a: 1, b: 2 }, 'u');
  const after = buildSubtree('case', 'C', { a: 1 }, 'u');
  markStale(prev, after); // b is stale
  ok(findById(prev, 'C.b').isStale === true);
  const next = buildSubtree('case', 'C', { a: 1, b: 9 }, 'u');
  markStale(prev, next); // b reappears
  eq(findById(prev, 'C.b').isStale, false);
});

report('stale');
