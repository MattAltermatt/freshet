# Phase 2, Plan 4 — Popup Rewrite Implementation Plan

> **Status:** Shipped 2026-04-18 on `feature/phase2-plan4-popup` → `main`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled `src/popup/popup.ts` DOM code with a Preact popup that delivers the locked UX spec: brand header, active-tab match status with an orange rule chip + *Edit rule* deep-link, *+ Add rule for this host* CTA on no-match, per-host skip toggle, test-URL quick-jump that hands off to the options URL tester, theme-reactive from day one. Popup must reuse the `src/ui/` primitives from Plans 1/3 and converge `.sync`-area data via `promoteStorageToLocal()` on boot (see CLAUDE.md gotcha).

**Scope clarifications vs. the Phase 2 spec:**
- Engine swap (spec Rollout step 2) shipped as Plan 2 with **LiquidJS**. No Handlebars references leak into popup wiring.
- Rendered top-strip is explicitly **out of scope** — Plan 5.
- Phase 7 QOL candidates that fit here:
  - **"Create rule from current page"** — folded in as the *No rule matches · [+ Add rule for this host]* CTA, which hands off to the options page with the current tab's hostname pre-filled into a new-rule modal.
  - **"Page is being rendered" indicator (action badge)** — the matched-rule chip delivers this inside the popup. A full `chrome.action.setBadgeText` treatment (visible without opening the popup) stays in Phase 7 backlog; this plan does not add background wiring for the badge.
- Popup does **not** own global toasts — the popup window is ~280×240 and closes on blur, so the Saved ✓ / Undo pipeline from Plan 3 has no surface here. State writes go straight through `useStorage`; the options page shows the toast if it's open.

**Architecture:**
- One Preact root mounted from `src/popup/popup.tsx` into `<div id="app">` inside `src/popup/popup.html`.
- Top-level `Popup.tsx` owns boot, theme provider, and the active-tab read.
- Active-tab URL is read once via `chrome.tabs.query({ active: true, currentWindow: true })` at mount — popup is transient, so no subscription is needed for tab changes.
- `rules` + `hostSkipList` + `settings` come from `useStorage` — same hook used by the options page. `chrome.storage.onChanged` keeps the popup reactive to edits made in the options page while the popup happens to still be open.
- `promoteStorageToLocal()` runs at boot before the Preact tree renders, identical pattern to `src/options/App.tsx`. Any `.sync`-area legacy data converges into `.local` so `useStorage` reads authoritative values.
- Cross-surface handoff from popup → options uses a URL-hash directive protocol on the options page. The popup opens `chrome.runtime.getURL('src/options/options.html') + '#<directive>'` via `chrome.tabs.create`; the options page parses the hash on first paint, applies the directive (open rule modal, pre-fill host, pre-fill URL tester), then clears the hash so reload doesn't re-trigger. `chrome.runtime.openOptionsPage()` is *not* used because it doesn't accept a URL fragment.
- Styling: same `--pj-*` CSS custom properties from `src/ui/theme.css`. Popup-specific layout rules live in `src/popup/popup.css`. Popup stays in the light/dark token set — no new tokens.
- No shadow DOM: the popup has its own browser-action document, so host-page CSS can't leak in.

**Tech Stack:** Preact 10 (existing), existing `src/ui/` primitives (`Toggle`, `Button`, `useStorage`, `useTheme`), Playwright for E2E, `@axe-core/playwright` for a11y. No new runtime dependencies.

**Critical de-risk path:** Task 4 is a "popup boots under MV3 CSP" smoke test. The options page already proved Preact + CodeMirror load cleanly (Plan 3, Task 3), so Preact-only popup is low-risk — but one E2E catches any surprise from the action-popup context (e.g., popup HTML served from a different URL shape than the options page). All remaining tasks depend on this pass.

**Phases (roadmap-style, strategic):**

1. **Foundation** — spec branch (this doc), impl branch, scaffolding. (Tasks 1–2)
2. **De-risk** — popup Preact boot smoke test under MV3 CSP. (Tasks 3–4)
3. **Popup UI** — `Popup.tsx`, URL block (middle-truncated), match chip / add-rule CTA, skip toggle, URL quick-jump, footer. (Tasks 5–11)
4. **Options-page directive router** — parse URL-hash directives, seed the Rules tab with the right URL-tester text / open the right modal / prefill new-rule host. (Tasks 12–15)
5. **Popup ↔ options handoff wiring** — popup buttons trigger the right directives via `chrome.tabs.create`. (Tasks 16–17)
6. **E2E + accessibility** — Playwright popup-context tests, axe-core sweep. (Tasks 18–21)
7. **Code review + docs + FF-merge** — fresh reviewer agent, README/CLAUDE.md/ROADMAP update. (Tasks 22–25)

**Todos (current tactical focus):** Task 1 (branch) → Task 4 (CSP smoke). Everything downstream gates on that proof.

---

## Task 1: FF-merge this spec, cut impl branch

This plan currently lives on `feature/phase2-plan4-spec`. After Matt reviews and FF-merges the spec to `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/phase2-plan4-popup
```

All subsequent tasks commit on `feature/phase2-plan4-popup`. Push the branch to origin for backup after Task 5.

---

## Task 2: Remove the legacy popup files from the impl branch

**Files:**
- Delete: `src/popup/popup.ts`
- Modify: `src/popup/popup.html` (will be rewritten in Task 3; delete its content for now)

- [ ] **Step 2.1: Delete the hand-rolled popup**

```bash
rm src/popup/popup.ts
```

- [ ] **Step 2.2: Verify the manifest still points at `src/popup/popup.html`**

Grep `vite.config.ts` — the `action.default_popup` line must still read `'src/popup/popup.html'`. No change needed; this is just a guard against accidental breakage.

- [ ] **Step 2.3: Commit**

```bash
git add -A
git commit -m "popup: drop legacy imperative entry (rewrite inbound)"
```

---

## Task 3: Popup HTML + Preact entry scaffold

**Files:**
- Modify: `src/popup/popup.html`
- Create: `src/popup/popup.tsx`
- Create: `src/popup/Popup.tsx` (empty shell — real UI lands in Task 5+)
- Create: `src/popup/popup.css`

- [ ] **Step 3.1: Write `src/popup/popup.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Present-JSON</title>
    <link rel="stylesheet" href="../ui/theme.css" />
    <link rel="stylesheet" href="./popup.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./popup.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3.2: Write `src/popup/popup.tsx`**

```tsx
import { render } from 'preact';
import { Popup } from './Popup';

