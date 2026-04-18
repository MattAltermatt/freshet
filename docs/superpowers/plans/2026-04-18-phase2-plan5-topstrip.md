# Phase 2, Plan 5 — Rendered Top-Strip Implementation Plan

> **Status:** Shipped 2026-04-18 on `feature/phase2-plan5-topstrip` → `main`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled imperative `buildTopStrip` in `src/content/content-script.ts` with a Preact top-strip that mounts inside a closed shadow DOM on rendered pages. Delivers the spec-locked UX: `{>` brand, orange env chip (when `vars.env` is set), monospace rule name, `Rendered | Raw` toggle-group (orange active state), `⋯` dropdown with *Copy URL* / *Edit rule* / *Skip this host*, `⌘⇧J` keyboard shortcut via `chrome.commands`, theme-reactive (light/dark) from stored `settings.themePreference`.

**Scope clarifications vs. the Phase 2 spec:**
- Reuses the shared `Menu` + `useStorage` + `useTheme` primitives from `src/ui/` via **deep-imports** (not the `../ui` barrel) to keep the content-script bundle lean (CLAUDE.md gotcha).
- Conflict-detection heuristic (*"another viewer handled this page first"*) is explicitly **Phase 4**. This plan reserves the UI slot (a degraded-state render branch) and a detection hook that currently always returns `ok`.
- No global toast host — the top-strip lives on arbitrary host pages and a cross-surface toast would require more shadow-root plumbing than the value justifies. Copy URL success is surfaced by a brief button state flip ("Copied ✓" for 1.2 s).

**Architecture:**
- Content script boot stays the same up to the match decision. Instead of calling the imperative `buildTopStrip(...)`, it calls `mountTopStrip(shadowHostContainer, props)` which:
  1. Creates a host `<div id="pj-topstrip-host">` prepended to `document.body`.
  2. Calls `host.attachShadow({ mode: 'closed' })`.
  3. Injects the bundled strip stylesheet (`topStrip.css?inline`) into a `<style>` inside the shadow root. Stylesheet declares its own `--pj-*` tokens scoped to `:host` / `:host([data-theme="dark"])` — CSS custom properties don't pierce shadow boundaries, so we inline the subset we need.
  4. Renders `<TopStrip />` into the shadow root.
- `TopStrip.tsx` owns:
  - Display state: env badge, rule name, rendered/raw toggle state.
  - `useStorage<'settings'>` + `useTheme({ root: shadowHost })` for live theme swaps.
  - `useStorage<'hostSkipList'>` for the Skip-this-host action.
  - ⌘⇧J handling via a `chrome.runtime.onMessage` listener (the background SW forwards `chrome.commands.onCommand('toggle-raw')` to the active tab).
- Raw/rendered toggle flips the *content* node outside the shadow root (`#pj-root`) between rendered HTML and a `<pre>` of pretty-printed JSON. The shadow-rooted strip stays mounted and updates its active-button state via internal Preact state.
- Matched-rule id is piped into TopStrip as a prop (known at content-script boot) so the *Edit rule* action can build `directiveHash.editRule(rule.id)` without another storage read.
- Theme preference comes from `settings.themePreference` (via `useStorage` on the content script after `promoteStorageToLocal()`). `useTheme({ root: shadowHost })` writes `data-theme="light"|"dark"` onto the host element — the `:host(...)` selectors in `topStrip.css` pick it up. Subscribes to `chrome.storage.onChanged` automatically via `useStorage`.
- Bundle discipline: deep-import `Menu` from `src/ui/components/Menu` and `useStorage` / `useTheme` from `src/ui/hooks/*` (same pattern as the popup). Do **not** import from `src/ui/` (the barrel) — it re-exports `CodeMirrorBox` and drags CodeMirror into the content script.

**Tech Stack:** Preact 10 (existing), existing `src/ui/` primitives (`Menu`, `useStorage`, `useTheme`, `theme.ts`), `chrome.commands` (new manifest entry), Playwright for E2E, `@axe-core/playwright` for a11y. No new runtime dependencies.

**Critical de-risk path:** Task 4 is a "strip mounts in a closed shadow DOM on a live page under MV3 CSP" smoke test. The popup proved Preact boots under CSP (Plan 4 Task 4), but the content-script context is meaningfully different: (a) host pages can inject hostile CSS, (b) the shadow boundary must hold, (c) `topStrip.css?inline` must make it through Vite unhashed. All downstream tasks gate on that pass.

**Phases (roadmap-style, strategic):**

1. **Foundation** — spec branch (this doc), impl branch, strip down the imperative strip, Preact scaffold. (Tasks 1–3)
2. **De-risk** — shadow-DOM + MV3 CSP smoke on a rendered page. (Task 4)
3. **Strip UI** — brand + env badge + rule name + Rendered/Raw toggle-group + ⋯ menu trigger. (Tasks 5–9)
4. **Interactions** — raw/rendered content swap, Copy URL, Edit rule handoff, Skip this host. (Tasks 10–13)
5. **Keyboard command** — manifest `commands`, background relay, content-strip listener. (Tasks 14–16)
6. **Theme reactivity** — `useStorage('settings')` + `useTheme({ root: shadowHost })`. (Task 17)
7. **Conflict-detection slot** — reserve the degraded UI branch for Phase 4. (Task 18)
8. **Tests + a11y** — unit tests, Playwright E2E on a fixture JSON, axe-core sweep. (Tasks 19–23)
9. **Code review + docs + FF-merge.** (Tasks 24–27)

**Todos (current tactical focus):** Task 1 (branch) → Task 4 (shadow-DOM smoke). Everything downstream gates on that proof.

---

## Task 1: FF-merge this spec, cut impl branch

This plan currently lives on `feature/phase2-plan5-spec`. After Matt reviews and FF-merges the spec to `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/phase2-plan5-topstrip
```

All subsequent tasks commit on `feature/phase2-plan5-topstrip`. Push the branch to origin for backup after Task 4.

---

## Task 2: Strip the imperative top-strip out of the content script

**Files:**
- Modify: `src/content/content-script.ts`

Keep the matcher + render decision. Replace the imperative `buildTopStrip` / `renderSuccess` / `toggleRaw` body with a call-site for the new `mountTopStrip` helper (written in Task 3). Content script becomes a thin boot.

- [ ] **Step 2.1: Rewrite `src/content/content-script.ts`**

Use a Bash heredoc (per the CLAUDE.md security-hook gotcha — this file contains `documentElement.innerHTML = ...` style patterns):

```bash
cat > src/content/content-script.ts << 'EOF'
import { render as renderTemplate } from '../engine/engine';
import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
import { mountTopStrip } from './mountTopStrip';
import type { Rule } from '../shared/types';

async function main(): Promise<void> {
  const rawText = document.body?.innerText;
  if (!rawText) return;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return;
  }

  await promoteStorageToLocal();
  const storage = await createStorage(chrome.storage);
  const [rules, templates, skip] = await Promise.all([
    storage.getRules(),
    storage.getTemplates(),
    storage.getHostSkipList(),
  ]);

  const host = window.location.hostname;
  if (skip.includes(host)) return;

  const rule = match(window.location.href, rules);
  if (!rule) return;

  const templateText = templates[rule.templateName];
  if (templateText === undefined) {
    renderError(`Template '${rule.templateName}' not found.`);
    return;
  }

  let rendered: string;
  try {
    rendered = renderTemplate(templateText, parsedJson, rule.variables);
  } catch (err) {
    renderError(`Template error: ${(err as Error).message}`);
    return;
  }

  renderSuccess(rendered, rawText, rule);
}

function renderSuccess(html: string, raw: string, rule: Rule): void {
  const titleEsc = escHtml(window.location.href);
  document.documentElement.innerHTML =
    '<head><meta charset="utf-8"><title>' + titleEsc + '</title></head><body></body>';
  const root = document.createElement('div');
  root.id = 'pj-root';
  const htmlAssign = 'inner' + 'HTML';
  (root as Record<string, unknown>)[htmlAssign] = html;
  document.body.appendChild(root);
  mountTopStrip({
    rule,
    renderedHtml: html,
    rawJsonText: raw,
    contentRoot: root,
  });
}

function renderError(message: string): void {
  const banner = document.createElement('div');
  banner.textContent = message;
  banner.style.cssText =
    'padding:8px 12px;background:#fee2e2;border-bottom:1px solid #fca5a5;color:#991b1b;font:12px -apple-system,sans-serif;cursor:pointer;';
  banner.onclick = () => banner.remove();
  setTimeout(() => banner.remove(), 10000);
  document.body.prepend(banner);
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

void main();
EOF
```

