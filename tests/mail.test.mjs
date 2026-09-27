import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverOne } from '../src/mail.mjs';
import { ticketEmail } from '../src/email-template.mjs';
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
test('staging blocks queued messages to real roles, extra recipients and old test accounts', async () => {
  for (const payload of [
    { to: ['role@example.org'] },
    { to: ['tester@example.org', 'role@example.org'] },
    { to: ['tester@example.org'], cc: ['role@example.org'] },
    { to: ['tester@example.org'], bcc: ['role@example.org'] },
    { to: ['tester@example.org'], reply_to: 'old-test@example.org' },
    { to: [42] },
  ]) {
    let acknowledgement;
    await deliverOne(
      {
        rpc: async (name, args) => {
          if (name === 'gateway_claim_email') return { id: 'job-1', lease_id: 'lease-1', payload };
          acknowledgement = args;
        },
      },
      { staging: true, stagingInbox: 'tester@example.org' },
      { fetchImpl: async () => assert.fail('Unsafe staging mail must not leave the process') },
    );
    assert.equal(acknowledgement.p_error, 'staging-recipient-blocked');
    assert.equal(acknowledgement.p_retryable, false);
  }
});
test('staging can deliver an allowed message with the same idempotency protection', async () => {
  const { calls, store } = setup();
  await deliverOne(
    store,
    { mailKey: 'test', staging: true, stagingInbox: 'role@example.org' },
    {
      fetchImpl: async (url, options) => {
        assert.deepEqual(JSON.parse(options.body).to, ['role@example.org']);
        assert.equal(options.headers['Idempotency-Key'], 'gateway/job-1');
        return { ok: true, json: async () => ({ id: 'test-delivery' }) };
      },
    },
  );
  assert.equal(calls[1].args.p_provider, 'test-delivery');
});
test('HTML email includes the database reference and retries preserve the exact provider payload', async () => {
  const ticketId = '00000000-0000-4000-8000-000000000003';
  const payload = {
    to: ['tester@example.org'],
    ...ticketEmail(
      { lang: 'he', topicId: 'housing', campus: 'givat-ram', description: 'בדיקת תצוגה בלבד' },
      'tester@example.org',
      {},
    ),
  };
  // The existing database trigger adds the reference to subject/text before claim.
  payload.subject += ` [${ticketId}]`;
  payload.text += `\n\nRequest reference: ${ticketId}`;
  const bodies = [];
  const store = {
    rpc: async (name) =>
      name === 'gateway_claim_email'
        ? { id: 'job-1', lease_id: 'lease-1', ticket_id: ticketId, payload }
        : true,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await deliverOne(
      store,
      { mailKey: 'test' },
      {
        fetchImpl: async (url, options) => {
          bodies.push(options.body);
          return { ok: false, status: 503, json: async () => ({}) };
        },
      },
    );
  }
  assert.equal(bodies[0], bodies[1]);
  const sent = JSON.parse(bodies[0]);
  assert.ok(sent.html.includes(ticketId));
  assert.ok(!sent.html.includes('<!--gateway-ticket-reference-->'));
  assert.equal(sent.text, payload.text);
  assert.ok(
    payload.html.includes('<!--gateway-ticket-reference-->'),
    'Do not mutate the frozen outbox payload',
  );
});