const host = document.getElementById('app');
if (!host) throw new Error('Missing #app host');
render(<Popup />, host);
```

- [ ] **Step 3.3: Write the `Popup` shell**

`src/popup/Popup.tsx`:

```tsx
import type { JSX } from 'preact';

export function Popup(): JSX.Element {
  return (
    <div class="pj-popup">
      <p class="pj-popup-placeholder">Popup (scaffold)</p>
    </div>
  );
}
```

- [ ] **Step 3.4: Write `src/popup/popup.css`**

```css
html, body { margin: 0; padding: 0; }
body {
  width: 320px;
  font: 13px/1.4 -apple-system, system-ui, sans-serif;
  background: var(--pj-bg);
  color: var(--pj-fg);
}

.pj-popup { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.pj-popup-placeholder { margin: 0; color: var(--pj-muted); }
```

- [ ] **Step 3.5: Verify the scaffold builds**

```bash
pnpm build
```

Expected: build succeeds, `dist/src/popup/popup.html` exists, no CSS/TS errors.

- [ ] **Step 3.6: Commit**

```bash
git add src/popup/popup.html src/popup/popup.tsx src/popup/Popup.tsx src/popup/popup.css
git commit -m "popup: preact scaffold"
```

---

## Task 4: CSP smoke — popup boots under MV3

**Purpose:** prove the Preact popup loads from the action-popup context under MV3 CSP. Mirrors `test/e2e/cm-csp-smoke.spec.ts` (Plan 3 Task 3) but for the popup URL. All downstream tasks gate on this pass.

**Files:**
- Create: `test/e2e/popup-csp-smoke.spec.ts`

- [ ] **Step 4.1: Write the failing test**

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

test('popup boots under MV3 CSP', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;

  const page = await ctx.newPage();
  const cspViolations: string[] = [];
  page.on('console', (msg) => {
    const t = msg.text().toLowerCase();
    if (t.includes('content security policy') || t.includes('unsafe-eval')) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  await expect(page.locator('.pj-popup')).toBeVisible({ timeout: 5000 });

  expect(cspViolations, `CSP violations: ${cspViolations.join('\n')}`).toEqual([]);
  await ctx.close();
});
```

- [ ] **Step 4.2: Build + run**

```bash
pnpm build
pnpm test:e2e test/e2e/popup-csp-smoke.spec.ts
```

Expected: passes. If it fails, do not proceed. Investigate before writing more popup code.

- [ ] **Step 4.3: Commit**

```bash
git add test/e2e/popup-csp-smoke.spec.ts
git commit -m "test(e2e): popup preact boot csp smoke"
```

---

## Task 5: Storage promotion + active-tab read at boot

**Files:**
- Modify: `src/popup/Popup.tsx`

The popup needs the same `.sync` → `.local` convergence the options page runs, or a fresh install's seed data will be invisible in the popup (see `src/options/storagePromote.ts` gotcha). Read the active tab URL once at mount — popup is short-lived.

- [ ] **Step 5.1: Update `Popup.tsx`**

```tsx
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { promoteStorageToLocal } from '../options/storagePromote';

interface ActiveTab {
  url: string;
  host: string;
}

function readActiveTab(): Promise<ActiveTab> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? '';
      let host = '';
      try {
        host = url ? new URL(url).hostname : '';
      } catch {
        host = '';
      }
      resolve({ url, host });
    });
  });
}

export function Popup(): JSX.Element {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<ActiveTab>({ url: '', host: '' });

  useEffect(() => {
    void Promise.all([promoteStorageToLocal(), readActiveTab()]).then(([, t]) => {
      setTab(t);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <div class="pj-popup pj-popup--booting">
        <p class="pj-popup-placeholder">Loading…</p>
      </div>
    );
  }

  return (
    <div class="pj-popup">
      <p class="pj-popup-placeholder">Tab: {tab.url || '(no URL)'}</p>
    </div>
  );
}
```

- [ ] **Step 5.2: Build + reload extension + eyeball**

```bash
pnpm build
```

Per memory: remind Matt to reload at `chrome://extensions/` (toggle off/on or click refresh) before clicking the action icon. Expected: popup shows the current tab's URL.

- [ ] **Step 5.3: Commit**

```bash
git add src/popup/Popup.tsx
git commit -m "popup: storage promote + active-tab read on boot"
```

---

## Task 6: Extract `promoteStorageToLocal` into a shared location

**Files:**
- Create: `src/storage/promoteStorageToLocal.ts`
- Modify: `src/options/storagePromote.ts` (re-export thin shim, or delete + fix imports)
- Modify: `src/popup/Popup.tsx` (import path)
- Modify: `src/options/App.tsx` (import path)

Popup importing from `src/options/` crosses surface boundaries. Move the helper to `src/storage/` where it logically belongs (Plan 5 will also need it from the content script).

- [ ] **Step 6.1: Move the file**

```bash
git mv src/options/storagePromote.ts src/storage/promoteStorageToLocal.ts
```

- [ ] **Step 6.2: Update imports**

In `src/options/App.tsx`:

```ts
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
```

In `src/popup/Popup.tsx`:

```ts
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
```

- [ ] **Step 6.3: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all green. If the existing options test (`src/options/Header.test.tsx` etc.) referenced the old path, fix.

- [ ] **Step 6.4: Commit**

```bash
git add -A
git commit -m "refactor: share promoteStorageToLocal across surfaces"
```

---

## Task 7: URL middle-truncation helper + tests

**Files:**
- Create: `src/shared/truncateUrl.ts`
- Create: `src/shared/truncateUrl.test.ts`

Purpose: show a long URL in a 280 px popup without losing the meaningful tail (`…/v2/users/123`). Pure util, unit-testable, no DOM.

- [ ] **Step 7.1: Write the failing tests**

`src/shared/truncateUrl.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { truncateUrlMiddle } from './truncateUrl';

describe('truncateUrlMiddle', () => {
  it('returns the url unchanged when within max', () => {
    expect(truncateUrlMiddle('https://a.com/x', 40)).toBe('https://a.com/x');
  });

  it('truncates the middle with an ellipsis when too long', () => {
    const url = 'https://api.github.com/repos/MattAltermatt/present-json/issues/123';
    const out = truncateUrlMiddle(url, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out).toContain('…');
    expect(out.startsWith('https://')).toBe(true);
    expect(out.endsWith('/issues/123')).toBe(true);
  });

  it('keeps the leading scheme+host and the trailing path', () => {
    const out = truncateUrlMiddle('https://very.long.example.com/a/b/c/d/e/f/g/h/i/j/k', 30);
    expect(out).toMatch(/^https:\/\/very\.long/);
    expect(out).toMatch(/k$/);
    expect(out).toContain('…');
  });

  it('handles short max gracefully', () => {
    expect(truncateUrlMiddle('https://example.com/path', 10)).toBe('https:…path');
  });
});
```

- [ ] **Step 7.2: Run to verify failure**

```bash
pnpm test src/shared/truncateUrl.test.ts
```

Expected: FAIL — `truncateUrl` module not found.

- [ ] **Step 7.3: Write the implementation**

`src/shared/truncateUrl.ts`:

```ts
/**
 * Middle-truncate a URL string so it fits in `max` characters.
 * Preserves the leading scheme+host and the trailing path segment
 * so the "where it's going" stays readable.
 */
export function truncateUrlMiddle(url: string, max: number): string {
  if (url.length <= max) return url;
  if (max < 5) return url.slice(0, max);
  const keep = max - 1; // room for the ellipsis
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${url.slice(0, head)}…${url.slice(url.length - tail)}`;
}
```

- [ ] **Step 7.4: Run tests**

```bash
pnpm test src/shared/truncateUrl.test.ts
```

Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/shared/truncateUrl.ts src/shared/truncateUrl.test.ts
git commit -m "shared: middle-truncate url helper"
```

