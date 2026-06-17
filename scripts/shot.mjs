import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
page.setDefaultTimeout(180000);

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/01-landing.png', fullPage: true });

// Example: 1995-05-25, 10:10, female, solar, Korea (UTC+9)
await page.fill('input[placeholder="e.g. Alex"]', 'Jiwoo');
await page.selectOption('select >> nth=0', 'female');
await page.fill('input[aria-label="Year"]', '1995');
await page.selectOption('select[aria-label="Month"]', '5');
await page.selectOption('select[aria-label="Day"]', '25');
await page.selectOption('select >> nth=3', '10');
await page.fill('input[type="number"] >> nth=1', '10');
await page.selectOption('select >> nth=4', '9');

await page.click('button[type="submit"]');
await page.waitForSelector('.daeun', { timeout: 180000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/02-results.png', fullPage: true });

// Clipped chart card for clarity.
await page.locator('.card').nth(1).screenshot({ path: '/tmp/chart.png' });
// Clipped free reading card.
await page.locator('.card.reading').first().screenshot({ path: '/tmp/free-reading.png' });

// Unlock the detailed (demo) report and capture it too.
const unlockBtn = page.locator('button.secondary');
if (await unlockBtn.count()) {
  await unlockBtn.click();
  await page.waitForSelector('text=Detailed Destiny Report', { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/03-detailed.png', fullPage: true });
  // Clip just the detailed card.
  const cards = page.locator('.card.reading');
  await cards.nth((await cards.count()) - 1).screenshot({ path: '/tmp/detailed-card.png' });
}

await browser.close();
console.log('done');
