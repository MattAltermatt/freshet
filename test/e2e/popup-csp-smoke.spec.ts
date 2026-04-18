import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

test('popup boots under MV3 CSP', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;

  const page = await ctx.newPage();
  const cspViolations: string[] = [];
  page.on('console', (msg) => {
    const t = msg.text().toLowerCase();
    if (t.includes('content security policy') || t.includes('unsafe-eval')) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  await expect(page.locator('.pj-popup')).toBeVisible({ timeout: 5000 });

  expect(cspViolations, `CSP violations: ${cspViolations.join('\n')}`).toEqual([]);
  await ctx.close();
});
