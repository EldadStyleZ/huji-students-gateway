import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createApi } from './api.mjs';
import { privacyPage } from './privacy.mjs';
import { rawBody, json } from './http.mjs';
import { verifyWebhook, deliveryEvent } from './webhook.mjs';
import { AppError } from './domain.mjs';

export async function createGatewayServer(config, store, { background = null } = {}) {
  const assets = new Map();
  for (const [path, file, type] of [
    ['/', 'index.html', 'text/html'],
    ['/app.js', 'app.js', 'text/javascript'],
    ['/routing.js', 'routing.js', 'text/javascript'],
    ['/styles.css', 'styles.css', 'text/css'],
    ['/research.html', 'research.html', 'text/html'],
  ]) {
    const data = await readFile(new URL('../public/' + file, import.meta.url));
    const gzip = gzipSync(data);
    const tag = (b) => '"' + createHash('sha256').update(b).digest('hex').slice(0, 24) + '"';
    assets.set(path, {
      data,
      gzip,
      tag: tag(data),
      gzipTag: tag(gzip),
      type: type + '; charset=utf-8',
    });
  }
  const api = createApi(config, store);
  // A bounded process-wide burst cap protects memory without trusting proxy headers.
  // Per-email/account business limits remain durable in Postgres.
  let requests = 0,
    windowEnd = Date.now() + 1000,
    active = 0;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
    );
    if (config.live) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    if (Date.now() > windowEnd) {
      requests = 0;
      windowEnd = Date.now() + 1000;
    }
    if (++requests > 200 || active >= 100) {
      res.setHeader('Retry-After', '1');
      json(res, 429, { error: 'too-many-requests' });
      return;
    }
    active++;
    let finished = false;
    const release = () => {
      if (!finished) {
        finished = true;
        active--;
      }
    };
    res.once('close', release);
    res.once('finish', release);
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/webhooks/resend') {
        if (req.method !== 'POST') throw new AppError(405, 'method-not-allowed');
        if (!config.live || !config.webhookSecret)
          throw new AppError(503, 'webhook-not-configured');
        const raw = await rawBody(req, 65536);
        const id = verifyWebhook(raw, req.headers, config.webhookSecret);
        const event = deliveryEvent(raw, id);
        if (event) await store.rpc('gateway_email_event', event);
        json(res, 200, { ok: true });
        return;
      }
      if (path.startsWith('/api/')) {
        await api(req, res, path);
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        throw new AppError(405, 'method-not-allowed');
      }
      if (path === '/healthz' || path === '/readyz') {
        const ready =
          !config.live ||
          Boolean(
            background &&
            !background.state.stopping &&
            Date.now() - background.state.lastSuccess < 120000,
          );
        json(res, path === '/healthz' || ready ? 200 : 503, { ok: path === '/healthz' || ready });
        return;
      }
      if (path === '/privacy') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : privacyPage(config));
        return;
      }
      const file = assets.get(path);
      if (!file) throw new AppError(404, 'not-found');
      const encodings = String(req.headers['accept-encoding'] || '')
        .split(',')
        .map((x) => x.trim().split(';'));
      const zipped = encodings.some(
        ([name, q]) => name === 'gzip' && (!q || Number(q.trim().replace(/^q=/, '')) > 0),
      );
      const tag = zipped ? file.gzipTag : file.tag,
        data = zipped ? file.gzip : file.data;
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('ETag', tag);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      if (zipped) res.setHeader('Content-Encoding', 'gzip');
      if (
        String(req.headers['if-none-match'] || '')
          .split(',')
          .map((x) => x.trim())
          .includes(tag)
      ) {
        res.writeHead(304).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': file.type, 'Content-Length': data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (!res.headersSent)
        json(res, error instanceof AppError ? error.status : 503, {
          error: error instanceof AppError ? error.code : 'service-unavailable',
        });
      else res.destroy();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 1000;
  return server;
}
