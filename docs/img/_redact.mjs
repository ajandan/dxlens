// Produce a redacted version of screenshot-clipboard.png by opening
// _redact.html in headless Chrome and capturing its canvas.

import { spawn } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { accessSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import net from 'node:net';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(HERE, '_redact.html');
const HTML_URL = pathToFileURL(HTML_PATH).href;
const OUT_PATH = path.join(HERE, 'screenshot-clipboard.png');
const W = 1918, H = 987;

function resolveChrome() {
  if (process.env.DX_LENS_CHROME) return process.env.DX_LENS_CHROME;
  const candidates = platform() === 'win32' ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ] : platform() === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ];
  for (const c of candidates) { try { accessSync(c); return c; } catch {} }
  throw new Error('Chrome not found');
}
async function pickFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.unref();
    s.on('error', reject);
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
async function waitForPort(port, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return await r.json(); } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome did not start');
}

const port = await pickFreePort();
const userDataDir = await mkdtemp(path.join(tmpdir(), 'dxlens-redact-'));
const chrome = spawn(resolveChrome(), [
  '--headless=new', '--disable-gpu', `--user-data-dir=${userDataDir}`,
  `--remote-debugging-port=${port}`, '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', HTML_URL
], { stdio: 'ignore' });

try {
  const { webSocketDebuggerUrl } = await waitForPort(port);
  const ws = new globalThis.WebSocket(webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  const raw = (sid, method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject });
    const frame = { id: n, method, params }; if (sid) frame.sessionId = sid;
    ws.send(JSON.stringify(frame));
  });
  const targets = await raw(null, 'Target.getTargets');
  const page = targets.targetInfos.find((t) => t.type === 'page');
  const { sessionId } = await raw(null, 'Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const s = (m, p) => raw(sessionId, m, p);
  await s('Page.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await s('Page.navigate', { url: HTML_URL });
  // Wait until the canvas has been populated (title is set by the onload handler)
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const { result } = await s('Runtime.evaluate', { expression: 'document.title' });
    if (result && typeof result.value === 'string' && result.value.startsWith('ready:')) break;
  }
  const shot = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  await writeFile(OUT_PATH, Buffer.from(shot.data, 'base64'));
  console.log(`wrote ${OUT_PATH}`);
  ws.close();
} finally { chrome.kill(); }
