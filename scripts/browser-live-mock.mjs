const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const destination = {
  id: 'test-academic',
  roleId: 'academic',
  name: { he: 'צוות אקדמיה לבדיקה', en: 'Test academic team' },
  email: 'test-role@example.org',
  directoryVersion: 'test-v1',
};
const receipts = [];
let attempts = 0;
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  let status = 200,
    value;
  if (path === '/api/config') value = { live: true, aiEnabled: false, aiNotice: '' };
  else if (path === '/api/route') value = { destination };
  else if (path === '/api/auth/request-code') value = { ok: true };
  else if (path === '/api/auth/verify-code') value = { email: 'test@example.org' };
  else if (path === '/api/tickets') {
    attempts++;
    receipts.push({
      key: route.request().headers()['idempotency-key'],
      data: route.request().postDataJSON(),
    });
    if (attempts === 1) {
      status = 503;
      value = { error: 'upstream-unavailable' };
    } else
      value = {
        id: '00000000-0000-4000-8000-000000000001',
        status: 'received',
        emailStatus: 'queued',
      };
  } else if (path.startsWith('/api/tickets/'))
    value = {
      id: '00000000-0000-4000-8000-000000000001',
      status: 'received',
      emailStatus: 'provider_accepted',
    };
  else throw new Error('Unexpected API request: ' + path);
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
});
await page.goto('http://127.0.0.1:4173/?topic=course-registration&lang=en');
await page.getByLabel('Edmond J. Safra (Givat Ram)', { exact: true }).check();
await page.getByLabel('A specific course or academic approval issue', { exact: true }).check();
await page.getByRole('button', { name: 'Find my contact', exact: true }).click();
await page.getByRole('heading', { name: 'Test academic team' }).waitFor();
await page.getByRole('button', { name: 'Prepare a union request' }).click();
await page.getByLabel('Your issue (required)', { exact: true }).fill('Synthetic live UI test');
await page.getByLabel('Reply email (required)', { exact: true }).fill('test@example.org');
await page.getByRole('checkbox').check();
await page.getByRole('button', { name: 'Review request' }).click();
assert.equal(
  await page.getByRole('button', { name: 'Send request to the union' }).isEnabled(),
  false,
);
await page.getByRole('button', { name: 'Send verification code' }).click();
await page.getByLabel('Code from your email').fill('123456');
await page.getByRole('button', { name: 'Verify code' }).click();
await page.getByRole('button', { name: 'Send request to the union' }).click();
await page.getByRole('alert').waitFor();
await page.getByRole('button', { name: 'Send request to the union' }).click();
await page.getByRole('heading', { name: 'Your request was received.' }).waitFor();
assert.equal(receipts.length, 2);
assert.equal(receipts[0].key, receipts[1].key);
assert.equal(receipts[0].data.destinationId, destination.id);
assert.ok(!Object.hasOwn(receipts[0].data, 'email'));
await page.getByRole('button', { name: 'Refresh status' }).click();
await page
  .getByText(
    'The email provider accepted the message. This does not confirm the recipient read it.',
    { exact: true },
  )
  .waitFor();
await page.screenshot({
  path: new URL('../artifacts/live-ui-mocked.png', import.meta.url).pathname,
  fullPage: true,
});
assert.deepEqual(errors, []);
await browser.close();
console.log(
  'Mocked live UI passed: approved recipient, OTP, transient failure, stable idempotency key, receipt and accurate provider status. No external requests sent.',
);
