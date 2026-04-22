// Rasterize icons/dx-lens.svg at 16/32/48/128 via Chrome headless + CDP.
// Runs Chrome with a remote-debugging port, drives Page.captureScreenshot
// with an explicit viewport. This avoids the small-window rendering quirks
// of the --screenshot flag.

import { spawn } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SVG_URL = 'file:///C:/MyProjects/DxLens/icons/dx-lens.svg';
const SIZES = [16, 32, 48, 128];
const OUT_DIR = 'C:/MyProjects/DxLens/icons';

async function pickFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

async function waitForPort(port, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome did not start');
}

async function main() {
  const port = await pickFreePort();
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'dxlens-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    SVG_URL
  ], { stdio: 'ignore' });

  try {
    const { webSocketDebuggerUrl } = await waitForPort(port);
    // Node 22+: built-in WebSocket on globalThis.
    const ws = new globalThis.WebSocket(webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id; pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });

    // Find the first page target.
    const targets = await send('Target.getTargets');
    const page = targets.targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    const sendSess = (method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id; pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ sessionId, id: n, method, params }));
    });

    await sendSess('Page.enable');
    await sendSess('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

    for (const size of SIZES) {
      await sendSess('Emulation.setDeviceMetricsOverride', {
        width: size, height: size, deviceScaleFactor: 1, mobile: false
      });
      // Re-navigate so the SVG lays out at the new viewport.
      await sendSess('Page.navigate', { url: SVG_URL });
      await sendSess('Page.loadEventFired').catch(() => {});
      // Small settle delay — SVG has no scripts but make sure paint completes.
      await new Promise((r) => setTimeout(r, 80));
      const shot = await sendSess('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const buf = Buffer.from(shot.data, 'base64');
      const out = path.join(OUT_DIR, `icon${size}.png`);
      await writeFile(out, buf);
      console.log(`wrote ${out} (${buf.length} bytes)`);
    }

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
