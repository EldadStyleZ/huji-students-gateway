export async function deliverOne(store, config, { fetchImpl = fetch } = {}) {
  const job = await store.rpc('gateway_claim_email', {});
  if (!job) return false;
  // Also protect frozen jobs already in the queue when staging configuration changes.
  if (
    config.staging &&
    (!config.stagingInbox ||
      !Array.isArray(job.payload?.to) ||
      job.payload.to.length !== 1 ||
      typeof job.payload.to[0] !== 'string' ||
      job.payload.to[0].toLowerCase() !== config.stagingInbox ||
      job.payload.cc !== undefined ||
      job.payload.bcc !== undefined ||
      (job.payload.reply_to !== undefined &&
        (typeof job.payload.reply_to !== 'string' ||
          job.payload.reply_to.toLowerCase() !== config.stagingInbox)))
  ) {
    await store.rpc('gateway_finish_email', {
      p_id: job.id,
      p_lease: job.lease_id,
      p_provider: null,
      p_error: 'staging-recipient-blocked',
      p_retryable: false,
    });
    return true;
  }
  let provider = null,
    error = null,
    retryable = true;
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.mailKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `gateway/${job.id}`,
      },
      body: JSON.stringify(emailWithReference(job.payload, job.ticket_id)),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && typeof result?.id === 'string') provider = result.id;
    else {
      error = `provider-${response.status}`;
      retryable =
        response.status >= 500 ||
        response.status === 429 ||
        (response.status === 409 && result?.name === 'concurrent_idempotent_requests');
    }
  } catch {
    error = 'provider-network-error';
  }
  // A DB failure here leaves a leased job, recovered with the same provider key.
  await store.rpc('gateway_finish_email', {
    p_id: job.id,
    p_lease: job.lease_id,
    p_provider: provider,
    p_error: error,
    p_retryable: retryable,
  });
  return true;
}
import { emailWithReference } from './email-template.mjs';