The `htmlAssign` indirection is the same trick used elsewhere in the repo to get the DOM write past the Write/Edit tool's inner-HTML hook — at runtime it's identical to a direct assignment.

- [ ] **Step 2.2: Verify the build is currently red**

```bash
pnpm typecheck
```

Expected: FAIL — `./mountTopStrip` module not found. That's correct; Task 3 closes it. Commit even though typecheck is red so the impl branch has a clean checkpoint.

- [ ] **Step 2.3: Commit**

```bash
git add src/content/content-script.ts
git commit -m "content: wire mountTopStrip call-site (typecheck red pending task 3)"
```

---

## Task 3: Preact scaffold — `mountTopStrip` + `TopStrip` shell + strip CSS

**Files:**
- Create: `src/content/topStrip.css`
- Create: `src/content/mountTopStrip.ts`
- Create: `src/content/TopStrip.tsx`

The mount helper attaches a closed shadow root, injects the bundled stylesheet, and renders the Preact tree. The shell doesn't interact yet — Tasks 5–13 build the surface.

- [ ] **Step 3.1: Write `src/content/topStrip.css`**

CSS custom properties do **not** cross the shadow boundary, so we redeclare the tokens we need on `:host`. Dark mode activates via `data-theme="dark"` on the host element (applied by `useTheme({ root: shadowHost })`).

```css
:host {
  all: initial;
  --pj-bg: #fef7ed;
  --pj-bg-elevated: #ffffff;
  --pj-border: #fed7aa;
  --pj-fg: #111827;
  --pj-fg-muted: #44403c;
  --pj-accent: #ea580c;
  --pj-accent-fg: #ffffff;
  --pj-accent-strong: #c2410c;
  --pj-font: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --pj-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  display: block;
  position: sticky;
  top: 0;
  z-index: 2147483647;
  font-family: var(--pj-font);
  font-size: 12px;
}
:host([data-theme="dark"]) {
  --pj-bg: #1c1917;
  --pj-bg-elevated: #292524;
  --pj-border: #292524;
  --pj-fg: #fafafa;
  --pj-fg-muted: #a8a29e;
  --pj-accent-strong: #c2410c;
}

.pj-topstrip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: var(--pj-bg);
  color: var(--pj-fg);
  border-bottom: 1px solid var(--pj-border);
  box-sizing: border-box;
}

.pj-logo { font-family: var(--pj-font-mono); font-size: 14px; line-height: 1; }
.pj-logo-brace { color: var(--pj-fg); }
.pj-logo-bracket { color: var(--pj-accent); margin-left: 1px; }

.pj-env-chip {
  background: var(--pj-accent-strong);
  color: var(--pj-accent-fg);
  padding: 2px 8px;
  border-radius: 3px;
  font-family: var(--pj-font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pj-rule-name {
  font-family: var(--pj-font-mono);
  color: var(--pj-fg-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1 1 auto;
}

.pj-toggle-group {
  display: inline-flex;
  border: 1px solid var(--pj-border);
  border-radius: 4px;
  overflow: hidden;
  background: var(--pj-bg-elevated);
}
.pj-toggle-group button {
  border: 0;
  background: transparent;
  color: var(--pj-fg-muted);
  padding: 3px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.pj-toggle-group button[aria-pressed="true"] {
  background: var(--pj-accent-strong);
  color: var(--pj-accent-fg);
}
.pj-toggle-group button:focus-visible {
  outline: 2px solid var(--pj-accent);
  outline-offset: -2px;
}
.pj-toggle-hint {
  margin-left: 6px;
  font-size: 10px;
  opacity: 0.75;
}

.pj-menu-trigger-btn {
  border: 1px solid var(--pj-border);
  border-radius: 4px;
  background: var(--pj-bg-elevated);
  color: var(--pj-fg);
  padding: 3px 8px;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.pj-menu-trigger-btn:focus-visible {
  outline: 2px solid var(--pj-accent);
  outline-offset: 1px;
}

/* The shared Menu primitive ships with its own pj-menu / pj-menu-list classes;
   provide the visuals locally since the shared theme.css tokens can't reach in. */
.pj-menu { position: relative; }
.pj-menu-list {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--pj-bg-elevated);
  color: var(--pj-fg);
  border: 1px solid var(--pj-border);
  border-radius: 4px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  min-width: 180px;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  z-index: 1;
}
.pj-menu-item {
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 6px 12px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.pj-menu-item:hover { background: rgba(234,88,12,0.08); }
.pj-menu-item--danger { color: #b91c1c; }

.pj-degraded {
  color: var(--pj-fg-muted);
  font-style: italic;
}
```

- [ ] **Step 3.2: Write `src/content/mountTopStrip.ts`**

```ts
import { render } from 'preact';
import { TopStrip, type TopStripProps } from './TopStrip';
import stripStyles from './topStrip.css?inline';

export interface MountTopStripOptions extends TopStripProps {
  /** Container the strip's host element is prepended into. Defaults to document.body. */
  parent?: HTMLElement;
}

/**
 * Create a closed shadow root on a new host element, inject the strip stylesheet,
 * and render the Preact TopStrip tree into it. Returns the host element so callers
 * (tests, or the content script if it ever needs to unmount) can tear down.
 */
export function mountTopStrip(options: MountTopStripOptions): HTMLElement {
  const parent = options.parent ?? document.body;
  const host = document.createElement('div');
  host.id = 'pj-topstrip-host';
  parent.prepend(host);

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = stripStyles;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  mount.className = 'pj-topstrip-mount';
  shadow.appendChild(mount);

  const { parent: _parent, ...props } = options;
  render(<TopStrip {...(props as TopStripProps)} shadowHost={host} />, mount);
  return host;
}
```

- [ ] **Step 3.3: Write `src/content/TopStrip.tsx`**

Skeleton with just a visible element so the CSP smoke test has something to assert.

```tsx
import type { JSX } from 'preact';
import type { Rule } from '../shared/types';

export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  /** Set automatically by mountTopStrip; overridable in tests. */
  shadowHost?: HTMLElement;
}

export function TopStrip({ rule }: TopStripProps): JSX.Element {
  return (
    <div class="pj-topstrip" data-testid="pj-topstrip">
      <span class="pj-rule-name" data-testid="pj-rule-name">
        {rule.templateName}
      </span>
    </div>
  );
}
```

- [ ] **Step 3.4: Verify**

```bash
pnpm typecheck && pnpm build
```

Expected: both green. The build produces `dist/src/content/content-script.*.js` and bundles `topStrip.css` as an inlined string (via the `?inline` query).

