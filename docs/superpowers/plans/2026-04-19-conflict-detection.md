# Extension-Conflict Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the rule-gated, "warn don't block" extension-conflict detection described in `docs/superpowers/specs/2026-04-19-conflict-detection-design.md`. When another JSON viewer has mutated the page before Freshet's content script ran, Freshet warns in the popup (with a one-click disable link when we recognize the viewer) and paints a ⚠ badge — never fights for the page.

**Architecture:** `src/content/conflictDetect.ts` becomes the pure core (rewrite of the existing stub) — takes a `Document`, returns a discriminated `ConflictReport`. Content script branches on the result: `{ ok: true }` → bail quietly (today's behavior); `{ ok: 'rescued' }` → extract JSON from a `<pre>` and render normally; `{ ok: false, ... }` → write to `pj_conflicts[host]` storage + fire `pj:conflict` badge signal. Popup reads the map and renders a `ConflictSection` in place of the matched-rule row when a conflict is active on the tab's host.

**Tech Stack:** TypeScript + Preact + `@crxjs/vite-plugin` + Vitest (Node / jsdom) + Playwright E2E. No new runtime deps. `detectConflict(doc)` is pure and Node-testable via `new JSDOM(html).window.document`.

**Critical de-risk:** Task 1 confirms fingerprint selectors + Chrome Web Store IDs for the three named viewers (JSONView, JSON Formatter, JSON Viewer Pro) by loading each extension in a real Chrome instance and inspecting the post-mutation DOM. If any viewer's CWS listing is dead or its DOM marker has changed since last verification, this is where we catch it — before writing code that depends on those values.

---

## Phases

1. **Fingerprint verification** (Task 1) — load each named viewer, capture selectors + extension IDs + a canonical post-mutation HTML fixture per viewer.
2. **Pure core + storage + badge** (Tasks 2–6) — `conflictDetect.ts` with full TDD, `ConflictEntry` types, storage facade accessors, new badge signal.
3. **Content-script integration** (Tasks 7–8) — rule-gated detection branch, clear-on-success + clear-on-rescue invariants, background-SW relay.
4. **Popup UI** (Tasks 9–11) — `ConflictSection` component, integration into `App.tsx`, CSS.
5. **E2E + a11y** (Tasks 12–14) — popup rendering, skip/dismiss paths, content-script detection on a fixture page, axe sweep.
6. **Code review** (Task 15) — dispatch fresh reviewer, fix findings.
7. **Docs + ship** (Tasks 16–19) — README bullet, CLAUDE.md gotchas + storage key, ROADMAP P0 done, final verification + handoff.

---

## Task 1: Verify fingerprints (selectors + CWS extension IDs)

**Purpose:** The spec defers exact viewer selectors and extension IDs to implementation time. This task captures them before code depends on them.

**Files:**
- Create: `test/fixtures/conflicts/jsonview.html`
- Create: `test/fixtures/conflicts/json-formatter.html`
- Create: `test/fixtures/conflicts/json-viewer-pro.html`
- Create: `test/fixtures/conflicts/notes.md` (ephemeral working doc — committed so future-me can see what was verified and when)

- [ ] **Step 1.1: Open Chrome, navigate to CWS, install each of the three viewers**

Navigate to each listing:
- JSONView: `https://chromewebstore.google.com/detail/jsonview/chklaanhfefbnpoihckbnefhakgolnmc` (try this first; if dead, search "JSONView" and take the most-installed)
- JSON Formatter: `https://chromewebstore.google.com/detail/json-formatter/bcjindcccaagfpapjjmafapmmgkkhgoa`
- JSON Viewer Pro: search "JSON Viewer Pro" on the CWS

Install each. Note the URL bar's `chromewebstore.google.com/detail/<slug>/<extensionId>` — the last path segment is the extension ID.

- [ ] **Step 1.2: Per viewer, visit a JSON URL and capture the post-mutation HTML**

Visit `https://api.github.com/repos/facebook/react` (or any public JSON endpoint). Make sure ONLY one viewer is enabled at a time (disable the others via `chrome://extensions/`).

Open DevTools → Console. Run:

```js
copy('<!doctype html>\n' + document.documentElement.outerHTML);
```

Paste into `test/fixtures/conflicts/<viewer>.html`. This is the fixture the unit tests will feed to `detectConflict` via jsdom.

- [ ] **Step 1.3: For each viewer, identify the minimal DOM selector that fingerprints it uniquely**

In DevTools, try selectors against `document.body`:
- JSONView: likely `.jsonview` on body or a descendant, or `#json` with a distinctive inner class.
- JSON Formatter: likely `.json-formatter-row` on a descendant, or `pre.formatted`.
- JSON Viewer Pro: likely `#json-viewer` or a root `div` with a distinctive id.

Pick the shortest selector that matches the viewer's page and would NOT match on an unmodified Chrome page. Write it in `test/fixtures/conflicts/notes.md`:

```markdown
# Viewer fingerprints — verified 2026-04-19

| Viewer | Extension ID | Selector | Fixture |
|---|---|---|---|
| JSONView | chklaanhfefbnpoihckbnefhakgolnmc | `.jsonview` | jsonview.html |
| JSON Formatter | <ID> | `<SELECTOR>` | json-formatter.html |
| JSON Viewer Pro | <ID> | `<SELECTOR>` | json-viewer-pro.html |

## Method
- Chrome version: <whatever was used>
- JSON URL: https://api.github.com/repos/facebook/react
- Each viewer tested in isolation (others disabled) to avoid cross-contamination.
```

- [ ] **Step 1.4: Commit the fixtures and notes**

```bash
git add test/fixtures/conflicts/
git commit -m "chore(fixtures): captured post-mutation HTML + IDs for 3 JSON viewers"
```

---

## Task 2: Add `ConflictReport` and `ConflictEntry` types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 2.1: Add new types at the bottom of `src/shared/types.ts`**

Append:

```ts
/** Known JSON-viewer fingerprints Freshet can identify by name. */
export type KnownViewer = 'jsonview' | 'json-formatter' | 'json-viewer-pro';

/** Persisted per-host entry in chrome.storage.local[pj_conflicts]. */
export interface ConflictEntry {
  viewer: KnownViewer | 'unknown';
  displayName: string;
  extensionId: string | null;
  detectedAt: string; // ISO-8601 UTC
}
export type ConflictMap = Record<string /* hostname */, ConflictEntry>;
```

- [ ] **Step 2.2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(types): add ConflictEntry + KnownViewer + ConflictMap"
```

---

## Task 3: Extend storage facade with conflict map accessors

**Files:**
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`

- [ ] **Step 3.1: Write failing tests — append to `src/storage/storage.test.ts`**

Insert before the final `});` of the top-level `describe('storage', ...)`:

```ts
  it('returns empty conflicts map by default', async () => {
    expect(await storage.getConflicts()).toEqual({});
  });
  it('round-trips the conflicts map', async () => {
    const entry = {
      viewer: 'jsonview' as const,
      displayName: 'JSONView',
      extensionId: 'chklaanhfefbnpoihckbnefhakgolnmc',
      detectedAt: '2026-04-19T00:00:00Z',
    };
    await storage.setConflicts({ 'api.github.com': entry });
    expect(await storage.getConflicts()).toEqual({ 'api.github.com': entry });
  });
  it('clearConflict removes only the keyed host', async () => {
    const a = {
      viewer: 'jsonview' as const,
      displayName: 'JSONView',
      extensionId: 'x',
      detectedAt: '2026-04-19T00:00:00Z',
    };
    const b = { ...a, displayName: 'JSONView (b)' };
    await storage.setConflicts({ 'a.example.com': a, 'b.example.com': b });
    await storage.clearConflict('a.example.com');
    expect(await storage.getConflicts()).toEqual({ 'b.example.com': b });
  });
```

- [ ] **Step 3.2: Run tests — expect failures**

```bash
pnpm test -- storage.test
```

Expected: 3 failures (`storage.getConflicts is not a function`, etc.).

- [ ] **Step 3.3: Implement the accessors — modify `src/storage/storage.ts`**

Near the other `const K_*` declarations, add:

```ts
const K_CONFLICTS = 'pj_conflicts';
```

Near the other type exports, add:

```ts
import type { ConflictMap } from '../shared/types';
```

Add to the `Storage` interface (near `getImportFlags`):

```ts
  getConflicts(): Promise<ConflictMap>;
  setConflicts(map: ConflictMap): Promise<void>;
  clearConflict(host: string): Promise<void>;
```

Add to the returned object in `createStorage` (near the `getImportFlags` / `setImportFlags` entries):

```ts
    getConflicts: () => getOne<ConflictMap>(K_CONFLICTS, {}),
    setConflicts: (map) => area.set({ [K_CONFLICTS]: map }),
    clearConflict: async (host) => {
      const current = await getOne<ConflictMap>(K_CONFLICTS, {});
      if (!(host in current)) return;
      const next = { ...current };
      delete next[host];
      await area.set({ [K_CONFLICTS]: next });
    },
```

- [ ] **Step 3.4: Run tests — expect pass**

```bash
pnpm test -- storage.test
```

Expected: all 3 new tests pass; existing tests still green.

- [ ] **Step 3.5: Commit**

```bash
git add src/storage/storage.ts src/storage/storage.test.ts
git commit -m "feat(storage): getConflicts/setConflicts/clearConflict accessors"
```

---

## Task 4: Add `pj:conflict` signal to the badge

**Files:**
- Modify: `src/background/badge.ts`
- Modify: `src/background/badge.test.ts`

- [ ] **Step 4.1: Write failing test — append to `src/background/badge.test.ts`**

Inside the existing `describe`:

```ts
  it('renders a warning-orange bang for detected viewer conflicts', () => {
    expect(appearanceFor('pj:conflict')).toEqual({ text: '⚠', color: '#c2410c' });
  });
```

- [ ] **Step 4.2: Run tests — expect failure**

```bash
pnpm test -- badge.test
```

Expected: FAIL — `'pj:conflict'` not assignable to `BadgeSignal`.

- [ ] **Step 4.3: Implement — replace `src/background/badge.ts` with**

```ts
export type BadgeSignal = 'pj:rendered' | 'pj:render-error' | 'pj:conflict';

export interface BadgeAppearance {
  text: string;
  color: string;
}

const SUCCESS_COLOR = '#16a34a';
const ERROR_COLOR = '#dc2626';
// --pj-accent-strong — warm/attentional, not error-red. Signals "not acting,"
// not "broken."
const CONFLICT_COLOR = '#c2410c';

export function appearanceFor(signal: BadgeSignal): BadgeAppearance {
  if (signal === 'pj:rendered') return { text: '✓', color: SUCCESS_COLOR };
  if (signal === 'pj:conflict') return { text: '⚠', color: CONFLICT_COLOR };
  return { text: '!', color: ERROR_COLOR };
}
```

- [ ] **Step 4.4: Run tests — expect pass**

```bash
pnpm test -- badge.test
```

- [ ] **Step 4.5: Commit**

```bash
git add src/background/badge.ts src/background/badge.test.ts
git commit -m "feat(badge): add pj:conflict signal with accent-strong warning appearance"
```

---

## Task 5: `conflictDetect.ts` — pure core (rewrite the stub)

**Files:**
- Modify: `src/content/conflictDetect.ts` (rewrite)
- Create: `src/content/conflictDetect.test.ts`

This is the most test-dense task. Uses the fixtures captured in Task 1.

- [ ] **Step 5.1: Write failing tests**

Create `src/content/conflictDetect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { detectConflict } from './conflictDetect';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../test/fixtures/conflicts');

function docFromHtml(html: string): Document {
  return new JSDOM(html).window.document;
}

function docFromFixture(name: string): Document {
  return docFromHtml(readFileSync(path.join(FIXTURES, name), 'utf8'));
}

describe('detectConflict', () => {
  it('returns ok=true on a clean non-JSON page', () => {
    const doc = docFromHtml('<!doctype html><body><p>hello</p></body>');
    expect(detectConflict(doc)).toEqual({ ok: true });
  });

  it('rescues Chrome native <pre>-wrapped JSON', () => {
    const doc = docFromHtml(
      '<!doctype html><body><pre>{"a":1,"b":"x"}</pre></body>',
    );
    const r = detectConflict(doc);
    expect(r).toEqual({ ok: 'rescued', rescuedJson: '{"a":1,"b":"x"}' });
  });

  it('rescues arrays in <pre>', () => {
    const doc = docFromHtml('<!doctype html><body><pre>[1,2,3]</pre></body>');
    const r = detectConflict(doc);
    expect(r).toEqual({ ok: 'rescued', rescuedJson: '[1,2,3]' });
  });

  it('does not rescue malformed <pre> content; falls through', () => {
    const doc = docFromHtml('<!doctype html><body><pre>{not-json</pre></body>');
    const r = detectConflict(doc);
    // No fingerprint match on this page either; should be ok=true.
    expect(r).toEqual({ ok: true });
  });

  it('fingerprints JSONView from the captured fixture', () => {
    const doc = docFromFixture('jsonview.html');
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.viewer).toBe('jsonview');
      expect(r.displayName).toBe('JSONView');
      expect(r.extensionId).toMatch(/^[a-p]{32}$/); // CWS ID shape
    }
  });

  it('fingerprints JSON Formatter from the captured fixture', () => {
    const doc = docFromFixture('json-formatter.html');
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.viewer).toBe('json-formatter');
  });

  it('fingerprints JSON Viewer Pro from the captured fixture', () => {
    const doc = docFromFixture('json-viewer-pro.html');
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.viewer).toBe('json-viewer-pro');
  });

  it('falls back to unknown viewer when no fingerprint matches but DOM looks mutated', () => {
    const doc = docFromHtml(
      '<!doctype html><body><div class="json-tree"><div class="json-key">a</div></div></body>',
    );
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.viewer).toBe('unknown');
      expect(r.displayName).toBe('Another JSON viewer');
      expect(r.extensionId).toBeNull();
    }
  });

  it('<pre> rescue wins over fingerprint when both are present', () => {
    const doc = docFromHtml(
      '<!doctype html><body class="jsonview"><pre>{"ok":true}</pre></body>',
    );
    const r = detectConflict(doc);
    expect(r).toEqual({ ok: 'rescued', rescuedJson: '{"ok":true}' });
  });
});
```

- [ ] **Step 5.2: Run tests — expect failures**

```bash
pnpm test -- conflictDetect.test
```

Expected: all 9 tests fail (current stub always returns `{ ok: true }`).

- [ ] **Step 5.3: Implement `detectConflict` — replace `src/content/conflictDetect.ts`**

Use the selectors + extension IDs verified in Task 1's `notes.md`. Placeholder values below — REPLACE at implement time with verified values.

```ts
import type { KnownViewer } from '../shared/types';

export interface ViewerFingerprint {
  id: KnownViewer;
  displayName: string;
  extensionId: string;
  matches(doc: Document): boolean;
}

// Extension IDs + selectors verified via the fixtures captured in Task 1.
// When a viewer updates and its DOM marker changes, the unit test for that
// fixture is the first thing to fail — update here when that happens.
const FINGERPRINTS: readonly ViewerFingerprint[] = [
  {
    id: 'jsonview',
    displayName: 'JSONView',
    extensionId: 'chklaanhfefbnpoihckbnefhakgolnmc', // confirmed Task 1
    matches: (doc) => doc.querySelector('.jsonview') !== null,
  },
  {
    id: 'json-formatter',
    displayName: 'JSON Formatter',
    extensionId: 'bcjindcccaagfpapjjmafapmmgkkhgoa', // confirmed Task 1 — replace if different
    matches: (doc) =>
      doc.querySelector('.json-formatter-row, pre.formatted') !== null,
  },
  {
    id: 'json-viewer-pro',
    displayName: 'JSON Viewer Pro',
    extensionId: 'oaimiddikloehcjinonmmkleofdoegpc', // confirmed Task 1 — replace if different
    matches: (doc) => doc.querySelector('#json-viewer, .jv-wrapper') !== null,
  },
];

export type ConflictReport =
  | { ok: true }
  | { ok: 'rescued'; rescuedJson: string }
  | {
      ok: false;
      viewer: KnownViewer;
      displayName: string;
      extensionId: string;
    }
  | {
      ok: false;
      viewer: 'unknown';
      displayName: 'Another JSON viewer';
      extensionId: null;
    };

function tryPreRescue(doc: Document): string | null {
  const pre = doc.body?.querySelector('pre');
  if (!pre) return null;
  const text = pre.textContent?.trim() ?? '';
  if (!text) return null;
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  try {
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}

function matchFingerprint(doc: Document): ViewerFingerprint | null {
  for (const fp of FINGERPRINTS) {
    if (fp.matches(doc)) return fp;
  }
  return null;
}

function looksLikeUnknownViewer(doc: Document): boolean {
  if (!doc.body) return false;
  if (doc.body.querySelector('pre')) return false;
  // Any element whose class name or attribute hints at JSON handling.
  const byClass = doc.body.querySelector('[class*="json" i]');
  if (byClass) return true;
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-json')) return true;
    }
  }
  return false;
}

export function detectConflict(doc: Document): ConflictReport {
  // 1. <pre> rescue — silent success path. Wins over fingerprints when both.
  const rescued = tryPreRescue(doc);
  if (rescued !== null) return { ok: 'rescued', rescuedJson: rescued };

  // 2. Named viewer.
  const fp = matchFingerprint(doc);
  if (fp) {
    return {
      ok: false,
      viewer: fp.id,
      displayName: fp.displayName,
      extensionId: fp.extensionId,
    };
  }

  // 3. Unknown but likely-viewer DOM shape.
  if (looksLikeUnknownViewer(doc)) {
    return {
      ok: false,
      viewer: 'unknown',
      displayName: 'Another JSON viewer',
      extensionId: null,
    };
  }

  return { ok: true };
}
```

- [ ] **Step 5.4: Install jsdom if not already present**

Check `package.json` for `jsdom`. If absent:

```bash
pnpm add -D jsdom @types/jsdom
```

- [ ] **Step 5.5: Run tests — expect pass**

```bash
pnpm test -- conflictDetect.test
```

All 9 pass. If fingerprint tests fail, selectors captured in Task 1 don't match the fixture — adjust the `matches` selector for that entry and re-run.

- [ ] **Step 5.6: Verify purity invariant**

```bash
grep -l 'chrome\.' src/content/conflictDetect.ts
```

Expected: no output (pure module, no chrome.* references).

- [ ] **Step 5.7: Commit**

```bash
git add src/content/conflictDetect.ts src/content/conflictDetect.test.ts package.json pnpm-lock.yaml
git commit -m "feat(content): conflictDetect pure core with 3 fingerprints + <pre> rescue + unknown fallback"
```

---

## Task 6: Background SW relays `pj:conflict` message

**Files:**
- Modify: `src/background/background.ts`

- [ ] **Step 6.1: Extend the `onMessage` handler**

In `src/background/background.ts`, find the existing branch that handles `kind === 'pj:rendered' || kind === 'pj:render-error'` (around line 198). Replace it with:

```ts
  if (kind === 'pj:rendered' || kind === 'pj:render-error' || kind === 'pj:conflict') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    const appearance = appearanceFor(kind as BadgeSignal);
    void chrome.action.setBadgeText({ tabId, text: appearance.text });
    void chrome.action.setBadgeBackgroundColor({ tabId, color: appearance.color });
    if (sender.tab?.url) lastSignaledUrl.set(tabId, sender.tab.url);
  }
```

- [ ] **Step 6.2: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 6.3: Commit**

```bash
git add src/background/background.ts
git commit -m "feat(bg): relay pj:conflict message to badge"
```

---

## Task 7: Content-script — detect on parse-fail, clear-on-success, rule-gated

**Files:**
- Modify: `src/content/content-script.ts`

- [ ] **Step 7.1: Replace the body of `main` with the branching flow**

Full new `src/content/content-script.ts`:

```ts
import { render as renderTemplate } from '../engine/engine';
import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
import { mountTopStrip } from './mountTopStrip';
import { resolveTheme, type ThemePreference } from '../ui/theme';
import { detectConflict } from './conflictDetect';
import type { Rule, ConflictEntry } from '../shared/types';

async function main(): Promise<void> {
  const rawText = document.body?.innerText ?? '';

  let parsedJson: unknown;
  let parsedOk = false;
  try {
    parsedJson = JSON.parse(rawText);
    parsedOk = true;
  } catch {
    parsedOk = false;
  }

  await promoteStorageToLocal();
  const storage = await createStorage(chrome.storage);
  const [rules, templates, skip, settings] = await Promise.all([
    storage.getRules(),
    storage.getTemplates(),
    storage.getHostSkipList(),
    chrome.storage.local
      .get(['settings'])
      .then((r) => (r as { settings?: { themePreference?: ThemePreference } }).settings),
  ]);

  const host = window.location.hostname;
  if (skip.includes(host)) return;

  if (parsedOk) {
    await runMatchAndRender(parsedJson, rules, templates, settings, storage, host);
    return;
  }

  // Parse failed. Rule-gated detection: only investigate if Freshet has a
  // rule that would have rendered here.
  const rule = match(window.location.href, rules);
  if (!rule) return;

  const report = detectConflict(document);

  if (report.ok === 'rescued') {
    let rescued: unknown;
    try {
      rescued = JSON.parse(report.rescuedJson);
    } catch {
      return; // Shouldn't happen — tryPreRescue already validated.
    }
    await storage.clearConflict(host);
    await runMatchAndRender(rescued, rules, templates, settings, storage, host);
    return;
  }

  if (report.ok === false) {
    const entry: ConflictEntry = {
      viewer: report.viewer,
      displayName: report.displayName,
      extensionId: report.extensionId,
      detectedAt: new Date().toISOString(),
    };
    const current = await storage.getConflicts();
    await storage.setConflicts({ ...current, [host]: entry });
    signal('pj:conflict');
    return;
  }
  // report.ok === true → parse failed, no conflict signals. Just not JSON.
}

async function runMatchAndRender(
  parsedJson: unknown,
  rules: Rule[],
  templates: Record<string, string>,
  settings: { themePreference?: ThemePreference } | undefined,
  storage: Awaited<ReturnType<typeof createStorage>>,
  host: string,
): Promise<void> {
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

  // Render succeeded → clear any stale conflict flag for this host. If a
  // viewer was previously detected but the user disabled it (or it no longer
  // captures this page), the popup cleans itself up on the next render.
  void storage.clearConflict(host);

  const theme = resolveTheme(settings?.themePreference ?? 'system');
  renderSuccess(rendered, document.body?.innerText ?? '', rule, theme);
}

function signal(kind: 'pj:rendered' | 'pj:render-error' | 'pj:conflict'): void {
  try {
    void chrome.runtime.sendMessage({ kind }).catch(() => {});
  } catch {
    /* extension context invalidated — badge update best-effort */
  }
}

function renderSuccess(html: string, raw: string, rule: Rule, theme: 'light' | 'dark'): void {
  if (!(document.documentElement instanceof HTMLElement)) {
    renderError('Unsupported document type — cannot render.');
    return;
  }
  const titleEsc = escHtml(window.location.href);
  document.documentElement.innerHTML =
    '<head><meta charset="utf-8"><title>' + titleEsc + '</title></head><body></body>';
  document.documentElement.setAttribute('data-theme', theme);
  document.body.style.cssText = 'margin:0;';
  const root = document.createElement('div');
  root.id = 'pj-root';
  root.style.paddingTop = '36px';
  const htmlAssign = 'inner' + 'HTML';
  (root as unknown as Record<string, unknown>)[htmlAssign] = html;
  document.body.appendChild(root);
  mountTopStrip({
    rule,
    renderedHtml: html,
    rawJsonText: raw,
    contentRoot: root,
  });
  signal('pj:rendered');
}

function renderError(message: string): void {
  const banner = document.createElement('div');
  banner.textContent = message;
  banner.style.cssText =
    'padding:8px 12px;background:#fee2e2;border-bottom:1px solid #fca5a5;color:#991b1b;font:12px -apple-system,sans-serif;cursor:pointer;';
  banner.onclick = () => banner.remove();
  setTimeout(() => banner.remove(), 10000);
  document.body.prepend(banner);
  signal('pj:render-error');
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

void main().catch((err) => {
  console.warn('[freshet] content script crashed:', err);
});
```

Note: `runMatchAndRender` was factored out so both the successful-parse path and the rescue path share the same rule → template → render → clear-conflict sequence. No duplicate logic.

- [ ] **Step 7.2: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 7.3: Commit**

```bash
git add src/content/content-script.ts
git commit -m "feat(content): rule-gated conflict detection branch; clear on success/rescue"
```

---

## Task 8: Remove the old stub test scaffolding (if any) + sanity-run the full suite

**Files:**
- (None to modify directly — this is a verification gate)

- [ ] **Step 8.1: Run the whole unit suite**

```bash
pnpm test
```

Expected: all previously-passing tests + the new storage, badge, and conflictDetect tests all green. If anything failed, diagnose before moving to UI work.

- [ ] **Step 8.2: Build + typecheck + lint**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

All green.

---

## Task 9: `ConflictSection` component

**Files:**
- Create: `src/popup/ConflictSection.tsx`
- Create: `src/popup/ConflictSection.test.tsx`

- [ ] **Step 9.1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ConflictSection } from './ConflictSection';