---

## Task 8: Header + URL block

**Files:**
- Modify: `src/popup/Popup.tsx`
- Modify: `src/popup/popup.css`

Render the `{>` brand header and the truncated active-tab URL. No interactivity yet.

- [ ] **Step 8.1: Update `Popup.tsx` — inject header + URL block before the placeholder**

Replace the post-boot return block:

```tsx
return (
  <div class="pj-popup">
    <header class="pj-popup-header">
      <span class="pj-logo" aria-hidden="true">
        <span class="pj-logo-brace">{'{'}</span>
        <span class="pj-logo-bracket">{'>'}</span>
      </span>
      <h1>Present-JSON</h1>
    </header>
    <section class="pj-popup-url" aria-label="Active tab URL">
      <span class="pj-popup-label">Tab URL</span>
      <code class="pj-popup-url-text" title={tab.url}>
        {tab.url ? truncateUrlMiddle(tab.url, 44) : '(no URL)'}
      </code>
    </section>
  </div>
);
```

Add the import:

```ts
import { truncateUrlMiddle } from '../shared/truncateUrl';
```

- [ ] **Step 8.2: Extend `popup.css`**

```css
.pj-popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pj-popup-header h1 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  color: var(--pj-fg);
}
.pj-logo { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px; line-height: 1; }
.pj-logo-brace { color: var(--pj-fg); }
.pj-logo-bracket { color: var(--pj-accent); margin-left: 1px; }

.pj-popup-url { display: flex; flex-direction: column; gap: 2px; }
.pj-popup-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--pj-muted);
}
.pj-popup-url-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--pj-fg);
  word-break: break-all;
}
```

- [ ] **Step 8.3: Eyeball**

Rebuild, reload extension, open popup. Expected: brand header, then `Tab URL` label, then truncated URL.

- [ ] **Step 8.4: Commit**

```bash
git add src/popup/Popup.tsx src/popup/popup.css
git commit -m "popup: brand header + truncated url block"
```

---

## Task 9: Match status block — rule chip + Edit rule link OR +Add CTA

**Files:**
- Modify: `src/popup/Popup.tsx`
- Modify: `src/popup/popup.css`

Compute the matched rule from `useStorage` + `match()` and render either:
- **Match:** orange rule chip + "Edit rule" button (opens options with rule-edit directive).
- **No match:** muted text + "+ Add rule for this host" button.

Handler wiring to the options page happens in Task 16; for now the buttons are inert but rendered.

- [ ] **Step 9.1: Extend `Popup.tsx`**

Add imports:

```ts
import { useStorage } from '../ui';
import type { Rule } from '../shared/types';
import { findMatchingRule } from '../matcher/matcher';
```

Inside the component, after `useEffect`:

```tsx
const [rules] = useStorage<'rules', Rule[]>('rules', []);

const matched = (() => {
  if (!tab.url) return null;
  try {
    const u = new URL(tab.url);
    return findMatchingRule(u.hostname, u.pathname, rules);
  } catch {
    return null;
  }
})();
```

Render after the URL block:

```tsx
<section class="pj-popup-match" aria-label="Match status">
  <span class="pj-popup-label">Matched rule</span>
  {matched ? (
    <div class="pj-popup-match-row">
      <span class="pj-rule-chip">{matched.templateName || matched.id}</span>
      <button
        type="button"
        class="pj-linkish"
        onClick={() => {/* Task 16 */}}
      >
        Edit rule
      </button>
    </div>
  ) : (
    <div class="pj-popup-match-row">
      <span class="pj-popup-miss">No rule matches this URL</span>
      <button
        type="button"
        class="pj-btn pj-btn--accent"
        disabled={!tab.host}
        onClick={() => {/* Task 16 */}}
      >
        + Add rule for this host
      </button>
    </div>
  )}
</section>
```

- [ ] **Step 9.2: Extend `popup.css`**

```css
.pj-popup-match { display: flex; flex-direction: column; gap: 4px; }
.pj-popup-match-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.pj-rule-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--pj-accent);
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
}

.pj-popup-miss { color: var(--pj-muted); font-style: italic; }

.pj-linkish {
  background: none;
  border: none;
  padding: 0;
  color: var(--pj-accent-strong);
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
}
.pj-linkish:hover { color: var(--pj-accent); }

.pj-btn {
  padding: 4px 10px;
  border: 1px solid var(--pj-border);
  border-radius: 6px;
  background: var(--pj-surface);
  color: var(--pj-fg);
  font: inherit;
  cursor: pointer;
}
.pj-btn:hover:not(:disabled) { background: var(--pj-surface-hover); }
.pj-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.pj-btn--accent {
  background: var(--pj-accent-strong);
  border-color: var(--pj-accent-strong);
  color: #fff;
}
.pj-btn--accent:hover:not(:disabled) { background: var(--pj-accent); border-color: var(--pj-accent); }
```

**Note:** The `--pj-accent-strong` token is the AA-contrast orange (CLAUDE.md gotcha). Use it anywhere small text sits on an orange button or link, as done here.

- [ ] **Step 9.3: Eyeball two cases**

