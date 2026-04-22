import { t, eq, ok, report } from './_harness.js';
import {
  emptyTree, mergeCaseReplace, mergeDataPage, mergeOperator, __setNowForTests
} from '../src/state/clipboard.js';
import { buildIndex, runSearch, ancestorsToExpand, SCOPE } from '../src/state/search.js';

__setNowForTests(() => 1);

function sampleTree() {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', {
    Customer: { Name: 'Ada Lovelace', Email: 'ada@example.com' },
    Tags: ['red', 'green'],
    Items: [{ label: 'one' }, { label: 'two' }]
  }, 'u1');
  mergeCaseReplace(tree, 'WORK-2', null, { Customer: { Name: 'Grace Hopper' } }, 'u2');
  mergeDataPage(tree, 'D_Customers', null, { data: [{ id: 1, name: 'Ada' }] }, 'u3');
  mergeOperator(tree, { userID: 'jane@x', accessGroup: 'AG' }, 'u4');
  return tree;
}

t('buildIndex: every node represented', () => {
  const tree = sampleTree();
  const ix = buildIndex(tree);
  ok(ix.length > 10, `index length: ${ix.length}`);
  const paths = new Set(ix.map((e) => e.id));
  ok(paths.has('Cases.WORK-1.Customer.Name'));
  ok(paths.has('Cases.WORK-1.Items(2).label'));
  ok(paths.has('Operator.userID'));
  ok(paths.has('DataPages.D_Customers'));
});

t('runSearch: empty query → no matches', () => {
  const ix = buildIndex(sampleTree());
  eq(runSearch(ix, '').length, 0);
  eq(runSearch(ix, '   ').length, 0);
});

t('runSearch: substring over name + value + path, case-insensitive', () => {
  const ix = buildIndex(sampleTree());
  const r = runSearch(ix, 'ada');
  const ids = r.map((e) => e.id);
  ok(ids.includes('Cases.WORK-1.Customer.Name'));             // value match
  ok(ids.includes('DataPages.D_Customers.data(1).name'));     // value match (Ada)
});

t('runSearch: quoted phrase → value exact-phrase match only', () => {
  const ix = buildIndex(sampleTree());
  const r = runSearch(ix, '"Ada Lovelace"');
  eq(r.length, 1);
  eq(r[0].id, 'Cases.WORK-1.Customer.Name');
});

t('runSearch: leading . → path prefix', () => {
  const ix = buildIndex(sampleTree());
  const r = runSearch(ix, '.Customer');
  const ids = r.map((e) => e.id);
  ok(ids.includes('Cases.WORK-1.Customer'));
  ok(ids.includes('Cases.WORK-1.Customer.Name'));
  // "Customer" without leading dot should not appear via the path-prefix rule;
  // but substring rule would still catch it. Here we use leading dot.
  ok(!ids.includes('DataPages.D_Customers'), '.Customer must not match D_Customers via path-prefix');
});

t('runSearch: scope Operator restricts matches', () => {
  const ix = buildIndex(sampleTree());
  const r = runSearch(ix, 'ag', { scope: SCOPE.OPERATOR });
  for (const e of r) ok(e.id.startsWith('Operator'), `out of scope: ${e.id}`);
});

t('runSearch: scope DataPages restricts matches', () => {
  const ix = buildIndex(sampleTree());
  const r = runSearch(ix, 'ada', { scope: SCOPE.DATA_PAGES });
  for (const e of r) ok(e.id.startsWith('DataPages'), `out of scope: ${e.id}`);
});

t('runSearch: scope CurrentCase requires id', () => {
  const ix = buildIndex(sampleTree());
  eq(runSearch(ix, 'ada', { scope: SCOPE.CURRENT_CASE }).length, 0);
  const r = runSearch(ix, 'ada', { scope: SCOPE.CURRENT_CASE, currentCaseId: 'WORK-1' });
  for (const e of r) ok(e.id.startsWith('Cases.WORK-1'));
});

t('ancestorsToExpand: yields each parent path', () => {
  const ix = buildIndex(sampleTree());
  const matches = runSearch(ix, 'Ada Lovelace');
  const set = ancestorsToExpand(matches);
  ok(set.has('Cases'));
  ok(set.has('Cases.WORK-1'));
  ok(set.has('Cases.WORK-1.Customer'));
  ok(!set.has('Cases.WORK-1.Customer.Name'), 'leaf match itself is not an ancestor');
});

// Perf smoke — 10k-node synthetic tree should search in well under 50ms (spec/04).
t('runSearch: 10k nodes under 50ms', () => {
  const big = emptyTree();
  const payload = {};
  for (let i = 0; i < 3500; i++) payload['f' + i] = { v: 'value_' + i, tag: i };
  mergeCaseReplace(big, 'BIG-1', null, payload, 'u');
  const ix = buildIndex(big);
  ok(ix.length > 10000, `ix size ${ix.length}`);
  const t0 = process.hrtime.bigint();
  const r = runSearch(ix, 'value_1234');
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  ok(ms < 50, `search took ${ms.toFixed(2)}ms (>50ms budget)`);
  ok(r.length > 0);
});

report('search');
