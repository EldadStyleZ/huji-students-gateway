import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { verifyWebhook, deliveryEvent } from '../src/webhook.mjs';
import { createGatewayServer } from '../src/server.mjs';
import { createSupabase } from '../src/supabase.mjs';
import { loadConfig } from '../src/config.mjs';
import { startBackground } from '../src/background.mjs';

// Public example vector from Svix, not a credential from a deployed endpoint:
// https://docs.svix.com/receiving/verifying-payloads/how-manual#example-signatures
// Its whsec_ prefix can trigger GitHub's Stripe webhook-secret detector.
// Keep this independent vector to verify compatibility; never configure it in production.
const reference = {
  secret: 'whsec_plJ3nmyCDGBKInavdOK15jsl',
  raw: Buffer.from('{"event_type":"ping","data":{"success":true}}'),
  headers: {
    'svix-id': 'msg_loFOjxBNrRLzqYUf',
    'svix-timestamp': '1731705121',
    'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=',
  },
};
test('webhook verifier matches the independent Svix published test vector', () => {
  assert.equal(
    verifyWebhook(reference.raw, reference.headers, reference.secret, 1731705121000),
    'msg_loFOjxBNrRLzqYUf',
  );
});
test('webhook verifier rejects tampered bytes, expired/future signatures and missing headers', () => {
  const now = 1731705121000;
  assert.throws(() => verifyWebhook(Buffer.from('{}'), reference.headers, reference.secret, now));
  assert.throws(() =>
    verifyWebhook(reference.raw, reference.headers, reference.secret, now + 301000),
  );
  assert.throws(() =>
    verifyWebhook(reference.raw, reference.headers, reference.secret, now - 301000),
  );
  assert.throws(() => verifyWebhook(reference.raw, {}, reference.secret, now));
  assert.equal(
    verifyWebhook(
      reference.raw,
      {
        ...reference.headers,
        'svix-signature': 'v1,invalid ' + reference.headers['svix-signature'],
      },
      reference.secret,
      now,
    ),
    'msg_loFOjxBNrRLzqYUf',
  );
});
test('delivery events retain minimal metadata and ignore non-delivery events', () => {
  const event = deliveryEvent(
    Buffer.from(
      JSON.stringify({
        type: 'email.delivered',
        created_at: '2026-09-13T12:00:00Z',
        data: { email_id: 'abc', to: ['private@example.org'], text: 'private' },
      }),
    ),
    'event-1',
  );
  assert.deepEqual(Object.keys(event).sort(), [
    'p_event_id',
    'p_occurred_at',
    'p_provider_id',
    'p_status',
  ]);
  assert.equal(deliveryEvent(Buffer.from('{"type":"email.opened"}'), 'event-2'), null);
  assert.throws(() =>
    deliveryEvent(
      Buffer.from('{"type":"email.delivered","created_at":"invalid","data":{"email_id":"abc"}}'),
      'event-3',
    ),
  );
});
const service = {
  approved: true,
  noticeVersion: 'test-v2',
  operator: { he: 'בדיקה', en: 'Test' },
  privacyEmail: 'privacy@example.org',
  retentionDays: 90,
  responseExpectation: { he: 'בדיקה', en: 'Test' },
};
async function withServer(config, store, options, fn) {
  const server = await createGatewayServer(config, store, options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    await fn(url);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
test('HTTP assets revalidate, gzip reduces bytes, private routes are unavailable and HEAD is empty', async () => {
  await withServer({ live: false, service }, null, {}, async (base) => {
    const raw = await fetch(base + '/app.js', { headers: { 'Accept-Encoding': 'identity' } });
    const plainLength = Number(raw.headers.get('content-length'));
    await raw.text();
    const compressed = await fetch(base + '/app.js', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(compressed.headers.get('content-encoding'), 'gzip');
    assert.ok(Number(compressed.headers.get('content-length')) < plainLength / 2);
    const cached = await fetch(base + '/app.js', {
      headers: { 'Accept-Encoding': 'gzip', 'If-None-Match': compressed.headers.get('etag') },
    });
    assert.equal(cached.status, 304);
    assert.equal((await fetch(base + '/.env')).status, 404);
    assert.equal((await fetch(base + '/config/roles-source.json')).status, 404);
    assert.equal((await fetch(base + '/app.js', { method: 'POST' })).status, 405);
    assert.equal(await (await fetch(base + '/', { method: 'HEAD' })).text(), '');
    const privacy = await fetch(base + '/privacy');
    assert.equal(privacy.headers.get('cache-control'), 'no-store');
    assert.match(await privacy.text(), /privacy@example.org/);
  });
});
test('live readiness requires a healthy background loop and signed webhooks bypass only Origin', async () => {
  const secret = 'whsec_' + Buffer.alloc(32, 7).toString('base64');
  const state = { lastSuccess: 0, stopping: false };
  const calls = [];
  await withServer(
    { live: true, service, webhookSecret: secret },
    { rpc: async (...x) => calls.push(x) },
    { background: { state } },
    async (base) => {
      assert.equal((await fetch(base + '/readyz')).status, 503);
      state.lastSuccess = Date.now();
      assert.equal((await fetch(base + '/readyz')).status, 200);
      state.stopping = true;
      assert.equal((await fetch(base + '/readyz')).status, 503);
      const body = JSON.stringify({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: 'provider-1' },
      });
      assert.equal(
        (await fetch(base + '/api/webhooks/resend', { method: 'POST', body })).status,
        401,
      );
      assert.equal(calls.length, 0);
      const timestamp = String(Math.floor(Date.now() / 1000)),
        id = 'msg-1';
      const signature = createHmac('sha256', Buffer.alloc(32, 7))
        .update(`${id}.${timestamp}.${body}`)
        .digest('base64');
      const response = await fetch(base + '/api/webhooks/resend', {
        method: 'POST',
        body,
        headers: {
          'svix-id': id,
          'svix-timestamp': timestamp,
          'svix-signature': 'v1,' + signature,
        },
      });
      assert.equal(response.status, 200);
      assert.equal(calls[0][0], 'gateway_email_event');
    },
  );
});
test('Supabase new keys use apikey and verified user JWT uses Authorization', async () => {
  const calls = [];
  const store = createSupabase(
    {
      supabaseUrl: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_test',
      serviceKey: 'sb_secret_test',
    },
    async (url, request) => {
      calls.push({ url, ...request });
      return new Response('{}');
    },
  );
  await store.rpc('gateway_operations', {});
  await store.requestCode('test@example.org');
  await store.user('jwt-user-token');
  assert.equal(calls[0].headers.apikey, 'sb_secret_test');
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[1].headers.apikey, 'sb_publishable_test');
  assert.equal(calls[1].headers.Authorization, undefined);
  assert.equal(calls[2].headers.Authorization, 'Bearer jwt-user-token');
});
test('authentication errors distinguish expired code, expired user session and server key failures', async () => {
  const store = createSupabase(
    { supabaseUrl: 'https://example.supabase.co' },
    async () => new Response('{}', { status: 401 }),
  );
  await assert.rejects(store.verifyCode('test@example.org', '123456'), { code: 'invalid-code' });
  await assert.rejects(store.user('bad-token'), { code: 'session-expired' });
  await assert.rejects(store.rpc('gateway_operations', {}), { code: 'upstream-unavailable' });
});
const liveEnv = {
  GATEWAY_MODE: 'live',
  APP_ORIGIN: 'https://gateway.example.org',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  RATE_LIMIT_SECRET: 'x'.repeat(32),
  RESEND_API_KEY: 'test',
  MAIL_FROM: 'sender@example.org',
  ROUTING_POLICY_APPROVED: 'true',
};
const directory = {
  version: 'test',
  entries: [
    {
      id: 'triage',
      roleId: 'triage',
      name: { he: 'בדיקה', en: 'Test' },
      email: 'test@example.org',
      topicIds: ['*'],
      campusIds: ['*'],
      approved: true,
      approvedBy: 'Test',
      validUntil: '2099-01-01',
    },
  ],
};
test('live startup validates the fallback, every route, policy and numeric limits', async () => {
  await loadConfig(liveEnv, { directory, service });
  await assert.rejects(
    loadConfig(liveEnv, { directory, service: { ...service, approved: false } }),
  );
  await assert.rejects(loadConfig({ ...liveEnv, AI_TIMEOUT_MS: 'NaN' }, { directory, service }));
  await assert.rejects(
    loadConfig(liveEnv, {
      service,
      directory: { ...directory, entries: [{ ...directory.entries[0], topicIds: ['housing'] }] },
    }),
  );
  await assert.rejects(
    loadConfig(liveEnv, {
      service,
      directory: {
        ...directory,
        entries: [...directory.entries, { ...directory.entries[0], id: 'duplicate' }],
      },
    }),
  );
});
test('background shutdown drains an in-flight send and does not claim another job', async () => {
  let release, started;
  const sending = new Promise((resolve) => {
    started = resolve;
  });
  let delivered = 0;
  const store = {
    rpc: async (name) =>
      name === 'gateway_operations'
        ? { schemaVersion: 4, queued: 0, needsAttention: 0, oldestPendingSeconds: 0 }
        : 0,
  };
  const background = startBackground(
    store,
    { service },
    {
      log: () => {},
      deliver: async () => {
        delivered++;
        started();
        await new Promise((resolve) => {
          release = resolve;
        });
        return true;
      },
    },
  );
  await sending;
  let stopped = false;
  const stopping = background.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  assert.equal(stopped, false);
  release();
  await stopping;
  assert.equal(delivered, 1);
  assert.equal(background.state.stopping, true);
});
