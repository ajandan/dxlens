import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, __setNowForTests } from '../src/state/clipboard.js';
import { keyStep, flattenVisible } from '../src/state/keynav.js';

__setNowForTests(() => 1);

function sample() {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo', {
    Customer: { Name: 'Ada', Age: 30 },
    Tags: ['red', 'blue']
  }, 'u');
  return tree;
}

function run(rows, startId, expanded, keys) {
  let sel = startId;
  const exp = new Set(expanded);
  let lastExpand = null, lastCollapse = null;
  for (const k of keys) {
    const r = keyStep({ rows, expanded: exp, selectedId: sel }, k);
    sel = r.selectedId;
    if (r.expand) { exp.add(r.expand); lastExpand = r.expand; }
    if (r.collapse) { exp.delete(r.collapse); lastCollapse = r.collapse; }
  }
  return { sel, exp, lastExpand, lastCollapse };
}

t('flattenVisible: includes top-level folders in default expansion', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView']);
  const rows = flattenVisible(tree, expanded);
  const ids = rows.map((r) => r.id);
  ok(ids.includes('Cases'));
  ok(ids.includes('DataPages'));
  ok(ids.includes('Operator'));
  ok(ids.includes('CurrentView'));
  ok(ids.includes('Cases.WORK-1'));
});

t('flattenVisible: collapsed subtree hides children', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView']);
  // Cases.WORK-1 is NOT expanded, so its children shouldn't appear.
  const rows = flattenVisible(tree, expanded);
  const ids = rows.map((r) => r.id);
  ok(!ids.includes('Cases.WORK-1.Customer'));
});

t('ArrowDown / ArrowUp: move to next/previous visible row', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView', 'Cases.WORK-1']);
  const rows = flattenVisible(tree, expanded);
  const start = 'Cases.WORK-1';
  const down = run(rows, start, expanded, ['ArrowDown']).sel;
  ok(down !== start, 'moved down');
  const up = run(rows, down, expanded, ['ArrowUp']).sel;
  eq(up, start, 'moved back up');
});

t('Home / End: jump to first / last row', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView']);
  const rows = flattenVisible(tree, expanded);
  eq(run(rows, rows[2].id, expanded, ['Home']).sel, rows[0].id);
  eq(run(rows, rows[0].id, expanded, ['End']).sel, rows[rows.length - 1].id);
});

t('ArrowRight: expands a collapsed parent with children', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView']);
  const rows = flattenVisible(tree, expanded);
  const r = keyStep({ rows, expanded, selectedId: 'Cases.WORK-1' }, 'ArrowRight');
  eq(r.selectedId, 'Cases.WORK-1');
  eq(r.expand, 'Cases.WORK-1');
});

t('ArrowRight: already-expanded → move to first child', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView', 'Cases.WORK-1']);
  const rows = flattenVisible(tree, expanded);
  const r = keyStep({ rows, expanded, selectedId: 'Cases.WORK-1' }, 'ArrowRight');
  eq(r.selectedId, rows[rows.findIndex((x) => x.id === 'Cases.WORK-1') + 1].id);
});

t('ArrowLeft: collapses expanded parent', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView', 'Cases.WORK-1']);
  const rows = flattenVisible(tree, expanded);
  const r = keyStep({ rows, expanded, selectedId: 'Cases.WORK-1' }, 'ArrowLeft');
  eq(r.collapse, 'Cases.WORK-1');
});

t('ArrowLeft: leaf → move to parent', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases', 'DataPages', 'Operator', 'CurrentView', 'Cases.WORK-1', 'Cases.WORK-1.Customer']);
  const rows = flattenVisible(tree, expanded);
  const leaf = 'Cases.WORK-1.Customer.Name';
  const r = keyStep({ rows, expanded, selectedId: leaf }, 'ArrowLeft');
  eq(r.selectedId, 'Cases.WORK-1.Customer');
});

t('no selection: ArrowDown picks the first row', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases']);
  const rows = flattenVisible(tree, expanded);
  const r = keyStep({ rows, expanded, selectedId: null }, 'ArrowDown');
  eq(r.selectedId, rows[0].id);
});

t('unknown key: selection unchanged', () => {
  const tree = sample();
  const expanded = new Set(['', 'Cases']);
  const rows = flattenVisible(tree, expanded);
  eq(keyStep({ rows, expanded, selectedId: 'Cases' }, 'Tab').selectedId, 'Cases');
});

report('keynav');
