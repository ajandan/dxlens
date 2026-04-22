import { t, eq, ok, report } from './_harness.js';
import {
  emptyTree, mergeCaseReplace, mergeDataPage, mergeOperator, __setNowForTests
} from '../src/state/clipboard.js';
import { measureTree, byteCost } from '../src/state/footprint.js';

__setNowForTests(() => 1);

t('measureTree: empty tree → 5 nodes (root + 4 fixed zones), nonzero bytes', () => {
  const m = measureTree(emptyTree());
  eq(m.nodes, 5);
  ok(m.bytes > 0);
  for (const k of ['Cases', 'DataPages', 'Operator', 'CurrentView']) {
    eq(m.perTopLevel[k].nodes, 1);
    ok(m.perTopLevel[k].bytes > 0);
  }
});

t('measureTree: case adds nodes under Cases only', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', 'MyCo', { Customer: { Name: 'Ada', Age: 30 } }, 'u');
  const m = measureTree(tree);
  ok(m.perTopLevel.Cases.nodes > 1);
  eq(m.perTopLevel.DataPages.nodes, 1); // still just the zone node
});

t('measureTree: data pages and operator tracked separately', () => {
  const tree = emptyTree();
  mergeDataPage(tree, 'D_X', null, { data: [1, 2, 3] }, 'u');
  mergeOperator(tree, { userID: 'u@x', accessGroup: 'AG' }, 'u');
  const m = measureTree(tree);
  ok(m.perTopLevel.DataPages.nodes >= 3);
  ok(m.perTopLevel.Operator.nodes >= 3);
});

t('byteCost: SV string value contributes to bytes', () => {
  const small = byteCost({ id: 'a', name: 'a', mode: 'SV', value: '', sourceUrls: [] });
  const big   = byteCost({ id: 'a', name: 'a', mode: 'SV', value: 'x'.repeat(100), sourceUrls: [] });
  ok(big > small, `big=${big}, small=${small}`);
});

t('byteCost: null-safe', () => {
  eq(byteCost(null), 0);
  eq(byteCost(undefined), 0);
});

report('footprint');
