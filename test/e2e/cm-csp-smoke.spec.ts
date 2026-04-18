import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

test('CodeMirror 6 boots under MV3 CSP on the options page', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  try {
    const pageErrors: string[] = [];
    ctx.on('page', (p) => {
      p.on('pageerror', (err) => pageErrors.push(err.message));
    });

    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = sw.url().split('/')[2]!;

    const page = await ctx.newPage();
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`chrome-extension://${extId}/src/options/options.html`);
    await expect(page.locator('#cm-smoke .cm-editor')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#cm-smoke .cm-gutters')).toBeVisible();

    const cspErrors = pageErrors.filter(
      (m) =>
        m.toLowerCase().includes('content security policy') ||
        m.toLowerCase().includes('unsafe-eval'),
    );
    expect(cspErrors, `CSP violations: ${cspErrors.join('\n')}`).toEqual([]);
  } finally {
    await ctx.close();
  }
});
