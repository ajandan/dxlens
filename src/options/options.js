// Options page. Loads/saves settings via chrome.storage.local, validated by the
// pure settings module.

import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from '../state/settings.js';

const SETTINGS_KEY = 'dxlens.settings';

const el = (id) => document.getElementById(id);
const urlPatterns = el('urlPatterns');
const snapshotCap = el('snapshotCap');
const bodyLimitMB = el('bodyLimitMB');
const themeSel = el('theme');
const motionSel = el('reducedMotion');
const autoSnap = el('autoSnapshot');
const statusEl = el('status');

async function load() {
  const raw = await chrome.storage.local.get(SETTINGS_KEY);
  const s = mergeSettings(raw[SETTINGS_KEY] || {});
  render(s);
}

function render(s) {
  urlPatterns.value = s.urlPatterns.join('\n');
  snapshotCap.value = String(s.snapshotCap);
  bodyLimitMB.value = (s.bodyLimitBytes / (1024 * 1024)).toFixed(2);
  themeSel.value = s.theme;
  motionSel.value = s.reducedMotion;
  autoSnap.checked = !!s.autoSnapshot;
}

function collect() {
  const patterns = urlPatterns.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return {
    urlPatterns: patterns,
    snapshotCap: Number(snapshotCap.value),
    bodyLimitBytes: Math.floor(Number(bodyLimitMB.value) * 1024 * 1024),
    theme: themeSel.value,
    reducedMotion: motionSel.value,
    autoSnapshot: !!autoSnap.checked
  };
}

el('save').addEventListener('click', async () => {
  const next = mergeSettings(collect());
  const v = validateSettings(next);
  if (!v.ok) {
    statusEl.textContent = v.errors.join('; ');
    return;
  }
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  statusEl.textContent = 'saved';
  render(next);
  setTimeout(() => { statusEl.textContent = ''; }, 1200);
});

el('reset').addEventListener('click', async () => {
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS } });
  render({ ...DEFAULT_SETTINGS });
  statusEl.textContent = 'reset';
  setTimeout(() => { statusEl.textContent = ''; }, 1200);
});

load();
