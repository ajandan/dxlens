import { t, eq, ok, report } from './_harness.js';
import { emptyTree, mergeCaseReplace, getNodeByPath, __setNowForTests } from '../src/state/clipboard.js';
import { formatSvValue, nodeToPlain, nodeToJson, shortLabel, fmtBytes, fmtTime } from '../src/state/format.js';

__setNowForTests(() => 1);

t('formatSvValue: strings are JSON-encoded', () => {
  eq(formatSvValue('hello'), '"hello"');
  eq(formatSvValue('a "b" c'), '"a \\"b\\" c"');
});
t('formatSvValue: numbers, booleans, null', () => {
  eq(formatSvValue(42), '42');
  eq(formatSvValue(true), 'true');
  eq(formatSvValue(null), 'null');
  eq(formatSvValue(undefined), 'null');
});

t('nodeToPlain: SV', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', null, { Name: 'Ada', Age: 30, Tags: ['r', 'b'], Items: [{ x: 1 }] }, 'u');
  eq(nodeToPlain(getNodeByPath(tree, 'Cases.W-1.Name')), 'Ada');
  eq(nodeToPlain(getNodeByPath(tree, 'Cases.W-1.Tags')), ['r', 'b']);
  eq(nodeToPlain(getNodeByPath(tree, 'Cases.W-1.Items')), [{ x: 1 }]);
  eq(nodeToPlain(null), null);
});

t('nodeToJson: pretty JSON for a subtree', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', null, { a: 1 }, 'u');
  const json = nodeToJson(getNodeByPath(tree, 'Cases.W-1'), 0);
  eq(json, '{"a":1}');
});

t('shortLabel: binary bodies and errors', () => {
  eq(shortLabel({ kind: 'dx_error', error: 'boom' }), 'boom');
  eq(shortLabel({ kind: 'dx_response', bodyUnavailable: true }), '(binary / unavailable)');
  eq(shortLabel(null), '');
});
t('shortLabel: string body is clipped to 200 chars', () => {
  const body = 'x'.repeat(500);
  const s = shortLabel({ kind: 'dx_response', responseBody: body });
  eq(s.length, 200);
});
t('shortLabel: object body shows key preview', () => {
  const s = shortLabel({ kind: 'dx_response', responseBody: { a: 1, b: 2, c: 3 } });
  ok(s.startsWith('{'));
  ok(s.includes('a'));
  ok(s.includes('b'));
  ok(s.includes('c'));
});

t('fmtBytes: unit thresholds', () => {
  eq(fmtBytes(0), '0 B');
  eq(fmtBytes(512), '512 B');
  eq(fmtBytes(2048), '2.0 KB');
  eq(fmtBytes(2 * 1024 * 1024), '2.0 MB');
});

t('fmtTime: HH:MM:SS.mmm for a known instant', () => {
  // Use a local ms value we can reason about: midnight UTC varies by timezone
  // so we only assert formatting shape, not exact digits.
  const s = fmtTime(Date.UTC(2026, 0, 1, 12, 34, 56, 789));
  ok(/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(s), s);
});

report('format');
