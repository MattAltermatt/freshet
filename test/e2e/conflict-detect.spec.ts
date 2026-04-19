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

async function seed(ctx: BrowserContext, payload: Record<string, unknown>): Promise<void> {
  const sw = ctx.serviceWorkers()[0]!;
  await sw.evaluate(async (p: Record<string, unknown>) => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await chrome.storage.local.set({ pj_storage_area: 'local', ...p });
  }, payload);
}

async function read<T>(ctx: BrowserContext, key: string): Promise<T | undefined> {
  const sw = ctx.serviceWorkers()[0]!;
  return sw.evaluate(async (k: string) => {
    const rec = await chrome.storage.local.get(k);
    return (rec as Record<string, unknown>)[k] as unknown;
  }, key) as Promise<T | undefined>;
}

async function openPopup(ctx: BrowserContext, extId: string): Promise<Page> {
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  await expect(popup.locator('.pj-popup')).toBeVisible({ timeout: 5000 });
  return popup;
}

test.describe('Conflict detection — popup', () => {
  test('renders ConflictSection when pj_conflicts has an entry for the active tab host', async () => {
    const { ctx, extId } = await launch();
    try {
      await seed(ctx, {
        rules: [],
        templates: {},
        pj_conflicts: {
          // The popup's active-tab lookup may not resolve to a real host in the
          // test harness; keying by the extension's own id covers both paths.
          [extId]: {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
            detectedAt: new Date().toISOString(),
          },
          'api.github.com': {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
            detectedAt: new Date().toISOString(),
          },
        },
        schemaVersion: 2,
      });
      const popup = await openPopup(ctx, extId);
      await expect(popup.getByText(/JSONView is formatting/i)).toBeVisible();
      const link = popup.getByRole('link', { name: /Open JSONView settings/i });
      await expect(link).toHaveAttribute(
        'href',
        'chrome://extensions/?id=gmegofmjomhknnokphhckolhcffdaihd',
      );
    } finally {
      await ctx.close();
    }
  });

  test('Skip this host adds to hostSkipList + clears the conflict entry', async () => {
    const { ctx, extId } = await launch();
    try {
      await seed(ctx, {
        rules: [],
        templates: {},
        hostSkipList: [],
        pj_conflicts: {
          [extId]: {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
            detectedAt: new Date().toISOString(),
          },
        },
        schemaVersion: 2,
      });
      const popup = await openPopup(ctx, extId);
      await popup.getByRole('button', { name: /Skip this host/i }).click();
      // Give the storage write a beat to land
      await popup.waitForTimeout(200);
      const skip = await read<string[]>(ctx, 'hostSkipList');
      expect(skip).toContain(extId);
      const conflicts = await read<Record<string, unknown>>(ctx, 'pj_conflicts');
      expect(conflicts?.[extId]).toBeUndefined();
    } finally {
      await ctx.close();
    }
  });

  test('Dismiss clears conflict entry only; hostSkipList unchanged', async () => {
    const { ctx, extId } = await launch();
    try {
      await seed(ctx, {
        rules: [],
        templates: {},
        hostSkipList: [],
        pj_conflicts: {
          [extId]: {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
            detectedAt: new Date().toISOString(),
          },
        },
        schemaVersion: 2,
      });
      const popup = await openPopup(ctx, extId);
      await popup.getByRole('button', { name: /^Dismiss$/ }).click();
      await popup.waitForTimeout(200);
      const conflicts = await read<Record<string, unknown>>(ctx, 'pj_conflicts');
      expect(conflicts?.[extId]).toBeUndefined();
      const skip = await read<string[]>(ctx, 'hostSkipList');
      expect(skip).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});

// Content-script E2E deferred: Chrome doesn't run `<all_urls>` content scripts
// on `chrome-extension://` pages, and serving the fixture from http(s) would
// require an ambient local server. The `detectConflict` pure core + popup E2E
// cover the code paths; leaving a stub here for when we add a local HTTP
// server to the E2E infra.
