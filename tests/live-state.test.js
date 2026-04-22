import { t, eq, ok, report } from './_harness.js';
import { createLiveState } from '../src/state/live-state.js';

t('live mode: absorb returns the event', () => {
  const s = createLiveState();
  eq(s.isPaused(), false);
  const ev = { id: 1 };
  eq(s.absorb(ev), ev);
  eq(s.queuedCount(), 0);
});

t('pause: absorb enqueues and returns null', () => {
  const s = createLiveState();
  s.pause();
  eq(s.absorb({ id: 1 }), null);
  eq(s.absorb({ id: 2 }), null);
  eq(s.queuedCount(), 2);
});

t('resume: flushes FIFO and clears', () => {
  const s = createLiveState();
  s.pause();
  s.absorb({ id: 1 });
  s.absorb({ id: 2 });
  const { flushed, dropped } = s.resume();
  eq(flushed.map((e) => e.id), [1, 2]);
  eq(dropped, 0);
  eq(s.queuedCount(), 0);
  eq(s.isPaused(), false);
});

t('queueCap: over-cap events count as dropped', () => {
  const s = createLiveState({ queueCap: 2 });
  s.pause();
  s.absorb({ id: 1 });
  s.absorb({ id: 2 });
  s.absorb({ id: 3 }); // dropped
  eq(s.queuedCount(), 2);
  eq(s.droppedCount(), 1);
  const { dropped } = s.resume();
  eq(dropped, 1);
});

t('clear: empties queue', () => {
  const s = createLiveState();
  s.pause();
  s.absorb({ id: 1 });
  s.clear();
  eq(s.queuedCount(), 0);
});

report('live-state');