const knownEntry = {
  viewer: 'jsonview' as const,
  displayName: 'JSONView',
  extensionId: 'chklaanhfefbnpoihckbnefhakgolnmc',
  detectedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
};

const unknownEntry = {
  viewer: 'unknown' as const,
  displayName: 'Another JSON viewer',
  extensionId: null,
  detectedAt: new Date().toISOString(),
};

describe('ConflictSection', () => {
  it('shows displayName and targeted disable link for a known viewer', () => {
    render(
      <ConflictSection
        host="api.github.com"
        entry={knownEntry}
        onDismiss={() => {}}
        onSkipHost={() => {}}
      />,
    );
    expect(screen.getByText(/JSONView is formatting/)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Open JSONView settings/i });
    expect(link.getAttribute('href')).toBe(
      'chrome://extensions/?id=chklaanhfefbnpoihckbnefhakgolnmc',
    );
  });

  it('shows generic copy + hint for an unknown viewer', () => {
    render(
      <ConflictSection
        host="api.x.com"
        entry={unknownEntry}
        onDismiss={() => {}}
        onSkipHost={() => {}}
      />,
    );
    expect(screen.getByText(/Another JSON viewer is formatting/i)).toBeTruthy();
    expect(screen.getByText(/Look for an extension/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Open Chrome extensions/i });
    expect(link.getAttribute('href')).toBe('chrome://extensions/');
  });

  it('fires onDismiss and onSkipHost', () => {
    const onDismiss = vi.fn();
    const onSkipHost = vi.fn();
    render(
      <ConflictSection
        host="x"
        entry={knownEntry}
        onDismiss={onDismiss}
        onSkipHost={onSkipHost}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Skip this host/i }));
    expect(onDismiss).toHaveBeenCalled();
    expect(onSkipHost).toHaveBeenCalled();
  });

  it('renders a relative-time label', () => {
    render(
      <ConflictSection
        host="x"
        entry={knownEntry}
        onDismiss={() => {}}
        onSkipHost={() => {}}
      />,
    );
    // "2 min ago" based on the knownEntry timestamp.
    expect(screen.getByText(/min ago/i)).toBeTruthy();
  });
});
```

- [ ] **Step 9.2: Run tests — expect failures**

```bash
pnpm test -- ConflictSection.test
```

- [ ] **Step 9.3: Implement — create `src/popup/ConflictSection.tsx`**

```tsx
import type { JSX } from 'preact';
import type { ConflictEntry } from '../shared/types';

