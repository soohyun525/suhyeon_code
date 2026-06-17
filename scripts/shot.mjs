import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/01-landing.png', fullPage: true });

// Example: 1995-05-25, 10:10, female, solar, Korea (UTC+9)
await page.fill('input[placeholder="e.g. Alex"]', 'Jiwoo');
await page.selectOption('select >> nth=0', 'female'); // gender
await page.fill('input[aria-label="Year"]', '1995');
await page.selectOption('select[aria-label="Month"]', '5');
await page.selectOption('select[aria-label="Day"]', '25');
await page.selectOption('select >> nth=3', '10'); // hour 10 (selects: 0=gender,1=month,2=day,3=hour,4=tz)
await page.fill('input[type="number"] >> nth=1', '10'); // minute 10 (number inputs: 0=Year, 1=Minute)
await page.selectOption('select >> nth=4', '9'); // timezone Korea +9

await page.click('button[type="submit"]');
await page.waitForSelector('.pillars', { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/02-results.png', fullPage: true });

// Unlock the detailed (demo) report and capture it too.
const unlockBtn = page.locator('button.secondary');
if (await unlockBtn.count()) {
  await unlockBtn.click();
  await page.waitForSelector('text=Detailed Destiny Report', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/03-detailed.png', fullPage: true });
}

await browser.close();
console.log('done');
