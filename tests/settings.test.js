import { t, eq, ok, report } from './_harness.js';
import {
  DEFAULT_SETTINGS, mergeSettings, validateSettings,
  MIN_BODY_LIMIT_BYTES, MAX_BODY_LIMIT_BYTES
} from '../src/state/settings.js';

t('mergeSettings: empty partial → defaults', () => {
  const s = mergeSettings();
  eq(s, { ...DEFAULT_SETTINGS });
});

t('mergeSettings: clamps snapshotCap above max', () => {
  const s = mergeSettings({ snapshotCap: 9999 });
  eq(s.snapshotCap, 20);
});
t('mergeSettings: clamps snapshotCap below min', () => {
  const s = mergeSettings({ snapshotCap: 0 });
  eq(s.snapshotCap, 1);
});

t('mergeSettings: clamps bodyLimitBytes', () => {
  const a = mergeSettings({ bodyLimitBytes: 1 });
  eq(a.bodyLimitBytes, MIN_BODY_LIMIT_BYTES);
  const b = mergeSettings({ bodyLimitBytes: 9 * 1024 * 1024 * 1024 });
  eq(b.bodyLimitBytes, MAX_BODY_LIMIT_BYTES);
});

t('mergeSettings: drops non-string urlPatterns', () => {
  const s = mergeSettings({ urlPatterns: ['/good', '', 42, null] });
  eq(s.urlPatterns, ['/good']);
});

t('mergeSettings: ignores empty urlPatterns and falls back to defaults', () => {
  const s = mergeSettings({ urlPatterns: [] });
  eq(s.urlPatterns, DEFAULT_SETTINGS.urlPatterns);
});

t('mergeSettings: rejects invalid theme and reducedMotion', () => {
  const s = mergeSettings({ theme: 'neon', reducedMotion: 'sometimes' });
  eq(s.theme, DEFAULT_SETTINGS.theme);
  eq(s.reducedMotion, DEFAULT_SETTINGS.reducedMotion);
});

t('validateSettings: defaults pass', () => {
  const r = validateSettings(DEFAULT_SETTINGS);
  eq(r.ok, true);
  eq(r.errors, []);
});

t('validateSettings: unknown key reports', () => {
  const r = validateSettings({ ...DEFAULT_SETTINGS, bogus: 1 });
  eq(r.ok, false);
  ok(r.errors.some((e) => e.includes('bogus')));
});

t('validateSettings: out-of-range snapshotCap', () => {
  const r = validateSettings({ ...DEFAULT_SETTINGS, snapshotCap: 999 });
  eq(r.ok, false);
  ok(r.errors.some((e) => e.includes('snapshotCap')));
});

t('mergeSettings: autoSnapshot boolean is accepted', () => {
  eq(mergeSettings({ autoSnapshot: true }).autoSnapshot, true);
  eq(mergeSettings({ autoSnapshot: false }).autoSnapshot, false);
});
t('mergeSettings: autoSnapshot non-boolean ignored', () => {
  eq(mergeSettings({ autoSnapshot: 'yes' }).autoSnapshot, true); // default is true
});

report('settings');
