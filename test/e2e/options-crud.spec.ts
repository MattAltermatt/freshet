import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
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
  const sw = ctx.serviceWorkers()[0];
  if (!sw) throw new Error('service worker missing');
  await sw.evaluate(async (p: Record<string, unknown>) => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await chrome.storage.local.set({ pj_storage_area: 'local', ...p });
  }, payload);
}

async function readStorage<T = unknown>(
  ctx: BrowserContext,
  key: string,
): Promise<T | undefined> {
  const sw = ctx.serviceWorkers()[0]!;
  return sw.evaluate(async (k: string) => {
    const rec = await chrome.storage.local.get(k);
    return (rec as Record<string, unknown>)[k] as unknown;
  }, key) as Promise<T | undefined>;
}

async function openOptions(ctx: BrowserContext, extId: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/src/options/options.html`);
  await expect(page.locator('.pj-app')).toBeVisible({ timeout: 5000 });
  return page;
}

test.describe('Options page CRUD', () => {
  test('URL tester surfaces match + shadowed states', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { tpl: '<pre>{{ id }}</pre>' },
        rules: [
          { id: 'a', hostPattern: '*.api.com', pathPattern: '/**', templateName: 'tpl', variables: {}, active: true },
          { id: 'b', hostPattern: '*.api.com', pathPattern: '/**', templateName: 'tpl', variables: {}, active: true },
        ],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);

      await page.locator('.pj-url-input').fill('https://foo.api.com/v2/users');

      const results = page.locator('.pj-url-result');
      await expect(results).toHaveCount(2);
      await expect(results.nth(0)).toHaveAttribute('data-state', 'match');
      await expect(results.nth(1)).toHaveAttribute('data-state', 'shadowed');
    } finally {
      await ctx.close();
    }
  });

  test('adding a rule from the modal persists through storage', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { tpl: '<span>{{ id }}</span>' },
        rules: [],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);

      await page.getByRole('button', { name: /add rule/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByLabel('Host pattern').fill('api.example.com');
      await page.getByLabel('Path pattern').fill('/users/**');
      await page.getByRole('dialog').getByRole('button', { name: /add rule/i }).click();

      // Modal closes + card appears + Saved toast
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.pj-rule-card')).toHaveCount(1);
      await expect(page.locator('.pj-rule-card').first()).toContainText('api.example.com');

      // Storage reflects the write
      const stored = await readStorage<Array<{ hostPattern: string }>>(ctx, 'rules');
      expect(stored).toHaveLength(1);
      expect(stored![0]!.hostPattern).toBe('api.example.com');
    } finally {
      await ctx.close();
    }
  });

  test('deleting a rule shows Undo toast and restores on click', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { tpl: '<x>{{ id }}</x>' },
        rules: [
          { id: 'r1', hostPattern: 'a.com', pathPattern: '/', templateName: 'tpl', variables: {}, active: true },
        ],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);

      await page.getByRole('button', { name: /^delete rule 1$/i }).click();
      await expect(page.locator('.pj-rule-card')).toHaveCount(0);

      const undo = page.getByRole('button', { name: /undo/i });
      await expect(undo).toBeVisible();
      await undo.click();
      await expect(page.locator('.pj-rule-card')).toHaveCount(1);
    } finally {
      await ctx.close();
    }
  });

  test('template delete with referencing rule deactivates that rule', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { alpha: '<h1>{{ id }}</h1>', beta: '<p>{{ id }}</p>' },
        rules: [
          { id: 'r1', hostPattern: 'x.com', pathPattern: '/', templateName: 'alpha', variables: {}, active: true },
        ],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);

      await page.getByRole('button', { name: 'Templates' }).click();
      await page.locator('.pj-templates-select select').selectOption('alpha');
      await page.getByRole('button', { name: /^delete$/i }).click();

      const dialog = page.getByRole('dialog', { name: /delete template/i });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('rule');
      await dialog.getByRole('button', { name: /delete \+ deactivate/i }).click();

      // Template gone
      const templates = await readStorage<Record<string, string>>(ctx, 'templates');
      expect(Object.keys(templates ?? {})).toEqual(['beta']);
      // Rule flipped to inactive
      const rules = await readStorage<Array<{ active: boolean }>>(ctx, 'rules');
      expect(rules![0]!.active).toBe(false);
    } finally {
      await ctx.close();
    }
  });

  test('stored sample JSON per template renders in the editor on load', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { alpha: '<a>{{ id }}</a>', beta: '<b>{{ id }}</b>' },
        pj_sample_json: { alpha: '{"kind":"stored-alpha"}', beta: '{"kind":"stored-beta"}' },
        rules: [],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);
      await page.getByRole('button', { name: 'Templates' }).click();

      // Sample JSON editor is the first CodeMirror editor in the side column.
      const jsonEditor = page
        .locator('.pj-templates-side-block')
        .first()
        .locator('.cm-content');
      await expect(jsonEditor).toContainText('stored-alpha');

      // Switch template → the side editor should swap to beta's sample.
      await page.locator('.pj-templates-select select').selectOption('beta');
      await expect(jsonEditor).toContainText('stored-beta');
    } finally {
      await ctx.close();
    }
  });
});
