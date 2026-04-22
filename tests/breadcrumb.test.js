import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, __setNowForTests } from '../src/state/clipboard.js';
import { buildBreadcrumb } from '../src/state/breadcrumb.js';

__setNowForTests(() => 1);

function sample() {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', { Customer: { Name: 'Ada' } }, 'u');
  return tree;
}

t('resolves each crumb to the node display name', () => {
  const tree = sample();
  const cr = buildBreadcrumb(tree, 'Cases.WORK-1.Customer.Name');
  eq(cr, [
    { id: 'Cases', label: 'Cases' },
    { id: 'Cases.WORK-1', label: 'WORK-1 (MyCo-Work)' },
    { id: 'Cases.WORK-1.Customer', label: 'Customer' },
    { id: 'Cases.WORK-1.Customer.Name', label: 'Name' }
  ]);
});

t('falls back to raw segments when path does not resolve', () => {
  const tree = sample();
  const cr = buildBreadcrumb(tree, 'Cases.WORK-1.Missing.Field');
  // First two crumbs resolve; last two fall back to raw names.
  eq(cr.length, 4);
  eq(cr[0].label, 'Cases');
  eq(cr[1].label, 'WORK-1 (MyCo-Work)');
  eq(cr[2].label, 'Missing');
  eq(cr[3].label, 'Field');
});

t('empty inputs yield empty array', () => {
  eq(buildBreadcrumb(null, 'x'), []);
  eq(buildBreadcrumb(emptyTree(), ''), []);
});

t('top-level zones have plain labels', () => {
  const cr = buildBreadcrumb(emptyTree(), 'Operator');
  eq(cr, [{ id: 'Operator', label: 'Operator' }]);
});

report('breadcrumb');
