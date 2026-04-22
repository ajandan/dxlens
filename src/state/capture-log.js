// Capture log (spec/06 §Error handling — "Capture log, hidden by default").
// Bounded ring buffer of {level, msg, at, details?} entries. Pure: the SW
// instantiates one per tab and exposes it via a panel port message.

export const LEVELS = Object.freeze(['debug', 'info', 'warn', 'error']);
const DEFAULT_CAP = 200;

export function createCaptureLog({ cap = DEFAULT_CAP, now = Date.now } = {}) {
  const limit = Math.max(1, cap | 0);
  /** @type {Array<{ level: string, msg: string, at: number, details?: any }>} */
  const items = [];
  let dropped = 0;

  return {
    append(level, msg, details) {
      if (!LEVELS.includes(level)) level = 'info';
      if (typeof msg !== 'string') msg = String(msg);
      const entry = { level, msg, at: now() };
      if (details !== undefined) entry.details = details;
      items.push(entry);
      if (items.length > limit) { items.shift(); dropped++; }
      return entry;
    },
    debug(msg, details) { return this.append('debug', msg, details); },
    info(msg, details)  { return this.append('info',  msg, details); },
    warn(msg, details)  { return this.append('warn',  msg, details); },
    error(msg, details) { return this.append('error', msg, details); },
    list({ level, since } = {}) {
      return items.filter((e) => {
        if (level && LEVELS.indexOf(e.level) < LEVELS.indexOf(level)) return false;
        if (since != null && e.at < since) return false;
        return true;
      });
    },
    clear() { items.length = 0; dropped = 0; },
    stats() { return { size: items.length, cap: limit, dropped }; }
  };
}
