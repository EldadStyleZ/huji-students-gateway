import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverOne } from '../src/mail.mjs';
function setup() {
  const calls = [];
  return {
    calls,
    store: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return name === 'gateway_claim_email'
          ? {
              id: 'job-1',
              lease_id: 'lease-1',
              payload: { to: ['role@example.org'], text: 'message' },
            }
          : true;
      },
    },
  };
}
test('email worker uses a stable provider idempotency key', async () => {
  const { calls, store } = setup();
  await deliverOne(
    store,
    { mailKey: 'test' },
    {
      fetchImpl: async (url, options) => {
        assert.equal(options.headers['Idempotency-Key'], 'gateway/job-1');
        return { ok: true, json: async () => ({ id: 'provider-1' }) };
      },
    },
  );
  assert.equal(calls[1].args.p_provider, 'provider-1');
  assert.equal(calls[1].args.p_lease, 'lease-1');
});
test('temporary email failure is retried and ticket remains durable', async () => {
  const { calls, store } = setup();
  await deliverOne(
    store,
    { mailKey: 'test' },
    { fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) },
  );
  assert.equal(calls[1].args.p_retryable, true);
  assert.equal(calls[1].args.p_provider, null);
});
test('permanent provider rejection requires operator action', async () => {
  const { calls, store } = setup();
  await deliverOne(
    store,
    { mailKey: 'test' },
    { fetchImpl: async () => ({ ok: false, status: 422, json: async () => ({}) }) },
  );
  assert.equal(calls[1].args.p_retryable, false);
});
test('database acknowledgement failure is propagated for lease recovery', async () => {
  await assert.rejects(
    deliverOne(
      {
        rpc: async (name) => {
          if (name === 'gateway_claim_email') return { id: 'a', lease_id: 'b', payload: {} };
          throw new Error('database offline');
        },
      },
      { mailKey: 'test' },
      { fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'provider-1' }) }) },
    ),
    /database offline/,
  );
});