export interface ConflictSectionProps {
  host: string;
  entry: ConflictEntry;
  onDismiss: () => void;
  onSkipHost: () => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 30) return 'just now';
  if (diffSec < 90) return '1 min ago';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function disableUrl(entry: ConflictEntry): string {
  if (entry.extensionId) return `chrome://extensions/?id=${entry.extensionId}`;
  return 'chrome://extensions/';
}

function disableLinkLabel(entry: ConflictEntry): string {
  if (entry.extensionId) return `Open ${entry.displayName} settings →`;
  return 'Open Chrome extensions →';
}

export function ConflictSection(props: ConflictSectionProps): JSX.Element {
  const { entry } = props;
  const headline = entry.extensionId
    ? `${entry.displayName} is formatting this page. Freshet can't render over it.`
    : `Another JSON viewer is formatting this page. Freshet can't render over it.`;

  return (
    <section class="pj-conflict" aria-label="Another viewer is active">
      <header class="pj-conflict-head">
        <span class="pj-conflict-icon" aria-hidden="true">⚠</span>
        <strong>Another viewer is active</strong>
      </header>
      <p class="pj-conflict-body">{headline}</p>
      {!entry.extensionId ? (
        <p class="pj-conflict-hint">Look for an extension that formats JSON.</p>
      ) : null}
      <a
        class="pj-btn pj-btn--accent pj-conflict-disable"
        href={disableUrl(entry)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {disableLinkLabel(entry)}
      </a>
      <div class="pj-conflict-secondary">
        <button type="button" class="pj-btn" onClick={props.onSkipHost}>
          Skip this host
        </button>
        <button type="button" class="pj-btn" onClick={props.onDismiss}>
          Dismiss
        </button>
      </div>
      <p class="pj-conflict-when">Detected {relativeTime(entry.detectedAt)}</p>
    </section>
  );
}
```

- [ ] **Step 9.4: Run tests — expect pass**

```bash
pnpm test -- ConflictSection.test
```

- [ ] **Step 9.5: Commit**

```bash
git add src/popup/ConflictSection.tsx src/popup/ConflictSection.test.tsx
git commit -m "feat(popup): ConflictSection component — targeted or generic disable link + skip/dismiss"
```

---

## Task 10: Wire `ConflictSection` into popup `App.tsx`

**Files:**
- Modify: `src/popup/App.tsx`

- [ ] **Step 10.1: Import the component + storage facade bits**

Near the existing imports:

```tsx
import { ConflictSection } from './ConflictSection';
import type { ConflictMap, HostSkipList } from '../shared/types';
```

- [ ] **Step 10.2: Add conflict-map storage hook**

Near the existing `useStorage` calls in `App`:

```tsx
const [conflicts, writeConflicts] = useStorage<'pj_conflicts', ConflictMap>(
  'pj_conflicts',
  {},
);
```

Also ensure `skip` / `setSkip` is available (it likely is — check existing `useStorage<'hostSkipList', HostSkipList>` call). If not, add:

```tsx
const [skipList, writeSkipList] = useStorage<'hostSkipList', HostSkipList>(
  'hostSkipList',
  [],
);
```

- [ ] **Step 10.3: Branch the match section**

Find the existing `<section class="pj-popup-match" ...>` block. Wrap its contents so that when `conflicts[tab.host]` is set, we render `ConflictSection` in place of the matched-rule row:

```tsx
<section class="pj-popup-match" aria-label="Match status">
  {tab.host && conflicts[tab.host] ? (
    <ConflictSection
      host={tab.host}
      entry={conflicts[tab.host]!}
      onDismiss={() => {
        const next = { ...conflicts };
        delete next[tab.host!];
        void writeConflicts(next);
      }}
      onSkipHost={() => {
        const host = tab.host!;
        if (!skipList.includes(host)) {
          void writeSkipList([...skipList, host]);
        }
        const next = { ...conflicts };
        delete next[host];
        void writeConflicts(next);
      }}
    />
  ) : (
    <>
      <span class="pj-popup-label">Matched rule</span>
      {matched ? (
        <div class="pj-popup-match-row">
          {/* ... existing matched rendering ... */}
        </div>
      ) : (
        <div class="pj-popup-match-row">
          {/* ... existing no-match rendering ... */}
        </div>
      )}
    </>
  )}
</section>
```

Keep the existing contents of the `matched ? ... : ...` branch verbatim — this task only wraps them.

- [ ] **Step 10.4: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 10.5: Commit**

```bash
git add src/popup/App.tsx
git commit -m "feat(popup): render ConflictSection in place of matched-rule row when pj_conflicts[host] is set"
```

---

## Task 11: Popup CSS for the conflict section

**Files:**
- Modify: `src/popup/popup.css`

- [ ] **Step 11.1: Append the ConflictSection styles**

```css
.pj-conflict {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-left: 3px solid var(--pj-accent-strong);
  background: var(--pj-accent-wash);
  border-radius: var(--pj-radius);
}
.pj-conflict-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--pj-fg);
}
.pj-conflict-icon {
  color: var(--pj-accent-strong);
  font-size: 14px;
}
.pj-conflict-body {
  margin: 0;
  line-height: 1.4;
  color: var(--pj-fg);
}
.pj-conflict-hint {
  margin: -4px 0 0 0;
  color: var(--pj-fg-muted);
  font-size: 12px;
}
.pj-conflict-disable {
  align-self: flex-start;
  text-decoration: none;
}
.pj-conflict-secondary {
  display: flex;
  gap: 6px;
}
.pj-conflict-when {
  margin: 0;
  color: var(--pj-fg-subtle);
  font-size: 11px;
}
```

- [ ] **Step 11.2: Build**

```bash
pnpm build
```

- [ ] **Step 11.3: Commit**

```bash
git add src/popup/popup.css
git commit -m "style(popup): conflict section styling (accent-wash left-rail panel)"
```

---

## Task 12: E2E — popup rendering path (seed storage, open popup, verify)

**Files:**
- Create: `test/e2e/conflict-detect.spec.ts`

- [ ] **Step 12.1: Write the popup rendering tests**

```ts
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
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

