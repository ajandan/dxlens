// Pure throttle + debounce utilities.
// Clock and scheduler are injectable so callers can drive time deterministically
// in tests. Production code uses Date.now and setTimeout defaults.

/**
 * Trailing-edge debounce: calls `fn` with the last-seen args, `delay` ms after
 * the most recent invocation. Consecutive calls within `delay` reset the timer.
 *
 * @param {Function} fn
 * @param {number} delay
 * @param {{ now?: () => number, schedule?: (cb: Function, ms: number) => any, cancel?: (id: any) => void }} [opts]
 */
export function debounce(fn, delay, opts = {}) {
  const now = opts.now || Date.now;
  const schedule = opts.schedule || ((cb, ms) => setTimeout(cb, ms));
  const cancel = opts.cancel || ((id) => clearTimeout(id));

  let timer = null;
  let lastArgs = null;
  let pendingUntil = 0;

  function call() {
    timer = null;
    const a = lastArgs;
    lastArgs = null;
    fn.apply(null, a);
  }
  function wrapped(...args) {
    lastArgs = args;
    pendingUntil = now() + delay;
    if (timer != null) cancel(timer);
    timer = schedule(call, delay);
  }
  wrapped.cancel = () => {
    if (timer != null) { cancel(timer); timer = null; }
    lastArgs = null; pendingUntil = 0;
  };
  wrapped.flush = () => {
    if (timer != null) { cancel(timer); timer = null; call(); }
  };
  wrapped.pending = () => timer != null;
  wrapped.pendingUntil = () => pendingUntil;
  return wrapped;
}

/**
 * Leading-edge throttle: the first call fires immediately; subsequent calls
 * within `delay` are collapsed and the trailing args fire after `delay`.
 *
 * Deterministic with the same clock/scheduler overrides as `debounce`.
 */
export function throttle(fn, delay, opts = {}) {
  const now = opts.now || Date.now;
  const schedule = opts.schedule || ((cb, ms) => setTimeout(cb, ms));
  const cancel = opts.cancel || ((id) => clearTimeout(id));

  let lastInvoke = -Infinity;
  let timer = null;
  let trailingArgs = null;

  function invoke(args) {
    lastInvoke = now();
    trailingArgs = null;
    fn.apply(null, args);
  }

  function wrapped(...args) {
    const t = now();
    const since = t - lastInvoke;
    if (since >= delay) {
      if (timer != null) { cancel(timer); timer = null; }
      invoke(args);
      return;
    }
    trailingArgs = args;
    if (timer == null) {
      timer = schedule(() => {
        timer = null;
        if (trailingArgs) invoke(trailingArgs);
      }, delay - since);
    }
  }
  wrapped.cancel = () => {
    if (timer != null) { cancel(timer); timer = null; }
    trailingArgs = null;
  };
  wrapped.flush = () => {
    if (timer != null) { cancel(timer); timer = null; }
    if (trailingArgs) invoke(trailingArgs);
  };
  return wrapped;
}
