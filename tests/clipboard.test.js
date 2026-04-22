import { t, eq, ok, report } from './_harness.js';
import {
  MODE, inferMode, joinPath, buildSubtree, emptyTree,
  mergeCaseReplace, mergeCasePatch, mergeAssignment, mergeDataPage, mergeOperator,
  getNodeByPath, listCases, listDataPages, __setNowForTests
} from '../src/state/clipboard.js';

__setNowForTests(() => 1000);

t('inferMode: primitives', () => {
  eq(inferMode('x').mode, MODE.SV);
  eq(inferMode(1).mode, MODE.SV);
  eq(inferMode(true).mode, MODE.SV);
  eq(inferMode(null).mode, MODE.SV);
});
t('inferMode: object → P', () => eq(inferMode({ a: 1 }).mode, MODE.P));
t('inferMode: array of objects → PL', () => eq(inferMode([{ a: 1 }]).mode, MODE.PL));
t('inferMode: array of primitives → VL', () => eq(inferMode(['a', 'b']).mode, MODE.VL));
t('inferMode: empty array → tentative VL', () => {
  const r = inferMode([]);
  eq(r.mode, MODE.VL);
  eq(r.isTentative, true);
});

t('joinPath: object property', () => eq(joinPath('Customer', 'Name', 'prop'), 'Customer.Name'));
t('joinPath: 1-indexed array (D-009)', () => {
  eq(joinPath('Customer.Address', 0, 'index'), 'Customer.Address(1)');
  eq(joinPath('pyTags', 1, 'index'), 'pyTags(2)');
});
t('joinPath: root → bare name', () => eq(joinPath('', 'Customer', 'prop'), 'Customer'));

t('buildSubtree: nested object → Page node with SV leaves', () => {
  const n = buildSubtree('root', 'root', { a: 1, b: { c: 'x' } }, 'u');
  eq(n.mode, MODE.P);
  const b = n.children.find((x) => x.name === 'b');
  eq(b.children[0].name, 'c');
  eq(b.children[0].value, 'x');
  eq(b.children[0].id, 'root.b.c');
});
t('buildSubtree: PL ids are 1-indexed (D-009)', () => {
  const n = buildSubtree('root', 'root', { items: [{ a: 1 }, { a: 2 }] }, 'u');
  const items = n.children[0];
  eq(items.mode, MODE.PL);
  eq(items.children[0].id, 'root.items(1)');
  eq(items.children[1].id, 'root.items(2)');
});

t('mergeCaseReplace: creates case under Cases', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', { Customer: { Name: 'Ada' } }, 'u1');
  eq(listCases(tree).length, 1);
  eq(listCases(tree)[0].name, 'WORK-1 (MyCo-Work)');
  eq(getNodeByPath(tree, 'Cases.WORK-1.Customer.Name').value, 'Ada');
});

t('mergeCasePatch: updates SV, preserves siblings', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', { Customer: { Name: 'Ada', Age: 30 } }, 'u1');
  mergeCasePatch(tree, 'WORK-1', { Customer: { Age: 31 } }, 'u2');
  eq(getNodeByPath(tree, 'Cases.WORK-1.Customer.Age').value, 31);
  eq(getNodeByPath(tree, 'Cases.WORK-1.Customer.Name').value, 'Ada');
});

t('mergeCasePatch: empty array → PL when populated later', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', null, { Addresses: [] }, 'u1');
  eq(getNodeByPath(tree, 'Cases.WORK-1.Addresses').mode, MODE.VL);
  eq(getNodeByPath(tree, 'Cases.WORK-1.Addresses').isTentative, true);
  mergeCasePatch(tree, 'WORK-1', { Addresses: [{ City: 'NYC' }] }, 'u2');
  const after = getNodeByPath(tree, 'Cases.WORK-1.Addresses');
  eq(after.mode, MODE.PL);
  ok(!after.isTentative, 'tentative flag cleared after population');
  eq(getNodeByPath(tree, 'Cases.WORK-1.Addresses(1).City').value, 'NYC');
});

// O-001 lean A: nested under case
t('mergeCaseReplace: unwraps DX envelope data.caseInfo', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', {
    data: { caseInfo: { ID: 'WORK-1', status: 'New', content: { Name: 'Ada' } } },
    uiResources: { foo: 1 }
  }, 'u');
  // Children of the case should be caseInfo fields, not data/uiResources.
  ok(getNodeByPath(tree, 'Cases.WORK-1.status'));
  eq(getNodeByPath(tree, 'Cases.WORK-1.status').value, 'New');
  eq(getNodeByPath(tree, 'Cases.WORK-1.content.Name').value, 'Ada');
  // uiResources should NOT appear as a case child.
  eq(getNodeByPath(tree, 'Cases.WORK-1.uiResources'), null);
});

t('mergeAssignment: case id fallback from assignment id pattern', () => {
  const tree = emptyTree();
  mergeAssignment(
    tree,
    'ASSIGN-WORKLIST MYORG-CUSTOMER-WORK C-1008!COLLECT_FLOW',
    { pxTaskLabel: 'Collect' },
    'u'
  );
  ok(getNodeByPath(tree, 'Cases.MYORG-CUSTOMER-WORK C-1008.assignments.ASSIGN-WORKLIST MYORG-CUSTOMER-WORK C-1008!COLLECT_FLOW'));
  // [unknown] should NOT have been created.
  eq(getNodeByPath(tree, 'Cases.[unknown]'), null);
});

t('mergeAssignment: nests under discovered case', () => {
  const tree = emptyTree();
  mergeAssignment(tree, 'ASSIGN-1', { caseID: 'WORK-1', pxTaskLabel: 'Approve' }, 'u');
  const node = getNodeByPath(tree, 'Cases.WORK-1.assignments.ASSIGN-1');
  ok(node, 'assignment present under owning case');
  eq(node.name, 'ASSIGN-1');
});
t('mergeAssignment: falls back to [unknown] when owner missing', () => {
  const tree = emptyTree();
  mergeAssignment(tree, 'ASSIGN-9', { pxTaskLabel: 'Stray' }, 'u');
  ok(getNodeByPath(tree, 'Cases.[unknown].assignments.ASSIGN-9'));
});

t('mergeDataPage: single entry', () => {
  const tree = emptyTree();
  mergeDataPage(tree, 'D_Customers', null, { data: [{ id: 1 }] }, 'u');
  eq(listDataPages(tree).length, 1);
  eq(listDataPages(tree)[0].name, 'D_Customers');
});

t('mergeDataPage: paramHash disambiguates', () => {
  const tree = emptyTree();
  mergeDataPage(tree, 'D_Customers', 'abc', {}, 'u');
  mergeDataPage(tree, 'D_Customers', 'xyz', {}, 'u');
  eq(listDataPages(tree).length, 2);
});

t('mergeOperator: flattens fields onto Operator page', () => {
  const tree = emptyTree();
  mergeOperator(tree, { userID: 'u@x', accessGroup: 'AG', extra: 'keep' }, 'u');
  eq(getNodeByPath(tree, 'Operator.userID').value, 'u@x');
  eq(getNodeByPath(tree, 'Operator.accessGroup').value, 'AG');
  eq(getNodeByPath(tree, 'Operator.extra').value, 'keep');
});

report('clipboard');
