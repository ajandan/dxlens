import { t, eq, ok, report } from './_harness.js';
import { createPipeline, ingestAll, ingestEvent } from '../src/state/pipeline.js';
import { createSnapshot, diffTrees } from '../src/state/snapshot.js';
import { getNodeByPath, listCases, listDataPages, buildSubtree, __setNowForTests } from '../src/state/clipboard.js';
import { dispatchTool } from '../src/state/tools.js';
import { markStale } from '../src/state/stale.js';

__setNowForTests(() => 100);

function mkClock(t0 = 1_700_000_000_000) {
  let t = t0;
  return { now: () => t, tick(ms) { t += ms; } };
}

function ev(kind, url, method, body, durationMs = 10) {
  return {
    kind, url, method,
    status: 200,
    durationMs,
    responseBody: body,
    startedAt: 0, finishedAt: 0
  };
}

// Synthetic DX stream: case GET, case PATCH, assignment GET, data page GET.
function syntheticStream() {
  return [
    ev('dx_response', 'https://app/prweb/api/application/v2/cases/WORK-1', 'GET',
       { caseInfo: { className: 'MyCo-Work' }, pxRequestor: { pyUserIdentifier: 'jane', pxAccessGroup: 'AG' },
         pyID: 'WORK-1', Customer: { Name: 'Ada', Age: 30 } }),
    ev('dx_response', 'https://app/prweb/api/application/v2/cases/WORK-1', 'PATCH',
       { Customer: { Age: 31 } }),
    ev('dx_response', 'https://app/prweb/api/application/v2/assignments/ASSIGN-A', 'GET',
       { caseID: 'WORK-1', pxTaskLabel: 'Approve' }),
    ev('dx_response', 'https://app/prweb/api/application/v2/data_views/D_Customers', 'GET',
       { data: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }] })
  ];
}

t('pipeline: synthetic stream produces expected tree shape', () => {
  const p = createPipeline();
  ingestAll(p, syntheticStream());
  eq(listCases(p.tree).length, 1);
  eq(listDataPages(p.tree).length, 1);
  eq(getNodeByPath(p.tree, 'Cases.WORK-1.Customer.Age').value, 31); // PATCH applied
  ok(getNodeByPath(p.tree, 'Cases.WORK-1.Customer.Name'));
  ok(getNodeByPath(p.tree, 'Cases.WORK-1.assignments.ASSIGN-A'));
  ok(getNodeByPath(p.tree, 'Operator.userID'));
  eq(getNodeByPath(p.tree, 'Operator.userID').value, 'jane');
});

t('pipeline: stats reflect event count and bytes', () => {
  const clock = mkClock();
  const p = createPipeline({ clock: clock.now });
  for (const e of syntheticStream()) { ingestEvent(p.tree, e, p.stats); clock.tick(50); }
  const s = p.stats.snapshot();
  eq(s.totalEvents, 4);
  ok(s.totalBytes > 0);
  ok(s.lastAt != null);
});

t('pipeline: snapshot store diff matches', () => {
  const p = createPipeline();
  // Ingest first case GET.
  ingestEvent(p.tree, syntheticStream()[0], p.stats);
  p.store.add(createSnapshot(p.tree, { label: 'Before PATCH' }));
  // Apply remaining events.
  for (const e of syntheticStream().slice(1)) ingestEvent(p.tree, e, p.stats);
  p.store.add(createSnapshot(p.tree, { label: 'After' }));

  const list = p.store.list();
  eq(list.length, 2);
  const a = p.store.get(list[0].id);
  const b = p.store.get(list[1].id);
  const d = diffTrees(a.tree, b.tree);
  ok(d.summary.changed > 0 || d.summary.added > 0);
});

