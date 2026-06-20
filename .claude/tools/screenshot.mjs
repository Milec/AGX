// Headless screenshot helper for AGX web sessions.
//
// Usage:
//   node .claude/tools/screenshot.mjs [input] [output] [width] [height] [fullPage]
//
//   input    html file path or http(s) URL   (default: public/index.html)
//   output   png path                          (default: /tmp/agx-screenshot.png)
//   width    viewport width in px              (default: 430  — phone-sized)
//   height   viewport height in px             (default: 900)
//   fullPage "true" | "false"                  (default: true)
//
// Set AGX_MOCK=1 to stub the Supabase backend so the SPA boots offline
// (useful for design review when the container network policy blocks the
// real backend). It returns empty results for reads and 200 for writes,
// which lands the app on the login screen.
//
// The AGX UI is mobile-first, so the default viewport mimics a phone.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const input = process.argv[2] || 'public/index.html';
const output = process.argv[3] || '/tmp/agx-screenshot.png';
const width = parseInt(process.argv[4] || '430', 10);
const height = parseInt(process.argv[5] || '900', 10);
const fullPage = (process.argv[6] || 'true') !== 'false';
const mock = process.env.AGX_MOCK === '1';

const url = /^https?:\/\//.test(input)
  ? input
  : pathToFileURL(path.resolve(input)).href;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });

  if (mock) {
    // Intercept the Supabase REST calls and answer them locally.
    await page.route('**/rest/v1/**', (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }

  // Use 'load' (not 'networkidle'): the SPA polls a backend on a timer, so
  // the network never truly goes idle. Settle layout/fonts with a short wait.
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: output, fullPage });
  console.log('Saved screenshot ->', output);
} finally {
  await browser.close();
}
