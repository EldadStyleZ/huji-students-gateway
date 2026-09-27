import { emailValid, fingerprint } from './domain.mjs';

// An explicit environment switch keeps test recipients out of the public repository.
// Use a dedicated Supabase project: staging retention must never run on live records.
export function configureStaging(config, env) {
  const stage = env.GATEWAY_STAGE || 'production';
  if (!['staging', 'production'].includes(stage)) throw new Error('Invalid GATEWAY_STAGE');
  config.staging = stage === 'staging';
  if (!config.staging) {
    if (env.STAGING_INBOX) throw new Error('STAGING_INBOX requires GATEWAY_STAGE=staging');
    return;
  }
  const inbox = env.STAGING_INBOX?.trim().toLowerCase();
  if (!emailValid(inbox) || inbox.endsWith('.invalid'))
    throw new Error('Staging requires a valid STAGING_INBOX');
  config.stagingInbox = inbox;
  config.directory = {
    ...config.directory,
    version: `staging-${fingerprint({ directory: config.directory, inbox }).slice(0, 24)}`,
    entries: config.directory.entries.map((entry) => ({
      ...entry,
      name: { he: `${entry.name.he} (בדיקה)`, en: `${entry.name.en} (test)` },
      email: inbox,
      approved: true,
      approvedBy: 'Staging configuration; test inbox only',
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
    })),
  };
  config.service = {
    approved: true,
    noticeVersion: 'staging-test-v1',
    operator: { he: 'מפעיל סביבת הבדיקות', en: 'Staging test operator' },
    privacyEmail: inbox,
    retentionDays: 7,
    responseExpectation: {
      he: 'סביבת בדיקות בלבד. יש להשתמש בפרטים מומצאים. כל הפניות נשלחות לתיבת הבדיקות, ללא טיפול של האגודה.',
      en: 'Testing only. Use invented details. All requests go to the test inbox; union staff do not handle them.',
    },
  };
}
