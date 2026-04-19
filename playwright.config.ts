import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
  use: { headless: false },
  // Visual-regression tolerances: the extension pages are mostly static layout
  // over seeded data, so they should be near-pixel-stable. 2% pixel-ratio
  // tolerance absorbs subpixel font rendering variation without hiding real
  // regressions. Baselines live in `test/e2e/<spec>.spec.ts-snapshots/` and
  // are platform/arch-suffixed (e.g. `-chromium-darwin-arm64.png`). Regenerate
  // with `pnpm test:e2e -- visual-regression --update-snapshots`.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
});
