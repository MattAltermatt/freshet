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

for (const theme of ['light', 'dark'] as const) {
  test(`popup with conflict entry has no axe-core serious/critical violations (${theme})`, async () => {
    const { ctx, extId } = await launch();
    try {
      const [sw] = ctx.serviceWorkers();
      await sw!.evaluate(async () => {
        await chrome.storage.local.set({
          pj_storage_area: 'local',
          rules: [],
          templates: {},
          hostSkipList: [],
          settings: { themePreference: 'system' },
          pj_conflicts: {
            'example.com': {
              viewer: 'jsonview',
              displayName: 'JSONView',
              extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
              detectedAt: new Date().toISOString(),
            },
          },
        });
      });

      const popup = await ctx.newPage();
      await popup.emulateMedia({ colorScheme: theme });
      await popup.addInitScript(() => {
        Object.defineProperty(chrome.tabs, 'query', {
          configurable: true,
          value: (_q: unknown, cb: (t: Array<{ url: string }>) => void): void =>
            cb([{ url: 'https://example.com/x' }]),
        });
      });
      await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
      await popup.waitForSelector('.pj-popup:not(.pj-popup--booting)');
      await expect(popup.getByText(/JSONView is formatting/i)).toBeVisible();

      const results = await new AxeBuilder({ page: popup })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const severe = results.violations.filter((v) =>
        ['serious', 'critical'].includes(v.impact ?? ''),
      );
      expect(severe, `axe violations: ${JSON.stringify(severe, null, 2)}`).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  test(`popup has no axe-core WCAG 2.1 AA violations (${theme})`, async () => {
    const { ctx, extId } = await launch();
    try {
      const [sw] = ctx.serviceWorkers();
      await sw!.evaluate(async () => {
        await chrome.storage.local.set({
          pj_storage_area: 'local',
          rules: [],
          templates: {},
          hostSkipList: [],
          settings: { themePreference: 'system' },
        });
      });

      const popup = await ctx.newPage();
      await popup.emulateMedia({ colorScheme: theme });
      await popup.addInitScript(() => {
        Object.defineProperty(chrome.tabs, 'query', {
          configurable: true,
          value: (_q: unknown, cb: (t: Array<{ url: string }>) => void): void =>
            cb([{ url: 'https://example.com/x' }]),
        });
      });
      await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
      await popup.waitForSelector('.pj-popup:not(.pj-popup--booting)');

      const results = await new AxeBuilder({ page: popup })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({ html: n.html, target: n.target, failure: n.failureSummary })),
      }));

      expect(violations, `axe violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}
