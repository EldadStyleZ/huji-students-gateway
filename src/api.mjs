import { createHmac } from 'node:crypto';
import { AppError, emailValid, ticketInput, destinationFor, fingerprint } from './domain.mjs';
import { classify } from './ai.mjs';
import { topics } from '../public/routing.js';
import { rawBody, json as respond } from './http.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function body(req) {
  const raw = await rawBody(req);
  try {
    return JSON.parse(raw.toString());
  } catch {
    throw new AppError(400, 'invalid-json');
  }
}
function cookieToken(req) {
  const raw = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('__Host-gateway='));
  return raw?.slice('__Host-gateway='.length);
}
export function createApi(config, store, { classifyImpl = classify } = {}) {
  const localLimits = new Map();
  async function limit(key, max, seconds) {
    if (config.live) {
      const bucket = createHmac('sha256', config.rateSecret).update(key).digest('hex');
      if (
        !(await store.rpc('gateway_rate_limit', {
          p_bucket: bucket,
          p_limit: max,
          p_seconds: seconds,
        }))
      )
        throw new AppError(429, 'too-many-requests');
    } else {
      const now = Date.now();
      if (localLimits.size > 1000)
        for (const [k, v] of localLimits) if (v.until < now) localLimits.delete(k);
      const v = localLimits.get(key);
      if (v && v.until > now) {
        if (++v.hits > max) throw new AppError(429, 'too-many-requests');
      } else localLimits.set(key, { hits: 1, until: now + seconds * 1000 });
    }
  }
  async function user(req) {
    const token = cookieToken(req);
    if (!token) throw new AppError(401, 'sign-in-required');
    const u = await store.user(token);
    if (!u?.id || !u.email_confirmed_at || !emailValid(u.email))
      throw new AppError(401, 'sign-in-required');
    return u;
  }
  return async (req, res, path) => {
    try {
      if (req.method === 'GET' && path === '/api/config') {
        respond(res, 200, {
          live: config.live,
          aiEnabled: Boolean(config.aiBase),
          aiNotice: config.aiNotice,
          noticeVersion: config.service?.noticeVersion,
          responseExpectation: config.service?.responseExpectation,
        });
        return;
      }
      if (!['GET', 'POST'].includes(req.method)) throw new AppError(405, 'method-not-allowed');
      if (req.method === 'POST') {
        if (req.headers.origin !== config.origin) throw new AppError(403, 'invalid-origin');
        if (req.headers['content-type']?.split(';')[0] !== 'application/json')
          throw new AppError(415, 'json-required');
      }
      // Generic traffic is bounded by the HTTP server; sensitive operations below
      // use database-backed limits. Forwarded IP headers never grant authority.
      if (path === '/api/suggest' && req.method === 'POST') {
        const b = await body(req);
        if (typeof b?.text !== 'string' || !b.text.trim() || b.text.length > 3000)
          throw new AppError(422, 'invalid-text');
        if (config.aiBase && b.allowModel !== true)
          throw new AppError(422, 'model-consent-required');
        await limit('model-global', 30, 60);
        respond(res, 200, await classifyImpl(b.text, config));
        return;
      }
      if (!config.live) throw new AppError(503, 'live-intake-not-configured');
      if (path === '/api/auth/session' && req.method === 'GET') {
        const u = await user(req);
        respond(res, 200, { email: u.email });
        return;
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        res.setHeader(
          'Set-Cookie',
          '__Host-gateway=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
        );
        respond(res, 200, { ok: true });
        return;
      }
      if (path === '/api/auth/request-code' && req.method === 'POST') {
        const b = await body(req);
        if (!emailValid(b?.email?.trim())) throw new AppError(422, 'invalid-email');
        const email = b.email.trim().toLowerCase();
        await limit(`otp:${email}`, 1, 60);
        await limit('otp-global', 30, 60);
        await store.requestCode(email);
        respond(res, 200, { ok: true });
        return;
      }
      if (path === '/api/auth/verify-code' && req.method === 'POST') {
        const b = await body(req);
        if (!emailValid(b?.email) || typeof b.token !== 'string' || !/^\d{6,10}$/.test(b.token))
          throw new AppError(422, 'invalid-code');
        await limit(`verify:${b.email.toLowerCase()}`, 8, 300);
        const session = await store.verifyCode(b.email, b.token);
        if (!session?.access_token || !session.user?.email_confirmed_at)
          throw new AppError(401, 'invalid-code');
        res.setHeader(
          'Set-Cookie',
          `__Host-gateway=${session.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.min(session.expires_in || 3600, 3600)}`,
        );
        respond(res, 200, { email: session.user.email });
        return;
      }
      if (path === '/api/route' && req.method === 'POST') {
        const b = await body(req);
        respond(res, 200, { destination: destinationFor(b, config.directory) });
        return;
      }
      if (path === '/api/tickets' && req.method === 'POST') {
        const u = await user(req);
        await limit(`submit:${u.id}`, 10, 3600);
        const input = ticketInput(await body(req));
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !uuid.test(key))
          throw new AppError(400, 'idempotency-key-required');
        const hash = fingerprint({ ...input, replyEmail: u.email });
        const replay = await store.rpc('gateway_replay_ticket', {
          p_owner: u.id,
          p_key: key,
          p_hash: hash,
        });
        if (replay) {
          respond(res, 200, replay);
          return;
        }
        if (config.service && input.noticeVersion !== config.service.noticeVersion)
          throw new AppError(409, 'notice-changed');
        const destination = destinationFor(input, config.directory);
        if (
          input.destinationId !== destination.id ||
          input.directoryVersion !== destination.directoryVersion
        )
          throw new AppError(409, 'recipient-changed');
        const data = { ...input, replyEmail: u.email, destination };
        const title = topics.find((t) => t.id === input.topicId).name[input.lang];
        const mail = {
          from: config.mailFrom,
          to: [destination.email],
          reply_to: u.email,
          subject: `[Student gateway] ${title}`,
          text: [
            `Student support request / פניית סטודנט`,
            `Topic: ${title}`,
            `Campus: ${input.campus}`,
            `Registration context: ${input.registrationIssue || 'Not applicable'}`,
            `Name: ${input.name || 'Not provided'}`,
            `Reply to: ${u.email}`,
            '',
            input.description,
          ].join('\n'),
        };
        // Hash user input only; retrying after a directory edit must return the
        // original ticket and its frozen recipient, not send a second email.
        const saved = await store.rpc('gateway_create_ticket', {
          p_owner: u.id,
          p_key: key,
          p_hash: hash,
          p_data: data,
          p_mail: mail,
        });
        respond(res, 201, saved);
        return;
      }
      if (path.startsWith('/api/tickets/') && req.method === 'GET') {
        const u = await user(req);
        const id = path.slice('/api/tickets/'.length);
        if (!uuid.test(id)) throw new AppError(404, 'not-found');
        const ticket = await store.rpc('gateway_get_ticket', { p_id: id, p_owner: u.id });
        if (!ticket) throw new AppError(404, 'not-found');
        respond(res, 200, ticket);
        return;
      }
      throw new AppError(404, 'not-found');
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500;
      if (status === 429) res.setHeader('Retry-After', '60');
      respond(res, status, { error: error instanceof AppError ? error.code : 'request-failed' });
    }
  };
}