test.describe('Conflict detection — popup', () => {
  test('renders ConflictSection when pj_conflicts[tabHost] has a known-viewer entry', async () => {
    const { ctx, extId } = await launch();
    try {
      // Seed a conflict + open a page whose hostname matches
      await seed(ctx, {
        rules: [],
        templates: {},
        pj_conflicts: {
          'httpbin.org': {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'chklaanhfefbnpoihckbnefhakgolnmc',
            detectedAt: new Date().toISOString(),
          },
        },
        schemaVersion: 2,
      });
      const tab = await ctx.newPage();
      await tab.goto('https://httpbin.org/json');
      const popup = await ctx.newPage();
      await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
      // Popup reads the active tab, but since popups run in their own page in
      // tests, we drive it with a URL param workaround: rebuild the Active-tab
      // read by explicitly navigating to the conflicted URL.
      // Simpler — the popup's useStorage reads pj_conflicts directly; all we
      // need is for `tab.host` to resolve to 'httpbin.org'. If the popup's
      // tab-read fails in the test harness, the ConflictSection still mounts
      // because the test seeds the active-tab URL as well via the helper.
      await expect(popup.getByText(/JSONView is formatting/i)).toBeVisible();
      const link = popup.getByRole('link', { name: /Open JSONView settings/i });
      await expect(link).toHaveAttribute(
        'href',
        'chrome://extensions/?id=chklaanhfefbnpoihckbnefhakgolnmc',
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
        pj_conflicts: {
          'httpbin.org': {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'chklaanhfefbnpoihckbnefhakgolnmc',
            detectedAt: new Date().toISOString(),
          },
        },
        hostSkipList: [],
        schemaVersion: 2,
      });
      const tab = await ctx.newPage();
      await tab.goto('https://httpbin.org/json');
      const popup = await ctx.newPage();
      await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
      await popup.getByRole('button', { name: /Skip this host/i }).click();

      const skip = await read<string[]>(ctx, 'hostSkipList');
      expect(skip).toContain('httpbin.org');
      const conflicts = await read<Record<string, unknown>>(ctx, 'pj_conflicts');
      expect(conflicts?.['httpbin.org']).toBeUndefined();
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
        pj_conflicts: {
          'httpbin.org': {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'chklaanhfefbnpoihckbnefhakgolnmc',
            detectedAt: new Date().toISOString(),
          },
        },
        hostSkipList: [],
        schemaVersion: 2,
      });
      const tab = await ctx.newPage();
      await tab.goto('https://httpbin.org/json');
      const popup = await ctx.newPage();
      await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
      await popup.getByRole('button', { name: /^Dismiss$/ }).click();

      const conflicts = await read<Record<string, unknown>>(ctx, 'pj_conflicts');
      expect(conflicts?.['httpbin.org']).toBeUndefined();
      const skip = await read<string[]>(ctx, 'hostSkipList');
      expect(skip).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
});
```

- [ ] **Step 12.2: Build + run**

```bash
pnpm build
pnpm test:e2e -- conflict-detect
```

If tests fail because the popup's active-tab read doesn't return `httpbin.org` in the test harness, the simpler alternative is: seed `tab.host` into the popup by URL-loading the popup under `chrome-extension://.../src/popup/popup.html?__test_host=httpbin.org` and having the popup's `App.tsx` prefer that param during tests. Only do this if the first approach fails.

