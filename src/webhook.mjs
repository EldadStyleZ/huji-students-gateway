import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from './domain.mjs';
// Published Svix HMAC specification; tested against its independent reference vector.
// https://docs.svix.com/receiving/verifying-payloads/how-manual
export function verifyWebhook(raw, headers, secret, now = Date.now()) {
  const id = headers['svix-id'],
    timestamp = headers['svix-timestamp'],
    signatures = headers['svix-signature'];
  if (
    typeof id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(id) ||
    typeof timestamp !== 'string' ||
    !/^\d{1,12}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    typeof signatures !== 'string' ||
    signatures.length > 2048 ||
    !secret
  )
    throw new AppError(401, 'invalid-webhook');
  const expected = createHmac('sha256', Buffer.from(secret.slice(6), 'base64'))
    .update(`${id}.${timestamp}.`)
    .update(raw)
    .digest();
  const valid = signatures.split(' ').some((part) => {
    const [version, encoded] = part.split(',');
    if (version !== 'v1' || !encoded) return false;
    const supplied = Buffer.from(encoded, 'base64');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
  if (!valid) throw new AppError(401, 'invalid-webhook');
  return id;
}
export function deliveryEvent(raw, id) {
  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new AppError(400, 'invalid-json');
  }
  const statuses = {
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.failed': 'failed',
    'email.suppressed': 'failed',
    'email.delivery_delayed': 'delayed',
  };
  if (!Object.hasOwn(statuses, event?.type)) return null;
  if (
    typeof event.data?.email_id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(event.data.email_id) ||
    !Number.isFinite(Date.parse(event.created_at))
  )
    throw new AppError(422, 'invalid-webhook-event');
  // Do not retain the provider's raw payload, recipient addresses or message content.
  return {
    p_event_id: id,
    p_provider_id: event.data.email_id,
    p_status: statuses[event.type],
    p_occurred_at: new Date(event.created_at).toISOString(),
  };
}
