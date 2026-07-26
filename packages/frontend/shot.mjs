import { chromium } from '@playwright/test';

// Ad-hoc visual QA harness: drives the standalone dev server on :8080 and
// writes one PNG per (route x theme x viewport) into .shots/.
const BASE = 'http://localhost:8080';
const routes = process.argv.slice(2);

const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
};

const browser = await chromium.launch();

for (const [vpName, viewport] of Object.entries(viewports)) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript((t) => {
      localStorage.setItem('tinyauth-color-scheme', t);
    }, theme);
    const page = await ctx.newPage();

    for (const route of routes) {
      const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `.shots/${slug}__${vpName}__${theme}.png`,
        fullPage: vpName === 'mobile',
      });
      console.log(`${slug} ${vpName} ${theme}`);
    }
    await ctx.close();
  }
}

await browser.close();
