import { readFile } from 'node:fs/promises';
import { emailValid, validateDirectory, destinationFor } from './domain.mjs';
import { topics, campuses, registrationOptions } from '../public/routing.js';
export async function loadConfig(env = process.env, supplied = {}) {
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
    serviceKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    rateSecret: env.RATE_LIMIT_SECRET,
    mailKey: env.RESEND_API_KEY,
    mailFrom: env.MAIL_FROM,
    webhookSecret: env.RESEND_WEBHOOK_SECRET,
    backgroundEnabled: env.BACKGROUND_WORKER !== 'false',
    aiBase: env.AI_BASE_URL,
    aiModel: env.AI_MODEL,
    aiProtocol: env.AI_PROTOCOL || 'openai',
    aiKey: env.AI_API_KEY,
    aiNotice: env.AI_PROCESSOR_NOTICE || '',
    aiTimeout: Number(env.AI_TIMEOUT_MS || 8000),
    directory:
      supplied.directory ||
      JSON.parse(await readFile(new URL('../config/directory.json', import.meta.url), 'utf8')),
    service:
      supplied.service ||
      JSON.parse(await readFile(new URL('../config/service.json', import.meta.url), 'utf8')),
  };
  validateDirectory(config.directory);
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
    throw new Error('PORT must be an integer from 1 to 65535');
  if (!Number.isInteger(config.aiTimeout) || config.aiTimeout < 100 || config.aiTimeout > 60000)
    throw new Error('AI_TIMEOUT_MS must be between 100 and 60000');
  const policy = config.service;
  if (
    !Number.isInteger(policy.retentionDays) ||
    policy.retentionDays < 7 ||
    policy.retentionDays > 365
  )
    throw new Error('service.retentionDays must be between 7 and 365');
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(policy.noticeVersion) ||
    !policy.operator?.he ||
    !policy.operator?.en ||
    !policy.responseExpectation?.he ||
    !policy.responseExpectation?.en
  )
    throw new Error('Complete the bilingual service policy');
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
    if (new URL(config.supabaseUrl).origin !== config.supabaseUrl)
      throw new Error('SUPABASE_URL must be an exact origin');
    if (!emailValid(config.mailFrom))
      throw new Error('MAIL_FROM must be a verified plain email address');
    if (
      !policy.approved ||
      !emailValid(policy.privacyEmail) ||
      policy.privacyEmail.endsWith('.invalid')
    )
      throw new Error('Complete and approve config/service.json before live intake');
    if (env.ROUTING_POLICY_APPROVED !== 'true')
      throw new Error('Approve routing policy before enabling live intake');
    if (
      !config.directory.entries.some(
        (e) =>
          e.roleId === 'triage' &&
          e.approved &&
          e.campusIds.includes('*') &&
          e.topicIds.includes('*') &&
          new Date(e.validUntil) > new Date(),
      )
    )
      throw new Error('Live intake needs an approved, current fallback triage destination');
    for (const topic of topics)
      for (const campus of campuses) {
        for (const issue of topic.id === 'course-registration'
          ? registrationOptions.map((x) => x.id)
          : [''])
          destinationFor(
            { topicId: topic.id, campus: campus.id, registrationIssue: issue },
            config.directory,
          );
      }
  }
  if (
    config.webhookSecret &&
    (!/^whsec_[A-Za-z0-9+/]+=*$/.test(config.webhookSecret) ||
      Buffer.from(config.webhookSecret.slice(6), 'base64').length < 16)
  )
    throw new Error('Invalid RESEND_WEBHOOK_SECRET');
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
