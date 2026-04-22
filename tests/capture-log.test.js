import { t, eq, ok, report } from './_harness.js';
import { createCaptureLog, LEVELS } from '../src/state/capture-log.js';

function fakeClock(start = 1000) { let now = start; return { now: () => now, tick(ms) { now += ms; } }; }

t('append: records level, msg, at', () => {
  const c = fakeClock();
  const log = createCaptureLog({ now: c.now });
  const e = log.append('info', 'hello');
  eq(e.level, 'info');
  eq(e.msg, 'hello');
  eq(e.at, 1000);
});

t('level helpers route to their level', () => {
  const log = createCaptureLog();
  log.debug('d'); log.info('i'); log.warn('w'); log.error('e');
  const levels = log.list().map((x) => x.level);
  eq(levels, ['debug', 'info', 'warn', 'error']);
});

t('list: minimum-level filter', () => {
  const log = createCaptureLog();
  log.debug('d'); log.info('i'); log.warn('w'); log.error('e');
  eq(log.list({ level: 'warn' }).map((x) => x.msg), ['w', 'e']);
  eq(log.list({ level: 'error' }).map((x) => x.msg), ['e']);
});

t('list: since-timestamp filter', () => {
  const c = fakeClock();
  const log = createCaptureLog({ now: c.now });
  log.info('one');
  c.tick(10);
  log.info('two');
  c.tick(10);
  log.info('three');
  eq(log.list({ since: 1010 }).map((x) => x.msg), ['two', 'three']);
});

t('ring buffer: evicts oldest and counts dropped', () => {
  const log = createCaptureLog({ cap: 2 });
  log.info('a'); log.info('b'); log.info('c');
  eq(log.list().map((x) => x.msg), ['b', 'c']);
  eq(log.stats().dropped, 1);
});

t('append: unknown level normalized to info', () => {
  const log = createCaptureLog();
  log.append('tragic', 'x');
  eq(log.list()[0].level, 'info');
});

t('append: non-string msg is coerced', () => {
  const log = createCaptureLog();
  log.append('info', 42);
  eq(log.list()[0].msg, '42');
});

t('clear: drops everything', () => {
  const log = createCaptureLog();
  log.info('a');
  log.clear();
  eq(log.list().length, 0);
  eq(log.stats().dropped, 0);
});

t('LEVELS: ordered least → most severe', () => {
  eq(LEVELS, ['debug', 'info', 'warn', 'error']);
});

report('capture-log');
