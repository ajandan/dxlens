import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, getNodeByPath, __setNowForTests } from '../src/state/clipboard.js';
import { copyPath, copyValue, copyValueJson } from '../src/state/copy.js';

__setNowForTests(() => 1);

function sample() {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', {
    Customer: { Name: 'Ada', Age: 30 },
    Tags: ['red', 'blue'],
    Items: [{ label: 'one' }, { label: 'two' }]
  }, 'u');
  return tree;
}

t('copyPath: returns node.id (dotted, 1-indexed)', () => {
  const tree = sample();
  eq(copyPath(getNodeByPath(tree, 'Cases.WORK-1.Customer.Name')), 'Cases.WORK-1.Customer.Name');
  eq(copyPath(getNodeByPath(tree, 'Cases.WORK-1.Items(2).label')), 'Cases.WORK-1.Items(2).label');
});

t('copyValue: SV returns primitive', () => {
  const tree = sample();
  eq(copyValue(getNodeByPath(tree, 'Cases.WORK-1.Customer.Name')), 'Ada');
  eq(copyValue(getNodeByPath(tree, 'Cases.WORK-1.Customer.Age')), 30);
});

t('copyValue: P returns keyed object', () => {
  const tree = sample();
  const c = copyValue(getNodeByPath(tree, 'Cases.WORK-1.Customer'));
  eq(c, { Name: 'Ada', Age: 30 });
});

t('copyValue: VL returns primitive array', () => {
  const tree = sample();
  eq(copyValue(getNodeByPath(tree, 'Cases.WORK-1.Tags')), ['red', 'blue']);
});

t('copyValue: PL returns array of objects', () => {
  const tree = sample();
  eq(copyValue(getNodeByPath(tree, 'Cases.WORK-1.Items')), [{ label: 'one' }, { label: 'two' }]);
});

t('copyValueJson: sorted keys', () => {
  const tree = sample();
  const s = copyValueJson(getNodeByPath(tree, 'Cases.WORK-1.Customer'), 0);
  eq(s, '{"Age":30,"Name":"Ada"}');
});

t('copyValue: null-safe', () => {
  eq(copyValue(null), null);
  eq(copyPath(null), '');
});

report('copy');