With a rule that matches the active tab → chip + Edit link.
On a tab with no match → "No rule matches" + "+ Add rule for this host" button.

If the local fixture server is running (`pnpm fixtures`), navigate to `http://127.0.0.1:4391/internal/user/1234` to exercise the match path.

- [ ] **Step 9.4: Commit**

```bash
git add src/popup/Popup.tsx src/popup/popup.css
git commit -m "popup: match status block (chip / add-rule cta)"
```

---

## Task 10: Per-host skip toggle

**Files:**
- Modify: `src/popup/Popup.tsx`
- Modify: `src/popup/popup.css`

Reuse the shared `Toggle` primitive from `src/ui/`. Writes through `useStorage` to `hostSkipList`. Toggle is disabled if `tab.host` is empty (e.g., `chrome://` pages).

- [ ] **Step 10.1: Extend `Popup.tsx`**

Add imports:

```ts
import { Toggle, useStorage } from '../ui';
import type { HostSkipList, Rule } from '../shared/types';
```

Inside the component:

```tsx
const [skipList, writeSkipList] = useStorage<'hostSkipList', HostSkipList>(
  'hostSkipList',
  [],
);
const skipped = tab.host ? skipList.includes(tab.host) : false;

const toggleSkip = async (next: boolean): Promise<void> => {
  if (!tab.host) return;
  const updated = next
    ? Array.from(new Set([...skipList, tab.host]))
    : skipList.filter((h) => h !== tab.host);
  await writeSkipList(updated);
};
```

Render after the match block:

```tsx
<section class="pj-popup-skip" aria-label="Skip toggle">
  <Toggle
    checked={skipped}
    onChange={(next) => void toggleSkip(next)}
    disabled={!tab.host}
    label={
      tab.host
        ? `Skip Present-JSON on ${tab.host}`
        : 'Skip toggle unavailable on this page'
    }
  />
</section>
```

Check `src/ui/components/Toggle.tsx` for the actual prop names — if the primitive uses `onToggle` or a different signature, match it here. (Adjust the JSX accordingly.)

- [ ] **Step 10.2: Extend `popup.css`**

```css
.pj-popup-skip { padding-top: 2px; }
```

- [ ] **Step 10.3: Eyeball**

Toggle on a known host, close popup, reopen → toggle persists. Re-render the host in another tab → content script respects the skip list.

- [ ] **Step 10.4: Commit**

```bash
git add src/popup/Popup.tsx src/popup/popup.css
git commit -m "popup: per-host skip toggle"
```

---

## Task 11: Test-URL quick-jump + footer

**Files:**
- Modify: `src/popup/Popup.tsx`
- Modify: `src/popup/popup.css`

Small input pre-filled with the active tab URL. The "Test in options" button (wired in Task 16) hands off the string to the options URL tester. The footer has a plain "Open options" link.

- [ ] **Step 11.1: Extend `Popup.tsx`**

Inside the component:

```tsx
const [testUrl, setTestUrl] = useState<string>('');
useEffect(() => {
  if (tab.url) setTestUrl(tab.url);
}, [tab.url]);
```

Render after the skip block:

```tsx
<section class="pj-popup-test" aria-label="Test URL in options">
  <label class="pj-popup-label" for="pj-popup-test-url">Test URL</label>
  <div class="pj-popup-test-row">
    <input
      id="pj-popup-test-url"
      type="text"
      class="pj-popup-test-input"
      value={testUrl}
      onInput={(e) => setTestUrl((e.target as HTMLInputElement).value)}
      placeholder="https://…"
    />
    <button
      type="button"
      class="pj-btn"
      disabled={!testUrl.trim()}
      onClick={() => {/* Task 16 */}}
    >
      Test in options
    </button>
  </div>
</section>

<footer class="pj-popup-footer">
  <button type="button" class="pj-linkish" onClick={() => chrome.runtime.openOptionsPage()}>
    Open options
  </button>
</footer>
```

- [ ] **Step 11.2: Extend `popup.css`**

```css
.pj-popup-test { display: flex; flex-direction: column; gap: 4px; }
.pj-popup-test-row { display: flex; gap: 6px; }
.pj-popup-test-input {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid var(--pj-border);
  border-radius: 6px;
  background: var(--pj-surface);
  color: var(--pj-fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}
.pj-popup-test-input:focus {
  outline: 2px solid var(--pj-accent);
  outline-offset: 1px;
}

.pj-popup-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--pj-border);
}
```

- [ ] **Step 11.3: Eyeball**

Pre-fill = current URL. Edit text and confirm input updates. "Open options" link opens the options page (existing behavior via `openOptionsPage`).

- [ ] **Step 11.4: Commit**

```bash
git add src/popup/Popup.tsx src/popup/popup.css
git commit -m "popup: test-url quick-jump + footer"
```

---

## Task 12: Options-page directive router — plumbing

**Files:**
- Create: `src/options/directives.ts`
- Create: `src/options/directives.test.ts`

The popup hands off state via the options-page URL hash. Define the parser and a directive type here in pure TS (no DOM), unit-testable.

**Directive format** (URL fragment on `options.html`):
- `#test-url=<encodeURIComponent(url)>` — open Rules tab, pre-fill URL tester.
- `#new-rule:host=<encodeURIComponent(host)>` — open Rules tab, open RuleEditModal in *new* mode with `hostPattern` pre-filled.
- `#edit-rule=<encodeURIComponent(ruleId)>` — open Rules tab, open RuleEditModal in *edit* mode for that rule.

Unknown / empty hash: no-op.

- [ ] **Step 12.1: Write the failing tests**

