// Microbenchmark for the pattern matcher used by injected.js.
// Kept in sync by hand; change both if DEFAULT_PATTERNS changes (spec/01).

const PATTERNS = [
  '/prweb/api/application/v',
  '/prweb/api/v',
  '/prweb/PRRestService/',
  '/api/application/v',
  '/api/v1/',
  '/api/v2/',
  '/prweb/app/',
  '/constellation/api/'
];

function matches(url, patterns) {
  for (let i = 0; i < patterns.length; i++) {
    if (url.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

const NON_MATCHING = [
  'https://www.google.com/search?q=pega',
  'https://cdn.example.com/assets/bundle.abc123.js',
  'https://mail.example.com/api/v3/messages',
  'https://gmail.com/u/0/mail/messages/inbox',
  'https://static.example.net/fonts/roboto.woff2',
  'https://telemetry.example.com/track?e=x',
  'https://app.example.com/graphql',
  'https://photos.example.com/images/list',
  'https://example.com/',
  'https://example.com/health'
];

const MATCHING = [
  'https://acme.pega.example/prweb/api/application/v2/cases/X-1',
  'https://acme.pega.example/prweb/api/v1/cases',
  'https://acme.pega.example/prweb/PRRestService/getData',
  'https://acme.pega.example/api/application/v2/data_pages/D_Something'
];

function bench(label, urls, iterations) {
  const n = urls.length;
  const t0 = performance.now();
  let hits = 0;
  for (let i = 0; i < iterations; i++) {
    if (matches(urls[i % n], PATTERNS)) hits++;
  }
  const t1 = performance.now();
  const total = t1 - t0;
  return { label, iterations, totalMs: total, perMs: total / iterations, hits };
}

function fmt(n, d = 4) { return n.toFixed(d); }

function render(results, budgetMs) {
  const out = document.getElementById('out');
  let html = '<table><thead><tr><th>Case</th><th>Iterations</th><th>Total (ms)</th><th>Per call (ms)</th><th>vs budget</th></tr></thead><tbody>';
  for (const r of results) {
    const pass = r.perMs < budgetMs;
    html += `<tr>
      <td>${r.label}</td>
      <td>${r.iterations.toLocaleString()}</td>
      <td>${fmt(r.totalMs, 2)}</td>
      <td>${fmt(r.perMs)}</td>
      <td class="${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'FAIL'} (&lt; ${budgetMs} ms)</td>
    </tr>`;
  }
  html += '</tbody></table>';
  out.innerHTML = html;
}

document.getElementById('run').addEventListener('click', () => {
  // Warm up the JIT.
  bench('warmup', NON_MATCHING, 20000);
  bench('warmup', MATCHING, 20000);

  const results = [
    bench('non-matching URLs', NON_MATCHING, 1_000_000),
    bench('matching URLs', MATCHING, 1_000_000)
  ];
  // Budget is per-call overhead for the wrapper on non-matched URLs: 2 ms.
  // The pattern check alone must be a small fraction of that.
  render(results, 2);
});
