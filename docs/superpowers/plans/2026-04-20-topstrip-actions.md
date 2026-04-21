# Top-strip actions — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the top-strip overflow menu with flattened inline actions, add a Copy JSON button, and add a clickable rule-name link to the left cluster. Closes [#3](https://github.com/MattAltermatt/freshet/issues/3) + [#4](https://github.com/MattAltermatt/freshet/issues/4).

**Architecture:** Single-file Preact component (`src/content/TopStrip.tsx`) rendered into a shadow root. All styling in one shadow-scoped CSS file (`src/content/topStrip.css`). No new components, no schema change, no migration. Theme dropdown reuses the existing `Menu` component from `src/ui/components/Menu.tsx`.

**Tech Stack:** Preact + TypeScript, Vitest (unit), Playwright (E2E), shadow-DOM styling with `--pj-*` CSS custom properties.

**Spec reference:** `docs/superpowers/specs/2026-04-20-topstrip-actions-design.md`

**Branch:** `feature/issue-3-4-topstrip-actions` (already created, spec committed)

---

## File map

| File | Purpose | Change type |
|---|---|---|
| `src/content/TopStrip.tsx` | Preact component — layout + handlers | Modify |
| `src/content/topStrip.css` | Shadow-scoped CSS | Modify |
| `src/content/TopStrip.test.tsx` | Component unit tests | Modify |
| `test/e2e/topstrip.spec.ts` | Playwright E2E | Modify (rewrite 2 tests, delete 1) |
| `test/e2e/visual-regression.spec.ts-snapshots/` | Golden PNGs | Regenerate baselines |

All other files (`mountTopStrip.tsx`, `background.ts`, `ui/components/Menu.tsx`, `ui/theme.css`, `shared/types.ts`) stay untouched.

---

## Task 1: Rule-link renders with `name` fallback (TDD)

**Files:**
- Modify: `src/content/TopStrip.test.tsx`
- Modify: `src/content/TopStrip.tsx`

- [ ] **Step 1: Add a failing test for rule-link rendering with `rule.name`**

