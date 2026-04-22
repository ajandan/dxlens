import { t, eq, ok, report } from './_harness.js';
import { debounce, throttle } from '../src/state/timing.js';

// Controllable clock + scheduler for deterministic tests.
function fakeTimers(start = 0) {
  let now = start;
  let nextId = 1;
  const pending = new Map();
  return {
    now: () => now,
    schedule(cb, ms) {
      const id = nextId++;
      pending.set(id, { at: now + ms, cb });
      return id;
    },
    cancel(id) { pending.delete(id); },
    advance(ms) {
      const target = now + ms;
      // Fire in chronological order
      while (true) {
        const next = [...pending.entries()]
          .filter(([, v]) => v.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, entry] = next;
        pending.delete(id);
        now = entry.at;
        entry.cb();
      }
      now = target;
    }
  };
}

t('debounce: fires once after delay with last args', () => {
  const tk = fakeTimers();
  const calls = [];
  const fn = debounce((x) => calls.push(x), 100, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });
  fn(1); fn(2); fn(3);
  eq(calls, []);
  tk.advance(99);
  eq(calls, []);
  tk.advance(1);
  eq(calls, [3]);
});

t('debounce: resets timer on each call', () => {
  const tk = fakeTimers();
  const calls = [];
  const fn = debounce((x) => calls.push(x), 100, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });
  fn('a');
  tk.advance(60);
  fn('b');
  tk.advance(60);
  eq(calls, []);
  tk.advance(40);
  eq(calls, ['b']);
});

t('debounce: flush fires immediately; cancel drops pending', () => {
  const tk = fakeTimers();
  const calls = [];
  const fn = debounce((x) => calls.push(x), 100, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });

  fn('x');
  fn.flush();
  eq(calls, ['x']);
  fn('y');
  fn.cancel();
  tk.advance(500);
  eq(calls, ['x']);
});

t('debounce: pending reflects state', () => {
  const tk = fakeTimers();
  const fn = debounce(() => {}, 50, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });
  eq(fn.pending(), false);
  fn();
  eq(fn.pending(), true);
  tk.advance(50);
  eq(fn.pending(), false);
});

t('throttle: leading-edge invoke', () => {
  const tk = fakeTimers();
  const calls = [];
  const fn = throttle((x) => calls.push(x), 100, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });
  fn(1);
  eq(calls, [1]);
});

t('throttle: within-window calls collapse and trailing fires at boundary', () => {
  const tk = fakeTimers();
  const calls = [];
  const fn = throttle((x) => calls.push(x), 100, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });
  fn(1); // leading
  tk.advance(30); fn(2);
  tk.advance(30); fn(3);
  eq(calls, [1]);
  tk.advance(40); // at 100ms — trailing should have fired
  eq(calls, [1, 3]);
});

t('throttle: new call after cooldown is a fresh leading invoke', () => {
  const tk = fakeTimers();
  const calls = [];
  const fn = throttle((x) => calls.push(x), 50, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });
  fn('a');
  tk.advance(100);
  fn('b');
  eq(calls, ['a', 'b']);
});

t('throttle: flush fires pending trailing immediately', () => {
  const tk = fakeTimers();
  const calls = [];
  const fn = throttle((x) => calls.push(x), 100, { now: tk.now, schedule: tk.schedule, cancel: tk.cancel });
  fn('x');  // leading fires
  fn('y');  // trailing queued
  fn.flush();
  eq(calls, ['x', 'y']);
});

report('timing');