`src/options/directives.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseDirective } from './directives';

describe('parseDirective', () => {
  it('returns null for empty hash', () => {
    expect(parseDirective('')).toBeNull();
    expect(parseDirective('#')).toBeNull();
  });

  it('returns null for unknown directive', () => {
    expect(parseDirective('#huh')).toBeNull();
  });

  it('parses test-url', () => {
    const encoded = encodeURIComponent('https://api.github.com/repos/x');
    expect(parseDirective(`#test-url=${encoded}`)).toEqual({
      kind: 'test-url',
      url: 'https://api.github.com/repos/x',
    });
  });

  it('parses new-rule with host', () => {
    const encoded = encodeURIComponent('api.example.com');
    expect(parseDirective(`#new-rule:host=${encoded}`)).toEqual({
      kind: 'new-rule',
      host: 'api.example.com',
    });
  });

  it('parses edit-rule', () => {
    const encoded = encodeURIComponent('rule-1712-abc');
    expect(parseDirective(`#edit-rule=${encoded}`)).toEqual({
      kind: 'edit-rule',
      ruleId: 'rule-1712-abc',
    });
  });

  it('rejects malformed test-url (non-URI)', () => {
    expect(parseDirective('#test-url=%E0%A4%A')).toBeNull();
  });
});
```

- [ ] **Step 12.2: Run to verify failure**

```bash
pnpm test src/options/directives.test.ts
```

Expected: FAIL.

- [ ] **Step 12.3: Write the implementation**

`src/options/directives.ts`:

```ts
export type OptionsDirective =
  | { kind: 'test-url'; url: string }
  | { kind: 'new-rule'; host: string }
  | { kind: 'edit-rule'; ruleId: string };

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function parseDirective(hash: string): OptionsDirective | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  if (raw.startsWith('test-url=')) {
    const url = safeDecode(raw.slice('test-url='.length));
    if (!url) return null;
    return { kind: 'test-url', url };
  }

  if (raw.startsWith('new-rule:host=')) {
    const host = safeDecode(raw.slice('new-rule:host='.length));
    if (!host) return null;
    return { kind: 'new-rule', host };
  }

  if (raw.startsWith('edit-rule=')) {
    const ruleId = safeDecode(raw.slice('edit-rule='.length));
    if (!ruleId) return null;
    return { kind: 'edit-rule', ruleId };
  }

  return null;
}

/** Build directive URLs for popup → options handoff. */
export const directiveHash = {
  testUrl: (url: string): string => `#test-url=${encodeURIComponent(url)}`,
  newRule: (host: string): string => `#new-rule:host=${encodeURIComponent(host)}`,
  editRule: (ruleId: string): string => `#edit-rule=${encodeURIComponent(ruleId)}`,
};
```

- [ ] **Step 12.4: Run tests**

```bash
pnpm test src/options/directives.test.ts
```

Expected: PASS.

- [ ] **Step 12.5: Commit**

```bash
git add src/options/directives.ts src/options/directives.test.ts
git commit -m "options: url-hash directive parser"
```

---

## Task 13: Apply directive on options-page boot

**Files:**
- Modify: `src/options/App.tsx`

Read `location.hash` once on mount, parse it, stash the result in state, and clear the hash so reload doesn't re-trigger. Pass the directive down to `RulesTab` (Task 14 handles consumption).

- [ ] **Step 13.1: Update `App.tsx`**

Add import:

```ts
import { parseDirective, type OptionsDirective } from './directives';
```

Inside the component:

```tsx
const [directive, setDirective] = useState<OptionsDirective | null>(null);
useEffect(() => {
  const d = parseDirective(window.location.hash);
  if (d) {
    setDirective(d);
    // Clear hash so reload is a clean boot.
    window.history.replaceState(null, '', window.location.pathname);
  }
}, []);
```

Force the Rules tab when a directive exists:

```tsx
useEffect(() => {
  if (directive) setTab('rules');
}, [directive]);
```

Pass the directive into `RulesTab` (add a new prop — Task 14 adds the consumer):

```tsx
<RulesTab
  rules={rules}
  templates={templates}
  onChange={(next) => void writeRules(next)}
  onDelete={(index) => handleRuleDelete(index)}
  directive={directive}
  onDirectiveHandled={() => setDirective(null)}
/>
```

- [ ] **Step 13.2: Verify typecheck fails where expected**

```bash
pnpm typecheck
```

Expected: typecheck errors in `RulesTab.tsx` about unknown props. That's correct — Task 14 fixes it.

- [ ] **Step 13.3: Commit (intentionally failing typecheck; Task 14 closes it)**

```bash
git add src/options/App.tsx
git commit -m "options: parse url-hash directive on boot (wip typecheck red)"
```

---

## Task 14: RulesTab consumes the directive

**Files:**
- Modify: `src/options/rules/RulesTab.tsx`
- Modify: `src/options/rules/UrlTester.tsx` (accept `initialUrl` prop)

- [ ] **Step 14.1: Inspect current `RulesTab` signature**

Read `src/options/rules/RulesTab.tsx` to find the modal-open handler and the URL-tester mount point. The file already owns modal open/close state and renders `<UrlTester rules={rules} />`.

- [ ] **Step 14.2: Accept `initialUrl` on `UrlTester`**

In `src/options/rules/UrlTester.tsx`:

```tsx
export interface UrlTesterProps {
  rules: Rule[];
  initialUrl?: string;
}

export function UrlTester({ rules, initialUrl }: UrlTesterProps): JSX.Element {
  const [url, setUrl] = useState(initialUrl ?? '');
  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);
  // …existing body unchanged below…
}
```

Add `useEffect` to the existing imports if not already present.

- [ ] **Step 14.3: Extend `RulesTab` props + wire up**

Add to the props interface:

```ts
import type { OptionsDirective } from '../directives';
import { useEffect, useState } from 'preact/hooks';

export interface RulesTabProps {
  rules: Rule[];
  templates: Templates;
  onChange: (next: Rule[]) => void;
  onDelete: (index: number) => void;
  directive?: OptionsDirective | null;
  onDirectiveHandled?: () => void;
}
```

Inside the component:

```tsx
const [testerUrl, setTesterUrl] = useState<string>('');
const [editingRule, setEditingRule] = useState<Rule | 'new' | null>(null);
const [newRuleHost, setNewRuleHost] = useState<string>('');

useEffect(() => {
  if (!directive) return;
  if (directive.kind === 'test-url') {
    setTesterUrl(directive.url);
  } else if (directive.kind === 'new-rule') {
    setNewRuleHost(directive.host);
    setEditingRule('new');
  } else if (directive.kind === 'edit-rule') {
    const target = rules.find((r) => r.id === directive.ruleId);
    if (target) setEditingRule(target);
  }
  onDirectiveHandled?.();
}, [directive]);
```

Render `<UrlTester rules={rules} initialUrl={testerUrl} />` and the existing `<RuleEditModal>` with `initial` set based on `editingRule` + the new `initialHost` prop (Task 15).

If `RulesTab` already owns the modal open state under a different variable name, adapt — don't introduce a parallel state path.

- [ ] **Step 14.4: Verify**

```bash
pnpm typecheck && pnpm test
```

Expected: green. Options CRUD unit / component tests still pass.

- [ ] **Step 14.5: Commit**

```bash
git add src/options/rules/RulesTab.tsx src/options/rules/UrlTester.tsx
git commit -m "options: rules tab honors url-hash directive"
```

---

## Task 15: RuleEditModal accepts pre-filled host

**Files:**
- Modify: `src/options/rules/RuleEditModal.tsx`

When opened in new-rule mode with a pre-filled host, seed `rule.hostPattern` with the given string.

- [ ] **Step 15.1: Extend props**

```tsx
export interface RuleEditModalProps {
  initial: Rule | null;
  initialHost?: string;
  templates: Templates;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}

