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

/**
 * Seeds chrome.storage.sync *only* — mimics a legacy install whose data still
 * lives in sync without the `pj_storage_area` sentinel.
 *
 * The SW's initial `main()` (seed/migrate/stamp) runs concurrently with the
 * test harness, so we first wait for its writes to settle (`pj_storage_area`
 * landing in local is the last-write marker of `seedStartersIfEmpty`). Clearing
 * before that completes lets `migrateTemplatesToV2` overwrite our seed with an
 * empty `templates` map.
 */
async function seedSyncOnly(
  ctx: BrowserContext,
  payload: Record<string, unknown>,
): Promise<void> {
  const sw = ctx.serviceWorkers()[0]!;
  await expect
    .poll(
      async () => {
        const rec = await sw.evaluate(() =>
          chrome.storage.local.get('pj_storage_area'),
        );
        return (rec as { pj_storage_area?: string }).pj_storage_area;
      },
      { timeout: 5000 },
    )
    .toBe('local');
  await sw.evaluate(async (p: Record<string, unknown>) => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(p);
  }, payload);
}

async function readLocal<T = unknown>(
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

test.describe('Storage promotion (sync → local on boot)', () => {
  test('promotes sync-only data to local and stamps the sentinel on options boot', async () => {
    const { ctx, extId } = await launch();
    try {
      // Simulate a legacy install: rules + templates + hostSkipList live in
      // chrome.storage.sync only, no pj_storage_area sentinel yet in local.
      // Each key stays under Chrome's 8 KB per-item sync cap.
      await seedSyncOnly(ctx, {
        rules: [
          {
            id: 'legacy-rule-1',
            name: 'Legacy rule',
            hostPattern: 'api.example.com',
            pathPattern: '/v1/**',
            templateName: 'legacy-template',
            variables: { env: 'prod' },
            active: true,
          },
        ],
        templates: {
          'legacy-template': '<h1>{{ title }}</h1>',
        },
        hostSkipList: ['skip.example.com'],
      });

      const sentinelBefore = await readLocal<string>(ctx, 'pj_storage_area');
      expect(sentinelBefore).toBeUndefined();

      const page = await openOptions(ctx, extId);

      // promoteStorageToLocal runs on boot (src/options/App.tsx). Wait for the
      // sentinel to land, then verify the promoted payload.
      await expect
        .poll(() => readLocal<string>(ctx, 'pj_storage_area'), { timeout: 5000 })
        .toBe('local');

      const promotedRules = await readLocal<unknown[]>(ctx, 'rules');
      expect(Array.isArray(promotedRules)).toBe(true);
      expect(promotedRules).toHaveLength(1);
      expect((promotedRules as Array<Record<string, unknown>>)[0]!).toMatchObject({
        id: 'legacy-rule-1',
        hostPattern: 'api.example.com',
        active: true,
      });

      const promotedTemplates = await readLocal<Record<string, string>>(ctx, 'templates');
      expect(promotedTemplates).toMatchObject({
        'legacy-template': '<h1>{{ title }}</h1>',
      });

      const promotedSkip = await readLocal<string[]>(ctx, 'hostSkipList');
      expect(promotedSkip).toEqual(['skip.example.com']);

      // The options page should render the legacy rule card (Rules is the
      // default tab).
      await expect(page.locator('.pj-rule-card').first()).toContainText('Legacy rule', {
        timeout: 5000,
      });
    } finally {
      await ctx.close();
    }
  });

  test('is a no-op when the sentinel is already set', async () => {
    const { ctx, extId } = await launch();
    try {
      const sw = ctx.serviceWorkers()[0]!;
      await sw.evaluate(async () => {
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
        // Pre-promoted state: data sits in local, sentinel is set, sync is empty.
        await chrome.storage.local.set({
          pj_storage_area: 'local',
          rules: [
            {
              id: 'local-rule',
              hostPattern: 'api.example.com',
              pathPattern: '/',
              templateName: 'local-template',
              variables: {},
              active: true,
            },
          ],
          templates: { 'local-template': '<p>{{ x }}</p>' },
          hostSkipList: [],
        });
        // Also write different data into sync — if the no-op guard fails, we'd
        // see this leak into local and clobber the local-only values above.
        await chrome.storage.sync.set({
          rules: [{ id: 'SHOULD-NOT-APPEAR', hostPattern: 'bad', pathPattern: '/', templateName: 'x', variables: {}, active: true }],
        });
      });

      await openOptions(ctx, extId);

      // Give promoteStorageToLocal a beat to run (it should bail because the
      // sentinel is already 'local').
      await new Promise((resolve) => setTimeout(resolve, 500));

      const rules = await readLocal<Array<Record<string, unknown>>>(ctx, 'rules');
      expect(rules).toHaveLength(1);
      expect(rules![0]!.id).toBe('local-rule');
    } finally {
      await ctx.close();
    }
  });
});
