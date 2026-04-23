// spec/07 D-003: Zero outbound network requests from the extension itself.
// Scan every .js file in src/ that runs in the extension or devtools context
// and fail if it contains primitives that would open an outbound connection.
//
// Excluded from the scan:
//   - src/injected.js runs in the page's MAIN world and wraps the page's own
//     fetch/XHR; it does not originate outbound requests.
//   - refreshInPage() in src/sidepanel/sidepanel.js is a function whose body
//     is serialized with toString() and injected into the inspected page; the
//     fetch inside runs inside the page, not the extension. Allow-listed.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { t, eq, ok, report } from './_harness.js';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..', 'src');

const FORBIDDEN = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bnavigator\.sendBeacon\b/,
  /\bnew\s+WebSocket\b/,
  /\bnew\s+EventSource\b/,
  /\bnavigator\.connect\b/
];

const EXCLUDED_FILES = new Set([
  // MAIN-world wrapper — touches the page's fetch/XHR on the page, not the extension.
  path.join(srcRoot, 'injected.js'),
  // The benchmark is a standalone page tool for dev verification, not part of the extension.
  path.join(srcRoot, 'bench', 'pattern-bench.js')
]);

// Phrases allowed because they live inside a string that is injected into the
// page, not executed by the extension itself. Format: { file, marker }.
const ALLOW_IN_CONTEXT = [
  { file: path.join(srcRoot, 'sidepanel', 'sidepanel.js'), marker: 'function refreshInPage' }
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && full.endsWith('.js')) acc.push(full);
  }
  return acc;
}

function scan(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const hits = [];
  for (const re of FORBIDDEN) {
    let m;
    const g = new RegExp(re.source, 'g');
    while ((m = g.exec(src)) !== null) {
      hits.push({ index: m.index, text: m[0] });
    }
  }
  if (hits.length === 0) return [];

  // Filter out hits that fall inside an allow-listed context marker.
  const allows = ALLOW_IN_CONTEXT.filter((a) => a.file === filePath);
  return hits.filter((h) => {
    for (const a of allows) {
      const i = src.indexOf(a.marker);
      if (i >= 0) {
        // rough bracketing: from marker to end of that function (matched braces).
        const end = findFunctionEnd(src, i);
        if (h.index >= i && h.index <= end) return false;
      }
    }
    return true;
  });
}

function findFunctionEnd(src, startIdx) {
  const open = src.indexOf('{', startIdx);
  if (open < 0) return src.length;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return src.length;
}

t('no-egress: scan runs over expected files', () => {
  const files = walk(srcRoot).filter((f) => !EXCLUDED_FILES.has(f));
  ok(files.length > 5, `expected several source files, got ${files.length}`);
});

t('no-egress: extension-context source files contain no outbound primitives', () => {
  const files = walk(srcRoot).filter((f) => !EXCLUDED_FILES.has(f));
  const offenders = [];
  for (const f of files) {
    const hits = scan(f);
    if (hits.length > 0) offenders.push({ f: path.relative(srcRoot, f), hits: hits.map((h) => h.text) });
  }
  if (offenders.length > 0) {
    throw new Error('outbound primitives detected:\n' + offenders.map((o) => `  ${o.f}: ${o.hits.join(', ')}`).join('\n'));
  }
});

t('no-egress: excluded files exist and still contain the expected wrappers (injected.js only)', () => {
  const inj = path.join(srcRoot, 'injected.js');
  const src = fs.readFileSync(inj, 'utf8');
  ok(/origFetch/.test(src), 'injected.js preserves a reference to the original fetch');
  ok(/XMLHttpRequest/.test(src), 'injected.js wraps XHR');
});

report('no-egress');
