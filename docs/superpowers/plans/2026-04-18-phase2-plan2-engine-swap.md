# Phase 2, Plan 2 — Engine Swap (Liquid) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled template engine with **LiquidJS** while preserving the public `render(template, data, vars): string` contract. Migrate existing stored templates (v1 → v2 Liquid syntax) transactionally on install/update. Rewrite bundled starters in Liquid. Zero user-visible change to currently-rendered pages for existing users, because their templates are auto-migrated.

**Why Liquid (not Handlebars):** An earlier attempt with Handlebars hit a hard MV3 blocker — Handlebars builds a runtime-compiled function via eval-style codegen, which violates the extension's CSP (`script-src 'self' 'wasm-unsafe-eval'`; no `'unsafe-eval'`). LiquidJS is interpreter-based (no runtime codegen), popular (Shopify + Jekyll + 11ty + GitHub Pages), AI-friendly, and covers every feature we've already shipped in the github-repo and internal-user templates. The superseded Handlebars plan doc was deleted.

**Architecture:**
- `src/engine/engine.ts` becomes a thin **LiquidJS wrapper** with one Liquid environment instance per render call. Same signature `render(template, data, vars): string`. Uses `parseAndRenderSync` to stay synchronous. Pipes output through the existing `sanitize()` unchanged.
- `src/engine/helpers.ts` registers four Liquid filters: `date`, `link`, `num`, `raw`. Underlying `formatDate` / `buildLink` / `formatNumber` stay.
- `src/engine/migrate.ts` (new) — pure regex+loop rewriter that transforms v1 syntax to v2 (Liquid).
- `src/engine/sanitize.ts` — unchanged.
- `src/storage/migration.ts` gets `migrateTemplatesToV2(storage)`. Batch-atomic: parse every rewritten template against a LiquidJS env; on any parse failure, keep the v1 source and return offending template IDs.
- `src/background/background.ts` triggers the migration on first run when `schemaVersion` is missing, then stamps `schemaVersion: 2`.
- `src/shared/types.ts` adds `schemaVersion?: number`.
- Starters (`src/starter/internal-user.html`, `src/starter/github-repo.html`) are rewritten at source in Liquid so fresh installs skip migration.
- Delete obsolete `src/engine/escape.ts` (LiquidJS handles HTML escape natively with `outputEscape`). `src/engine/lookup.ts` stays — still used by `buildLink` for inner `{{token}}` substitution inside link URL strings.

**Tech Stack:** LiquidJS 10.x (runtime interpreter). No compile-time codegen; CSP-safe in MV3 content scripts. Existing pnpm + Vite + Vitest + TypeScript retained.

**Critical de-risk (learned from Handlebars attempt):** Task 3 is a CSP smoke test that proves LiquidJS actually parses+renders under MV3 CSP inside the content script **before** investing in the migrator + starter rewrites. If CSP rejects LiquidJS, stop and re-plan.

**Liquid syntax reference (what ships):**

| v1 syntax | v2 Liquid syntax |
|---|---|
| `{{path.to.value}}` | `{{ path.to.value }}` — auto-HTML-escaped |
| `{{{path.to.value}}}` | `{{ path.to.value \| raw }}` — explicit no-escape |
| `{{@varName}}` | `{{ vars.varName }}` |
| `{{#when x "y"}}...{{/when}}` | `{% if x == "y" %}...{% endif %}` |
| `{{#when x "y"}}...{{#else}}...{{/when}}` | `{% if x == "y" %}...{% else %}...{% endif %}` |
| `{{#each items}}...{{this}}...{{/each}}` | `{% for item in items %}...{{ item }}...{% endfor %}` |
| `{{#each items}}...{{this.name}}...{{/each}}` | `{% for item in items %}...{{ item.name }}...{% endfor %}` |
| `{{date ts}}` / `{{date ts "fmt"}}` | `{{ ts \| date }}` / `{{ ts \| date: "fmt" }}` |
| `{{link "https://host/{{id}}"}}` | `{{ "https://host/{{id}}" \| link }}` |
| `{{num x}}` | `{{ x \| num }}` |

