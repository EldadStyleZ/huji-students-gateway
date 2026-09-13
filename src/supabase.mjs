import { AppError } from './domain.mjs';
export function createSupabase(config, fetchImpl = fetch) {
  async function request(path, body, { admin = false, token, method = 'POST' } = {}) {
    const key = admin ? config.serviceKey : config.publishableKey;
    const response = await fetchImpl(`${config.supabaseUrl}${path}`, {
      method,
      headers: {
        apikey: key,
        // New sb_* API keys belong only in apikey; only JWTs are bearer tokens.
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : key?.startsWith('eyJ')
            ? { Authorization: `Bearer ${key}` }
            : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      if (value?.message?.includes('idempotency-conflict'))
        throw new AppError(409, 'idempotency-conflict');
      if (response.status === 429) throw new AppError(429, 'too-many-requests');
      if (path === '/auth/v1/verify' && [400, 401, 403, 422].includes(response.status))
        throw new AppError(401, 'invalid-code');
      if (token && [401, 403].includes(response.status)) throw new AppError(401, 'session-expired');
      throw new AppError(503, 'upstream-unavailable');
    }
    return value;
  }
  return {
    rpc: (name, body) => request(`/rest/v1/rpc/${name}`, body, { admin: true }),
    requestCode: (email) => request('/auth/v1/otp', { email, create_user: true }),
    verifyCode: (email, token) => request('/auth/v1/verify', { email, token, type: 'email' }),
    user: (token) => request('/auth/v1/user', undefined, { method: 'GET', token }),
  };
}