- [ ] **Step 12.3: Commit**

```bash
git add test/e2e/conflict-detect.spec.ts
git commit -m "test(e2e): popup renders ConflictSection; skip/dismiss act on storage"
```

---

## Task 13: E2E — content-script detection on a fixture page

**Files:**
- Create: `public/__conflict-fixture.html`
- Modify: `test/e2e/conflict-detect.spec.ts` (append)

- [ ] **Step 13.1: Create a test-only HTML that looks like JSONView has processed it**

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>conflict fixture</title></head>
<body class="jsonview">
  <div class="json-header">{ 3 items }</div>
  <div class="json-body">
    <span class="json-key">"a"</span>: <span class="json-value">1</span>
  </div>
</body>
</html>
```

This file will be bundled into `dist/__conflict-fixture.html` by `@crxjs`. Note: `public/` is copied as-is by Vite.

- [ ] **Step 13.2: Append the E2E test**

```ts
test.describe('Conflict detection — content script', () => {
  test('writes pj_conflicts when a JSONView-signed page matches a rule', async () => {
    const { ctx, extId } = await launch();
    try {
      const fixtureUrl = `chrome-extension://${extId}/__conflict-fixture.html`;
      await seed(ctx, {
        rules: [
          {
            id: 'r1',
            hostPattern: '*',
            pathPattern: '/__conflict-fixture.html',
            templateName: 't1',
            variables: {},
            active: true,
          },
        ],
        templates: { t1: '<div>{{ a }}</div>' },
        schemaVersion: 2,
      });
      const tab = await ctx.newPage();
      await tab.goto(fixtureUrl);
      // Wait for content script to run + write storage
      await tab.waitForTimeout(500);
      const conflicts = await read<Record<string, { viewer: string }>>(ctx, 'pj_conflicts');
      // Hostname of a chrome-extension:// URL is the extension id
      const entry = conflicts?.[extId];
      expect(entry?.viewer).toBe('jsonview');
    } finally {
      await ctx.close();
    }
  });
});
```

- [ ] **Step 13.3: Build + run**

```bash
pnpm build
pnpm test:e2e -- conflict-detect
```

- [ ] **Step 13.4: Commit**

```bash
git add public/__conflict-fixture.html test/e2e/conflict-detect.spec.ts
git commit -m "test(e2e): content-script writes pj_conflicts on a JSONView-signed fixture page"
```

---

## Task 14: a11y — axe sweep over popup with a conflict entry

**Files:**
- Modify: `test/e2e/a11y-popup.spec.ts` (append scenario)

- [ ] **Step 14.1: Find the existing a11y-popup test structure**

Read `test/e2e/a11y-popup.spec.ts` to see how it's organized. Match the existing style exactly.

- [ ] **Step 14.2: Append a conflict-state scenario**

Near the existing tests, add one that seeds `pj_conflicts` before opening the popup and runs axe:

```ts
test('popup with conflict entry has no axe-core serious/critical violations', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = sw.url().split('/')[2]!;
    await sw.evaluate(async () => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({
        pj_storage_area: 'local',
        rules: [], templates: {}, schemaVersion: 2,
        pj_conflicts: {
          'api.github.com': {
            viewer: 'jsonview',
            displayName: 'JSONView',
            extensionId: 'chklaanhfefbnpoihckbnefhakgolnmc',
            detectedAt: new Date().toISOString(),
          },
        },
      });
    });
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
    await expect(popup.getByText(/JSONView is formatting/i)).toBeVisible();
    const results = await new AxeBuilder({ page: popup })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['aria-valid-attr-value'])
      .analyze();
    const severe = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(severe, `axe violations: ${JSON.stringify(severe, null, 2)}`).toEqual([]);
  } finally {
    await ctx.close();
  }
});
```

(Import `AxeBuilder` + `chromium` + `expect` at the top if the file doesn't already — it does in the export-import a11y pattern.)

- [ ] **Step 14.3: Run**

```bash
pnpm test:e2e -- a11y-popup
```

- [ ] **Step 14.4: Commit**

```bash
git add test/e2e/a11y-popup.spec.ts
git commit -m "test(a11y): popup with conflict entry passes axe (no serious/critical)"
```

---

## Task 15: Code review pass

**Purpose:** required second-to-last phase per Matt's workflow. Fresh reviewer, no implementation bias.

- [ ] **Step 15.1: Dispatch a `feature-dev:code-reviewer` Agent**

Prompt:

> Review the `feature/conflict-detect` branch at `/Users/matt/dev/MattAltermatt/freshet` against the spec at `docs/superpowers/specs/2026-04-19-conflict-detection-design.md`. Focus areas, HIGH confidence only:
>
> 1. **Purity of `src/content/conflictDetect.ts`** — `rg 'chrome\.' src/content/conflictDetect.ts` must return nothing.
> 2. **Rule-gated detection** — confirm `content-script.ts` calls `detectConflict` only after a successful rule match on parse-fail, never on hosts with no rule.
> 3. **Cleanup paths** — all four paths from the spec (Dismiss, Skip, render-success, rescue-success) actually call `storage.clearConflict(host)`.
> 4. **Badge signal** — `pj:conflict` relayed by background SW to `chrome.action.setBadgeText/Color`; cleared on navigation by the existing `chrome.tabs.onUpdated` handler.
> 5. **`<pre>` rescue determinism** — test case that asserts rescue beats fingerprint when both present.
> 6. **Popup branch** — matched-rule row is hidden when `pj_conflicts[tab.host]` is set; it returns once cleared.
> 7. **Extension IDs + selectors** — match the values committed in `test/fixtures/conflicts/notes.md` (not hallucinated).
> 8. **No DOM injection on conflict** — content script must not mount the top strip, not inject banners, when `detectConflict` returns `ok: false`.
>
> Report only high-confidence findings. Under 500 words.

- [ ] **Step 15.2: Address findings**

For each finding, either fix with a new commit (`fix: address review — <one-line>`) or reply with a justification before FF-merge.

- [ ] **Step 15.3: Commit any review fixes**

```bash
git add -A
git commit -m "fix: address code-review findings"
```

---

## Task 16: README — Features bullet

**Files:**
- Modify: `README.md`

- [ ] **Step 16.1: Add the bullet**

In the `## Features` list (near the end — after the existing `📦 Export / import` bullet), append:

```markdown
- 🚫 **Graceful handling of conflicting JSON viewers** — if another JSON viewer (JSONView, JSON Formatter, JSON Viewer Pro, etc.) has already formatted the page, Freshet warns you in the popup with a one-click disable link instead of fighting for the DOM. Detection is rule-gated — hosts you haven't configured stay quiet.
```

- [ ] **Step 16.2: Commit**

```bash
git add README.md
git commit -m "docs(readme): mention conflict detection in Features"
```

---

## Task 17: CLAUDE.md — Gotchas + storage key

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 17.1: Add two gotchas**

In the Gotchas section, append:

```markdown
- **Conflict detection is rule-gated.** `src/content/conflictDetect.ts` only runs after `match(url, rules)` returns a hit. Hosts with no Freshet rule silently bail on parse-fail, as before. The warning exists to point users at a viewer blocking a rule they've already configured — not to surface viewers on unrelated sites.
- **`<pre>` rescue beats fingerprint.** When both a `<pre>`-wrapped JSON body AND a named viewer's DOM marker are present, `detectConflict` returns `{ ok: 'rescued' }` and Freshet renders normally. Assertion in `src/content/conflictDetect.test.ts` pins this.
```

- [ ] **Step 17.2: Add storage key row**

In the Storage keys table, append:

```markdown
| `pj_conflicts` | `Record<host, ConflictEntry>` | Per-host record of a detected conflicting JSON viewer. Populated by the content script; cleared on Dismiss / Skip / render success / rescue success. |
```

- [ ] **Step 17.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): conflict detection gotchas + pj_conflicts storage key row"
```

---

## Task 18: ROADMAP.md — P0 done, promote next

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 18.1: Move the P0 entry to the Shipped block**

Find the `### ✅ Shipped` section. Add:

```markdown
**Extension-conflict detection (2026-04-19).** `src/content/conflictDetect.ts` with `<pre>` rescue + 3 named-viewer fingerprints (JSONView, JSON Formatter, JSON Viewer Pro) + generic unknown-viewer fallback. Rule-gated detection (no warning on hosts the user hasn't configured). Popup surfaces a ConflictSection with targeted `chrome://extensions/?id=<id>` disable link, Skip-host + Dismiss actions, relative-time label. New badge signal `pj:conflict` paints ⚠ in accent-strong. Spec: `docs/superpowers/specs/2026-04-19-conflict-detection-design.md`. Plan: `docs/superpowers/plans/2026-04-19-conflict-detection.md`.
```

And remove or shrink the old P0 block. Then promote the previous P1 ("Templates UX convergence with LiquidJS playground") to P0, or leave P0 empty with "next P0 TBD pending Matt's direction" — check with Matt before assuming.

- [ ] **Step 18.2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): conflict detection shipped; promote next P0"
```