**Deferred to Plan 3:** the per-template "Migrated to Liquid syntax" banner in the Templates tab (depends on Preact-rewritten options page). Plan 2 performs migration silently.

---

## Task 1: Create the feature branch

```bash
git status
git checkout main
git pull origin main
git checkout -b feature/phase2-plan2-engine-liquid
```

---

## Task 2: Install LiquidJS

```bash
pnpm add liquidjs
git add package.json pnpm-lock.yaml
git commit -m "deps: add liquidjs runtime (csp-safe interpreter for mv3)"
```

---

## Task 3: CSP smoke test — prove LiquidJS runs in MV3 content script

**Purpose:** catch CSP incompatibility before investing in the migrator + starter rewrites.

- [ ] **Step 3.1: Temporarily swap the engine to a direct LiquidJS wrapper (full version comes in Task 6)**

Replace `src/engine/engine.ts` with a minimal wrapper:

```ts
import { Liquid } from 'liquidjs';
import { sanitize } from './sanitize';
import type { Variables } from '../shared/types';

const engine = new Liquid({ outputEscape: 'escape' });

export function render(templateText: string, json: unknown, vars: Variables): string {
  const context = typeof json === 'object' && json !== null
    ? { ...(json as Record<string, unknown>), vars }
    : { vars };
  const output = engine.parseAndRenderSync(templateText, context);
  return sanitize(output);
}
```

Delete `src/engine/escape.ts`:
```bash
git rm src/engine/escape.ts
```

- [ ] **Step 3.2: Build**

```bash
pnpm build
```

- [ ] **Step 3.3: Write the smoke test** at `test/e2e/csp-smoke.spec.ts`:

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../fixtures-server/server';

const PORT = 4391;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

test('liquidjs renders in an MV3 content script without CSP errors', async () => {
  const stopServer = await startServer(PORT);
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  try {
    const pageErrors: string[] = [];
    context.on('page', (p) => {
      p.on('pageerror', (err) => pageErrors.push(err.message));
    });
    const page = await context.newPage();
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
    await serviceWorker.evaluate(async () => {
      await chrome.storage.sync.set({
        rules: [{ id: 'r1', hostPattern: '127.0.0.1', pathPattern: '/internal/user/*', templateName: 'smoke', variables: { env: 'qa' }, enabled: true }],
        templates: { smoke: '<div id="smoke-out">env={{ vars.env }} id={{ id }}</div>' },
      });
    });
    await page.waitForTimeout(500);
    await page.goto(`http://127.0.0.1:${PORT}/internal/user/1234`);
    await page.waitForTimeout(1500);
    const outer = await page.evaluate(() => document.querySelector('#smoke-out')?.outerHTML ?? '(missing)');
    expect(outer).toContain('env=qa');
    expect(outer).toContain('id=1234');
    const cspErrors = pageErrors.filter((m) => m.includes('unsafe-eval') || m.includes('Content Security Policy'));
    expect(cspErrors).toEqual([]);
  } finally {
    await context.close();
    await stopServer();
  }
});
```

- [ ] **Step 3.4: Run it**

```bash
pnpm test:e2e -- csp-smoke
```
If it fails with a CSP error, STOP — re-plan.

- [ ] **Step 3.5: Commit**

```bash
git add src/engine/engine.ts test/e2e/csp-smoke.spec.ts
git commit -m "engine: prove liquidjs is csp-safe in mv3 content script"
```

---

## Task 4: Add `schemaVersion` to `StorageShape`

In `src/shared/types.ts`, change `StorageShape` to add `schemaVersion?: number;` as the first field.

```bash
pnpm typecheck
git add src/shared/types.ts
git commit -m "storage: add optional schemaVersion to StorageShape"
```

---

## Task 5: v1 → v2 Liquid migrator (TDD)

- [ ] **Step 5.1: Write failing tests** at `src/engine/migrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { migrateTemplate } from './migrate';