Append to `src/content/TopStrip.test.tsx` (above the existing `'renders rule name'` test, since we're going to evolve that one):

```tsx
test('renders rule link with rule.name when set', () => {
  const p = baseProps();
  p.rule.name = 'Prod incidents';
  render(<TopStrip {...p} />);
  expect(screen.getByTestId('pj-rule-link')).toHaveTextContent('Prod incidents');
});

test('rule link falls back to hostPattern when rule.name is unset', () => {
  const p = baseProps();
  p.rule.hostPattern = 'api.github.com';
  render(<TopStrip {...p} />);
  expect(screen.getByTestId('pj-rule-link')).toHaveTextContent('api.github.com');
});

test('rule link falls back to (unnamed rule) when name and hostPattern empty', () => {
  const p = baseProps();
  p.rule.hostPattern = '';
  render(<TopStrip {...p} />);
  expect(screen.getByTestId('pj-rule-link')).toHaveTextContent('(unnamed rule)');
});
```

Also widen the `Rule` type literal in `baseProps()` to allow the optional `name`:

```tsx
  return {
    rule: {
      id: 'r1',
      name: undefined as string | undefined,
      hostPattern: '*',
      pathPattern: '/**',
      templateName: 'internal-user',
      variables: {} as Record<string, string>,
      active: true,
    },
    // ...
  };
```

- [ ] **Step 2: Run the three new tests — expect all three to fail (testid `pj-rule-link` doesn't exist)**

Run:
```bash
pnpm test src/content/TopStrip.test.tsx
```

Expected: the three new tests fail with `Unable to find an element by: [data-testid="pj-rule-link"]`.

- [ ] **Step 3: Add the rule-link button to `TopStrip.tsx`**

In `src/content/TopStrip.tsx`, import the directive helper (already imported) and add an `openEditRule` handler that we already have at `~line 94`. The handler exists — we just need to render a button wired to it.

Locate the JSX section (around line 161) and replace the env-chip + rule-name button block:

```tsx
      {env ? (
        <span class="pj-env-chip" data-testid="pj-env-chip">
          {env}
        </span>
      ) : null}
      <button
        type="button"
        class="pj-rule-name"
        data-testid="pj-rule-name"
        title={`Edit template "${rule.templateName}"`}
        onClick={openEditTemplate}
      >
        <span class="pj-rule-name-label">{rule.templateName}</span>
        <span class="pj-rule-name-arrow" aria-hidden="true">↗</span>
      </button>
```

with:

```tsx
      {env ? (
        <span class="pj-env-chip" data-testid="pj-env-chip">
          {env}
        </span>
      ) : null}
      <button
        type="button"
        class="pj-link"
        data-testid="pj-rule-link"
        title="Edit this rule"
        onClick={openEditRule}
      >
        <span class="pj-link-label">
          {rule.name || rule.hostPattern || '(unnamed rule)'}
        </span>
        <span class="pj-link-arrow" aria-hidden="true">↗</span>
      </button>
      <span class="pj-sep" aria-hidden="true">·</span>
      <button
        type="button"
        class="pj-link"
        data-testid="pj-rule-name"
        title={`Edit template "${rule.templateName}"`}
        onClick={openEditTemplate}
      >
        <span class="pj-link-label">{rule.templateName}</span>
        <span class="pj-link-arrow" aria-hidden="true">↗</span>
      </button>
```

The `pj-rule-name` testid is preserved on the template link so existing tests (and the E2E spec that probes `[data-testid="pj-rule-name"]`) keep working — that button is semantically "the template name link" today, and we keep that meaning.

- [ ] **Step 4: Run the three new tests — expect all three to pass**

Run:
```bash
pnpm test src/content/TopStrip.test.tsx
```

Expected: all tests in `TopStrip.test.tsx` pass. (The existing `'renders rule name'` test still passes because the template-link still carries `data-testid="pj-rule-name"`.)

- [ ] **Step 5: Commit**

```bash
git add src/content/TopStrip.tsx src/content/TopStrip.test.tsx
git commit -m "feat(topstrip): add rule-link with name/hostPattern fallback (#3 #4)"
```

---

## Task 2: Rule-link click dispatches `editRule` directive (TDD)

**Files:**
- Modify: `src/content/TopStrip.test.tsx`

- [ ] **Step 1: Add a failing test for rule-link click handler**

Append to `src/content/TopStrip.test.tsx`:

```tsx
test('clicking the rule link sends an open-options edit-rule message', () => {
  const sendMessage = vi.fn();
  (globalThis as unknown as { chrome: { runtime: { sendMessage: typeof sendMessage } } })
    .chrome.runtime.sendMessage = sendMessage;
  render(<TopStrip {...baseProps()} />);
  fireEvent.click(screen.getByTestId('pj-rule-link'));
  expect(sendMessage).toHaveBeenCalledTimes(1);
  const arg = sendMessage.mock.calls[0]![0] as { kind: string; hash: string };
  expect(arg.kind).toBe('pj:open-options');
  expect(arg.hash).toContain('#edit-rule=');
  expect(decodeURIComponent(arg.hash.split('=')[1]!)).toBe('r1');
});
```

- [ ] **Step 2: Run the new test — expect PASS**

Run:
```bash
pnpm test src/content/TopStrip.test.tsx -t "edit-rule"
```

Expected: PASS. (The handler `openEditRule` already exists in `TopStrip.tsx:94-99`. The previous task wired it to the button.)

If this test fails, `openEditRule` is not attached to the rule-link `onClick` — fix that, not the test.

- [ ] **Step 3: Commit**

```bash
git add src/content/TopStrip.test.tsx
git commit -m "test(topstrip): rule-link click dispatches editRule directive"
```

---

## Task 3: CSS styles for the new left-cluster link (dot separator, two links)

**Files:**
- Modify: `src/content/topStrip.css`

- [ ] **Step 1: Replace `.pj-rule-name` selectors with a shared `.pj-link` class**

The current file has `.pj-rule-name`, `.pj-rule-name-label`, `.pj-rule-name-arrow` (lines 84–117). Replace that block with:

```css
.pj-link {
  font-family: var(--pj-font-mono);
  color: var(--pj-fg-muted);
  font-size: 11px;
  white-space: nowrap;
  min-width: 0;
  flex: 0 1 auto;
  background: transparent;
  border: 0;
  padding: 0;
  text-align: left;
  cursor: pointer;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}
.pj-link-label {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.pj-link-arrow {
  flex: 0 0 auto;
  font-size: 10px;
  opacity: 0.7;
}
.pj-link:hover,
.pj-link:focus-visible {
  color: var(--pj-accent-strong);
  text-decoration: underline;
  outline: none;
}
.pj-link:hover .pj-link-arrow,
.pj-link:focus-visible .pj-link-arrow { opacity: 1; }

.pj-sep {
  color: var(--pj-fg-muted);
  opacity: 0.5;
  font-family: var(--pj-font-mono);
  font-size: 11px;
  flex: 0 0 auto;
}
```

- [ ] **Step 2: Run the unit tests — expect PASS**

Run:
```bash
pnpm test src/content/TopStrip.test.tsx
```

Expected: PASS. (CSS changes don't break JSDOM tests — they don't apply styles.)

- [ ] **Step 3: Commit**

```bash
git add src/content/topStrip.css
git commit -m "style(topstrip): rename .pj-rule-name → .pj-link and add .pj-sep"
```

---

## Task 4: Flatten menu — failing tests (TDD step 1)

**Files:**
- Modify: `src/content/TopStrip.test.tsx`

- [ ] **Step 1: Add failing tests for Copy JSON + flat layout**

Append to `src/content/TopStrip.test.tsx`:

```tsx
test('Copy JSON button writes rawJsonText verbatim to the clipboard', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  (navigator as unknown as { clipboard: { writeText: typeof writeText } }).clipboard = {
    writeText,
  };
  const p = baseProps();
  p.rawJsonText = '{"a":1,"b":2}';
  render(<TopStrip {...p} />);
  fireEvent.click(screen.getByTestId('pj-copy-json'));
  expect(writeText).toHaveBeenCalledWith('{"a":1,"b":2}');
});

test('renders inline Copy URL button (not in an overflow menu)', () => {
  render(<TopStrip {...baseProps()} />);
  expect(screen.getByTestId('pj-copy-url')).toBeInTheDocument();
});

test('renders theme dropdown button showing the current theme label', () => {
  render(<TopStrip {...baseProps()} />);
  const btn = screen.getByTestId('pj-theme-trigger');
  expect(btn).toHaveTextContent('Light');
});

test('no ⋯ overflow menu trigger exists on the strip', () => {
  render(<TopStrip {...baseProps()} />);
  expect(screen.queryByTestId('pj-menu-trigger')).toBeNull();
});

test('clicking the theme dropdown opens a menu with three theme items', async () => {
  render(<TopStrip {...baseProps()} />);
  fireEvent.click(screen.getByTestId('pj-theme-trigger'));
  expect(await screen.findByText('Theme: Auto')).toBeInTheDocument();
  expect(screen.getByText('Theme: Light')).toBeInTheDocument();
  expect(screen.getByText('Theme: Dark')).toBeInTheDocument();
});
```

Also **update the existing `'menu exposes a theme submenu with the active preference checked'` test** (lines 122–133 of current file) — rename + retarget it to open via the theme dropdown trigger, not the overflow menu:

```tsx
test('theme dropdown shows a checkmark next to the active preference', async () => {
  // Mock chrome default seeds themePreference: 'light' — active should be Light.
  render(<TopStrip {...baseProps()} />);
  fireEvent.click(screen.getByTestId('pj-theme-trigger'));
  expect(await screen.findByText('Theme: Auto')).toBeInTheDocument();
  const lightItem = screen.getByText('Theme: Light').closest('button')!;
  const darkItem = screen.getByText('Theme: Dark').closest('button')!;
  expect(lightItem.textContent).toContain('✓');
  expect(darkItem.textContent).not.toContain('✓');
});
```

Delete the old `'menu exposes a theme submenu…'` test in the same commit.

Also **update the `'degraded state hides…'` test** — replace the menu-trigger assertion with an inline-actions assertion:

```tsx
test('degraded state hides the toggle-group + right-cluster actions and shows the reason', () => {
  render(
    <TopStrip {...baseProps()} degraded={{ reason: 'Another viewer handled this page' }} />,
  );
  expect(screen.getByTestId('pj-degraded')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'View mode' })).toBeNull();
  expect(screen.queryByTestId('pj-copy-url')).toBeNull();
  expect(screen.queryByTestId('pj-copy-json')).toBeNull();
  expect(screen.queryByTestId('pj-theme-trigger')).toBeNull();
});
```

- [ ] **Step 2: Run the new tests — expect FAIL**

Run:
```bash
pnpm test src/content/TopStrip.test.tsx
```

Expected: the five new tests fail + old `'menu exposes…'` test still exists + `'degraded state…'` test still asserts `pj-menu-trigger`.

- [ ] **Step 3: Commit just the failing tests (red step)**

```bash
git add src/content/TopStrip.test.tsx
git commit -m "test(topstrip): failing tests for Copy JSON + flat-action layout"
```

---

## Task 5: Flatten menu — implement right-cluster

**Files:**
- Modify: `src/content/TopStrip.tsx`

- [ ] **Step 1: Add the `copyJson` handler**

In `src/content/TopStrip.tsx`, add a `copyJson` handler immediately after `copyUrl` (around line 91):

```tsx
  const copyJson = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rawJsonText);
      setToast({ kind: 'copy', text: 'Copied JSON to clipboard' });
      setTimeout(() => setToast(null), 1600);
    } catch {
      /* silent — clipboard may be unavailable in some contexts. */
    }
  };
```

- [ ] **Step 2: Rewrite the right-cluster JSX in `TopStrip.tsx`**

Replace the entire `degraded ? … : <>…</>` block (around lines 182–220) with:

```tsx
      {degraded ? (
        <span class="pj-degraded" data-testid="pj-degraded">
          ⚠ {degraded.reason}
        </span>
      ) : (
        <div class="pj-right">
          <div class="pj-toggle-group" role="group" aria-label="View mode">
            <button
              type="button"
              aria-pressed={mode === 'rendered'}
              onClick={() => setMode('rendered')}
            >
              Rendered
            </button>
            <button
              type="button"
              aria-pressed={mode === 'raw'}
              onClick={() => setMode('raw')}
              title="Toggle raw JSON (⌘⇧J)"
            >
              Raw<span class="pj-toggle-hint"> ⌘⇧J</span>
            </button>
          </div>
          <button
            type="button"
            class="pj-btn"
            data-testid="pj-copy-url"
            title="Copy URL to clipboard"
            onClick={() => void copyUrl()}
          >
            <span class="pj-btn-icon" aria-hidden="true">⧉</span>
            <span>Copy URL</span>
          </button>
          <button
            type="button"
            class="pj-btn"
            data-testid="pj-copy-json"
            title="Copy raw JSON to clipboard"
            onClick={() => void copyJson()}
          >
            <span class="pj-btn-icon" aria-hidden="true">{'{}'}</span>
            <span>Copy JSON</span>
          </button>
          <Menu
            align="right"
            items={themeItems}
            trigger={
              <button
                type="button"
                class="pj-btn pj-theme-trigger"
                data-testid="pj-theme-trigger"
                aria-label="Theme"
                title="Theme"
              >
                <span class="pj-btn-icon" aria-hidden="true">
                  {settings.themePreference === 'dark'
                    ? '☾'
                    : settings.themePreference === 'light'
                      ? '☀'
                      : '◐'}
                </span>
                <span>
                  {settings.themePreference === 'dark'
                    ? 'Dark'
                    : settings.themePreference === 'light'
                      ? 'Light'
                      : 'Auto'}
                </span>
                <span class="pj-btn-chev" aria-hidden="true">▾</span>
              </button>
            }
          />
        </div>
      )}
```

- [ ] **Step 3: Remove the now-unused `menuItems` array and the `skipHost` handler**

In `src/content/TopStrip.tsx`:

- Delete the `menuItems` declaration (the array that contained Copy URL / Edit rule / theme items / Skip this host, around lines 140–159).
- Delete the `skipHost` handler (around lines 108–118) — Skip functionality stays in the popup; it's no longer on the strip.
- Delete the `skipList` + `writeSkipList` `useStorage` call (around lines 34–37) — no longer read or written here.
- Keep `themeItems` (the theme menu items) — the theme dropdown still uses them.
- Keep `copyUrl` and `copyJson` handlers.
- Keep `openEditRule` and `openEditTemplate`.

Also update the `skip` toast branch: since `skipHost` is gone, `setToast` is only ever called with `kind: 'copy'`. Narrow the `toast` state type:

```tsx
  const [toast, setToast] = useState<{ kind: 'copy'; text: string } | null>(null);
```

And in the JSX at the bottom, simplify the toast render to just:

```tsx
      {toast ? (
        <div
          class="pj-toast"
          role="status"
          aria-live="polite"
          data-testid="pj-toast"
        >
          {toast.text}
        </div>
      ) : null}
```

(Drops the `pj-toast--skip` variant branch, since skip is gone.)

- [ ] **Step 4: Run the TopStrip tests**

Run:
```bash
pnpm test src/content/TopStrip.test.tsx
```

Expected: all tests pass (the five new tests from Task 4 + the updated `'theme dropdown shows a checkmark…'` + updated `'degraded state hides…'`).

- [ ] **Step 5: Run the full unit suite to catch collateral**

Run:
```bash
pnpm test
```

Expected: all tests pass. `useStorage` facade has its own tests and is unaffected by the `hostSkipList` caller going away here.

- [ ] **Step 6: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "feat(topstrip): flatten overflow menu into inline buttons + theme dropdown (#3 #4)"
```

---

## Task 6: CSS for right-cluster buttons, theme dropdown, narrow-viewport wrap

**Files:**
- Modify: `src/content/topStrip.css`

- [ ] **Step 1: Add a `.pj-right` wrapper + `margin-left: auto` pinning**

In `src/content/topStrip.css`, modify `.pj-topstrip` to allow wrapping:

```css
.pj-topstrip {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 6px 12px;
  background: var(--pj-bg);
  color: var(--pj-fg);
  border-bottom: 1px solid var(--pj-border);
  box-sizing: border-box;
}

.pj-right {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
```

(`gap: 8px 12px` is `row-gap column-gap` — 8 px between wrapped rows, 12 px between items on the same row.)

- [ ] **Step 2: Add `.pj-btn` style for the inline action buttons**

Append to `src/content/topStrip.css`:

```css
.pj-btn {
  border: 1px solid var(--pj-border);
  border-radius: 4px;
  background: var(--pj-bg-elevated);
  color: var(--pj-fg);
  padding: 3px 8px;
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.pj-btn:hover { border-color: var(--pj-accent); }
.pj-btn:focus-visible {
  outline: 2px solid var(--pj-accent);
  outline-offset: 1px;
}
.pj-btn-icon {
  font-family: var(--pj-font-mono);
  opacity: 0.8;
}
.pj-btn-chev {
  opacity: 0.7;
  font-size: 10px;
  margin-left: 2px;
}
.pj-theme-trigger .pj-btn-icon {
  font-size: 13px;
  line-height: 1;
}
```

- [ ] **Step 3: Delete obsolete `.pj-menu-trigger-btn` block**

Find and delete the `.pj-menu-trigger-btn { … }` + `.pj-menu-trigger-btn:focus-visible { … }` rules (around lines 148–162 of the current file). They're no longer referenced.

- [ ] **Step 4: Build and verify no broken styles**

Run:
```bash
pnpm build
```

Expected: clean build, no warnings about unused selectors (there won't be any — Vite doesn't audit that).

Manually grep the built bundle to confirm the new class is in the output:
```bash
grep -o 'pj-btn{[^}]*}' dist/assets/content-script.ts-*.js | head -1
grep -o 'pj-right{[^}]*}' dist/assets/content-script.ts-*.js | head -1
```

Expected: both lines return the expected CSS.

- [ ] **Step 5: Commit**

```bash
git add src/content/topStrip.css
git commit -m "style(topstrip): right-cluster buttons + theme dropdown + narrow-viewport wrap"
```

---

## Task 7: Update E2E spec — replace menu-based tests with flat-layout tests

**Files:**
- Modify: `test/e2e/topstrip.spec.ts`

- [ ] **Step 1: Update the first test to assert the new flat layout**

In `test/e2e/topstrip.spec.ts`, replace the first test (lines 17–63, `'top-strip renders with rule name + env chip + toggle-group + menu on a matched page'`) with:

```ts
test('top-strip renders rule-link + template-link + flat-action buttons on a matched page', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [{
        id: 'rule-e2e',
        name: 'E2E rule',
        hostPattern: '127.0.0.1',
        pathPattern: '/**',
        templateName: 'Example',
        variables: { env: 'staging' },
        active: true,
      }],
      templates: { Example: '<h1 id="pj-rendered">rendered</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4391/internal/user/1234');
  await page.waitForSelector('#pj-topstrip-host');

  const probe = await page.evaluate(() => {
    const host = document.getElementById('pj-topstrip-host');
    const root = host?.shadowRoot;
    if (!root) {
      return {
        ruleLink: null,
        templateLink: null,
        env: null,
        hasGroup: false,
        hasCopyUrl: false,
        hasCopyJson: false,
        hasThemeTrigger: false,
        hasMenuTrigger: false,
      };
    }
    return {
      ruleLink: root.querySelector('[data-testid="pj-rule-link"]')?.textContent ?? null,
      templateLink: root.querySelector('[data-testid="pj-rule-name"]')?.textContent ?? null,
      env: root.querySelector('[data-testid="pj-env-chip"]')?.textContent ?? null,
      hasGroup: Boolean(root.querySelector('[role="group"]')),
      hasCopyUrl: Boolean(root.querySelector('[data-testid="pj-copy-url"]')),
      hasCopyJson: Boolean(root.querySelector('[data-testid="pj-copy-json"]')),
      hasThemeTrigger: Boolean(root.querySelector('[data-testid="pj-theme-trigger"]')),
      hasMenuTrigger: Boolean(root.querySelector('[data-testid="pj-menu-trigger"]')),
    };
  });

  expect(probe.ruleLink).toContain('E2E rule');
  expect(probe.templateLink).toContain('Example');
  expect(probe.env).toBe('staging');
  expect(probe.hasGroup).toBe(true);
  expect(probe.hasCopyUrl).toBe(true);
  expect(probe.hasCopyJson).toBe(true);
  expect(probe.hasThemeTrigger).toBe(true);
  expect(probe.hasMenuTrigger).toBe(false);

  await ctx.close();
});
```

- [ ] **Step 2: Delete the `'skip this host'` E2E test**

Delete the entire third `test(...)` block (lines 106–150, `'skip this host adds hostname to hostSkipList'`). Skip functionality is no longer on the strip; the popup-skip path has its own coverage.

- [ ] **Step 3: Leave the `'toggle-raw message flips the strip into raw mode'` test unchanged**

It doesn't touch the menu — it only verifies the `chrome.commands` → content-script path.

- [ ] **Step 4: Build and run the E2E suite**

Run:
```bash
pnpm build
pnpm test:e2e -- --grep topstrip
```

Expected: both remaining tests in `topstrip.spec.ts` pass. If something flakes, re-run once — Playwright's extension-loading can be racy.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/topstrip.spec.ts
git commit -m "test(e2e): update topstrip spec for flat-action layout, drop skip-host test"
```

---

## Task 8: Refresh visual-regression baselines

**Files:**
- Regenerate: `test/e2e/visual-regression.spec.ts-snapshots/*`

- [ ] **Step 1: Identify which snapshots cover the top strip**

```bash
ls test/e2e/visual-regression.spec.ts-snapshots/
```

List the filenames that include "topstrip" or "strip" or rendered-page screenshots where the strip is visible.

- [ ] **Step 2: Re-generate the affected baselines**

Playwright re-baseline command (Freshet uses `playwright.config.ts` — check the exact flag):

```bash
pnpm test:e2e -- --update-snapshots --grep "visual"
```

Expected: the snapshots for top-strip-bearing pages get overwritten with new PNGs. Non-strip snapshots should be untouched.

- [ ] **Step 3: Spot-check 1–2 regenerated PNGs visually**

Open one of the regenerated PNGs in Preview (or the finder) and confirm:
- Rule-link text is visible on the left
- Middle dot `·` separator between rule-link and template-link
- Right cluster (toggle + Copy URL + Copy JSON + theme dropdown) pinned right
- No `⋯` button

If the image looks wrong, stop and investigate the CSS before continuing.

- [ ] **Step 4: Re-run the visual-regression spec to confirm green**

```bash
pnpm test:e2e -- --grep "visual"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/visual-regression.spec.ts-snapshots/
git commit -m "test(e2e): re-baseline top-strip visual regression after layout change"
```

---

## Task 9: Full verification gate

**Files:** none modified — this is a gate.

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean. If `hostSkipList`/`skipList` or `skipHost` references remain elsewhere, TypeScript will flag them.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: clean.

- [ ] **Step 3: Run unit tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 4: Run E2E suite**

```bash
pnpm build
pnpm test:e2e
```

Expected: all pass, including any CSP smoke tests (`csp-smoke.spec.ts`, `cm-csp-smoke.spec.ts`, `topstrip-csp-smoke.spec.ts`) and a11y tests (`a11y-topstrip.spec.ts`).

If `a11y-topstrip.spec.ts` fails on contrast or missing labels, fix the `aria-label` / visible-label attributes on the new buttons before proceeding.

- [ ] **Step 5: Check dist/ freshness**

```bash
ls -la dist/assets/content-script.ts-*.js | head -2
grep -o 'pj-copy-json' dist/assets/content-script.ts-*.js | head -1
grep -o 'pj-rule-link' dist/assets/content-script.ts-*.js | head -1
```

Expected: both testids present in the bundle, file modified within the last few minutes.

---

## Task 10: Code review

**Files:** none modified — this is a review phase.

- [ ] **Step 1: Dispatch a fresh code-reviewer subagent**

Use the `superpowers:code-reviewer` agent (or equivalent). Brief it:

> Review the diff on `feature/issue-3-4-topstrip-actions` against the spec at `docs/superpowers/specs/2026-04-20-topstrip-actions-design.md` and the plan at `docs/superpowers/plans/2026-04-20-topstrip-actions.md`. Flag: deviation from spec, missing tests, dead code (especially any leftover `hostSkipList` / `skipHost` references), a11y regressions on the new buttons, CSS selector drift between `topStrip.css` and any callers, and anything that would break the CSP / shadow-DOM contracts noted in the project CLAUDE.md gotchas.

- [ ] **Step 2: Address reviewer feedback**

Fix any high-confidence issues in a follow-up commit on the same branch. If a finding is questionable, use the `superpowers:receiving-code-review` skill — don't just blindly apply.

---

## Task 11: Chrome manual verification (REQUIRED before FF-merge)

**Files:** none modified — this is a user-hand-off gate.

- [ ] **Step 1: Rebuild and reload**

```bash
pnpm build
```

Remind the user to reload Freshet at `chrome://extensions/`.

- [ ] **Step 2: Hand off to user for visual verification**

State explicitly:

> Ready for your manual Chrome check. Please:
>
> 1. Reload Freshet at chrome://extensions/
> 2. Visit a seeded demo URL, e.g. `https://mattaltermatt.github.io/freshet/examples/incidents/INC-2026-000.json`
> 3. Confirm: rule-link visible on left (should show the rule's `name` if set, else its `hostPattern`) with `↗` arrow; middle dot separator; template-link to its right with `↗`; right cluster pinned right with Rendered/Raw toggle, Copy URL, Copy JSON, and `◐ Auto ▾` theme dropdown.
> 4. Click the rule-link — should open the Options page with the Edit-rule modal open for this rule.
> 5. Click Copy URL — should copy and show toast "Copied URL to clipboard".
> 6. Click Copy JSON — should copy the raw JSON text and show toast "Copied JSON to clipboard".
> 7. Click the theme dropdown — should open a 3-item menu; pick Dark; strip + page switch to dark theme; button label updates to "Dark".
> 8. Repeat the round-trip on a dark-themed starter (`pokemon`, `country`).
> 9. Shrink the Chrome window until the strip has to wrap to 2 rows; confirm no action hides.

Wait for explicit user approval before proceeding to merge.

---

## Task 12: Ship

**Files:** none modified.

- [ ] **Step 1: Push feature branch** (routine, no explicit approval needed)

```bash
git push -u origin feature/issue-3-4-topstrip-actions
```

- [ ] **Step 2: Ask user to approve FF-merge**

Ask:
> FF-merge `feature/issue-3-4-topstrip-actions` to main and push? (y/n)

On approval:

```bash
git checkout main
git merge --ff-only feature/issue-3-4-topstrip-actions
git push origin main
git branch -d feature/issue-3-4-topstrip-actions
git push origin --delete feature/issue-3-4-topstrip-actions
```

- [ ] **Step 3: Watch Pages deploy** (`docs/superpowers/specs/...` did change — Jekyll needs to rebuild)

Use the `verify-pages-deploy` skill. Expected: green, site returns 200.

- [ ] **Step 4: Ask user to approve GitHub issue actions**

Per the "GitHub write actions require explicit approval" gate, ask:
> Approve comment + close on #3 and #4? (y/n)

On approval, comment on each issue with a one-paragraph summary linking the merge commit, then `gh issue close 3 --repo MattAltermatt/freshet` and `gh issue close 4 --repo MattAltermatt/freshet`.

- [ ] **Step 5: Prune feature branch from local state if anything remains**

```bash
git branch --merged main
git fetch --prune
```