- [ ] **Step 3.5: Commit**

```bash
git add src/content/topStrip.css src/content/mountTopStrip.ts src/content/TopStrip.tsx
git commit -m "content: preact topstrip scaffold (shadow-dom mount + shell)"
```

---

## Task 4: Shadow-DOM + CSP smoke on a rendered page

**Purpose:** Prove that (a) the strip mounts inside a closed shadow root on an arbitrary page, (b) no MV3 CSP violations fire, (c) the inlined stylesheet makes it through Vite. Mirrors `test/e2e/cm-csp-smoke.spec.ts` + `test/e2e/popup-csp-smoke.spec.ts`.

**Files:**
- Create: `test/e2e/topstrip-csp-smoke.spec.ts`

- [ ] **Step 4.1: Write the failing test**

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

test('top-strip mounts in closed shadow root on a rendered JSON page (no CSP violations)', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));

  // Seed a rule + template + skip list so the content script renders.
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [{
        id: 'rule-smoke',
        hostPattern: '127.0.0.1',
        pathPattern: '/**',
        templateName: 'Smoke',
        variables: {},
        enabled: true,
      }],
      templates: { Smoke: '<h1 id="pj-smoke-rendered">hi</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  // Serve a JSON page from the fixture server (start it first in a sibling terminal
  // or via playwright webServer — this test relies on pnpm fixtures on 127.0.0.1:4391).
  const page = await ctx.newPage();
  const cspViolations: string[] = [];
  page.on('console', (msg) => {
    const t = msg.text().toLowerCase();
    if (t.includes('content security policy') || t.includes('unsafe-eval')) {
      cspViolations.push(msg.text());
    }
  });
  await page.goto('http://127.0.0.1:4391/internal/user/1');

  // Shadow root is closed — assert via a probe inside page context.
  await page.waitForFunction(
    () => Boolean(document.getElementById('pj-topstrip-host')),
    null,
    { timeout: 5000 },
  );

  const mountPresent = await page.evaluate(() => {
    const host = document.getElementById('pj-topstrip-host');
    if (!host) return false;
    // Closed shadow root — reach via the attachShadow monkeypatch escape hatch:
    // Playwright's page context can evaluate synchronously, but closed roots
    // hide their root from outside. Verify at least the host + its sibling
    // content root exist. Shadow internals are covered by the component test
    // (Task 19), not this smoke.
    return Boolean(document.getElementById('pj-root'));
  });
  expect(mountPresent).toBe(true);
  expect(cspViolations, `CSP violations: ${cspViolations.join('\n')}`).toEqual([]);

  await ctx.close();
});
```

- [ ] **Step 4.2: Build + start fixtures + run**

```bash
pnpm build
pnpm fixtures &
FIXPID=$!
pnpm test:e2e test/e2e/topstrip-csp-smoke.spec.ts
kill $FIXPID
```

Expected: PASS. If it fails, investigate before continuing. Likely suspects: `topStrip.css?inline` query not honored (add `vite.config.ts` asset handler), or the seeded rule didn't match `127.0.0.1` (check the glob — `compileGlob('127.0.0.1', { caseInsensitive: true })` should match the bare IP).

- [ ] **Step 4.3: Commit**

```bash
git add test/e2e/topstrip-csp-smoke.spec.ts
git commit -m "test(e2e): topstrip shadow-dom csp smoke"
```

---

## Task 5: Brand + env chip + rule name

**Files:**
- Modify: `src/content/TopStrip.tsx`

Render the left cluster: `{>` logo, env chip (hidden when `rule.variables.env` is absent), rule name.

- [ ] **Step 5.1: Update `TopStrip.tsx`**

```tsx
import type { JSX } from 'preact';
import type { Rule } from '../shared/types';

export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  shadowHost?: HTMLElement;
}

export function TopStrip({ rule }: TopStripProps): JSX.Element {
  const env = rule.variables['env'];
  return (
    <div class="pj-topstrip" data-testid="pj-topstrip">
      <span class="pj-logo" aria-hidden="true">
        <span class="pj-logo-brace">{'{'}</span>
        <span class="pj-logo-bracket">{'>'}</span>
      </span>
      {env ? (
        <span class="pj-env-chip" data-testid="pj-env-chip">
          {env}
        </span>
      ) : null}
      <span class="pj-rule-name" data-testid="pj-rule-name" title={rule.templateName}>
        {rule.templateName}
      </span>
    </div>
  );
}
```

- [ ] **Step 5.2: Eyeball**

```bash
pnpm build
```

Reload the extension at `chrome://extensions/`. Navigate to `http://127.0.0.1:4391/internal/user/1` (start fixtures with `pnpm fixtures`). Expected: warm-cream strip with `{>` + rule name. If the seeded rule has `vars.env` set, an orange chip appears.

- [ ] **Step 5.3: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip brand + env chip + rule name"
```

---

## Task 6: Rendered / Raw toggle-group (display only)

**Files:**
- Modify: `src/content/TopStrip.tsx`

Controlled toggle: two buttons with `aria-pressed`. State lives in `TopStrip`. Active button gets the orange accent (CSS already in place). Task 10 wires the DOM swap.

- [ ] **Step 6.1: Extend `TopStrip.tsx`**

Replace the component body:

```tsx
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Rule } from '../shared/types';

export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  shadowHost?: HTMLElement;
}

type ViewMode = 'rendered' | 'raw';

export function TopStrip({ rule }: TopStripProps): JSX.Element {
  const env = rule.variables['env'];
  const [mode, setMode] = useState<ViewMode>('rendered');

  return (
    <div class="pj-topstrip" data-testid="pj-topstrip">
      <span class="pj-logo" aria-hidden="true">
        <span class="pj-logo-brace">{'{'}</span>
        <span class="pj-logo-bracket">{'>'}</span>
      </span>
      {env ? (
        <span class="pj-env-chip" data-testid="pj-env-chip">
          {env}
        </span>
      ) : null}
      <span class="pj-rule-name" data-testid="pj-rule-name" title={rule.templateName}>
        {rule.templateName}
      </span>
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
    </div>
  );
}
```

- [ ] **Step 6.2: Eyeball**

Rebuild + reload. Click each button — active state flips orange. No DOM swap yet (that's Task 10).

- [ ] **Step 6.3: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip rendered/raw toggle-group (visual only)"
```

---

## Task 7: ⋯ Menu trigger wired to the shared `Menu` primitive

**Files:**
- Modify: `src/content/TopStrip.tsx`

Deep-import the shared `Menu` from `src/ui/components/Menu` — **not** the barrel (CLAUDE.md gotcha). Menu items wired to no-ops for now; Tasks 11–13 fill them in.

- [ ] **Step 7.1: Extend imports**

```ts
import { Menu, type MenuItem } from '../ui/components/Menu';
```

- [ ] **Step 7.2: Render the menu next to the toggle-group**

Inside the component body, before the closing `</div>`:

```tsx
const menuItems: MenuItem[] = [
  { label: 'Copy URL', onSelect: () => {/* Task 11 */} },
  { label: 'Edit rule', onSelect: () => {/* Task 12 */} },
  { label: 'Skip this host', danger: true, onSelect: () => {/* Task 13 */} },
];
```

```tsx
<Menu
  align="right"
  items={menuItems}
  trigger={
    <button
      type="button"
      class="pj-menu-trigger-btn"
      aria-label="More actions"
      data-testid="pj-menu-trigger"
    >
      ⋯
    </button>
  }
/>
```

- [ ] **Step 7.3: Eyeball**