describe('migrateTemplate — v1 → v2 (Liquid)', () => {
  it('leaves pure text unchanged', () => {
    expect(migrateTemplate('<p>hello</p>')).toBe('<p>hello</p>');
  });
  it('leaves plain inline expressions unchanged', () => {
    expect(migrateTemplate('<p>{{id}} {{user.name}}</p>')).toBe('<p>{{id}} {{user.name}}</p>');
  });
  it('rewrites triple-brace to | raw', () => {
    expect(migrateTemplate('<p>{{{html}}}</p>')).toBe('<p>{{ html | raw }}</p>');
    expect(migrateTemplate('<p>{{{user.bio}}}</p>')).toBe('<p>{{ user.bio | raw }}</p>');
  });
  it('rewrites {{@var}} to {{ vars.var }}', () => {
    expect(migrateTemplate('<p>{{@env}} / {{@adminHost}}</p>'))
      .toBe('<p>{{ vars.env }} / {{ vars.adminHost }}</p>');
  });
  it('rewrites bare #when to {% if == %}', () => {
    expect(migrateTemplate('{{#when status "UP"}}<g>{{/when}}'))
      .toBe('{% if status == "UP" %}<g>{% endif %}');
  });
  it('rewrites #when + #else', () => {
    expect(migrateTemplate('{{#when x "y"}}<g>{{#else}}<r>{{/when}}'))
      .toBe('{% if x == "y" %}<g>{% else %}<r>{% endif %}');
  });
  it('rewrites #when on @variable', () => {
    expect(migrateTemplate('{{#when @env "qa"}}[QA]{{/when}}'))
      .toBe('{% if vars.env == "qa" %}[QA]{% endif %}');
  });
  it('rewrites #when with dotted-path LHS', () => {
    expect(migrateTemplate('{{#when user.role "admin"}}X{{/when}}'))
      .toBe('{% if user.role == "admin" %}X{% endif %}');
  });
  it('rewrites #each + {{this}}', () => {
    expect(migrateTemplate('{{#each xs}}[{{this}}]{{/each}}'))
      .toBe('{% for item in xs %}[{{ item }}]{% endfor %}');
  });
  it('rewrites #each + {{this.field}}', () => {
    expect(migrateTemplate('{{#each users}}{{this.name}};{{/each}}'))
      .toBe('{% for item in users %}{{ item.name }};{% endfor %}');
  });
  it('rewrites nested #each + #when', () => {
    const input = '{{#each xs}}{{#when this.on "y"}}{{this.id}}{{/when}}{{/each}}';
    const expected = '{% for item in xs %}{% if item.on == "y" %}{{ item.id }}{% endif %}{% endfor %}';
    expect(migrateTemplate(input)).toBe(expected);
  });
  it('rewrites date helper', () => {
    expect(migrateTemplate('{{date ts}}')).toBe('{{ ts | date }}');
    expect(migrateTemplate('{{date ts "yyyy-MM-dd"}}')).toBe('{{ ts | date: "yyyy-MM-dd" }}');
  });
  it('rewrites num helper', () => {
    expect(migrateTemplate('{{num stars}}')).toBe('{{ stars | num }}');
    expect(migrateTemplate('{{num stats.forks}}')).toBe('{{ stats.forks | num }}');
  });
  it('rewrites link helper (preserving inner {{tokens}})', () => {
    expect(migrateTemplate('{{link "https://h/{{id}}"}}')).toBe('{{ "https://h/{{id}}" | link }}');
    expect(migrateTemplate('{{link "https://{{@host}}/u/{{id}}"}}'))
      .toBe('{{ "https://{{vars.host}}/u/{{id}}" | link }}');
  });
  it('migrates a realistic mixed template', () => {
    const input = '<p>{{@adminHost}}</p>{{#when status "UP"}}<g>{{/when}}{{#each items}}<li>{{this.name}}</li>{{/each}}{{date ts}}';
    const expected = '<p>{{ vars.adminHost }}</p>{% if status == "UP" %}<g>{% endif %}{% for item in items %}<li>{{ item.name }}</li>{% endfor %}{{ ts | date }}';
    expect(migrateTemplate(input)).toBe(expected);
  });
});
```

- [ ] **Step 5.2: Implement** at `src/engine/migrate.ts`:

```ts
const LINK_HELPER = /\{\{link\s+"([^"]*)"\s*\}\}/g;
const DATE_HELPER_WITH_FMT = /\{\{date\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}/g;
const DATE_HELPER_NO_FMT = /\{\{date\s+(@?[\w.]+)\s*\}\}/g;
const NUM_HELPER = /\{\{num\s+(@?[\w.]+)\s*\}\}/g;
const TRIPLE_BRACE = /\{\{\{([\w.]+)\}\}\}/g;
const EACH_BLOCK = /\{\{#each\s+(@?[\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;
const WHEN_WITH_ELSE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/when\}\}/g;
const WHEN_NO_ELSE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{\/when\}\}/g;
const AT_VAR_IN_TAG = /\{\{@(\w+)\}\}/g;
const AT_IDENT_INLINE = /@(\w+)/g;

