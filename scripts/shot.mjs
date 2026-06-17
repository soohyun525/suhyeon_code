import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/01-landing.png', fullPage: true });

// Fill the birth form.
await page.fill('input[placeholder="e.g. Alex"]', 'Alex');
await page.fill('input[aria-label="Year"]', '1990');
await page.selectOption('select[aria-label="Month"]', '6');
await page.selectOption('select[aria-label="Day"]', '15');
// timezone → US Eastern (-5)
await page.selectOption('select >> nth=4', '-5');

await page.click('button[type="submit"]');
// Wait for the results card to render.
await page.waitForSelector('.pillars', { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/02-results.png', fullPage: true });

await browser.close();
console.log('done');