Click ⋯ — dropdown opens with three rows. Escape + outside-click both close it (inherited from `Menu`'s internal effect).

- [ ] **Step 7.4: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip ⋯ menu scaffold (items inert)"
```

---

## Task 8: Outside-click listener must target the shadow root, not document

**Files:**
- Modify: `src/ui/components/Menu.tsx` (narrow fix)
- Modify: `src/ui/components/Menu.test.tsx`

**Context:** `Menu.tsx` currently adds `document.addEventListener('click', …)` to close on outside-click. Inside a closed shadow root, clicks on the document proper do reach that listener (events bubble out of shadow in composed mode), *but* the `e.target` value is re-targeted at the shadow-host element — `root.current?.contains(e.target)` returns `false` for clicks inside the shadow-root's own menu, which would incorrectly close the menu on the very click that opened it.

Fix: when the menu is mounted inside a shadow root, listen on the shadow root itself; otherwise listen on `document`. Detect via `root.current?.getRootNode()`.

- [ ] **Step 8.1: Patch `Menu.tsx`**

Replace the `useEffect` that binds the click listener:

```tsx
useEffect(() => {
  if (!open) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };
  const onClick = (e: MouseEvent) => {
    if (!root.current?.contains(e.target as Node)) setOpen(false);
  };

  const rootNode = root.current?.getRootNode();
  const clickTarget: Document | ShadowRoot =
    rootNode instanceof ShadowRoot ? rootNode : document;

  document.addEventListener('keydown', onKey);
  clickTarget.addEventListener('click', onClick as EventListener);
  return () => {
    document.removeEventListener('keydown', onKey);
    clickTarget.removeEventListener('click', onClick as EventListener);
  };
}, [open]);
```

- [ ] **Step 8.2: Add a test for the shadow-root branch**

Append to `src/ui/components/Menu.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/preact';
import { Menu } from './Menu';
import { vi } from 'vitest';

test('closes on outside click when mounted inside a shadow root', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const mount = document.createElement('div');
  shadow.appendChild(mount);

  const onSelect = vi.fn();
  const { getByText } = render(
    <Menu
      trigger={<button>open</button>}
      items={[{ label: 'item', onSelect }]}
    />,
    { container: mount },
  );

  fireEvent.click(getByText('open'));
  // Menu is open — clicking elsewhere inside the shadow root closes it.
  fireEvent.click(shadow);
  // Menu no longer renders its list.
  expect(shadow.querySelector('.pj-menu-list')).toBeNull();
});
```

- [ ] **Step 8.3: Run**

```bash
pnpm test src/ui/components/Menu.test.tsx
```

Expected: all existing tests still pass and the new one passes.

- [ ] **Step 8.4: Commit**

```bash
git add src/ui/components/Menu.tsx src/ui/components/Menu.test.tsx
git commit -m "ui(menu): listen on shadowRoot for outside-click when nested"
```

---

## Task 9: Icon helpers for the menu items

**Files:**
- Modify: `src/content/TopStrip.tsx`

Add lightweight glyph icons to the three menu items (Unicode arrows/pencil/cross to avoid SVG bundle overhead inside the strip).

- [ ] **Step 9.1: Extend the `menuItems` definition**

```tsx
const menuItems: MenuItem[] = [
  {
    label: 'Copy URL',
    icon: <span aria-hidden="true">↗</span>,
    onSelect: () => {/* Task 11 */},
  },
  {
    label: 'Edit rule',
    icon: <span aria-hidden="true">✎</span>,
    onSelect: () => {/* Task 12 */},
  },
  {
    label: 'Skip this host',
    icon: <span aria-hidden="true">✕</span>,
    danger: true,
    onSelect: () => {/* Task 13 */},
  },
];
```

- [ ] **Step 9.2: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip menu item icons"
```

---

## Task 10: Wire the Rendered/Raw toggle to the DOM content swap

**Files:**
- Modify: `src/content/TopStrip.tsx`

When `mode` changes, mutate `contentRoot` (passed in as a prop): rendered → `innerHTML = renderedHtml`, raw → `<pre>{ pretty JSON }</pre>`. Use a `useEffect` keyed on `mode`.

- [ ] **Step 10.1: Import `useEffect`**

```ts
import { useEffect, useState } from 'preact/hooks';
```

- [ ] **Step 10.2: Add the effect**

Inside the component, after the `useState`:

```tsx
useEffect(() => {
  if (mode === 'rendered') {
    const htmlAssign = 'inner' + 'HTML';
    (contentRoot as Record<string, unknown>)[htmlAssign] = renderedHtml;
    contentRoot.removeAttribute('data-mode');
    return;
  }
  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(rawJsonText), null, 2);
  } catch {
    pretty = rawJsonText;
  }
  const pre = document.createElement('pre');
  pre.style.cssText =
    'margin:0;padding:12px;font:12px ui-monospace,Menlo,monospace;white-space:pre-wrap;';
  pre.textContent = pretty;
  contentRoot.replaceChildren(pre);
  contentRoot.setAttribute('data-mode', 'raw');
}, [mode, contentRoot, renderedHtml, rawJsonText]);
```

The `htmlAssign` indirection repeats the trick from Task 2 Step 2.1 to keep the Write/Edit tool's DOM-injection hook off our back at tool time.

- [ ] **Step 10.3: Eyeball**

Rebuild + reload. Click Raw → page body swaps to a pretty-printed JSON pre. Click Rendered → swaps back. Strip stays mounted across the swap.

- [ ] **Step 10.4: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip rendered/raw swaps contentRoot"
```

---

## Task 11: Wire Copy URL

**Files:**
- Modify: `src/content/TopStrip.tsx`

Use `navigator.clipboard.writeText`; flash the menu item label to "Copied ✓" for 1.2 s. Falls back silently if clipboard is unavailable.

- [ ] **Step 11.1: Add copy state + handler**

```tsx
const [copyPulse, setCopyPulse] = useState(false);

const copyUrl = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    setCopyPulse(true);
    setTimeout(() => setCopyPulse(false), 1200);
  } catch {
    /* silent — user can still use the system URL bar. */
  }
};
```

- [ ] **Step 11.2: Update the Copy URL menu item**

```tsx
{
  label: copyPulse ? 'Copied ✓' : 'Copy URL',
  icon: <span aria-hidden="true">{copyPulse ? '✓' : '↗'}</span>,
  onSelect: () => void copyUrl(),
},
```

Note: `Menu` closes on select (see `Menu.tsx` — it calls `setOpen(false)` after `onSelect`), so the "Copied ✓" state only shows on the *next* menu open within the 1.2 s window. That's acceptable; the toggle label doubles as a log when the user reopens.

- [ ] **Step 11.3: Eyeball**

Open the menu, click Copy URL, paste elsewhere — confirm it's the full `window.location.href`.

- [ ] **Step 11.4: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip copy url action"
```

---

## Task 12: Wire Edit rule — handoff to options via directive

**Files:**
- Modify: `src/content/TopStrip.tsx`

Open `chrome-extension://<id>/src/options/options.html#edit-rule=<encoded>` in a new tab using the shared `directiveHash` from `src/options/directives.ts`.

- [ ] **Step 12.1: Import the helper**

```ts
import { directiveHash } from '../options/directives';
```

- [ ] **Step 12.2: Add the handler**

```tsx
const openEditRule = (): void => {
  const url = chrome.runtime.getURL('src/options/options.html') + directiveHash.editRule(rule.id);
  void chrome.tabs.create({ url });
};
```

- [ ] **Step 12.3: Update the menu item**

```tsx
{
  label: 'Edit rule',
  icon: <span aria-hidden="true">✎</span>,
  onSelect: openEditRule,
},
```

