import { t, eq, ok, report } from './_harness.js';
import {
  emptyTree, mergeCaseReplace, mergeCasePatch, getNodeByPath, __setNowForTests as setTreeNow
} from '../src/state/clipboard.js';
import {
  createSnapshot, createStore, diffTrees, formatChange, DEFAULT_CAP, MAX_CAP,
  __setNowForTests as setSnapNow, __resetIdsForTests
} from '../src/state/snapshot.js';

setTreeNow(() => 1000);
setSnapNow(() => 2000);
__resetIdsForTests();

// ---- createSnapshot --------------------------------------------------------

t('createSnapshot: clones tree deeply', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', { Customer: { Name: 'Ada' } }, 'u');
  const snap = createSnapshot(tree, { label: 'Before', eventCount: 3 });
  ok(snap.id.startsWith('snap_'));
  eq(snap.label, 'Before');
  eq(snap.eventCount, 3);
  // mutate original; snapshot unaffected.
  mergeCasePatch(tree, 'WORK-1', { Customer: { Name: 'Grace' } }, 'u2');
  eq(getNodeByPath(tree, 'Cases.WORK-1.Customer.Name').value, 'Grace');
  const snapNode = findNode(snap.tree, 'Cases.WORK-1.Customer.Name');
  eq(snapNode.value, 'Ada');
});

// ---- Store retention -------------------------------------------------------

t('store: default cap 5, FIFO eviction', () => {
  eq(DEFAULT_CAP, 5);
  const s = createStore();
  for (let i = 0; i < 7; i++) s.add(createSnapshot(emptyTree(), { label: `s${i}` }));
  const list = s.list();
  eq(list.length, 5);
  eq(list[0].label, 's2');   // oldest two evicted
  eq(list[4].label, 's6');
});

t('store: setCap shrinks and clamps to MAX_CAP', () => {
  const s = createStore({ cap: 5 });
  for (let i = 0; i < 5; i++) s.add(createSnapshot(emptyTree(), { label: `s${i}` }));
  s.setCap(3);
  eq(s.list().length, 3);
  eq(s.setCap(999), MAX_CAP);
});

t('store: remove + label', () => {
  const s = createStore();
  const a = s.add(createSnapshot(emptyTree(), { label: 'a' }));
  s.label(a.id, 'renamed');
  eq(s.get(a.id).label, 'renamed');
  eq(s.remove(a.id), true);
  eq(s.get(a.id), null);
});

// ---- Diff ------------------------------------------------------------------

function mkCase(patch) {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', patch, 'u');
  return tree;
}

function findNode(tree, path) {
  const stack = [tree];
  while (stack.length) {
    const n = stack.pop();
    if (n.id === path) return n;
    if (n.children) for (const c of n.children) stack.push(c);
  }
  return null;
}

function collect(tree, kind) {
  const out = [];
  (function walk(n) {
    if (n.__change === kind) out.push(n.id);
    if (n.children) for (const c of n.children) walk(c);
  })(tree);
  return out;
}

t('diff: value_changed on SV', () => {
  const a = mkCase({ Customer: { Name: 'Ada', Age: 30 } });
  const b = mkCase({ Customer: { Name: 'Grace', Age: 30 } });
  const d = diffTrees(a, b);
  eq(collect(d.tree, 'value_changed'), ['Cases.WORK-1.Customer.Name']);
  eq(d.summary.changed, 1);
  const changed = findNode(d.tree, 'Cases.WORK-1.Customer.Name');
  eq(changed.__before, 'Ada');
  eq(changed.value, 'Grace');
});

t('diff: added + removed propagate', () => {
  const a = mkCase({ Customer: { Name: 'Ada' } });
  const b = mkCase({ Customer: { Email: 'a@x' } });
  const d = diffTrees(a, b);
  eq(collect(d.tree, 'added'), ['Cases.WORK-1.Customer.Email']);
  eq(collect(d.tree, 'removed'), ['Cases.WORK-1.Customer.Name']);
  eq(d.summary.added, 1);
  eq(d.summary.removed, 1);
});

t('diff: mode_changed when array shape flips', () => {
  const a = mkCase({ Tags: ['x'] });             // VL
  const b = mkCase({ Tags: [{ label: 'x' }] });  // PL
  const d = diffTrees(a, b);
  const node = findNode(d.tree, 'Cases.WORK-1.Tags');
  eq(node.__change, 'mode_changed');
});

t('diff: PL correlated by pzInsKey when present', () => {
  const a = mkCase({ Items: [
    { pzInsKey: 'K1', label: 'one' },
    { pzInsKey: 'K2', label: 'two' }
  ] });
  // Reordered, K1 label changed:
  const b = mkCase({ Items: [
    { pzInsKey: 'K2', label: 'two' },
    { pzInsKey: 'K1', label: 'ONE' }
  ] });
  const d = diffTrees(a, b);
  const changes = collect(d.tree, 'value_changed');
  // The label of the K1-keyed item should be the only value change.
  eq(changes.length, 1);
  ok(changes[0].endsWith('.label'), `unexpected change path: ${changes[0]}`);
});

t('diff: unchanged subtree summarized', () => {
  const a = mkCase({ Customer: { Name: 'Ada' } });
  const b = mkCase({ Customer: { Name: 'Ada' } });
  const d = diffTrees(a, b);
  eq(d.summary.changed, 0);
  eq(d.summary.added, 0);
  eq(d.summary.removed, 0);
  ok(d.summary.unchanged > 0);
});

// ---- formatChange ----------------------------------------------------------

t('formatChange: value_changed sentence', () => {
  const change = {
    id: '.Customer.Name', __change: 'value_changed', __before: 'Ada', value: 'Grace'
  };
  eq(
    formatChange(change, 'Before', 'After'),
    '".Customer.Name" changed from "Ada" to "Grace" between "Before" and "After"'
  );
});

report('snapshot');
