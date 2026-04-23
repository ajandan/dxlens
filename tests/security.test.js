// Security regression gate. Each assertion exists because a real attack
// vector was considered during review and closed in code. If any of these
// fail, either we introduced a regression or we need to consciously update
// the threat model.

import { t, eq, ok, report } from './_harness.js';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { emptyTree, mergeCaseReplace, mergeCasePatch, mergeOperator, getNodeByPath, MAX_DEPTH, MAX_CHILDREN, __setNowForTests } from '../src/state/clipboard.js';
import { copyValue, copyValueJson } from '../src/state/copy.js';
import { nodeToPlain } from '../src/state/format.js';
import { classify, extractOperator } from '../src/state/classify.js';
import { planRefreshFrom } from '../src/state/refresh.js';
import { isUnsafeKey } from '../src/state/safe-keys.js';
import { mergeSettings, DEFAULT_SETTINGS } from '../src/state/settings.js';

__setNowForTests(() => 1);

// ---- Prototype pollution --------------------------------------------------

t('proto-pollution: merge accepts __proto__ in payload but does not pollute', () => {
  const tree = emptyTree();
  const evil = { __proto__: { polluted: 'yes' }, Customer: { Name: 'Ada' } };
  mergeCaseReplace(tree, 'W-1', 'MyCo', evil, 'u');
  const probe = {};
  eq(probe.polluted, undefined);
  // No __proto__ child should have been added either (buildChildren skips it).
  const caseNode = getNodeByPath(tree, 'Cases.W-1');
  ok(!caseNode.children.some((c) => c.name === '__proto__'));
  ok(caseNode.children.some((c) => c.name === 'Customer'));
});

t('proto-pollution: copyValue never assigns __proto__ onto a plain object', () => {
  const tree = emptyTree();
  // Can't build a tree node with name==__proto__ through the happy path (our
  // merge drops it), so synthesize one and ensure copyValue still ignores it.
  mergeCaseReplace(tree, 'W-1', 'MyCo', { ok: 1 }, 'u');
  const caseNode = getNodeByPath(tree, 'Cases.W-1');
  caseNode.children.push({ id: 'Cases.W-1.__proto__', name: '__proto__', mode: 'P', children: [{ id: 'x', name: 'polluted', mode: 'SV', value: true, valueType: 'boolean', sourceUrls: [], lastUpdated: 0, isPartial: false, isStale: false }], sourceUrls: [], lastUpdated: 0, isPartial: false, isStale: false });
  const projected = copyValue(caseNode);
  const probe = {};
  eq(probe.polluted, undefined);
  eq('polluted' in projected, false);
});

t('proto-pollution: nodeToPlain skips __proto__-named children', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', null, { ok: 1 }, 'u');
  const caseNode = getNodeByPath(tree, 'Cases.W-1');
  caseNode.children.push({ id: 'x', name: 'constructor', mode: 'SV', value: 'hax', valueType: 'string', sourceUrls: [], lastUpdated: 0, isPartial: false, isStale: false });
  const plain = nodeToPlain(caseNode);
  eq(plain.constructor, Object); // inherited Object constructor, not "hax"
});

t('proto-pollution: extractOperator refuses unsafe keys', () => {
  const op = extractOperator({ pxRequestor: { __proto__: { polluted: 1 }, userID: 'jane' } });
  const probe = {};
  eq(probe.polluted, undefined);
  eq(op.userID, 'jane');
});

t('safe-keys: explicit list', () => {
  ok(isUnsafeKey('__proto__'));
  ok(isUnsafeKey('constructor'));
  ok(isUnsafeKey('prototype'));
  ok(!isUnsafeKey('Customer'));
});

// ---- Recursion / width caps ----------------------------------------------

t('depth cap: 500-deep JSON is truncated rather than overflowing', () => {
  let obj = { leaf: 'end' };
  for (let i = 0; i < 500; i++) obj = { nest: obj };
  const tree = emptyTree();
  // Must not throw. The deep branch terminates at MAX_DEPTH.
  mergeCaseReplace(tree, 'W-1', null, obj, 'u');
  const root = getNodeByPath(tree, 'Cases.W-1');
  ok(root);
  // Walk down MAX_DEPTH and verify the truncation marker sits at the boundary.
  let cur = root;
  let hops = 0;
  while (cur && cur.children && cur.children.length > 0 && hops < MAX_DEPTH + 2) {
    cur = cur.children.find((c) => c.name === 'nest' || c.name === 'leaf');
    hops++;
    if (!cur) break;
    if (cur.mode === 'SV') break;
  }
  ok(hops <= MAX_DEPTH + 1, `walked ${hops} hops, expected ≤ ${MAX_DEPTH + 1}`);
});

t('width cap: huge array is truncated at MAX_CHILDREN', () => {
  const huge = { items: new Array(MAX_CHILDREN + 100).fill(0).map((_, i) => ({ i })) };
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', null, huge, 'u');
  const items = getNodeByPath(tree, 'Cases.W-1.items');
  eq(items.children.length, MAX_CHILDREN);
  eq(items.isPartial, true);
});

// ---- classify / current-view resilience ----------------------------------

t('classify: malformed percent-encoding does not throw', () => {
  const r = classify({ url: 'https://x/prweb/api/application/v2/cases/%F1%B0', method: 'GET' });
  eq(r.kind, 'case');
  ok(typeof r.caseId === 'string');
});

// ---- Refresh planner URL validation --------------------------------------

t('refresh: plans a http(s) URL only', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', null, { x: 1 }, 'javascript:alert(1)');
  const node = getNodeByPath(tree, 'Cases.W-1');
  eq(planRefreshFrom(tree, node), null);
});

t('refresh: accepts a normal https URL', () => {
  const tree = emptyTree();
  mergeCaseReplace(tree, 'W-1', null, { x: 1 }, 'https://acme.example/prweb/api/application/v2/cases/W-1');
  const node = getNodeByPath(tree, 'Cases.W-1');
  const plan = planRefreshFrom(tree, node);
  ok(plan);
  eq(plan.method, 'GET');
});

// ---- content.js event-shape whitelist (static check) ---------------------

t('content.js validates inbound event keys', () => {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.resolve(here, '..', 'src', 'content.js'), 'utf8');
  ok(/ALLOWED_KINDS/.test(src));
  ok(/ALLOWED_TOP_KEYS/.test(src));
  ok(/function validate/.test(src));
});

// ---- settings: deep-frozen defaults --------------------------------------

t('settings: DEFAULT_SETTINGS and nested urlPatterns are frozen', () => {
  ok(Object.isFrozen(DEFAULT_SETTINGS));
  ok(Object.isFrozen(DEFAULT_SETTINGS.urlPatterns));
});

t('settings: mergeSettings returns a mutable patterns array', () => {
  const s = mergeSettings();
  // Should not throw on push since mergeSettings forks the frozen array.
  s.urlPatterns.push('/extra');
  eq(s.urlPatterns[s.urlPatterns.length - 1], '/extra');
  // Defaults stay intact.
  eq(DEFAULT_SETTINGS.urlPatterns.includes('/extra'), false);
});

// ---- Refresh bridge in sidepanel.js re-validates origin in the page ------

t('sidepanel.js refreshInPage enforces same-origin fetch', () => {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.resolve(here, '..', 'src', 'sidepanel', 'sidepanel.js'), 'utf8');
  ok(/u\.origin\s*!==\s*window\.location\.origin/.test(src), 'origin check present in refreshInPage body');
});

report('security');
