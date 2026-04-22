// Live/Pause queue (spec/05 §Live / Pause mode).
// Pure: the SW holds one of these per tab; when paused, events are buffered;
// flush returns the queued events in FIFO order so the consumer can apply them.

export function createLiveState({ queueCap = 5000 } = {}) {
  let paused = false;
  /** @type {Array<object>} */
  const queue = [];
  let dropped = 0;

  return {
    isPaused() { return paused; },
    pause() { paused = true; },
    resume() { paused = false; const flushed = queue.slice(); queue.length = 0; const d = dropped; dropped = 0; return { flushed, dropped: d }; },
    /** If live, returns the event untouched so caller may apply it. If paused, enqueues and returns null. */
    absorb(event) {
      if (!paused) return event;
      if (queue.length >= queueCap) { dropped++; return null; }
      queue.push(event);
      return null;
    },
    queuedCount() { return queue.length; },
    droppedCount() { return dropped; },
    clear() { queue.length = 0; dropped = 0; }
  };
}