t('pipeline: tool dispatch works against an ingested stream', () => {
  const p = createPipeline();
  ingestAll(p, syntheticStream());

  const tree = dispatchTool(p, 'get_tree');
  ok(tree);

  const cases = dispatchTool(p, 'list_cases');
  eq(cases.length, 1);

  const age = dispatchTool(p, 'get_node', { path: 'Cases.WORK-1.Customer.Age' });
  eq(age.value, 31);

  const dps = dispatchTool(p, 'list_data_pages');
  eq(dps.length, 1);

  const op = dispatchTool(p, 'get_operator');
  ok(op);
  ok(op.children.find((c) => c.name === 'userID'));

  const matches = dispatchTool(p, 'search_clipboard', { query: 'Ada' });
  ok(matches.length >= 1);
});

t('pipeline: footprint bytes grow monotonically with the stream', () => {
  const p = createPipeline();
  const f0 = p.footprint();
  ingestEvent(p.tree, syntheticStream()[0], p.stats);
  const f1 = p.footprint();
  ingestAll(p, syntheticStream().slice(1));
  const f2 = p.footprint();
  ok(f1.bytes > f0.bytes, `f1 ${f1.bytes} <= f0 ${f0.bytes}`);
  ok(f2.bytes > f1.bytes, `f2 ${f2.bytes} <= f1 ${f1.bytes}`);
  ok(f2.perTopLevel.Cases.nodes > f0.perTopLevel.Cases.nodes);
  ok(f2.perTopLevel.DataPages.nodes > f0.perTopLevel.DataPages.nodes);
  ok(f2.perTopLevel.Operator.nodes > f0.perTopLevel.Operator.nodes);
});

t('pipeline: stale marker flags fields dropped across a case replace', () => {
  // Build "before" and "after" case subtrees ourselves — no need to modify the
  // core merge contract (spec/02 says replace). We capture a snapshot of the
  // case subtree before the replace and run markStale against the new one.
  const before = buildSubtree('case', 'Cases.W-1', { Customer: { Name: 'Ada', Age: 30, Email: 'a@x' } }, 'u');
  const after  = buildSubtree('case', 'Cases.W-1', { Customer: { Name: 'Ada' } }, 'u');
  const r = markStale(before, after);
  ok(r.stale >= 2);
  ok(r.kept >= 2);
  const find = (path) => { const s = [before]; while (s.length) { const n = s.pop(); if (n.id === path) return n; if (n.children) for (const c of n.children) s.push(c); } return null; };
  eq(find('Cases.W-1.Customer.Name').isStale, false);
  eq(find('Cases.W-1.Customer.Age').isStale, true);
  eq(find('Cases.W-1.Customer.Email').isStale, true);
});

t('pipeline: current view populated from uiResources in a case response', () => {
  const p = createPipeline();
  ingestEvent(p.tree, {
    kind: 'dx_response',
    url: 'https://app/prweb/api/application/v2/cases/W-1',
    method: 'GET',
    status: 200, durationMs: 10, startedAt: 0, finishedAt: 0,
    responseBody: {
      uiResources: {
        root: {
          config: { name: 'Review', classID: 'MyCo-Work' },
          children: [{ config: { value: '@P .Customer.Name' } }]
        }
      }
    }
  }, p.stats);
  const cv = p.tree.children.find((n) => n.id === 'CurrentView');
  ok(cv.children.length > 0, 'CurrentView has been populated');
  const viewId = cv.children.find((c) => c.name === 'viewId');
  eq(viewId.value, 'Review');
});

t('pipeline: dx_error does not mutate tree, still records stats', () => {
  const p = createPipeline();
  const before = JSON.stringify(p.tree);
  ingestEvent(p.tree, { kind: 'dx_error', url: 'https://x/prweb/api/application/v2/cases/WORK-9', method: 'GET', error: 'boom', startedAt: 0, finishedAt: 0, durationMs: 0 }, p.stats);
  eq(JSON.stringify(p.tree), before);
  eq(p.stats.snapshot().totalEvents, 1);
});

report('pipeline');
