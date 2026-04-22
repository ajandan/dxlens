import { t, eq, ok, report } from './_harness.js';
import { highlightRanges } from '../src/state/highlight.js';

function joinHits(ranges) {
  return ranges.filter((r) => r.hit).map((r) => r.text).join('|');
}
function textOf(ranges) {
  return ranges.map((r) => r.text).join('');
}

t('empty query → whole string as non-hit', () => {
  const r = highlightRanges('Hello', '');
  eq(r, [{ text: 'Hello', hit: false }]);
  eq(textOf(r), 'Hello');
});

t('null text → single empty non-hit', () => {
  eq(highlightRanges(null, 'x'), [{ text: '', hit: false }]);
});

t('substring match: case-insensitive and preserves case in output', () => {
  const r = highlightRanges('Ada Lovelace', 'ada');
  eq(joinHits(r), 'Ada');
  eq(textOf(r), 'Ada Lovelace');
});

t('substring match: multiple hits', () => {
  const r = highlightRanges('foo bar foo', 'foo');
  eq(joinHits(r), 'foo|foo');
  eq(textOf(r), 'foo bar foo');
});

t('quoted phrase: hits appear as contiguous range', () => {
  const r = highlightRanges('name: Ada Lovelace', '"Ada Lovelace"');
  eq(joinHits(r), 'Ada Lovelace');
});

t('leading dot query: highlights the trailing needle', () => {
  const r = highlightRanges('Cases.WORK-1.Customer.Name', '.Customer');
  eq(joinHits(r), 'Customer');
});

t('no-hit query: single non-hit range', () => {
  const r = highlightRanges('Hello', 'xyz');
  eq(r, [{ text: 'Hello', hit: false }]);
});

t('needle longer than text: no hit', () => {
  const r = highlightRanges('abc', 'abcd');
  eq(r, [{ text: 'abc', hit: false }]);
});

t('numeric input is coerced to string', () => {
  const r = highlightRanges(42, '2');
  eq(joinHits(r), '2');
  eq(textOf(r), '42');
});

report('highlight');