function rewriteEachBody(body: string): string {
  const innerRewritten = body.replace(EACH_BLOCK, (_m, path: string, inner: string) =>
    `{% for item in ${path} %}${rewriteEachBody(inner)}{% endfor %}`,
  );
  return innerRewritten
    .replace(/\{\{\s*this\s*\}\}/g, '{{ item }}')
    .replace(/\{\{\s*this\.([\w.]+)\s*\}\}/g, '{{ item.$1 }}');
}

export function migrateTemplate(v1: string): string {
  let out = v1;
  out = out.replace(LINK_HELPER, (_m, tmpl: string) => `{{ "${tmpl}" | link }}`);
  out = out.replace(DATE_HELPER_WITH_FMT, (_m, p: string, f: string) => `{{ ${p} | date: "${f}" }}`);
  out = out.replace(DATE_HELPER_NO_FMT, (_m, p: string) => `{{ ${p} | date }}`);
  out = out.replace(NUM_HELPER, (_m, p: string) => `{{ ${p} | num }}`);
  out = out.replace(TRIPLE_BRACE, (_m, p: string) => `{{ ${p} | raw }}`);
  out = out.replace(EACH_BLOCK, (_m, p: string, body: string) =>
    `{% for item in ${p} %}${rewriteEachBody(body)}{% endfor %}`,
  );
  out = out.replace(WHEN_WITH_ELSE, (_m, l: string, r: string, t: string, e: string) =>
    `{% if ${l} == "${r}" %}${t}{% else %}${e}{% endif %}`,
  );
  out = out.replace(WHEN_NO_ELSE, (_m, l: string, r: string, b: string) =>
    `{% if ${l} == "${r}" %}${b}{% endif %}`,
  );
  out = out.replace(AT_VAR_IN_TAG, (_m, name: string) => `{{ vars.${name} }}`);
  out = out.replace(AT_IDENT_INLINE, (_m, name: string) => `vars.${name}`);
  return out;
}
```

- [ ] **Step 5.3: Run** `pnpm test -- src/engine/migrate.test.ts` — all pass.

- [ ] **Step 5.4: Commit**

```bash
git add src/engine/migrate.ts src/engine/migrate.test.ts
git commit -m "engine: add v1 → v2 Liquid migrator (snapshot tests)"
```

---

## Task 6: Final engine wrapper — register `date` / `link` / `num` / `raw` filters

- [ ] **Step 6.1: Extend `src/engine/helpers.ts`**

Add import at top:
```ts
import type { Liquid } from 'liquidjs';
```

Append at bottom:
```ts
export function registerFilters(engine: Liquid): void {
  engine.registerFilter('date', (value: unknown, fmt?: unknown) =>
    formatDate(value, typeof fmt === 'string' ? fmt : undefined),
  );
  engine.registerFilter('num', (value: unknown) => formatNumber(value));
  engine.registerFilter('link', function (this: unknown, tmpl: unknown) {
    const ctx = (this as { context?: { environments?: unknown[] } })?.context;
    const root = (ctx?.environments?.[0] ?? {}) as Record<string, unknown>;
    const vars = (root['vars'] as Record<string, string>) ?? {};
    return buildLink(typeof tmpl === 'string' ? tmpl : '', root, vars);
  });
  engine.registerFilter('raw', (value: unknown) => {
    const s = value === undefined || value === null ? '' : String(value);
    const w = new String(s) as String & { __pjRaw?: true };
    w.__pjRaw = true;
    return w;
  });
}
```

- [ ] **Step 6.2: Finalize `src/engine/engine.ts`**

Replace with:
```ts
import { Liquid } from 'liquidjs';
import { registerFilters } from './helpers';
import { sanitize } from './sanitize';
import type { Variables } from '../shared/types';