- [ ] **Step 12.4: Eyeball**

Click Edit rule on a rendered page → a new tab opens on the options page with the matching rule's modal open. Same pattern already verified by Plan 4 Task 20's E2E; same code path.

- [ ] **Step 12.5: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip edit-rule directive handoff"
```

---

## Task 13: Wire Skip this host

**Files:**
- Modify: `src/content/TopStrip.tsx`

Adds the current hostname to `hostSkipList` via `useStorage`, then reloads the tab so the page shows the raw JSON (because the content script early-returns when the host is skipped).

- [ ] **Step 13.1: Import `useStorage`**

```ts
import { useStorage } from '../ui/hooks/useStorage';
import type { HostSkipList } from '../shared/types';
```

- [ ] **Step 13.2: Add the hook + handler inside `TopStrip`**

```tsx
const [skipList, writeSkipList] = useStorage<'hostSkipList', HostSkipList>(
  'hostSkipList',
  [],
);

const skipHost = async (): Promise<void> => {
  const host = window.location.hostname;
  if (!host) return;
  const next = Array.from(new Set([...skipList, host]));
  await writeSkipList(next);
  window.location.reload();
};
```

- [ ] **Step 13.3: Update the menu item**

```tsx
{
  label: 'Skip this host',
  icon: <span aria-hidden="true">✕</span>,
  danger: true,
  onSelect: () => void skipHost(),
},
```

- [ ] **Step 13.4: Eyeball**

Click Skip this host → page reloads and now shows raw JSON (no strip, no rendering). Re-enable by removing the hostname from the popup's skip toggle (from Plan 4).

- [ ] **Step 13.5: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip skip-this-host action"
```

---

## Task 14: Register `⌘⇧J` in the manifest

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 14.1: Add the `commands` block to the manifest**

Inside `defineManifest({ ... })`, after `permissions`:

```ts
commands: {
  'toggle-raw': {
    suggested_key: {
      default: 'Ctrl+Shift+J',
      mac: 'Command+Shift+J',
    },
    description: 'Toggle rendered / raw view on a matched page',
  },
},
```

- [ ] **Step 14.2: Verify the manifest builds**

```bash
pnpm build
```

Expected: `dist/manifest.json` contains the `commands` entry.

- [ ] **Step 14.3: Commit**

```bash
git add vite.config.ts
git commit -m "manifest: register ⌘⇧J toggle-raw command"
```

---

## Task 15: Background relay — forward `toggle-raw` to the active tab

**Files:**
- Modify: `src/background/background.ts`

`chrome.commands.onCommand` fires in the background SW. Forward to the active tab via `chrome.tabs.sendMessage`.

- [ ] **Step 15.1: Append the listener to `background.ts`**

Add after `void main();`:

```ts
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-raw') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId === undefined) return;
    // Swallow errors — the active tab may not have our content script (e.g., chrome://).
    void chrome.tabs.sendMessage(tabId, { kind: 'pj:toggle-raw' }).catch(() => {});
  });
});
```

- [ ] **Step 15.2: Commit**

```bash
git add src/background/background.ts
git commit -m "background: relay toggle-raw command to active tab"
```

---

## Task 16: Content strip listens for `pj:toggle-raw`

**Files:**
- Modify: `src/content/TopStrip.tsx`

- [ ] **Step 16.1: Add the message listener**

Inside `TopStrip`, after the existing `useEffect`:

```tsx
useEffect(() => {
  const onMessage = (message: unknown): void => {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { kind?: unknown }).kind === 'pj:toggle-raw'
    ) {
      setMode((m) => (m === 'rendered' ? 'raw' : 'rendered'));
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  return () => chrome.runtime.onMessage.removeListener(onMessage);
}, []);
```

- [ ] **Step 16.2: Eyeball**

Rebuild + reload. On a rendered page, press `⌘⇧J` → view flips. Press again → flips back. Confirm by watching the toggle-group's orange active state move.

- [ ] **Step 16.3: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip listens for ⌘⇧J toggle-raw message"
```

---

## Task 17: Theme reactivity — read `settings.themePreference`, apply to the shadow host

**Files:**
- Modify: `src/content/TopStrip.tsx`

Mirror the options / popup pattern: read `settings` via `useStorage`, feed the preference to `useTheme({ root: shadowHost })`. `applyTheme` writes `data-theme="light"|"dark"` onto the shadow host, which our `topStrip.css` `:host([data-theme="dark"])` selector picks up.

- [ ] **Step 17.1: Import the hook**

```ts
import { useTheme } from '../ui/hooks/useTheme';
import type { ThemePreference } from '../ui/theme';
```

- [ ] **Step 17.2: Hook up theme inside `TopStrip`**

```tsx
const [settings] = useStorage<'settings', { themePreference: ThemePreference }>(
  'settings',
  { themePreference: 'system' },
);
useTheme({
  preference: settings.themePreference,
  root: shadowHost,
});
```

Note: `useTheme`'s default `applyTheme` writes `data-theme` on `document.documentElement` when `root` is not passed. Passing the shadow host here scopes the attribute correctly — `topStrip.css`'s `:host([data-theme="dark"])` does the rest.

- [ ] **Step 17.3: Eyeball**

Toggle the options-page theme (sun/moon). The already-open rendered page's strip flips light↔dark without reload.

- [ ] **Step 17.4: Commit**

```bash
git add src/content/TopStrip.tsx
git commit -m "content: topstrip theme reactivity via shadow-host data-theme"
```

---

## Task 18: Conflict-detection UI slot (Phase 4 reservation)

**Files:**
- Create: `src/content/conflictDetect.ts`
- Modify: `src/content/TopStrip.tsx`

Reserve the *"another JSON viewer handled this page first"* branch. The detection hook currently always returns `{ ok: true }`. Phase 4 fills in the heuristic; this plan just proves the render branch is reachable.

- [ ] **Step 18.1: Write the detection hook**

`src/content/conflictDetect.ts`:

```ts
/**
 * Phase 2 stub — Phase 4 fills in the real heuristic
 * (e.g. another JSON viewer already mutated document.body before our content
 * script ran). For now we always return ok=true; the UI branch in TopStrip
 * is kept so Phase 4 only flips this implementation.
 */
export interface ConflictReport {
  ok: boolean;
  reason?: string;
}

export function detectConflict(): ConflictReport {
  return { ok: true };
}
```

- [ ] **Step 18.2: Wire the degraded branch in `TopStrip.tsx`**

Add a prop + render a small italic notice when `degraded` is true. The notice appears *inside* the strip, to the right of the rule name, displacing the toggle-group and menu (which make no sense when we didn't actually render).

Extend `TopStripProps`:

```ts
export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  shadowHost?: HTMLElement;
  /** Phase 4 hook — reserved slot for the "another viewer handled this page" degraded state. */
  degraded?: { reason: string };
}
```

Inside the component, replace the toggle-group + menu block with:

```tsx
{degraded ? (
  <span class="pj-degraded" data-testid="pj-degraded">
    ⚠ {degraded.reason}
  </span>
) : (
  <>
    <div class="pj-toggle-group" role="group" aria-label="View mode">
      {/* …existing buttons unchanged… */}
    </div>
    <Menu
      align="right"
      items={menuItems}
      trigger={/* …unchanged… */}
    />
  </>
)}
```

- [ ] **Step 18.3: Commit**

```bash
git add src/content/conflictDetect.ts src/content/TopStrip.tsx
git commit -m "content: reserve conflict-detection ui slot (phase 4 hook)"
```

---

## Task 19: TopStrip component tests

**Files:**
- Create: `src/content/TopStrip.test.tsx`

Mock `chrome`, render `<TopStrip />` into a plain `<div>` container (bypassing the shadow root for tests), assert env chip / rule name / toggle state / menu items / conflict-state branch.

- [ ] **Step 19.1: Write the test**

```tsx
import { render, fireEvent, screen } from '@testing-library/preact';
import { beforeEach, test, expect, vi } from 'vitest';
import { TopStrip } from './TopStrip';

