import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './src/config.mjs';
import { validateDirectory } from './src/domain.mjs';
import { createSupabase } from './src/supabase.mjs';
import { createApi } from './src/api.mjs';

// Safe demo by default. Live mode requires explicit configuration and approval.
const files = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/routing.js', ['public/routing.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
  ['/research.html', ['public/research.html', 'text/html; charset=utf-8']],
]);
const config = await loadConfig();
validateDirectory(config.directory);
const api = createApi(config, config.live ? createSupabase(config) : null);
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'",
  );
  if (config.live) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      await api(req, res, path);
      return;
    }
    if (path === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const route = files.get(path);
    if (!route) {
      res.writeHead(404).end('Not found');
      return;
    }
    const data = await readFile(fileURLToPath(new URL(route[0], import.meta.url)));
    res.writeHead(200, { 'Content-Type': route[1] });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(500).end('Preview unavailable');
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(config.port, config.host, () =>
  console.log(`Student gateway (${config.live ? 'live' : 'demo'}): ${config.origin}`),
);
process.on('SIGTERM', () => server.close(() => process.exit(0)));
