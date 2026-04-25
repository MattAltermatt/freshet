import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
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

async function seedThreeRules(ctx: BrowserContext): Promise<void> {
  const sw = ctx.serviceWorkers()[0]!;
  await sw.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [
        { id: 'r1', name: 'Alpha', hostPattern: 'a.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
        { id: 'r2', name: 'Beta',  hostPattern: 'b.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
        { id: 'r3', name: 'Gamma', hostPattern: 'c.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
      ],
      templates: { t1: '<div>{{ x }}</div>' },
      schemaVersion: 2,
    });
  });
}

async function readRuleOrder(ctx: BrowserContext): Promise<string[]> {
  const sw = ctx.serviceWorkers()[0]!;
  return sw.evaluate(async () => {
    const got = await chrome.storage.local.get('rules');
    return ((got.rules as { id: string }[]) ?? []).map((r) => r.id);
  });
}

async function openOptions(ctx: BrowserContext, extId: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/src/options/options.html`);
  await expect(page.locator('.pj-rule-card').first()).toBeVisible({ timeout: 5000 });
  return page;
}

test.describe('rules drag-to-reorder (#9)', () => {
  test('drags rule #1 to last position and persists once', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedThreeRules(ctx);
      const page = await openOptions(ctx, extId);

      // Cards in DOM order: Alpha, Beta, Gamma
      await expect(page.locator('.pj-rule-card').nth(0)).toContainText('Alpha');
      await expect(page.locator('.pj-rule-card').nth(2)).toContainText('Gamma');

      const grip = page.locator('.pj-rule-card').nth(0).locator('.pj-rule-grip');
      const lastCard = page.locator('.pj-rule-card').nth(2);
      const gripBox = await grip.boundingBox();
      const lastBox = await lastCard.boundingBox();
      if (!gripBox || !lastBox) throw new Error('layout missing');

      // Drag from grip to just past the last card's bottom
      await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        gripBox.x + gripBox.width / 2,
        lastBox.y + lastBox.height + 6,
        { steps: 14 },
      );
      await page.mouse.up();

      // Wait for the post-drop state to settle
      await page.waitForTimeout(250);

      // Storage now reflects the new order: r2, r3, r1
      expect(await readRuleOrder(ctx)).toEqual(['r2', 'r3', 'r1']);
      await expect(page.locator('.pj-rule-card').nth(2)).toContainText('Alpha');
    } finally {
      await ctx.close();
    }
  });

  test('escape cancels mid-drag without writing', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedThreeRules(ctx);
      const page = await openOptions(ctx, extId);

      const grip = page.locator('.pj-rule-card').nth(0).locator('.pj-rule-grip');
      const lastCard = page.locator('.pj-rule-card').nth(2);
      const gripBox = await grip.boundingBox();
      const lastBox = await lastCard.boundingBox();
      if (!gripBox || !lastBox) throw new Error('layout missing');

      await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        gripBox.x + gripBox.width / 2,
        lastBox.y + lastBox.height / 2,
        { steps: 10 },
      );
      // Wait for the floating clone to appear — confirms drag state flushed.
      await expect(page.locator('.pj-rule-card-floating')).toBeVisible({ timeout: 1000 });
      // Cancel mid-drag
      await page.keyboard.press('Escape');
      await page.mouse.up();

      // Order unchanged
      expect(await readRuleOrder(ctx)).toEqual(['r1', 'r2', 'r3']);
    } finally {
      await ctx.close();
    }
  });

  test('axe-core a11y passes mid-drag (slot opened)', async () => {
    const { ctx, extId } = await launch();
    try {
      await seedThreeRules(ctx);
      const page = await openOptions(ctx, extId);

      const grip = page.locator('.pj-rule-card').nth(0).locator('.pj-rule-grip');
      const middleCard = page.locator('.pj-rule-card').nth(1);
      const gripBox = await grip.boundingBox();
      const midBox = await middleCard.boundingBox();
      if (!gripBox || !midBox) throw new Error('layout missing');

      // Pause mid-drag
      await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        gripBox.x + gripBox.width / 2,
        midBox.y + midBox.height + 4,
        { steps: 10 },
      );

      const results = await new AxeBuilder({ page })
        .include('.pj-rule-stack')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);

      await page.mouse.up();
    } finally {
      await ctx.close();
    }
  });
});
