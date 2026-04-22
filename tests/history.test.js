import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, mergeCasePatch, __setNowForTests } from '../src/state/clipboard.js';
import { createStore, createSnapshot, __setNowForTests as setSnapNow, __resetIdsForTests } from '../src/state/snapshot.js';
import { changeHistory, compressHistory } from '../src/state/history.js';

__setNowForTests(() => 1);
setSnapNow(() => 2);
__resetIdsForTests();

function seedStore() {
  const s = createStore();
  const tree = emptyTree();
  // snap1: Customer.Name = Ada
  mergeCaseReplace(tree, 'W-1', 'MyCo', { Customer: { Name: 'Ada' } }, 'u');
  s.add(createSnapshot(tree, { label: 'snap1' }));
  // snap2: Customer.Name = Grace
  mergeCasePatch(tree, 'W-1', { Customer: { Name: 'Grace' } }, 'u');
  s.add(createSnapshot(tree, { label: 'snap2' }));
  // snap3: Customer.Name = Grace (unchanged)
  s.add(createSnapshot(tree, { label: 'snap3' }));
  return s;
}

t('changeHistory: reports every snapshot for the path', () => {
  const store = seedStore();
  const h = changeHistory(store.all(), 'Cases.W-1.Customer.Name');
  eq(h.length, 3);
  eq(h[0].presence, 'present');
  eq(h[0].value, 'Ada');
  eq(h[1].value, 'Grace');
  eq(h[2].value, 'Grace');
});

t('changeHistory: absent when path missing in a snapshot', () => {
  const s = createStore();
  const tree1 = emptyTree();
  s.add(createSnapshot(tree1, { label: 'empty' }));
  const tree2 = emptyTree();
  mergeCaseReplace(tree2, 'W-1', null, { Customer: { Name: 'Ada' } }, 'u');
  s.add(createSnapshot(tree2, { label: 'added' }));
  const h = changeHistory(s.all(), 'Cases.W-1.Customer.Name');
  eq(h[0].presence, 'absent');
  eq(h[1].presence, 'present');
});

t('compressHistory: collapses runs of identical SV state', () => {
  const store = seedStore();
  const h = changeHistory(store.all(), 'Cases.W-1.Customer.Name');
  const c = compressHistory(h);
  eq(c.length, 2);
  eq(c[0].value, 'Ada');
  eq(c[1].value, 'Grace');
});

t('compressHistory: preserves absent → present transition', () => {
  const s = createStore();
  const tree1 = emptyTree();
  s.add(createSnapshot(tree1, { label: 'empty' }));
  const tree2 = emptyTree();
  mergeCaseReplace(tree2, 'W-1', null, { Customer: { Name: 'Ada' } }, 'u');
  s.add(createSnapshot(tree2, { label: 'added' }));
  const h = compressHistory(changeHistory(s.all(), 'Cases.W-1.Customer.Name'));
  eq(h.length, 2);
  eq(h[0].presence, 'absent');
  eq(h[1].presence, 'present');
});

t('changeHistory: empty or invalid inputs', () => {
  eq(changeHistory([], 'x'), []);
  eq(changeHistory(null, 'x'), []);
  eq(changeHistory(seedStore().all(), ''), []);
});

report('history');
