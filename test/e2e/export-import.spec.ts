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
  const sw = ctx.serviceWorkers()[0]!;
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

test.describe('Export / Import', () => {
  test('paste path: round-trip preserves rules + templates + sample JSON', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { t1: '<div>{{x}}</div>' },
        pj_sample_json: { t1: '{"x":1}' },
        rules: [
          {
            id: 'r1',
            name: 'qa',
            hostPattern: 'api.x.com',
            pathPattern: '/**',
            templateName: 't1',
            variables: { env: 'qa' },
            active: true,
          },
        ],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);

      // Export
      await page.getByRole('button', { name: /⬇ Export/ }).click();
      await page.getByLabel(/qa/).check();
      await page.getByRole('button', { name: /next: scrub/i }).click();
      await page.getByRole('button', { name: /next: output/i }).click();

      // Capture the bundle JSON via clipboard button (simpler than download)
      const json = await page.evaluate(async () => {
        // Re-build the bundle by reading from storage + running the same serializer
        // would require importing. Instead, grab the clipboard via the dialog.
        return '';
      });
      expect(json).toBe(''); // placeholder — we'll capture differently below

      // Download path — use Playwright's waitForEvent
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /^Download$/ }).click(),
      ]);
      const savedPath = await download.path();
      expect(savedPath).toBeTruthy();

      // Read bundle bytes
      const fs = await import('node:fs/promises');
      const bundleText = await fs.readFile(savedPath!, 'utf8');
      const parsed = JSON.parse(bundleText);
      expect(parsed.bundleSchemaVersion).toBe(1);
      expect(parsed.rules).toHaveLength(1);
      expect(parsed.rules[0].id).toBe('r1');

      // Close export, clear storage
      await page.getByRole('button', { name: /^Done$/ }).click();
      await seedStorage(ctx, {
        templates: {},
        pj_sample_json: {},
        rules: [],
        schemaVersion: 2,
      });
      await page.reload();
      await expect(page.locator('.pj-app')).toBeVisible({ timeout: 5000 });

      // Re-import via paste
      await page.getByRole('button', { name: /⬆ Import/ }).click();
      await page.getByPlaceholder(/paste bundle json/i).fill(bundleText);
      await page.getByRole('button', { name: /next: review/i }).click();
      await page.getByRole('button', { name: /just append all/i }).click();
      await page.getByRole('button', { name: /^Append all$/ }).click();

      // Verify storage round-trip
      const rules = await readStorage<{ id: string; active: boolean }[]>(ctx, 'rules');
      expect(rules).toHaveLength(1);
      expect(rules![0]!.id).toBe('r1');
      expect(rules![0]!.active).toBe(false); // imported rules always inactive

      const templates = await readStorage<Record<string, string>>(ctx, 'templates');
      expect(Object.keys(templates ?? {})).toEqual(['t1']);

      const sample = await readStorage<Record<string, string>>(ctx, 'pj_sample_json');
      expect(sample?.['t1']).toBe('{"x":1}');
    } finally {
      await ctx.close();
    }
  });

  test('append mode auto-renames colliding template + persists flags across reload', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { foo: '<div>old</div>' },
        pj_sample_json: { foo: '{}' },
        rules: [],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);

      await page.getByRole('button', { name: /⬆ Import/ }).click();
      await page.getByPlaceholder(/paste bundle json/i).fill(
        JSON.stringify({
          bundleSchemaVersion: 1,
          exportedAt: 'x',
          appVersion: '1.0.0',
          templates: [
            { name: 'foo', source: '<div>new</div>', sampleJson: '{"api_token":"abc"}' },
          ],
          rules: [],
        }),
      );
      await page.getByRole('button', { name: /next: review/i }).click();
      await page.getByRole('button', { name: /just append all/i }).click();
      await page.getByRole('button', { name: /^Append all$/ }).click();

      const tmpls = await readStorage<Record<string, string>>(ctx, 'templates');
      expect(Object.keys(tmpls ?? {}).sort()).toEqual(['foo', 'foo-2']);

      // Flags stored under the resolved template name, and survive across reload.
      await page.reload();
      await expect(page.locator('.pj-app')).toBeVisible({ timeout: 5000 });
      const flags = await readStorage<Record<string, unknown>>(ctx, 'pj_import_flags');
      expect(flags).toHaveProperty('foo-2');
    } finally {
      await ctx.close();
    }
  });

  test('malformed paste renders inline errors and blocks advance', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, { templates: {}, rules: [], schemaVersion: 2 });
      const page = await openOptions(ctx, extId);
      await page.getByRole('button', { name: /⬆ Import/ }).click();
      await page.getByPlaceholder(/paste bundle json/i).fill('{not valid');
      await page.getByRole('button', { name: /next: review/i }).click();
      await expect(page.getByRole('alert')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('scrub strips sampleJson: exported bundle omits it + re-import leaves recipient pj_sample_json untouched', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: { t1: '<div>{{x}}</div>' },
        pj_sample_json: { t1: '{"secret":"xyz"}' },
        rules: [
          {
            id: 'r1',
            name: 'demo',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't1',
            variables: {},
            active: true,
          },
        ],
        schemaVersion: 2,
      });
      const page = await openOptions(ctx, extId);

      await page.getByRole('button', { name: /⬇ Export/ }).click();
      await page.getByLabel(/demo/).check();
      await page.getByRole('button', { name: /next: scrub/i }).click();
      // Strip the sample JSON for this template
      await page.getByLabel(/strip sample json for t1/i).check();
      await page.getByRole('button', { name: /next: output/i }).click();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /^Download$/ }).click(),
      ]);
      const fs = await import('node:fs/promises');
      const bundleText = await fs.readFile((await download.path())!, 'utf8');
      const parsed = JSON.parse(bundleText);
      // The exported bundle must omit sampleJson for the stripped template.
      expect(parsed.templates[0].sampleJson).toBeUndefined();

      // Close export, clear recipient storage, import the stripped bundle.
      await page.getByRole('button', { name: /^Done$/ }).click();
      await seedStorage(ctx, {
        templates: {},
        pj_sample_json: { preserved: '{"kept":true}' },
        rules: [],
        schemaVersion: 2,
      });
      await page.reload();
      await page.getByRole('button', { name: /⬆ Import/ }).click();
      await page.getByPlaceholder(/paste bundle json/i).fill(bundleText);
      await page.getByRole('button', { name: /next: review/i }).click();
      await page.getByRole('button', { name: /just append all/i }).click();
      await page.getByRole('button', { name: /^Append all$/ }).click();

      const sample = await readStorage<Record<string, string>>(ctx, 'pj_sample_json');
      // Recipient's unrelated entry preserved, and no entry written for t1
      expect(sample?.['preserved']).toBe('{"kept":true}');
      expect(sample?.['t1']).toBeUndefined();
    } finally {
      await ctx.close();
    }
  });

  test('file picker path opens review on valid file', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, { templates: {}, rules: [], schemaVersion: 2 });
      const page = await openOptions(ctx, extId);
      await page.getByRole('button', { name: /⬆ Import/ }).click();

      const validBundle = JSON.stringify({
        bundleSchemaVersion: 1,
        exportedAt: 'x',
        appVersion: '1.0.0',
        templates: [{ name: 't', source: 'x' }],
        rules: [],
      });
      const buffer = Buffer.from(validBundle, 'utf8');
      await page.setInputFiles('input[type="file"]', {
        name: 'bundle.freshet.json',
        mimeType: 'application/json',
        buffer,
      });
      await page.getByRole('button', { name: /next: review/i }).click();
      await expect(page.getByRole('heading', { name: /ready to review/i })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
