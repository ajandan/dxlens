import { t, eq, ok, report } from './_harness.js';
import { createStats, estimateBytes } from '../src/state/stats.js';

function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance(ms) { t += ms; } };
}

t('record: counts totals and timestamps', () => {
  const c = fakeClock();
  const s = createStats({ now: c.now, windowMs: 5000 });
  s.record({ url: '/x', responseBody: { a: 1 } });
  c.advance(1000);
  s.record({ url: '/y', responseBody: 'hello' });
  const snap = s.snapshot();
  eq(snap.totalEvents, 2);
  eq(snap.firstAt, 1_000_000);
  eq(snap.lastAt, 1_001_000);
  ok(snap.totalBytes > 0);
});

t('snapshot: rolling window evicts old entries', () => {
  const c = fakeClock();
  const s = createStats({ now: c.now, windowMs: 5000 });
  s.record({ url: '/a' });
  c.advance(6000); // past the window
  s.record({ url: '/b' });
  const snap = s.snapshot();
  eq(snap.windowEvents, 1);
  eq(snap.totalEvents, 2);
});

t('snapshot: eventsPerSec is windowEvents * 1000 / windowMs', () => {
  const c = fakeClock();
  const s = createStats({ now: c.now, windowMs: 10_000 });
  for (let i = 0; i < 4; i++) { s.record({ url: '/x' }); c.advance(1000); }
  const snap = s.snapshot();
  // Window=10s, 4 events → 0.4/sec.
  eq(Math.round(snap.eventsPerSec * 10) / 10, 0.4);
});

t('reset: clears counters', () => {
  const c = fakeClock();
  const s = createStats({ now: c.now });
  s.record({ url: '/x' });
  s.reset();
  const snap = s.snapshot();
  eq(snap.totalEvents, 0);
  eq(snap.firstAt, null);
  eq(snap.lastAt, null);
  eq(snap.windowEvents, 0);
});

t('estimateBytes: includes string body lengths', () => {
  eq(estimateBytes({ responseBody: 'hello', url: 'http://x' }) >= ('hello'.length + 'http://x'.length), true);
});

t('estimateBytes: handles undefined safely', () => {
  ok(estimateBytes(null) === 0);
  ok(estimateBytes(undefined) === 0);
});

report('stats');
