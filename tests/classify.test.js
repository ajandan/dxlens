import { t, eq, ok, report } from './_harness.js';
import { classify, extractOperator } from '../src/state/classify.js';

t('classify: case GET', () => {
  const c = classify({ url: 'https://x/prweb/api/application/v2/cases/WORK-1', method: 'GET' });
  eq(c.kind, 'case');
  eq(c.caseId, 'WORK-1');
  eq(c.isPatch, false);
});

t('classify: case PATCH', () => {
  const c = classify({ url: 'https://x/prweb/api/application/v2/cases/WORK-1', method: 'PATCH' });
  eq(c.kind, 'case');
  eq(c.isPatch, true);
});

t('classify: className lifted from response', () => {
  const c = classify({
    url: 'https://x/prweb/api/application/v2/cases/WORK-1',
    method: 'GET',
    responseBody: { caseInfo: { className: 'MyCo-Work' } }
  });
  eq(c.className, 'MyCo-Work');
});

t('classify: assignment', () => {
  const c = classify({ url: 'https://x/prweb/api/application/v2/assignments/A-1/actions/Approve', method: 'GET' });
  eq(c.kind, 'assignment');
  eq(c.assignmentId, 'A-1');
});

t('classify: data_view with query string → paramHash', () => {
  const c = classify({ url: 'https://x/prweb/api/application/v2/data_views/D_Customers?filter=x', method: 'GET' });
  eq(c.kind, 'data_view');
  eq(c.dataPageName, 'D_Customers');
  ok(c.paramHash, 'paramHash derived from query string');
});

t('classify: view', () => {
  const c = classify({ url: 'https://x/prweb/api/application/v2/cases/WORK-1/views/Perform', method: 'GET' });
  eq(c.kind, 'view');
  eq(c.viewId, 'Perform');
});

t('classify: other (non-matching URL)', () => {
  eq(classify({ url: 'https://x/foo', method: 'GET' }).kind, 'other');
});

t('extractOperator: finds nested pxRequestor', () => {
  const op = extractOperator({ pxRequestor: { pyUserIdentifier: 'jane', pxAccessGroup: 'AG1' } });
  eq(op.userID, 'jane');
  eq(op.accessGroup, 'AG1');
});

t('extractOperator: returns null when absent', () => {
  eq(extractOperator({ foo: 1 }), null);
});

report('classify');
