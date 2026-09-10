import { readFile } from 'node:fs/promises';
export async function loadConfig(env = process.env) {
  const live = env.GATEWAY_MODE === 'live';
  if (env.NODE_ENV === 'production' && !live)
    throw new Error('Production requires explicit GATEWAY_MODE=live');
  const config = {
    live,
    origin: env.APP_ORIGIN || 'http://127.0.0.1:4173',
    port: Number(env.PORT || 4173),
    host: env.HOST || '127.0.0.1',
    supabaseUrl: env.SUPABASE_URL,
    publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    rateSecret: env.RATE_LIMIT_SECRET,
    mailKey: env.RESEND_API_KEY,
    mailFrom: env.MAIL_FROM,
    aiBase: env.AI_BASE_URL,
    aiModel: env.AI_MODEL,
    aiProtocol: env.AI_PROTOCOL || 'openai',
    aiKey: env.AI_API_KEY,
    aiNotice: env.AI_PROCESSOR_NOTICE || '',
    aiTimeout: Number(env.AI_TIMEOUT_MS || 8000),
    directory: JSON.parse(
      await readFile(new URL('../config/directory.json', import.meta.url), 'utf8'),
    ),
  };
  if (new URL(config.origin).origin !== config.origin)
    throw new Error('APP_ORIGIN must be an exact origin without path or trailing slash');
  if (!['openai', 'ollama'].includes(config.aiProtocol))
    throw new Error('AI_PROTOCOL must be openai or ollama');
  if (live) {
    for (const key of [
      'supabaseUrl',
      'publishableKey',
      'serviceKey',
      'rateSecret',
      'mailKey',
      'mailFrom',
    ])
      if (!config[key]) throw new Error(`Missing configuration: ${key}`);
    if (config.rateSecret.length < 32)
      throw new Error('RATE_LIMIT_SECRET must contain at least 32 characters');
    if (new URL(config.origin).protocol !== 'https:')
      throw new Error('Live APP_ORIGIN must use HTTPS');
    if (new URL(config.supabaseUrl).protocol !== 'https:')
      throw new Error('Supabase URL must use HTTPS');
    if (env.ROUTING_POLICY_APPROVED !== 'true')
      throw new Error('Approve routing policy before enabling live intake');
    if (
      !config.directory.entries.some(
        (e) =>
          e.roleId === 'triage' &&
          e.approved &&
          e.campusIds.includes('*') &&
          new Date(e.validUntil) > new Date(),
      )
    )
      throw new Error('Live intake needs an approved, current fallback triage destination');
  }
  if (config.aiBase) {
    const url = new URL(config.aiBase);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid AI_BASE_URL');
    if (live && url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
      throw new Error('Remote AI endpoints must use HTTPS');
    if (!config.aiModel || !config.aiNotice)
      throw new Error('AI_MODEL and AI_PROCESSOR_NOTICE are required when AI is enabled');
  }
  return config;
}
