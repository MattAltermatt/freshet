import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

for (const theme of ['light', 'dark'] as const) {
  test(`topstrip has no a11y violations (${theme})`, async () => {
    const ctx = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const [sw] = ctx.serviceWorkers();
    const worker = sw ?? (await ctx.waitForEvent('serviceworker'));

    await worker.evaluate(async (pref) => {
      await chrome.storage.local.set({
        pj_storage_area: 'local',
        rules: [{
          id: 'r-a11y', hostPattern: '127.0.0.1', pathPattern: '/**',
          templateName: 'A', variables: { env: 'staging' }, enabled: true,
        }],
        templates: { A: '<h1>a</h1>' },
        hostSkipList: [],
        settings: { themePreference: pref },
      });
    }, theme);

    const page = await ctx.newPage();
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('http://127.0.0.1:4391/internal/user/1234');
    await page.waitForSelector('#pj-topstrip-host');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('#pj-topstrip-host')
      .analyze();

    expect(results.violations).toEqual([]);
    await ctx.close();
  });
}
