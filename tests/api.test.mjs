import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApi } from '../src/api.mjs';
const owner = '00000000-0000-4000-8000-000000000001';
const key = '00000000-0000-4000-8000-000000000002';
const entry = {
  id: 'triage',
  roleId: 'triage',
  name: { he: 'הכוונה', en: 'Triage' },
  email: 'role@example.org',
  topicIds: ['*'],
  campusIds: ['*'],
  approved: true,
  approvedBy: 'Test',
  validUntil: '2099-01-01',
};
const config = {
  live: true,
  origin: 'https://gateway.example.org',
  rateSecret: 'a'.repeat(32),
  mailFrom: 'support@example.org',
  directory: { version: '1', entries: [entry] },
};
const input = {
  topicId: 'housing',
  campus: 'givat-ram',
  description: 'Synthetic request',
  consent: true,
  lang: 'en',
  destinationId: 'triage',
  directoryVersion: '1',
};
function store() {
  const calls = [];
  return {
    calls,
    user: async () => ({
      id: owner,
      email: 'verified@example.org',
      email_confirmed_at: '2026-01-01',
    }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'gateway_rate_limit') return true;
      if (name === 'gateway_replay_ticket') return null;
      if (name === 'gateway_create_ticket')
        return { id: key, status: 'received', emailStatus: 'queued' };
      return null;
    },
  };
}
async function request(
  api,
  { path = '/api/tickets', method = 'POST', data = input, headers = {} } = {},
) {
  const req = Readable.from([Buffer.from(JSON.stringify(data))]);
  req.method = method;
  req.headers = {
    origin: config.origin,
    'content-type': 'application/json',
    'idempotency-key': key,
    cookie: '__Host-gateway=test-token',
    ...headers,
  };
  req.socket = { remoteAddress: '127.0.0.1' };
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    writeHead(status) {
      this.status = status;
    },
    end(value) {
      this.value = JSON.parse(value);
    },
  };
  await api(req, res, path);
  return res;
}
test('API creates a durable request using verified email and server-selected recipient', async () => {
  const s = store();
  const res = await request(createApi(config, s));
  assert.equal(res.status, 201);
  const call = s.calls.find((c) => c.name === 'gateway_create_ticket');
  assert.equal(call.args.p_data.replyEmail, 'verified@example.org');
  assert.deepEqual(call.args.p_mail.to, ['role@example.org']);
  assert.equal(call.args.p_owner, owner);
});
test('API rejects cross-origin submissions', async () =>
  assert.equal(
    (await request(createApi(config, store()), { headers: { origin: 'https://evil.example' } }))
      .status,
    403,
  ));
test('API requires verified authentication', async () =>
  assert.equal(
    (await request(createApi(config, store()), { headers: { cookie: '' } })).status,
    401,
  ));
test('API rejects client-selected mail recipients', async () =>
  assert.equal(
    (await request(createApi(config, store()), { data: { ...input, to: 'evil@example.org' } }))
      .status,
    400,
  ));
test('API refuses a changed recipient until the student reviews it', async () => {
  const s = store();
  assert.equal(
    (await request(createApi(config, s), { data: { ...input, directoryVersion: 'old' } })).status,
    409,
  );
  assert.ok(!s.calls.some((c) => c.name === 'gateway_create_ticket'));
});
test('API replays saved request before checking changed directory', async () => {
  const s = store();
  const original = s.rpc;
  s.rpc = (name, args) =>
    name === 'gateway_replay_ticket'
      ? { id: key, status: 'received', emailStatus: 'queued' }
      : original(name, args);
  const res = await request(
    createApi({ ...config, directory: { version: 'new', entries: [] } }, s),
  );
  assert.equal(res.status, 200);
  assert.equal(res.value.id, key);
});
test('API passes authenticated ownership to status lookup', async () => {
  const s = store();
  const res = await request(createApi(config, s), { path: '/api/tickets/' + key, method: 'GET' });
  assert.equal(res.status, 404);
  assert.equal(s.calls.find((c) => c.name === 'gateway_get_ticket').args.p_owner, owner);
});
test('demo mode cannot create or email a real ticket', async () =>
  assert.equal((await request(createApi({ ...config, live: false }, null))).status, 503));
test('model call requires explicit permission to process text', async () => {
  const res = await request(createApi({ ...config, aiBase: 'https://model.example/v1' }, store()), {
    path: '/api/suggest',
    data: { text: 'Help with housing' },
  });
  assert.equal(res.status, 422);
});
test('request size is bounded before parsing', async () =>
  assert.equal(
    (
      await request(createApi(config, store()), {
        data: { ...input, description: 'x'.repeat(20000) },
      })
    ).status,
    413,
  ));
test('missing idempotency key is rejected', async () =>
  assert.equal(
    (await request(createApi(config, store()), { headers: { 'idempotency-key': '' } })).status,
    400,
  ));