function makeEngine(): Liquid {
  const engine = new Liquid({
    outputEscape: (value: unknown) => {
      if (value && typeof value === 'object' && (value as { __pjRaw?: true }).__pjRaw) {
        return String(value);
      }
      const s = value === undefined || value === null ? '' : String(value);
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
  });
  registerFilters(engine);
  return engine;
}

export function render(templateText: string, json: unknown, vars: Variables): string {
  const engine = makeEngine();
  const context = typeof json === 'object' && json !== null
    ? { ...(json as Record<string, unknown>), vars }
    : { vars };
  const output = engine.parseAndRenderSync(templateText, context);
  return sanitize(output);
}
```

- [ ] **Step 6.3: Typecheck, commit**

```bash
pnpm typecheck
git add src/engine/engine.ts src/engine/helpers.ts
git commit -m "engine: finalize liquidjs wrapper with date/link/num/raw filters"
```

---

## Task 7: Storage-layer template migration

- [ ] **Step 7.1: Add tests** in `src/storage/migration.test.ts`:

```ts
import { migrateTemplatesToV2 } from './migration';

describe('migrateTemplatesToV2', () => {
  function makeStubStorage(initial: Record<string, string>) {
    const state = { templates: { ...initial }, schemaVersion: undefined as number | undefined };
    const lastWrite = { value: null as Record<string, string> | null };
    return {
      state, lastWrite,
      async getTemplates() { return { ...state.templates }; },
      async setTemplates(next: Record<string, string>) { state.templates = { ...next }; lastWrite.value = { ...next }; },
      async setSchemaVersion(v: number) { state.schemaVersion = v; },
    };
  }

  it('rewrites every template and stamps schemaVersion=2', async () => {
    const storage = makeStubStorage({
      'internal-user': '{{#when status "UP"}}<g>{{/when}}{{@env}}',
      'other': '{{@host}}',
    });
    const result = await migrateTemplatesToV2(storage);
    expect(result.ok).toBe(true);
    expect(result.migrated).toContain('internal-user');
    expect(result.migrated).toContain('other');
    expect(storage.lastWrite.value).toEqual({
      'internal-user': '{% if status == "UP" %}<g>{% endif %}{{ vars.env }}',
      'other': '{{ vars.host }}',
    });
    expect(storage.state.schemaVersion).toBe(2);
  });

  it('rolls back on parse failure', async () => {
    const storage = makeStubStorage({
      'good': '{{@host}}',
      'broken': '{% for item in items %}unterminated',
    });
    const result = await migrateTemplatesToV2(storage);
    expect(result.ok).toBe(false);
    expect(result.failed).toContain('broken');
    expect(storage.lastWrite.value).toBeNull();
    expect(storage.state.schemaVersion).toBeUndefined();
  });

  it('handles empty template map', async () => {
    const storage = makeStubStorage({});
    const result = await migrateTemplatesToV2(storage);
    expect(result.ok).toBe(true);
    expect(result.migrated).toEqual([]);
    expect(storage.state.schemaVersion).toBe(2);
  });
});
```

- [ ] **Step 7.2: Implement in `src/storage/migration.ts`**

Add imports at top:
```ts
import { Liquid } from 'liquidjs';
import { migrateTemplate } from '../engine/migrate';
```

Append at bottom:
```ts
export interface MigrateTemplatesStorage {
  getTemplates(): Promise<Record<string, string>>;
  setTemplates(next: Record<string, string>): Promise<void>;
  setSchemaVersion(version: number): Promise<void>;
}

export interface MigrateResult {
  ok: boolean;
  migrated: string[];
  failed: string[];
}

export async function migrateTemplatesToV2(storage: MigrateTemplatesStorage): Promise<MigrateResult> {
  const before = await storage.getTemplates();
  const validator = new Liquid();
  const rewritten: Record<string, string> = {};
  const migrated: string[] = [];
  const failed: string[] = [];
  for (const [key, source] of Object.entries(before)) {
    const next = migrateTemplate(source);
    try {
      validator.parse(next);
      rewritten[key] = next;
      migrated.push(key);
    } catch {
      failed.push(key);
    }
  }
  if (failed.length > 0) return { ok: false, migrated: [], failed };
  await storage.setTemplates(rewritten);
  await storage.setSchemaVersion(2);
  return { ok: true, migrated, failed: [] };
}
```

- [ ] **Step 7.3: Test + commit**

```bash
pnpm test -- src/storage/migration.test.ts
git add src/storage/migration.ts src/storage/migration.test.ts
git commit -m "storage: add migrateTemplatesToV2 (liquid) with atomic rollback"
```

---

## Task 8: Storage facade schemaVersion accessors

In `src/storage/storage.ts`:
- Add `const K_SCHEMA = 'schemaVersion';`
- Extend `Storage` interface with `getSchemaVersion(): Promise<number | undefined>; setSchemaVersion(version: number): Promise<void>;`
- In returned object, add:
```ts
getSchemaVersion: async () => {
  const result = await area.get([K_SCHEMA]);
  const v = result[K_SCHEMA];
  return typeof v === 'number' ? v : undefined;
},
setSchemaVersion: (version) => area.set({ [K_SCHEMA]: version }),
```

In `src/storage/storage.test.ts`, add:
```ts
it('returns undefined schemaVersion when unset', async () => {
  expect(await storage.getSchemaVersion()).toBeUndefined();
});
it('round-trips schemaVersion', async () => {
  await storage.setSchemaVersion(2);
  expect(await storage.getSchemaVersion()).toBe(2);
});
```

```bash
pnpm test -- src/storage/storage.test.ts
git add src/storage/storage.ts src/storage/storage.test.ts
git commit -m "storage: add get/setSchemaVersion accessors"
```

---

## Task 9: Wire migration into background service worker

Replace `src/background/background.ts` with:

```ts
import { createStorage } from '../storage/storage';
import { estimateBytes, SYNC_SOFT_LIMIT, migrateSyncToLocal, migrateTemplatesToV2 } from '../storage/migration';
import starterInternalUser from '../starter/internal-user.html?raw';

async function main(): Promise<void> {
  await maybeStorageAreaMigration();
  await maybeSchemaMigration();
  await seedStartersIfEmpty();
}

async function seedStartersIfEmpty(): Promise<void> {
  const storage = await createStorage(chrome.storage);
  const templates = await storage.getTemplates();
  if (Object.keys(templates).length > 0) return;
  await storage.setTemplates({ 'internal-user': starterInternalUser });
  await storage.setSchemaVersion(2);
}

async function maybeStorageAreaMigration(): Promise<void> {
  try {
    const all = await chrome.storage.sync.get(['rules', 'templates', 'hostSkipList']);
    if (estimateBytes(all) > SYNC_SOFT_LIMIT) await migrateSyncToLocal(chrome.storage);
  } catch (err) {
    console.warn('[present-json] storage-area migration skipped:', err);
  }
}

async function maybeSchemaMigration(): Promise<void> {
  try {
    const storage = await createStorage(chrome.storage);
    const current = await storage.getSchemaVersion();
    if (current !== undefined) return;
    const result = await migrateTemplatesToV2(storage);
    if (!result.ok) console.warn('[present-json] template migration rolled back; failing IDs:', result.failed);
  } catch (err) {
    console.warn('[present-json] schema migration skipped:', err);
  }
}

void main();
```

```bash
pnpm build
git add src/background/background.ts
git commit -m "background: run v1 → v2 liquid migration on first run after update"
```

---

## Task 10: Rewrite bundled starters in Liquid

Replace `src/starter/internal-user.html`, `src/starter/github-repo.html`, and `test/fixtures/internal-user/template.html` with Liquid-syntax equivalents (see tables + examples in architecture section above for mappings).

Run:
```bash
pnpm test -- src/starter/github-repo.test.ts src/engine/fixture.test.ts
```
Fix any whitespace drift in expected.html (only if semantics are identical — verify carefully).

```bash
git add src/starter/ test/fixtures/internal-user/template.html
git commit -m "starter: rewrite bundled templates in liquid syntax"
```

---

## Task 11: Adjust github-repo tests for Liquid output

If any assertions fail due to whitespace drift between Handlebars-shaped output and Liquid-shaped output, tighten them with whitespace-tolerant regex (do NOT relax security-relevant assertions).

```bash
pnpm test -- src/starter/github-repo.test.ts
git add src/starter/github-repo.test.ts
git commit -m "test: adjust github-repo template tests for liquid output"
```

(Skip the commit if no changes were needed.)

---

## Task 12: Rewrite engine unit tests in Liquid syntax

Replace `src/engine/engine.test.ts` with Liquid-syntax tests covering: values, vars namespace, HTML escape, raw filter, `{% if == %}` with else, truthy check, `{% for %}` iteration, filters (date, link, num), and sanitizer pass. (Parity with what the v1 tests covered.)

```bash
pnpm test
git add src/engine/engine.test.ts
git commit -m "test: rewrite engine tests in liquid syntax"
```

---

## Task 13: Prune dead engine code

```bash
grep -rn "from './escape'" src/
grep -rn "htmlEscape" src/
grep -rn "from './lookup'" src/
```
Escape should have zero matches. Lookup should still be imported by `helpers.ts` (used by buildLink). Fix if discrepancy; commit if any changes.

---

## Task 14: Full verification + push

```bash
grep -rn "{{#when\|{{@[a-z]\|{{/when}}\|{{#else}}\|{{#each\|{{/each}}" src/starter/ test/fixtures/
```
Expected: no matches.

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e
git push -u origin feature/phase2-plan2-engine-liquid
```
E2E should run both `csp-smoke.spec.ts` AND `render.spec.ts`.

---

## Task 15: Code review pass

Dispatch the `feature-dev:code-reviewer` agent. Brief it on:
- Engine swap to Liquid (CSP-safe interpreter; Handlebars attempt failed CSP)
- Migrator regex order + nested block handling
- outputEscape config + `raw` filter marker class
- Sanitizer still runs post-render
- Rollback path
- No eval/codegen paths

Address high-confidence findings. Commit + re-verify.

---

## Task 16: Docs updates

- `README.md`: replace the template syntax table with the Liquid version (see architecture section for the table). Update test-count badge.
- `ROADMAP.md`: Plan 2 → `— done 2026-04-18 (liquid)`.
- `CLAUDE.md`: update architecture bullet for `src/engine/` to mention "thin LiquidJS wrapper; registers `date` / `link` / `num` / `raw` filters; `outputEscape` auto-escapes non-raw output; sanitizer runs post-render".

```bash
git add README.md ROADMAP.md CLAUDE.md
git commit -m "docs: update syntax table + architecture for liquid engine"
git push
```

---

## Task 17: Hand off for Matt's review

Summarize:
- Branch name
- Commit chain in order
- Bundle impact (content-script +25–30 KB gzipped for LiquidJS)
- Test count delta
- Push URL

Wait for explicit FF-merge approval.

---

## Done when

- [ ] All unit tests pass.
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e` all clean — including the new CSP smoke test AND the existing render spec.
- [ ] `grep '{{#when\|{{@[a-z]\|{{/when}}\|{{#else}}\|{{#each\|{{/each}}'` in `src/` and `test/fixtures/` returns nothing.
- [ ] Fresh install seeds v2 Liquid starters and stamps `schemaVersion: 2` without running migration.
- [ ] Simulated update-from-v1 flow migrates atomically; keeps v1 source on parse failure.
- [ ] Content script renders via LiquidJS end-to-end in MV3 (no CSP errors); sanitizer still runs as final pass.
- [ ] Code review done; high-confidence findings addressed.
- [ ] README, ROADMAP.md, CLAUDE.md updated.
- [ ] Matt has approved the branch for FF-merge to `main`.