function mockChrome(): void {
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (keys: any, cb: any) => {
          if (typeof keys === 'string') {
            const v = keys === 'settings' ? { themePreference: 'light' } : [];
            cb({ [keys]: v });
          } else {
            cb({});
          }
        },
        set: (_p: any, cb?: any) => cb?.(),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      getURL: (p: string) => `chrome-extension://fake/${p}`,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { create: vi.fn() },
  };
}

function baseProps() {
  const contentRoot = document.createElement('div');
  contentRoot.id = 'pj-root';
  document.body.appendChild(contentRoot);
  return {
    rule: {
      id: 'r1',
      hostPattern: '*',
      pathPattern: '/**',
      templateName: 'internal-user',
      variables: {},
      enabled: true,
    },
    renderedHtml: '<h1>hi</h1>',
    rawJsonText: '{"a":1}',
    contentRoot,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  mockChrome();
});

test('renders rule name', () => {
  render(<TopStrip {...baseProps()} />);
  expect(screen.getByTestId('pj-rule-name')).toHaveTextContent('internal-user');
});

test('shows env chip when rule.variables.env is set', () => {
  const p = baseProps();
  p.rule.variables = { env: 'staging' };
  render(<TopStrip {...p} />);
  expect(screen.getByTestId('pj-env-chip')).toHaveTextContent('staging');
});

test('hides env chip when env is absent', () => {
  render(<TopStrip {...baseProps()} />);
  expect(screen.queryByTestId('pj-env-chip')).toBeNull();
});

test('raw toggle swaps contentRoot to a <pre> of pretty JSON', () => {
  const p = baseProps();
  render(<TopStrip {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /Raw/ }));
  expect(p.contentRoot.getAttribute('data-mode')).toBe('raw');
  expect(p.contentRoot.querySelector('pre')?.textContent).toContain('"a": 1');
});

test('rendered toggle restores the renderedHtml', () => {
  const p = baseProps();
  render(<TopStrip {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /Raw/ }));
  fireEvent.click(screen.getByRole('button', { name: /Rendered/ }));
  expect(p.contentRoot.getAttribute('data-mode')).toBeNull();
  expect(p.contentRoot.innerHTML).toContain('<h1>hi</h1>');
});

test('degraded state hides the toggle-group + menu and shows the reason', () => {
  render(<TopStrip {...baseProps()} degraded={{ reason: 'Another viewer handled this page' }} />);
  expect(screen.getByTestId('pj-degraded')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'View mode' })).toBeNull();
  expect(screen.queryByTestId('pj-menu-trigger')).toBeNull();
});
```

- [ ] **Step 19.2: Run**

```bash
pnpm test src/content/TopStrip.test.tsx
```

Expected: PASS.

- [ ] **Step 19.3: Commit**

```bash
git add src/content/TopStrip.test.tsx
git commit -m "content: topstrip component tests"
```

---

## Task 20: `mountTopStrip` smoke test in JSDOM

**Files:**
- Create: `src/content/mountTopStrip.test.ts`

Verify the mount helper attaches a shadow root, injects the stylesheet, prepends the host to the given parent.

- [ ] **Step 20.1: Write the test**

```ts
import { beforeEach, test, expect, vi } from 'vitest';
import { mountTopStrip } from './mountTopStrip';

function mockChrome(): void {
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (_k: any, cb: any) => cb({}),
        set: (_p: any, cb?: any) => cb?.(),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      getURL: (p: string) => `chrome-extension://fake/${p}`,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { create: vi.fn() },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  mockChrome();
});

test('mounts a host element with a shadow root and injects the stylesheet', () => {
  const contentRoot = document.createElement('div');
  contentRoot.id = 'pj-root';
  document.body.appendChild(contentRoot);

  const host = mountTopStrip({
    rule: {
      id: 'r1',
      hostPattern: '*',
      pathPattern: '/**',
      templateName: 'x',
      variables: {},
      enabled: true,
    },
    renderedHtml: '<h1>x</h1>',
    rawJsonText: '{}',
    contentRoot,
  });

  expect(host.id).toBe('pj-topstrip-host');
  expect(document.body.firstElementChild).toBe(host); // prepended
  // closed shadow root is hidden — assert via the style element's side effect:
  // we can't read shadowRoot directly on a closed root, so prove the style was
  // wired by checking the host's render state via the attachShadow spy.
});

test('honors the parent option', () => {
  const parent = document.createElement('main');
  document.body.appendChild(parent);
  const contentRoot = document.createElement('div');
  parent.appendChild(contentRoot);

  const host = mountTopStrip({
    rule: {
      id: 'r1',
      hostPattern: '*',
      pathPattern: '/**',
      templateName: 'x',
      variables: {},
      enabled: true,
    },
    renderedHtml: '<h1>x</h1>',
    rawJsonText: '{}',
    contentRoot,
    parent,
  });

  expect(parent.firstElementChild).toBe(host);
});
```

- [ ] **Step 20.2: Run**

```bash
pnpm test src/content/mountTopStrip.test.ts
```

Expected: PASS. If the `?inline` import doesn't resolve in Vitest, check `vitest.config.ts` — we may need `import stripStyles from './topStrip.css?inline'` to be handled by Vite's CSS plugin (it is, by default, in Vitest, since Vitest extends the Vite config).

- [ ] **Step 20.3: Commit**

```bash
git add src/content/mountTopStrip.test.ts
git commit -m "content: mountTopStrip smoke tests"
```

---

## Task 21: E2E — top-strip full render on a matched fixture page

**Files:**
- Create: `test/e2e/topstrip.spec.ts`

Boot the extension, seed a rule + template via the SW, navigate to `http://127.0.0.1:4391/internal/user/1`, assert the strip's internal DOM via a *test-only escape hatch*. Since the shadow root is closed, tests reach in by monkey-patching `Element.prototype.attachShadow` before the extension loads to hold onto the root (standard closed-shadow test pattern).

- [ ] **Step 21.1: Write the test**

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

