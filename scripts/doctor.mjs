import { readFile } from 'node:fs/promises';
import { loadConfig } from '../src/config.mjs';
const env = process.env;
const issues = [];
for (const key of [
  'APP_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'RATE_LIMIT_SECRET',
  'RESEND_API_KEY',
  'MAIL_FROM',
])
  if (!env[key])
    issues.push(`Set ${key} in Railway Variables (or your ignored .env for local checks).`);
if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_ROLE_KEY)
  issues.push('Set SUPABASE_SECRET_KEY on the server.');
const directory = JSON.parse(await readFile(new URL('../config/directory.json', import.meta.url)));
const service = JSON.parse(await readFile(new URL('../config/service.json', import.meta.url)));
if (
  !directory.entries.some(
    (e) =>
      e.approved && e.roleId === 'triage' && e.topicIds.includes('*') && e.campusIds.includes('*'),
  )
)
  issues.push('Review config/directory.json and approve the monitored fallback mailbox.');
if (!service.approved || !service.privacyEmail)
  issues.push('Set the privacy contact, review retention/notice and approve config/service.json.');
if (env.ROUTING_POLICY_APPROVED !== 'true')
  issues.push('After reviewing the provisional mapping, set ROUTING_POLICY_APPROVED=true.');
if (!env.RESEND_WEBHOOK_SECRET)
  console.log(
    'NOTE: Add RESEND_WEBHOOK_SECRET after creating the Resend webhook to track delivery.',
  );
if (issues.length) {
  console.log('Setup tasks (no secret values are printed):');
  issues.forEach((x, i) => console.log(`${i + 1}. ${x}`));
  process.exitCode = 1;
} else {
  try {
    await loadConfig({ ...env, GATEWAY_MODE: 'live' });
    console.log(
      'Local configuration checks passed. Next: follow the staging checks in docs/setup.md. No email was sent.',
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
