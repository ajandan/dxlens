// Render a 1280x800 Chrome-Web-Store-compliant screenshot (24-bit PNG, no alpha)
// from docs/img/_store_screenshot.html, using Chrome headless + CDP.

import { spawn } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HTML_URL = 'file:///C:/MyProjects/DxLens/docs/img/_store_screenshot.html';
const OUT_PATH = 'C:/MyProjects/DxLens/docs/img/store-screenshot-1.png';
const W = 1280, H = 800;

async function pickFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.unref();
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
    HTML_URL
  ], { stdio: 'ignore' });

  try {
    const { webSocketDebuggerUrl } = await waitForPort(port);
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
    const sendRaw = (sessionId, method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id; pending.set(n, { resolve, reject });
      const frame = { id: n, method, params };
      if (sessionId) frame.sessionId = sessionId;
      ws.send(JSON.stringify(frame));
    });

    const targets = await sendRaw(null, 'Target.getTargets');
    const page = targets.targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await sendRaw(null, 'Target.attachToTarget', { targetId: page.targetId, flatten: true });

    const s = (method, params) => sendRaw(sessionId, method, params);

    await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', {
      width: W, height: H, deviceScaleFactor: 1, mobile: false
    });
    await s('Page.navigate', { url: HTML_URL });
    await new Promise((r) => setTimeout(r, 500)); // settle image load

    // PNG is fine, but MUST be 24-bit (no alpha). Chrome emits RGBA by
    // default; the background color of the HTML is opaque, so every pixel
    // ends up fully opaque — but we still need to strip the alpha channel
    // to satisfy the Chrome Web Store rule. Do that post-hoc below.
    const shot = await s('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: W, height: H, scale: 1 }
    });

    const buf = Buffer.from(shot.data, 'base64');
    const rgb = stripAlpha(buf); // rebuild as 24-bit PNG
    await writeFile(OUT_PATH, rgb);
    console.log(`wrote ${OUT_PATH} (${rgb.length} bytes)`);

    ws.close();
  } finally {
    chrome.kill();
  }
}

// Rewrite a Chrome-emitted RGBA PNG as a 24-bit (colour-type 2) PNG by
// decoding the pixel stream, dropping the alpha channel, and re-encoding.
// Hand-rolled so we don't pull in a native dep.
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

function stripAlpha(pngBuf) {
  // --- parse chunks ---
  const sig = pngBuf.subarray(0, 8);
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatParts = [];
  while (off < pngBuf.length) {
    const len = pngBuf.readUInt32BE(off);
    const type = pngBuf.subarray(off + 4, off + 8).toString('ascii');
    const data = pngBuf.subarray(off + 8, off + 8 + len);
    off += 8 + len + 4; // +crc
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  if (bitDepth !== 8 || colorType !== 6) {
    // Not RGBA/8-bit — just return as-is; unlikely path for Chrome output.
    return pngBuf;
  }

  // --- unfilter scanlines ---
  const raw = inflateSync(Buffer.concat(idatParts));
  const stride = width * 4;
  const pix = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pix.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[x - 4] : 0;
      const b = prev[x];
      const c = x >= 4 ? prev[x - 4] : 0;
      let v;
      switch (filter) {
        case 0: v = line[x]; break;
        case 1: v = (line[x] + a) & 0xff; break;
        case 2: v = (line[x] + b) & 0xff; break;
        case 3: v = (line[x] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pred = (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c;
          v = (line[x] + pred) & 0xff; break;
        }
        default: v = line[x];
      }
      out[x] = v;
    }
    prev = out;
  }

  // --- drop alpha → RGB, re-emit as filter 0 scanlines ---
  const rgbStride = width * 3;
  const filtered = Buffer.alloc(height * (rgbStride + 1));
  for (let y = 0; y < height; y++) {
    filtered[y * (rgbStride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const srcI = y * stride + x * 4;
      const dstI = y * (rgbStride + 1) + 1 + x * 3;
      filtered[dstI]     = pix[srcI];
      filtered[dstI + 1] = pix[srcI + 1];
      filtered[dstI + 2] = pix[srcI + 2];
    }
  }

  // --- rebuild PNG ---
  const idat = deflateSync(filtered, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);  // bit depth
  ihdr.writeUInt8(2, 9);  // color type 2 = truecolor (RGB, 24-bit)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const parts = [sig];
  parts.push(makeChunk('IHDR', ihdr));
  parts.push(makeChunk('IDAT', idat));
  parts.push(makeChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcInput) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

main().catch((e) => { console.error(e); process.exit(1); });