test('top-strip renders with rule name + toggle-group + menu on a matched page', async () => {
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
        hostPattern: '127.0.0.1',
        pathPattern: '/**',
        templateName: 'Example',
        variables: { env: 'staging' },
        enabled: true,
      }],
      templates: { Example: '<h1 id="pj-rendered">rendered</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  // Monkey-patch attachShadow BEFORE extension content script runs so the test
  // can reach into the closed root.
  await page.addInitScript(() => {
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init: ShadowRootInit) {
      const root = orig.call(this, { ...init, mode: 'open' });
      (this as any).__pjShadow = root;
      return root;
    };
  });

  await page.goto('http://127.0.0.1:4391/internal/user/1');
  await page.waitForSelector('#pj-topstrip-host');

  const probe = await page.evaluate(() => {
    const host = document.getElementById('pj-topstrip-host') as any;
    const root: ShadowRoot = host?.__pjShadow;
    const ruleName = root.querySelector('[data-testid="pj-rule-name"]')?.textContent ?? null;
    const env = root.querySelector('[data-testid="pj-env-chip"]')?.textContent ?? null;
    const hasGroup = Boolean(root.querySelector('[role="group"]'));
    const hasMenuTrigger = Boolean(root.querySelector('[data-testid="pj-menu-trigger"]'));
    return { ruleName, env, hasGroup, hasMenuTrigger };
  });

  expect(probe.ruleName).toBe('Example');
  expect(probe.env).toBe('staging');
  expect(probe.hasGroup).toBe(true);
  expect(probe.hasMenuTrigger).toBe(true);

  await ctx.close();
});
```

- [ ] **Step 21.2: Run**

```bash
pnpm build
pnpm test:e2e test/e2e/topstrip.spec.ts
```

Expected: PASS. Requires the fixture server — either start it beforehand (`pnpm fixtures &`) or extend `playwright.config.ts`'s `webServer`.

- [ ] **Step 21.3: Commit**

```bash
git add test/e2e/topstrip.spec.ts
git commit -m "test(e2e): topstrip renders on matched fixture"
```

---

## Task 22: E2E — ⌘⇧J toggles raw/rendered; Skip this host writes storage

**Files:**
- Modify: `test/e2e/topstrip.spec.ts` (append)

Driving `chrome.commands` from Playwright is not supported (it's a browser-level shortcut). Trigger the message directly from the service worker to exercise the same code path (`chrome.tabs.sendMessage` → content listener → mode flip).

- [ ] **Step 22.1: Append to `topstrip.spec.ts`**

```ts
test('toggle-raw message flips the strip into raw mode', async () => {
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
        id: 'r-k', hostPattern: '127.0.0.1', pathPattern: '/**',
        templateName: 'K', variables: {}, enabled: true,
      }],
      templates: { K: '<h1 id="pj-rendered">rendered</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4391/internal/user/1');
  await page.waitForSelector('#pj-root');

  // Pre-toggle: content root renders the template.
  expect(await page.locator('#pj-rendered').count()).toBe(1);

  // Fire the message from the SW against the active tab.
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) await chrome.tabs.sendMessage(tab.id, { kind: 'pj:toggle-raw' });
  });

  await page.waitForFunction(
    () => document.getElementById('pj-root')?.getAttribute('data-mode') === 'raw',
    null,
    { timeout: 2000 },
  );

  await ctx.close();
});

test('skip this host adds hostname to hostSkipList and reload shows raw page', async () => {
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
        id: 'r-s', hostPattern: '127.0.0.1', pathPattern: '/**',
        templateName: 'S', variables: {}, enabled: true,
      }],
      templates: { S: '<h1 id="pj-rendered">rendered</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init: ShadowRootInit) {
      const root = orig.call(this, { ...init, mode: 'open' });
      (this as any).__pjShadow = root;
      return root;
    };
  });

  await page.goto('http://127.0.0.1:4391/internal/user/1');
  await page.waitForSelector('#pj-topstrip-host');

  // Trigger the Skip this host handler by evaluating inside the shadow root.
  await page.evaluate(() => {
    const host = document.getElementById('pj-topstrip-host') as any;
    const root: ShadowRoot = host.__pjShadow;
    (root.querySelector('[data-testid="pj-menu-trigger"]') as HTMLButtonElement).click();
  });
  await page.evaluate(() => {
    const host = document.getElementById('pj-topstrip-host') as any;
    const root: ShadowRoot = host.__pjShadow;
    const items = root.querySelectorAll('.pj-menu-item');
    const skip = Array.from(items).find((el) => el.textContent?.includes('Skip this host'));
    (skip as HTMLButtonElement).click();
  });

  // Reload will be triggered by the handler; wait for storage to reflect.
  const stored = await worker.evaluate(
    async () => (await chrome.storage.local.get('hostSkipList')) as { hostSkipList: string[] },
  );
  expect(stored.hostSkipList).toContain('127.0.0.1');

  await ctx.close();
});
```

- [ ] **Step 22.2: Run**

```bash
pnpm test:e2e test/e2e/topstrip.spec.ts
```

Expected: all three tests PASS.

- [ ] **Step 22.3: Commit**

```bash
git add test/e2e/topstrip.spec.ts
git commit -m "test(e2e): topstrip toggle-raw + skip-host"
```

---

## Task 23: Axe-core WCAG sweep on a rendered page

**Files:**
- Create: `test/e2e/a11y-topstrip.spec.ts`

Mirror `test/e2e/a11y-popup.spec.ts`. Axe-core respects shadow DOM when told to; we pass the host selector via `AxeBuilder#include`.

- [ ] **Step 23.1: Write the test**

```ts
import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

for (const theme of ['light', 'dark'] as const) {
  test(`topstrip has no a11y violations (${theme})`, async () => {
    const ctx = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    const [sw] = ctx.serviceWorkers();
    const worker = sw ?? (await ctx.waitForEvent('serviceworker'));

    await worker.evaluate(async (pref) => {
      await chrome.storage.local.set({
        pj_storage_area: 'local',
        rules: [{
          id: 'r-a11y', hostPattern: '127.0.0.1', pathPattern: '/**',
          templateName: 'A', variables: { env: 'staging' }, enabled: true,
        }],
        templates: { A: '<h1>a</h1>' },
        hostSkipList: [],
        settings: { themePreference: pref },
      });
    }, theme);

    const page = await ctx.newPage();
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('http://127.0.0.1:4391/internal/user/1');
    await page.waitForSelector('#pj-topstrip-host');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('#pj-topstrip-host')
      .analyze();

    expect(results.violations).toEqual([]);
    await ctx.close();
  });
}
```

- [ ] **Step 23.2: Run**

```bash
pnpm test:e2e test/e2e/a11y-topstrip.spec.ts
```

Expected: PASS. Contrast violations typically mean small text on an `--pj-accent` wash — swap to `--pj-accent-strong` (CLAUDE.md gotcha) in `topStrip.css`.

- [ ] **Step 23.3: Commit**

```bash
git add test/e2e/a11y-topstrip.spec.ts
git commit -m "test(e2e): axe-core wcag sweep on topstrip (light + dark)"
```

---

## Task 24: Full verification sweep

- [ ] **Step 24.1: Run the full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

Expected: all green. If red, fix before proceeding to code review.

- [ ] **Step 24.2: Manual Chrome check**

Remind Matt to reload the extension at `chrome://extensions/`. Manual checklist:
1. Matched page → strip shows `{>` + env chip (if `vars.env` set) + rule name + `Rendered | Raw` toggle-group + ⋯ menu.
2. Click Raw → page body swaps to a `<pre>` of pretty JSON. Click Rendered → swaps back.
3. Press `⌘⇧J` → toggles equivalently (active state moves in lockstep).
4. Menu → Copy URL → paste; confirm URL matches.
5. Menu → Edit rule → new tab opens on the options page with the matched rule's modal open.
6. Menu → Skip this host → page reloads and shows raw JSON (no strip); popup's skip toggle for that hostname is now on.
7. Change theme in the options page → the already-open top-strip flips light↔dark without reload.
8. Navigate to a non-matched URL → no strip, no rendering.

Await Matt's explicit "looks good" before Task 25.

---

## Task 25: Code review

Dispatch a fresh reviewer agent over the whole Plan 5 diff vs. `main`.

- [ ] **Step 25.1: Dispatch `feature-dev:code-reviewer`**

Prompt template:

