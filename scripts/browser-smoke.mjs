const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Local QA helper. Uses only synthetic input; never creates a live request.
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto('http://127.0.0.1:4173');
await page.getByRole('heading', { name: 'יש שאלה. יש למי לפנות.' }).waitFor();
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await page.screenshot({
  path: new URL('../artifacts/home-hebrew.png', import.meta.url).pathname,
  fullPage: true,
});
await page.getByRole('button', { name: 'לא מצליחים להירשם לקורס?' }).click();
await page.getByLabel('אדמונד י׳ ספרא (גבעת רם)', { exact: true }).check();
await page.getByLabel('מופיעה חסימה בגלל תשלום', { exact: true }).check();
await page.getByRole('button', { name: 'לכתובת המתאימה', exact: true }).click();
await page.getByRole('heading', { name: 'מדור שכר לימוד', exact: true }).waitFor();
await page.screenshot({
  path: new URL('../artifacts/routing-hebrew.png', import.meta.url).pathname,
  fullPage: true,
});
await page.getByRole('button', { name: 'הכנת פנייה לאגודה', exact: true }).click();
await page
  .getByLabel('תיאור הפנייה (חובה)', { exact: true })
  .fill('Synthetic QA: I cannot register for a course.');
await page.getByLabel('דוא״ל למענה (חובה)', { exact: true }).fill('test@example.org');
await page.getByRole('checkbox').check();
await page.getByRole('button', { name: 'בדיקת הפנייה', exact: true }).click();
await page.getByRole('heading', { name: 'רגע לפני הסיום' }).waitFor();
await page.getByRole('button', { name: 'עריכת הפרטים' }).click();
assert.equal(
  await page.getByLabel('תיאור הפנייה (חובה)', { exact: true }).inputValue(),
  'Synthetic QA: I cannot register for a course.',
);
await page.getByRole('button', { name: 'בדיקת הפנייה', exact: true }).click();
await page.getByRole('button', { name: 'סיום והצגת הטיוטה' }).click();
await page.getByRole('heading', { name: 'הטיוטה מוכנה.' }).waitFor();
const download = page.waitForEvent('download');
await page.getByRole('button', { name: 'הורדת טיוטת הפנייה' }).click();
assert.equal((await download).suggestedFilename(), 'student-request-draft.txt');
await page.getByRole('button', { name: 'בחזרה להתחלה' }).click();
await page.getByRole('button', { name: 'במילים שלי', exact: true }).click();
await page.getByLabel('במה אפשר לעזור?', { exact: true }).fill('חזרתי ממילואים ויש לי בעיה בבחינה');
await page.getByRole('button', { name: 'מציאת כיוון' }).click();
await page.getByRole('button', { name: 'סיוע בעקבות שירות מילואים', exact: false }).waitFor();
await page.getByRole('button', { name: 'English', exact: true }).click();
assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
await page.getByRole('heading', { name: 'A question. A clear way forward.' }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: 'Choose a topic', exact: true }).click();
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  'No horizontal overflow on mobile',
);
await page.screenshot({
  path: new URL('../artifacts/home-mobile-english.png', import.meta.url).pathname,
  fullPage: true,
});
await page.goto('http://127.0.0.1:4173/?topic=course-registration&lang=he');
await page.getByRole('heading', { name: 'קושי ברישום לקורס' }).waitFor();
assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
assert.deepEqual(errors, []);
console.log(
  'Browser smoke passed: Hebrew routing, preserved draft, review, download, natural-language suggestions, English, mobile overflow and topic link.',
);
await browser.close();
