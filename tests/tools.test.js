import { t, eq, ok, report, throws } from './_harness.js';
import {
  emptyTree, mergeCaseReplace, mergeDataPage, mergeOperator, __setNowForTests
} from '../src/state/clipboard.js';
import { createStore, createSnapshot, __setNowForTests as setSnapNow, __resetIdsForTests } from '../src/state/snapshot.js';
import { dispatchTool } from '../src/state/tools.js';
import { mergeCurrentView } from '../src/state/current-view.js';

__setNowForTests(() => 1);
setSnapNow(() => 2);
__resetIdsForTests();

function ctxWith(payload) {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'WORK-1', 'MyCo-Work', payload.case || {}, 'u');
  if (payload.dp) mergeDataPage(tree, 'D_X', null, payload.dp, 'u');
  if (payload.op) mergeOperator(tree, payload.op, 'u');
  const store = createStore();
  return { tree, store };
}

t('dispatchTool: get_tree returns root', () => {
  const ctx = ctxWith({ case: {} });
  const r = dispatchTool(ctx, 'get_tree');
  eq(r.mode, 'ROOT');
});

t('dispatchTool: list_cases', () => {
  const ctx = ctxWith({ case: { pyID: 'WORK-1' } });
  const r = dispatchTool(ctx, 'list_cases');
  eq(r.length, 1);
  eq(r[0].name, 'WORK-1 (MyCo-Work)');
});

t('dispatchTool: get_node', () => {
  const ctx = ctxWith({ case: { Customer: { Name: 'Ada' } } });
  const n = dispatchTool(ctx, 'get_node', { path: 'Cases.WORK-1.Customer.Name' });
  eq(n.value, 'Ada');
});

t('dispatchTool: get_operator', () => {
  const ctx = ctxWith({ case: {}, op: { userID: 'u@x' } });
  const op = dispatchTool(ctx, 'get_operator');
  eq(op.id, 'Operator');
  ok(op.children.find((c) => c.name === 'userID'));
});

t('dispatchTool: get_current_view null when CurrentView empty', () => {
  const ctx = ctxWith({ case: {} });
  eq(dispatchTool(ctx, 'get_current_view'), null);
});

t('dispatchTool: get_current_view populated after view identification', () => {
  const ctx = ctxWith({ case: {} });
  mergeCurrentView(ctx.tree, { viewId: 'Perform', bindings: ['x'], source: 'u' });
  const cv = dispatchTool(ctx, 'get_current_view');
  ok(cv);
  eq(cv.id, 'CurrentView');
  ok(cv.children.find((c) => c.name === 'viewId'));
});

t('dispatchTool: search_clipboard', () => {
  const ctx = ctxWith({ case: { Customer: { Name: 'Ada Lovelace' } } });
  const r = dispatchTool(ctx, 'search_clipboard', { query: 'Lovelace' });
  ok(r.some((m) => m.id === 'Cases.WORK-1.Customer.Name'));
});

t('dispatchTool: snapshot lifecycle', () => {
  const ctx = ctxWith({ case: { Name: 'A' } });
  // seed two snapshots
  ctx.store.add(createSnapshot(ctx.tree, { label: 'first' }));
  mergeCaseReplace(ctx.tree, 'WORK-1', 'MyCo-Work', { Name: 'B' }, 'u');
  ctx.store.add(createSnapshot(ctx.tree, { label: 'second' }));

  const list = dispatchTool(ctx, 'list_snapshots');
  eq(list.length, 2);
  eq(list[0].label, 'first');

  const got = dispatchTool(ctx, 'get_snapshot', { id: list[0].id });
  eq(got.label, 'first');

  const diff = dispatchTool(ctx, 'diff_snapshots', { a: list[0].id, b: list[1].id });
  ok(diff.summary.changed > 0 || diff.summary.added > 0 || diff.summary.removed > 0);
  eq(diff.a.label, 'first');
  eq(diff.b.label, 'second');
});

t('dispatchTool: get_field_binding finds a Customer.Name', () => {
  const ctx = ctxWith({ case: { Customer: { Name: 'Ada' } } });
  const b = dispatchTool(ctx, 'get_field_binding', { fieldName: 'Name', caseId: 'WORK-1' });
  ok(b);
  eq(b.value, 'Ada');
});

t('dispatchTool: unknown tool throws', () => {
  const ctx = ctxWith({ case: {} });
  throws(() => dispatchTool(ctx, 'nope'));
});

t('dispatchTool: diff_snapshots throws on missing id', () => {
  const ctx = ctxWith({ case: {} });
  throws(() => dispatchTool(ctx, 'diff_snapshots', { a: 'x', b: 'y' }));
});

report('tools');