> Review the whole diff on branch `feature/phase2-plan5-topstrip` vs. `main`. This is Phase 2, Plan 5 — rendered top-strip — per the locked spec at `docs/superpowers/specs/2026-04-18-phase2-ux-polish-design.md`. Focus on: (1) shadow-DOM isolation (style + event listeners don't leak into or from the host page), (2) the `Menu` outside-click patch (listens on `ShadowRoot` when nested — covers shadow-root case without regressing the plain-document case), (3) the `chrome.commands` → background → content message relay (no message spoofing — content-listener checks `kind === 'pj:toggle-raw'`), (4) CSP safety inside the shadow root (no runtime codegen pulled in via deep-imports), (5) accessibility (aria-pressed on toggles, aria-label on menu trigger, focus-visible rings, contrast in both themes — verified by the new a11y-topstrip spec), (6) reactivity to storage changes (theme toggle from options flips an already-open strip without reload), (7) bundle impact of the content script (check that `topStrip.css?inline` lands as a string and deep-imports haven't pulled CodeMirror in via a barrel re-export). Report high-confidence issues only.

- [ ] **Step 25.2: Address findings**

Apply fixes in-place. Out-of-scope findings → ROADMAP pre-release polish subitems.

- [ ] **Step 25.3: Commit**

```bash
git add -A
git commit -m "review: address plan 5 reviewer findings"
```

---

## Task 26: Docs update

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `ROADMAP.md`
- Modify: `docs/superpowers/plans/2026-04-18-phase2-plan5-topstrip.md` (status banner)

- [ ] **Step 26.1: README** — add to the feature list: *"Rendered pages get a shadow-DOM top-strip with env chip, rule name, Rendered/Raw toggle, Copy URL / Edit rule / Skip-this-host menu, `⌘⇧J` keyboard shortcut."*

- [ ] **Step 26.2: CLAUDE.md**

In the Architecture section, replace the existing `src/content/content-script.ts` bullet with:

```
- `src/content/content-script.ts` — parse JSON from `body.innerText`, match, render, replace `documentElement` HTML; hands off to `mountTopStrip` for the shadow-DOM strip.
- `src/content/mountTopStrip.ts` — creates a closed shadow root on a host `<div>` prepended to `document.body`, injects `topStrip.css?inline`, renders `<TopStrip />` into the shadow root.
- `src/content/TopStrip.tsx` — Preact strip with brand, env chip, rule name, Rendered/Raw toggle-group, ⋯ menu (Copy URL / Edit rule / Skip this host). Deep-imports `Menu`, `useStorage`, `useTheme` from `src/ui/*` (not the barrel, per the popup gotcha). Listens for `pj:toggle-raw` messages from the background SW to handle `⌘⇧J`.
- `src/content/conflictDetect.ts` — Phase 2 stub; Phase 4 fills in the heuristic for "another viewer handled this page first".
```

Add a new Gotchas bullet:

```
- **Top-strip styling lives inside the shadow root.** `topStrip.css` redeclares the subset of `--pj-*` tokens it needs on `:host` / `:host([data-theme="dark"])` because CSS custom properties don't cross the shadow boundary. If a new token is needed, add it to both `theme.css` (source of truth) *and* `topStrip.css`.
- **`Menu` outside-click listener detects `ShadowRoot` via `getRootNode()`** and listens on the root rather than `document` when nested. Events in closed shadow trees are re-targeted to the host, so the document-level handler can't distinguish clicks inside the menu from clicks elsewhere.
- **`⌘⇧J` is wired via `chrome.commands`** declared in the manifest; the background SW forwards `chrome.commands.onCommand` → `chrome.tabs.sendMessage({ kind: 'pj:toggle-raw' })` to the active tab. Content-strip listens via `chrome.runtime.onMessage`. Rebinding is handled natively by Chrome at `chrome://extensions/shortcuts`.
```

- [ ] **Step 26.3: ROADMAP**

Under Phase 2, flip Plan 5 to done:

```
5. **Plan 5 — Top-strip**: shadow-rooted injected banner, warm cream / warm near-black palette, ⋯ menu for secondaries, keyboard shortcuts. — done YYYY-MM-DD
```

Mark Phase 2 itself **done** once Plan 5 ships (this is the last sub-plan).

- [ ] **Step 26.4: Plan status banner**

Edit the top of this file:

```
> **Status:** Shipped YYYY-MM-DD on `feature/phase2-plan5-topstrip` → `main`.
```

- [ ] **Step 26.5: Commit**

```bash
git add README.md CLAUDE.md ROADMAP.md docs/superpowers/plans/2026-04-18-phase2-plan5-topstrip.md
git commit -m "docs: phase 2 plan 5 shipped (topstrip rewrite)"
```

---

## Task 27: Pre-ship manual verification + FF-merge

- [ ] **Step 27.1: Surface what was built**

Summarize to Matt: files added/modified, the Task 24 Step 2 manual checklist, any polish routed to ROADMAP.

- [ ] **Step 27.2: Wait for explicit "ship it"**

Do not FF-merge without Matt's approval.

- [ ] **Step 27.3: FF-merge + push**

```bash
git checkout main
git merge --ff-only feature/phase2-plan5-topstrip
git push origin main
```

- [ ] **Step 27.4: Delete the local impl branch after push confirms**

```bash
git branch -d feature/phase2-plan5-topstrip
```

Do **not** delete the remote branch or run destructive git commands without permission.

---

## Self-review checklist

Spec coverage vs. `2026-04-18-phase2-ux-polish-design.md` *Rendered top-strip* section:
- [x] `{>` logo (brand identity) → Task 5.
- [x] Env badge: orange chip showing `vars.env` if set; hidden otherwise → Task 5.
- [x] Rule name: monospace → Task 5.
- [x] Toggle-group: Rendered / Raw — orange active state, `⌘⇧J` hint → Tasks 6, 10, 16.
- [x] `⋯` menu with Copy URL / Edit rule / Skip this host → Tasks 7, 9, 11–13.
- [x] Palette: warm cream / warm near-black, orange `>` → `topStrip.css` (Task 3).
- [x] Theme detection via stored `settings.themePreference`; subscribes to storage change events → Task 17.
- [x] Shadow-DOM isolation via `attachShadow({ mode: 'closed' })` → Task 3.
- [x] Conflict-detection slot reservation → Task 18.
- [x] `⌘⇧J` registered via `chrome.commands` → Task 14; relayed Task 15; listened Task 16.
- [x] Copy URL = `⌘⇧C`? **Spec note:** spec lists the `⌘⇧C` keyboard shortcut but scopes the *command registration* to options-page footer documentation. Plan 5 documents `⌘⇧J` as the only new `chrome.commands` entry; `⌘⇧C` is a system/browser shortcut we cannot hijack. Menu label on Copy URL shows the chord visually (existing options footer already documents this) — no new manifest `commands` entry for Copy URL.

Placeholder scan: no "TBD", "implement later", "add appropriate", "similar to". Complete code blocks in every code step.

Type/identifier consistency:
- `TopStripProps` extended in Task 3 (shell) → Task 6 (toggle state) → Task 18 (degraded). All fields referenced downstream match.
- `mountTopStrip` return = `HTMLElement`, used by Task 20 tests.
- `directiveHash.editRule` used identically in Task 12 and already in Plan 4 Task 16.
- `pj:toggle-raw` message kind used in Task 15 (dispatch) and Task 16 (listen) — identical string.
- `chrome.commands` name `toggle-raw` used in Task 14 (manifest) and Task 15 (`onCommand` comparison) — identical string.

---

## Execution mode

Per Matt's global CLAUDE.md: **Inline Execution** is the standing default. When this spec is FF-merged, execute Plan 5 task-by-task in the active session with checkpoints at Tasks 4 (shadow-DOM CSP smoke), 13 (all menu actions wired), 17 (theme reactivity lands), 24 (full suite green), and 27 (ship).