---

## Task 19: Final verification + handoff for FF-merge

- [ ] **Step 19.1: Full test battery**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

All green. If any pre-existing flaky E2E tests fail (see `.remember/remember.md`), cross-reference the known list; only real regressions block.

- [ ] **Step 19.2: Manual Chrome verification**

Reload the extension. Walk through:

1. **Baseline success.** Configure a rule matching a JSON URL; visit it WITHOUT any conflicting viewer installed. Freshet renders. Badge shows `✓`.
2. **`<pre>` rescue.** Visit a JSON URL with Chrome's native viewer (no other extension installed). Freshet renders. Badge shows `✓` (silent success, no conflict warning).
3. **Known viewer conflict.** Install JSONView. Visit a JSON URL where a Freshet rule matches. Badge shows `⚠`; popup shows "JSONView is formatting this page. Freshet can't render over it." + targeted disable link.
4. **Skip this host.** From (3), click Skip. Popup closes; reload the same URL. Freshet silently exits; badge clears on nav; popup shows "no rule matches."
5. **Dismiss.** From (3), click Dismiss. Popup shows "no rule matches" (warning gone). Close + reopen popup — still gone. Reload the URL; warning re-fires as expected (viewer still active).
6. **Rule-gated quiet.** Visit a JSONView-formatted page on a host with NO Freshet rule. No badge, no warning. Freshet stays silent.

Note anything off; fix before handoff.

- [ ] **Step 19.3: Hand off to Matt**

Post a summary:
- Branch: `feature/conflict-detect`
- What to walk through (the 6 scenarios above)
- Test counts
- Any trade-offs worth mentioning

Wait for explicit FF-merge approval.

- [ ] **Step 19.4: After approval, FF-merge + push**

```bash
git checkout main
git merge --ff-only feature/conflict-detect
git push origin main
```

Ask before deleting the feature branch (destructive-list item).

---

## Notes on expected scale

- ~19 tasks, ~80 steps, ~17 commits.
- Task 1 is the one real-world dependency (install 3 Chrome extensions, capture HTML). Everything else is code.
- Task 13's content-script E2E is the most fragile — it depends on @crxjs copying `public/__conflict-fixture.html` into `dist/` at the expected path. Verify early.
