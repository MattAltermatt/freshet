/**
 * Visual-regression baselines for the options page and popup.
 *
 * Captures pixel snapshots of the main surfaces rendered over deterministic
 * seeded storage. Baselines are committed under
 * `visual-regression.spec.ts-snapshots/` and are platform/arch-suffixed —
 * each contributor's first run on a new OS will generate fresh baselines.
 *
 * To regenerate after an intentional UI change:
 *   pnpm test:e2e -- visual-regression --update-snapshots
 *
 * Coverage is intentionally narrow (two screenshots) — the goal is to catch
 * accidental layout regressions on the two highest-churn surfaces, not to
 * pin every pixel. Dark-mode + top-strip snapshots can follow later if
 * these prove stable.
 */
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

async function launch(): Promise<{ ctx: BrowserContext; extId: string }> {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    viewport: { width: 1280, height: 800 },
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
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      schemaVersion: 2,
      // Force light theme so baselines aren't flipped by the test machine's
      // OS-level dark-mode preference.
      settings: { themePreference: 'light' },
      pj_first_run_dismissed: true,
      ...p,
    });
  }, payload);
}

const SEED_TEMPLATES = {
  'service-status': '<h1>{{ service.name }}</h1><p>Status: {{ service.status }}</p>',
  'user-detail': '<h1>{{ user.displayName }}</h1><p>{{ user.email }}</p>',
};

const SEED_RULES = [
  {
    id: 'fixture-1',
    name: 'Internal status board',
    hostPattern: 'status.internal.example.com',
    pathPattern: '/api/services/**',
    templateName: 'service-status',
    variables: { env: 'prod' },
    active: true,
  },
  {
    id: 'fixture-2',
    name: 'User admin lookup',
    hostPattern: 'admin.example.com',
    pathPattern: '/api/v1/users/**',
    templateName: 'user-detail',
    variables: {},
    active: false,
  },
];

test.describe('Visual regression', () => {
  test('options page — rules tab with seeded fixtures', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: SEED_TEMPLATES,
        rules: SEED_RULES,
      });

      const page = await ctx.newPage();
      await page.goto(`chrome-extension://${extId}/src/options/options.html`);
      await expect(page.locator('.pj-app')).toBeVisible({ timeout: 5000 });
      // Wait for both rule cards to render to avoid snapshotting a half-loaded
      // list. Load settles within ~1 frame on a warm SW, but give it time.
      await expect(page.locator('.pj-rule-card')).toHaveCount(2, { timeout: 5000 });

      await expect(page).toHaveScreenshot('options-rules-light.png', { fullPage: true });
    } finally {
      await ctx.close();
    }
  });

  test('popup — empty-state with first-run banner dismissed', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedStorage(ctx, {
        templates: SEED_TEMPLATES,
        rules: SEED_RULES,
      });

      const popup = await ctx.newPage();
      await popup.setViewportSize({ width: 360, height: 520 });
      await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
      await expect(popup.locator('.pj-popup')).toBeVisible({ timeout: 5000 });

      await expect(popup).toHaveScreenshot('popup-light.png', { fullPage: true });
    } finally {
      await ctx.close();
    }
  });
});
