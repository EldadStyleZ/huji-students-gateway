const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const page = await browser.newPage({ viewport: { width: 1250, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.AI_PREVIEW_URL || 'http://127.0.0.1:4174');
await page.getByRole('button', { name: 'במילים שלי', exact: true }).click();
await page.getByLabel('במה אפשר לעזור?', { exact: true }).fill('בחדר שלי במעונות אין מים חמים');
await page.getByRole('button', { name: 'מציאת כיוון', exact: true }).click();
await page.getByRole('button', { name: 'מעונות ודיור', exact: false }).waitFor();
assert.ok((await page.getByText('הצעת מודל — יש לאשר את הנושא', { exact: true }).count()) > 0);
await page.screenshot({
  path: new URL('../artifacts/gemma-hebrew-suggestion.png', import.meta.url).pathname,
  fullPage: true,
});
assert.deepEqual(errors, []);
await browser.close();
console.log('Real local Gemma UI smoke passed using a synthetic Hebrew housing request.');
