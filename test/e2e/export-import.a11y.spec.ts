import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

async function launch(): Promise<{ ctx: BrowserContext; extId: string }> {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2]!;
  return { ctx, extId };
}

async function seedStorage(
  ctx: BrowserContext,
  payload: Record<string, unknown>,
): Promise<void> {
  const sw = ctx.serviceWorkers()[0]!;
  await sw.evaluate(async (p: Record<string, unknown>) => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await chrome.storage.local.set({ pj_storage_area: 'local', ...p });
  }, payload);
}

async function axeCheck(page: import('@playwright/test').Page): Promise<void> {
  // Scope to the modal only — axe otherwise surfaces pre-existing issues on
  // the underlying page (rule cards, example pills) that aren't this feature's
  // concern.
  const results = await new AxeBuilder({ page })
    .include('.pj-modal-backdrop')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['aria-valid-attr-value'])
    .analyze();
  const severe = results.violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact ?? ''),
  );
  expect(severe, `axe violations: ${JSON.stringify(severe, null, 2)}`).toEqual([]);
}

test.describe('a11y — export/import dialogs', () => {
  test('export picker', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { t: '<div>{{x}}</div>' },
        pj_sample_json: {},
        rules: [
          {
            id: 'r1',
            name: 'demo',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            variables: {},
            active: true,
          },
        ],
        schemaVersion: 2,
      });
      const page = await ctx.newPage();
      await page.goto(`chrome-extension://${extId}/src/options/options.html`);
      await expect(page.locator('.pj-app')).toBeVisible();
      await page.getByRole('button', { name: /^Export$/ }).click();
      await axeCheck(page);
    } finally {
      await ctx.close();
    }
  });

  test('export scrub', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { t: '<div>{{x}}</div>' },
        pj_sample_json: {},
        rules: [
          {
            id: 'r1',
            name: 'demo',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            variables: {},
            active: true,
          },
        ],
        schemaVersion: 2,
      });
      const page = await ctx.newPage();
      await page.goto(`chrome-extension://${extId}/src/options/options.html`);
      await expect(page.locator('.pj-app')).toBeVisible();
      await page.getByRole('button', { name: /^Export$/ }).click();
      await page.getByLabel(/demo/).check();
      await page.getByRole('button', { name: /next: scrub/i }).click();
      await axeCheck(page);
    } finally {
      await ctx.close();
    }
  });

  test('import input', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, { templates: {}, rules: [], schemaVersion: 2 });
      const page = await ctx.newPage();
      await page.goto(`chrome-extension://${extId}/src/options/options.html`);
      await expect(page.locator('.pj-app')).toBeVisible();
      await page.getByRole('button', { name: /^Import$/ }).click();
      await axeCheck(page);
    } finally {
      await ctx.close();
    }
  });

  test('import review', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, { templates: {}, rules: [], schemaVersion: 2 });
      const page = await ctx.newPage();
      await page.goto(`chrome-extension://${extId}/src/options/options.html`);
      await expect(page.locator('.pj-app')).toBeVisible();
      await page.getByRole('button', { name: /^Import$/ }).click();
      await page.getByPlaceholder(/paste bundle json/i).fill(
        JSON.stringify({
          bundleSchemaVersion: 1,
          exportedAt: 'x',
          appVersion: '1.0.0',
          templates: [{ name: 't', source: 'x' }],
          rules: [],
        }),
      );
      await page.getByRole('button', { name: /next: review/i }).click();
      await page.getByRole('button', { name: /review & pick/i }).click();
      await axeCheck(page);
    } finally {
      await ctx.close();
    }
  });
});
