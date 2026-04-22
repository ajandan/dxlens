import { t, eq, ok, throws, report } from './_harness.js';
import {
  parsePath, joinSegments, normalizePath, splitPath, isDescendantPath,
  ancestorPaths, parentPath
} from '../src/state/path.js';

t('parsePath: empty input → []', () => {
  eq(parsePath(''), []);
  eq(parsePath(null), []);
});

t('parsePath: property-only path', () => {
  eq(parsePath('Cases.WORK-1.Customer.Name'), [
    { name: 'Cases' }, { name: 'WORK-1' }, { name: 'Customer' }, { name: 'Name' }
  ]);
});

t('parsePath: array indices are 1-indexed', () => {
  eq(parsePath('Cases.WORK-1.Items(2).label'), [
    { name: 'Cases' }, { name: 'WORK-1' }, { name: 'Items', index: 2 }, { name: 'label' }
  ]);
});

t('parsePath: data-page paramHash survives as a single segment', () => {
  // DataPages.D_Customers[abc] would be invalid under SEGMENT_RE; ids that use
  // brackets come from mergeDataPage. Use a clean D_X id here.
  eq(parsePath('DataPages.D_Customers.data(1).name'), [
    { name: 'DataPages' }, { name: 'D_Customers' }, { name: 'data', index: 1 }, { name: 'name' }
  ]);
});

t('parsePath: rejects zero and non-positive indices', () => {
  throws(() => parsePath('x(0)'));
  throws(() => parsePath('x(-1)'));
});

t('parsePath: rejects empty segments', () => {
  throws(() => parsePath('a..b'));
  throws(() => parsePath('.a'));
});

t('parsePath: rejects malformed parens', () => {
  throws(() => parsePath('x(1'));
  throws(() => parsePath('x1)'));
});

t('joinSegments: serializes back to dotted form', () => {
  eq(joinSegments([{ name: 'Cases' }, { name: 'WORK-1' }, { name: 'Items', index: 2 }, { name: 'label' }]),
     'Cases.WORK-1.Items(2).label');
});

t('joinSegments: rejects bad segment.index', () => {
  throws(() => joinSegments([{ name: 'x', index: 0 }]));
  throws(() => joinSegments([{ name: '' }]));
});

t('normalizePath: round-trips valid input', () => {
  const p = 'Cases.WORK-1.Items(10).nested.label';
  eq(normalizePath(p), p);
});

t('normalizePath: throws on malformed input', () => {
  throws(() => normalizePath('a..b'));
});

t('splitPath: matches lossless string split', () => {
  eq(splitPath(''), []);
  eq(splitPath('a.b.c'), ['a', 'b', 'c']);
});

t('isDescendantPath: strict descendant', () => {
  eq(isDescendantPath('Cases.WORK-1', 'Cases.WORK-1.Customer'), true);
  eq(isDescendantPath('Cases.WORK-1', 'Cases.WORK-1'), false); // not strict
  eq(isDescendantPath('Cases.WORK-1', 'Cases.WORK-10.Customer'), false); // prefix, not ancestor
  eq(isDescendantPath('', 'Cases.WORK-1'), true); // root ancestor
});

t('ancestorPaths: yields top→parent list', () => {
  eq(ancestorPaths('Cases.WORK-1.Customer.Name'), ['Cases', 'Cases.WORK-1', 'Cases.WORK-1.Customer']);
});

t('parentPath: string split at last dot', () => {
  eq(parentPath('Cases.WORK-1.Customer'), 'Cases.WORK-1');
  eq(parentPath('Cases'), '');
});

report('path');
