import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, __setNowForTests } from '../src/state/clipboard.js';
import { mergeCurrentView } from '../src/state/current-view.js';
import { getFieldBinding, listFieldBindings } from '../src/state/binding.js';

__setNowForTests(() => 1);

function sample() {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', 'MyCo', {
    Customer: { Name: 'Ada', Age: 30, Email: 'a@x' },
    Items: [{ label: 'one' }]
  }, 'u');
  mergeCaseReplace(tree, 'W-2', null, {
    Customer: { Name: 'Grace' }
  }, 'u');
  return tree;
}

t('getFieldBinding: first matching name across all cases', () => {
  const tree = sample();
  const b = getFieldBinding(tree, 'Name');
  ok(b);
  eq(b.mode, 'SV');
  ok(b.path.endsWith('.Customer.Name'));
  ok(typeof b.value === 'string');
  ok(Array.isArray(b.sourceUrls));
});

t('getFieldBinding: caseId scope', () => {
  const tree = sample();
  const b = getFieldBinding(tree, 'Name', { caseId: 'W-2' });
  eq(b.caseId, 'W-2');
  eq(b.value, 'Grace');
});

t('getFieldBinding: unknown field → null', () => {
  const tree = sample();
  eq(getFieldBinding(tree, 'Missing'), null);
});

t('getFieldBinding: viewBound flag set when field appears in CurrentView.bindings', () => {
  const tree = sample();
  mergeCurrentView(tree, { viewId: 'Detail', bindings: ['Customer.Name'], source: 'u' });
  const b = getFieldBinding(tree, 'Name', { caseId: 'W-1' });
  eq(b.viewBound, true);
});

t('getFieldBinding: no viewBound when bindings absent or preference disabled', () => {
  const tree = sample();
  // no CurrentView
  eq(getFieldBinding(tree, 'Name', { caseId: 'W-1' }).viewBound, undefined);
  // with CurrentView but preference disabled
  mergeCurrentView(tree, { viewId: 'Detail', bindings: ['Customer.Name'], source: 'u' });
  eq(getFieldBinding(tree, 'Name', { caseId: 'W-1', preferViewBindings: false }).viewBound, undefined);
});

t('listFieldBindings: returns every matching path across cases', () => {
  const tree = sample();
  const list = listFieldBindings(tree, 'Name');
  eq(list.length, 2);
  const ids = list.map((x) => x.path).sort();
  eq(ids, ['Cases.W-1.Customer.Name', 'Cases.W-2.Customer.Name']);
});

t('listFieldBindings: empty for unknown field', () => {
  const tree = sample();
  eq(listFieldBindings(tree, 'Missing'), []);
});

report('binding');
