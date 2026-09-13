import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createGatewayServer } from '../src/server.mjs';
const service = JSON.parse(await readFile(new URL('../config/service.json', import.meta.url)));
const server = await createGatewayServer({ live: false, service }, null);
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
const samples = [];
let issued = 0;
try {
  await Promise.all(
    Array.from({ length: 10 }, async () => {
      while (issued++ < 100) {
        const start = performance.now();
        const res = await fetch(base + '/api/config');
        if (!res.ok) throw new Error('Unexpected HTTP status: ' + res.status);
        await res.json();
        samples.push(performance.now() - start);
      }
    }),
  );
  samples.sort((a, b) => a - b);
  const files = [];
  for (const name of ['index.html', 'app.js', 'routing.js', 'styles.css']) {
    const bytes = await readFile(new URL('../public/' + name, import.meta.url));
    files.push({ name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
  }
  const report = {
    createdAt: new Date().toISOString(),
    scope:
      'Local demo HTTP only; no external Auth, database, mail, model or internet latency. Not production capacity evidence.',
    requests: samples.length,
    concurrency: 10,
    p50ms: Math.round(samples[49] * 100) / 100,
    p95ms: Math.round(samples[94] * 100) / 100,
    files,
    totalGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
  };
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../artifacts/performance-local.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
