import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, mergeDataPage, getNodeByPath, __setNowForTests } from '../src/state/clipboard.js';
import { planRefresh, planRefreshFrom } from '../src/state/refresh.js';

__setNowForTests(() => 42);

function sample() {
  const tree = emptyTree();
  mergeCaseReplace(
    tree, 'WORK-1', 'MyCo-Work',
    { Customer: { Name: 'Ada' } },
    'https://acme.example/prweb/api/application/v2/cases/WORK-1'
  );
  mergeDataPage(
    tree, 'D_Customers', null,
    { data: [{ id: 1 }] },
    'https://acme.example/prweb/api/application/v2/data_views/D_Customers'
  );
  return tree;
}

t('planRefresh: case root → GET on case URL', () => {
  const tree = sample();
  const caseNode = getNodeByPath(tree, 'Cases.WORK-1');
  const r = planRefresh(caseNode);
  eq(r.method, 'GET');
  ok(r.url.endsWith('/cases/WORK-1'));
});

t('planRefresh: data page root → GET on data view URL', () => {
  const tree = sample();
  const dp = getNodeByPath(tree, 'DataPages.D_Customers');
  const r = planRefresh(dp);
  eq(r.method, 'GET');
  ok(r.url.endsWith('/data_views/D_Customers'));
});

t('planRefresh: non-refreshable node → null', () => {
  const tree = sample();
  const op = getNodeByPath(tree, 'Operator');
  eq(planRefresh(op), null);
  const customerName = getNodeByPath(tree, 'Cases.WORK-1.Customer.Name');
  // walkUp can't climb without parent pointers; planRefresh(descendant) returns null by design.
  eq(planRefresh(customerName), null);
});

t('planRefreshFrom: descendant resolves via root walk', () => {
  const tree = sample();
  const customerName = getNodeByPath(tree, 'Cases.WORK-1.Customer.Name');
  const r = planRefreshFrom(tree, customerName);
  ok(r);
  ok(r.url.endsWith('/cases/WORK-1'));
});

t('planRefreshFrom: non-refreshable descendant → null', () => {
  const tree = sample();
  const op = getNodeByPath(tree, 'Operator.userID') || getNodeByPath(tree, 'Operator');
  eq(planRefreshFrom(tree, op), null);
});

report('refresh');
