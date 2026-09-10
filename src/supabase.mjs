import { AppError } from './domain.mjs';
export function createSupabase(config, fetchImpl = fetch) {
  async function request(path, body, { admin = false, token, method = 'POST' } = {}) {
    const key = admin ? config.serviceKey : config.publishableKey;
    const response = await fetchImpl(`${config.supabaseUrl}${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token || (admin ? config.serviceKey : config.publishableKey)}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      if (value?.message?.includes('idempotency-conflict'))
        throw new AppError(409, 'idempotency-conflict');
      throw new AppError(
        response.status === 401 ? 401 : 503,
        response.status === 401 ? 'session-expired' : 'upstream-unavailable',
      );
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
