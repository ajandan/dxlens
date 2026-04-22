// Minimal test harness. No deps. Exits non-zero on any failure.

const results = [];

export function t(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(
        () => results.push({ ok: true, name }),
        (e) => results.push({ ok: false, name, msg: e && e.message, stack: e && e.stack })
      );
    }
    results.push({ ok: true, name });
  } catch (e) {
    results.push({ ok: false, name, msg: e && e.message, stack: e && e.stack });
  }
}

export function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label || 'eq'} — expected ${b} got ${a}`);
}

export function ok(cond, label) {
  if (!cond) throw new Error(label || 'expected truthy');
}

export function throws(fn, label) {
  try { fn(); } catch { return; }
  throw new Error(label || 'expected to throw');
}

export function report(suiteName) {
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  const header = `\n=== ${suiteName}: ${pass} passed, ${fail} failed ===`;
  process.stdout.write(header + '\n');
  for (const r of results) {
    if (r.ok) process.stdout.write(`  \u2713 ${r.name}\n`);
    else process.stdout.write(`  \u2717 ${r.name} — ${r.msg || ''}\n${r.stack || ''}\n`);
  }
  if (fail > 0) process.exit(1);
}
