import { t, eq, report } from './_harness.js';
import { classifySubmit } from '../src/state/auto-snapshot.js';

const base = (over) => ({ kind: 'dx_response', status: 200, durationMs: 1, startedAt: 0, finishedAt: 0, ...over });

t('GET /cases/WORK-1 is not submit-like', () => {
  eq(classifySubmit(base({ url: 'https://x/prweb/api/application/v2/cases/WORK-1', method: 'GET' })), { submitLike: false });
});

t('PATCH /cases/WORK-1 → submit-like (patch)', () => {
  const r = classifySubmit(base({ url: 'https://x/prweb/api/application/v2/cases/WORK-1', method: 'PATCH' }));
  eq(r.submitLike, true);
  eq(r.kind, 'patch');
  eq(r.caseId, 'WORK-1');
});

t('POST /cases → submit-like (create without id)', () => {
  const r = classifySubmit(base({ url: 'https://x/prweb/api/application/v2/cases', method: 'POST' }));
  eq(r.submitLike, true);
  eq(r.kind, 'create');
  eq(r.caseId, undefined);
});

t('POST /cases/WORK-2 → submit-like (create with id slug)', () => {
  const r = classifySubmit(base({ url: 'https://x/prweb/api/application/v2/cases/WORK-2', method: 'POST' }));
  eq(r.submitLike, true);
  eq(r.kind, 'create');
  eq(r.caseId, 'WORK-2');
});

t('POST /assignments/A-1/actions/Submit → assignment_action', () => {
  const r = classifySubmit(base({ url: 'https://x/prweb/api/application/v2/assignments/A-1/actions/Submit', method: 'POST' }));
  eq(r.submitLike, true);
  eq(r.kind, 'assignment_action');
  eq(r.assignmentId, 'A-1');
});

t('dx_error is never submit-like', () => {
  eq(classifySubmit({ kind: 'dx_error', url: 'https://x/prweb/api/application/v2/cases/WORK-1', method: 'PATCH' }), { submitLike: false });
});

t('non-DX URL is not submit-like', () => {
  eq(classifySubmit(base({ url: 'https://random.example/api/x', method: 'POST' })), { submitLike: false });
});

report('auto-snapshot');