function blankRule(templates: Templates, host?: string): Rule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hostPattern: host ?? '',
    pathPattern: '/',
    templateName: Object.keys(templates)[0] ?? '',
    variables: {},
    enabled: true,
  };
}

export function RuleEditModal({
  initial,
  initialHost,
  templates,
  onSave,
  onCancel,
}: RuleEditModalProps): JSX.Element {
  const [rule, setRule] = useState<Rule>(() =>
    initial ? structuredClone(initial) : blankRule(templates, initialHost),
  );
  // …rest unchanged
```

- [ ] **Step 15.2: Verify the prop flows from `RulesTab`**

In `RulesTab.tsx`, when opening the modal in new mode triggered by the `new-rule` directive, pass `initialHost={newRuleHost}`. Clear `newRuleHost` to `''` in the modal's `onCancel` / `onSave` handlers so a subsequent "+ Add rule" (non-directive) starts blank.

- [ ] **Step 15.3: Verify**

```bash
pnpm typecheck && pnpm test
```

Expected: green.

- [ ] **Step 15.4: Commit**

```bash
git add src/options/rules/RuleEditModal.tsx src/options/rules/RulesTab.tsx
git commit -m "options: rule-edit modal accepts prefilled host"
```

---

## Task 16: Wire popup buttons to open options with a directive

**Files:**
- Modify: `src/popup/Popup.tsx`

Replace the three `{/* Task 16 */}` placeholder handlers with real `chrome.tabs.create` calls pointing at `options.html` + the appropriate hash.

- [ ] **Step 16.1: Import the hash builder**

```ts
import { directiveHash } from '../options/directives';
```

- [ ] **Step 16.2: Add an `openOptionsAt` helper**

Inside `Popup.tsx`:

```ts
function openOptionsAt(hash: string): void {
  const url = chrome.runtime.getURL('src/options/options.html') + hash;
  void chrome.tabs.create({ url });
  window.close();
}
```

`window.close()` closes the popup — standard UX for "I just launched a new tab".

- [ ] **Step 16.3: Wire the three buttons**

Edit rule:

```tsx
onClick={() => matched && openOptionsAt(directiveHash.editRule(matched.id))}
```

Add rule for this host:

```tsx
onClick={() => openOptionsAt(directiveHash.newRule(tab.host))}
```

Test in options:

```tsx
onClick={() => openOptionsAt(directiveHash.testUrl(testUrl.trim()))}
```

- [ ] **Step 16.4: Eyeball all three hand-offs**

Rebuild, reload extension. For each button: click, confirm a new tab opens on the options page, and the right thing happens (modal open for edit, modal open with host prefilled for add, URL tester pre-filled for test).

- [ ] **Step 16.5: Commit**

```bash
git add src/popup/Popup.tsx
git commit -m "popup: wire buttons to options-page directives"
```

---

## Task 17: Popup component test — pure rendering

**Files:**
- Create: `src/popup/Popup.test.tsx`

Unit test the match/no-match branches against a mocked `chrome` global. Don't try to test `chrome.tabs.create` — that's E2E territory.

- [ ] **Step 17.1: Write the test**

```tsx
import { render, screen, waitFor } from '@testing-library/preact';
import { vi, beforeEach, test, expect } from 'vitest';
import { Popup } from './Popup';

function mockChrome(overrides: Partial<typeof chrome> = {}): void {
  (globalThis as any).chrome = {
    tabs: {
      query: (_q: any, cb: any) =>
        cb([{ url: 'http://127.0.0.1:4391/internal/user/1' }]),
      create: vi.fn(),
    },
    storage: {
      local: {
        get: (keys: any, cb: any) => {
          if (typeof keys === 'string') {
            cb({ [keys]: keys === 'rules' ? [] : keys === 'hostSkipList' ? [] : undefined });
          } else {
            cb({});
          }
        },
        set: (_patch: any, cb?: any) => cb?.(),
      },
      sync: {
        get: (_keys: any, cb: any) => cb({}),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      openOptionsPage: vi.fn(),
      getURL: (p: string) => `chrome-extension://fake/${p}`,
    },
    ...overrides,
  };
}

beforeEach(() => mockChrome());

test('shows no-match CTA when rules is empty', async () => {
  render(<Popup />);
  await waitFor(() =>
    expect(screen.getByText(/No rule matches this URL/)).toBeInTheDocument(),
  );
  expect(screen.getByText('+ Add rule for this host')).toBeInTheDocument();
});
```

Note: extending this to test the match path requires seeding `rules` in the storage mock. Leave that for E2E (Task 20) — unit-testing the render branches is enough here, and setting up `useStorage`'s first-render delay in JSDOM is finicky.

- [ ] **Step 17.2: Run**

```bash
pnpm test src/popup/Popup.test.tsx
```

Expected: PASS.

- [ ] **Step 17.3: Commit**

```bash
git add src/popup/Popup.test.tsx
git commit -m "popup: component test — no-match render path"
```

---

## Task 18: E2E — popup status block with a seeded match

**Files:**
- Create: `test/e2e/popup.spec.ts`

Load the extension, seed a rule + template via `chrome.storage.local.set` from the background context, open the popup URL directly, assert the rule chip renders.

- [ ] **Step 18.1: Write the failing test**

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

test('popup shows matched-rule chip for a seeded rule', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;

  // Seed storage via the service-worker context.
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [{
        id: 'rule-seed',
        hostPattern: '*.example.com',
        pathPattern: '/**',
        templateName: 'Example',
        variables: {},
        enabled: true,
      }],
      templates: { Example: '<h1>x</h1>' },
      hostSkipList: [],
    });
  });

  // Load a page so "active tab" has a URL that matches the seeded rule.
  const page = await ctx.newPage();
  await page.goto('https://api.example.com/v1/thing');

  // Navigate to the popup URL in the same tab (standalone harness — Playwright
  // can't drive the Chrome browser-action button directly).
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  // The popup reads "active tab" via chrome.tabs.query({ active: true, currentWindow: true }).
  // In the standalone harness, popup IS the active tab — so the match won't hit
  // the seeded `api.example.com` host by default. Override tab read for the test.
  await popup.evaluate(() => {
    // Force the popup to see the seeded URL as the active tab.
    (chrome.tabs as any).query = (_q: any, cb: any) =>
      cb([{ url: 'https://api.example.com/v1/thing' }]);
  });
  await popup.reload();

  await expect(popup.locator('.pj-rule-chip')).toBeVisible({ timeout: 5000 });
  await expect(popup.locator('.pj-rule-chip')).toHaveText('Example');

  await ctx.close();
});
```

**Caveat explained:** Playwright can't click the Chrome action icon directly. We open the popup HTML in a standalone tab and patch `chrome.tabs.query` so the popup's "active tab" read returns the URL we want. This is the standard workaround — the popup code path is identical.

- [ ] **Step 18.2: Build + run**

```bash
pnpm build
pnpm test:e2e test/e2e/popup.spec.ts
```

Expected: PASS.

- [ ] **Step 18.3: Commit**

```bash
git add test/e2e/popup.spec.ts
git commit -m "test(e2e): popup match chip render"
```

---

## Task 19: E2E — skip toggle writes through

**Files:**
- Modify: `test/e2e/popup.spec.ts` (append a second test)

- [ ] **Step 19.1: Append the test**

Add to `popup.spec.ts`:

```ts
test('popup skip toggle updates hostSkipList', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [],
      templates: {},
      hostSkipList: [],
    });
  });

  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  await popup.evaluate(() => {
    (chrome.tabs as any).query = (_q: any, cb: any) =>
      cb([{ url: 'https://example.com/x' }]);
  });
  await popup.reload();

  // Expected label surface: "Skip Present-JSON on example.com".
  await popup.getByLabel(/Skip Present-JSON on example\.com/).click();

  // Read back from storage in the service worker to confirm the write landed.
  const stored = await worker.evaluate(
    async () => (await chrome.storage.local.get('hostSkipList')) as { hostSkipList: string[] },
  );
  expect(stored.hostSkipList).toContain('example.com');

  await ctx.close();
});
```

- [ ] **Step 19.2: Run**

```bash
pnpm test:e2e test/e2e/popup.spec.ts
```

Expected: PASS.

- [ ] **Step 19.3: Commit**

```bash
git add test/e2e/popup.spec.ts
git commit -m "test(e2e): popup skip toggle writes hostSkipList"
```

---

## Task 20: E2E — directive handoff opens options with the right mode

**Files:**
- Modify: `test/e2e/popup.spec.ts` (append a third test)

- [ ] **Step 20.1: Append the test**

```ts
test('popup "Test in options" opens options page with url tester pre-filled', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [],
      templates: {},
      hostSkipList: [],
    });
  });

  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  await popup.evaluate(() => {
    (chrome.tabs as any).query = (_q: any, cb: any) =>
      cb([{ url: 'https://api.example.com/v1' }]);
    // Capture the URL opened via chrome.tabs.create.
    (window as any).__opened = '';
    (chrome.tabs as any).create = async ({ url }: { url: string }) => {
      (window as any).__opened = url;
    };
  });
  await popup.reload();

  await popup.getByRole('button', { name: 'Test in options' }).click();

  const opened = await popup.evaluate(() => (window as any).__opened);
  expect(opened).toContain('src/options/options.html');
  expect(opened).toContain('#test-url=');
  expect(decodeURIComponent(opened)).toContain('api.example.com/v1');

  // Now actually navigate to that URL and confirm the options URL tester is prefilled.
  const optionsPage = await ctx.newPage();
  await optionsPage.goto(opened);
  await expect(optionsPage.locator('.pj-url-input')).toHaveValue(
    'https://api.example.com/v1',
  );

  await ctx.close();
});
```

- [ ] **Step 20.2: Run**

```bash
pnpm test:e2e test/e2e/popup.spec.ts
```

Expected: all three popup tests PASS.

- [ ] **Step 20.3: Commit**

```bash
git add test/e2e/popup.spec.ts
git commit -m "test(e2e): popup test-url directive opens options prefilled"
```

---

## Task 21: Axe-core sweep on the popup

**Files:**
- Create: `test/e2e/a11y-popup.spec.ts`

Mirror `test/e2e/a11y-options.spec.ts`. Assert WCAG 2.1 AA on the popup in both match and no-match states, both themes.

- [ ] **Step 21.1: Write the test**

```ts
import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

async function launch(): Promise<{
  ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>>;
  extId: string;
}> {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;
  return { ctx, extId };
}

for (const theme of ['light', 'dark'] as const) {
  test(`popup has no a11y violations (${theme})`, async () => {
    const { ctx, extId } = await launch();
    const popup = await ctx.newPage();
    await popup.emulateMedia({ colorScheme: theme });
    await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
    await popup.evaluate(() => {
      (chrome.tabs as any).query = (_q: any, cb: any) =>
        cb([{ url: 'https://example.com/x' }]);
    });
    await popup.reload();
    await popup.waitForSelector('.pj-popup:not(.pj-popup--booting)');

    const results = await new AxeBuilder({ page: popup })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
    await ctx.close();
  });
}
```

- [ ] **Step 21.2: Run**

```bash
pnpm test:e2e test/e2e/a11y-popup.spec.ts
```

Expected: PASS. If a contrast violation hits, check which token the failing element uses — per CLAUDE.md, small text on a wash or orange surface must use `--pj-accent-strong`, not `--pj-accent`.

- [ ] **Step 21.3: Commit**

```bash
git add test/e2e/a11y-popup.spec.ts
git commit -m "test(e2e): axe-core wcag aa sweep on popup"
```

---

## Task 22: Full verification sweep

- [ ] **Step 22.1: Run the full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Expected: all green. If anything red, fix before proceeding — code review (Task 23) operates on a clean baseline.

- [ ] **Step 22.2: Manual Chrome check**

Remind Matt to reload the extension at `chrome://extensions/`. Then manually:
1. Open popup on a matching host → chip + Edit rule visible.
2. Click Edit rule → options tab opens with that rule's modal open.
3. Open popup on a non-matching host → "+ Add rule for this host" visible.
4. Click add-rule → options tab opens with new-rule modal, host pre-filled.
5. Type a different URL into "Test URL" → click Test → options URL tester pre-filled.
6. Toggle skip → close popup → reopen → toggle state persists.
7. Toggle theme in options → popup reflects theme on next open.

Await Matt's explicit "looks good" before Task 23.

---

## Task 23: Code review

Dispatch a fresh reviewer agent over the whole Plan 4 diff vs. `main`. Per Matt's workflow: code review is the second-to-last phase and must be done by a fresh agent (no implementation bias).

- [ ] **Step 23.1: Dispatch `feature-dev:code-reviewer`**

Prompt template:

> Review the whole diff on branch `feature/phase2-plan4-popup` vs. `main`. This is Phase 2, Plan 4 — popup rewrite — per the locked spec at `docs/superpowers/specs/2026-04-18-phase2-ux-polish-design.md`. Focus on: (1) CSP safety inside the popup context, (2) correctness of the URL-hash directive protocol (no injection surface — the directive consumer decodes but doesn't eval), (3) shared-primitive reuse (`src/ui/`) vs. popup-local duplication, (4) accessibility of the popup (labels on controls, keyboard reachability, focus order), (5) storage-area convergence (popup runs `promoteStorageToLocal` and writes go through `useStorage`), (6) missing test coverage on hand-off edge cases (malformed hash, stale rule id in `edit-rule`, empty host in `new-rule`). Report high-confidence issues only.

- [ ] **Step 23.2: Address findings**

Apply fixes in-place on the impl branch. If a finding is out of scope, queue it in ROADMAP.md under the **Pre-release polish sweep** subitems rather than fixing here.

- [ ] **Step 23.3: Commit**

```bash
git add -A
git commit -m "review: address plan 4 reviewer findings"
```

---

## Task 24: Docs update

**Files:**
- Modify: `README.md` (feature set reflects popup rewrite)
- Modify: `CLAUDE.md` (architecture section — popup is now Preact; note the directive protocol)
- Modify: `ROADMAP.md` (mark Plan 4 done with date; Plan 5 promoted to current focus)
- Modify: `docs/superpowers/plans/2026-04-18-phase2-plan4-popup.md` (status banner at top → "shipped")

- [ ] **Step 24.1: README**

In the feature list, add/update: "Popup: match status, skip toggle, test-URL quick-jump, deep-links into the options page."

- [ ] **Step 24.2: CLAUDE.md**

In the Architecture section, replace the line describing `src/popup/*` as "UI (still imperative pending Plan 4)" with:

```
- `src/popup/` — Preact SPA. `Popup.tsx` owns boot + active-tab read; reads `rules` / `hostSkipList` / `settings` via `useStorage`; runs `promoteStorageToLocal()` on boot (same as options). Hands off to options via URL-hash directives (`#test-url=…`, `#new-rule:host=…`, `#edit-rule=…`). Popup never writes templates — only reads rule state and writes `hostSkipList`.
```

Add a new Gotchas bullet:

```
- **Popup → options directives** use URL-hash fragments (`#test-url=…`, `#new-rule:host=…`, `#edit-rule=…`) parsed by `src/options/directives.ts`. `chrome.runtime.openOptionsPage()` cannot accept a fragment, so the popup uses `chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') + hash })`. The options page clears the hash after applying so reload starts clean.
```

- [ ] **Step 24.3: ROADMAP**

Under Phase 2, flip Plan 4 to done:

```
4. **Plan 4 — Popup**: restyled popup with match status, skip toggle, test-URL quick-jump, deep-link directives. — done YYYY-MM-DD
```

Move the popup-related QOL entries (action badge, "Create rule from current page") from Phase 7 into a done note under Plan 4 if now covered, or keep the remainder as Phase 7 backlog if not.

- [ ] **Step 24.4: Plan status banner**

Edit the top of `docs/superpowers/plans/2026-04-18-phase2-plan4-popup.md`:

```
> **Status:** Shipped YYYY-MM-DD on `feature/phase2-plan4-popup` → `main`.
```

- [ ] **Step 24.5: Commit**

```bash
git add README.md CLAUDE.md ROADMAP.md docs/superpowers/plans/2026-04-18-phase2-plan4-popup.md
git commit -m "docs: phase 2 plan 4 shipped (popup rewrite)"
```

---

## Task 25: Pre-ship manual verification + FF-merge

Per Matt's global CLAUDE.md: automated verification is necessary but not sufficient. Hand off for a manual inspection pass, wait for explicit approval, then FF-merge.

- [ ] **Step 25.1: Surface what was built**

Summarize to Matt:
- Files added/modified.
- Manual checklist (Task 22 Step 2).
- Any known follow-ups routed to ROADMAP.

- [ ] **Step 25.2: Wait for explicit "ship it"**

Do not FF-merge without Matt's approval.

- [ ] **Step 25.3: FF-merge + push**

```bash
git checkout main
git merge --ff-only feature/phase2-plan4-popup
git push origin main
```

- [ ] **Step 25.4: Delete the local impl branch only after push confirms**

```bash
git branch -d feature/phase2-plan4-popup
```

Do **not** delete the remote branch or run destructive git commands without permission.

---

## Self-review checklist (run after writing, before handing off)

Spec coverage vs. `2026-04-18-phase2-ux-polish-design.md` Popup section:
- [x] `{>` logo + title header → Task 8.
- [x] URL (middle-truncated, monospace) → Tasks 7–8.
- [x] Matched rule name chip + Edit rule quick-link → Task 9.
- [x] "No rule matches" + `[+ Add rule for this host]` → Task 9.
- [x] Skip toggle `[ ] Skip Present-JSON on {hostname}` → Task 10.
- [x] Test URL quick-jump pre-filled → Tasks 11, 16.
- [x] `[Open options]` footer → Task 11.
- [x] Reactive via `useStorage` + `chrome.tabs` → Task 5.
- [x] Theme parity with options → Task 3 (links `theme.css`).
- [x] Handoff to options URL tester → Tasks 12–16.

Placeholder scan: no "TBD", "implement later", "add appropriate", "similar to" references. Complete code blocks in every step.

Type/identifier consistency:
- `directiveHash.testUrl/newRule/editRule` used identically in Tasks 12, 16.
- `parseDirective` return type `OptionsDirective` used in Tasks 12, 13, 14.
- `promoteStorageToLocal` import path changes in Task 6; downstream tasks (if any) use the new path — confirmed only Tasks 5, 6 touch the import.
- `tab.host` used consistently in Tasks 5, 9, 10.

---

## Execution mode

Per Matt's global CLAUDE.md: **Inline Execution** is the standing default for this project. When this spec is FF-merged, execute Plan 4 task-by-task in the active session with checkpoints at Tasks 4 (CSP smoke), 11 (full popup UI built), 16 (handoff wired), 22 (full suite), and 25 (ship).
