# Phase 2, Plan 2 — Engine Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled template engine with Handlebars while preserving the public `render(template, data, vars): string` contract. Migrate existing stored templates (v1 → v2 syntax) transactionally on install/update. Rewrite bundled starters in v2 syntax. Zero user-visible change to currently-rendered pages for existing users, because their templates are auto-migrated.

**Architecture:**
- `src/engine/engine.ts` becomes a thin Handlebars wrapper. Same signature `render(template, data, vars): string`. Compiles on demand, runs with merged context `{ ...data, vars }`, pipes output through the existing `sanitize()` unchanged.
- `src/engine/helpers.ts` registers four Handlebars helpers: `eq` (stringwise equality to match v1 semantics), `date`, `link`, `num`. The underlying `formatDate`/`buildLink`/`formatNumber` functions stay; only the dispatch mechanism moves from our regex replacer to Handlebars' helper registry.
- `src/engine/migrate.ts` (new) — pure regex rewriter that transforms v1 syntax to v2.
- `src/engine/sanitize.ts` — unchanged.
- `src/storage/migration.ts` gets a new `migrateTemplatesToV2(storage)` entry point. Batch-atomic: compile-check every rewritten template under Handlebars before writing any back; on any failure, keep the v1 source intact and return the offending template IDs.
- `src/background/background.ts` triggers the migration on first run when `schemaVersion` is missing, then stamps `schemaVersion: 2`.
- `src/shared/types.ts` adds `schemaVersion?: number` to `StorageShape` (optional — absence means "never migrated, must be v1").
- Starters (`src/starter/internal-user.html`, `src/starter/github-repo.html`) are rewritten at source in v2 syntax so fresh installs skip migration and use Handlebars directly.
- Delete the obsolete hand-rolled engine code: the block walker in `engine.ts`, `lookup.ts`, and `escape.ts` (Handlebars handles HTML escape + path lookup natively). `lookup.ts` is still called by `helpers.ts::buildLink` for inner `{{token}}` substitution inside link URL templates — so it stays for that one purpose (keep the file, trim to only what's used).

**Tech Stack:** Handlebars 4.x runtime. Compiles templates at content-script runtime (precompile-at-save is a post-Phase-2 optimization per spec). Existing pnpm + Vite + Vitest + TypeScript retained.

**Deferred to Plan 3 (Options-page rewrite):** the spec mentions a per-template dismissible banner in the Templates tab ("Migrated to Handlebars syntax. Review and confirm.") that dismisses when the user saves the template. That UI depends on the Preact-rewritten options page and is therefore scheduled for Plan 3, not this plan. Plan 2 performs the migration silently; users inspecting their templates after update will see the new syntax without a banner until Plan 3 ships.

**Reference spec:** [`docs/superpowers/specs/2026-04-18-phase2-ux-polish-design.md`](../specs/2026-04-18-phase2-ux-polish-design.md) sections: "Architecture", "State model", "Migration (v1 → v2)", "Handlebars syntax reference".

---

## Task 1: Create the feature branch

**Files:** none — git operation only.

- [ ] **Step 1.1: Ensure working tree is clean, on `main`, up to date**

Run:
```bash
git status
git checkout main
git pull origin main
```
Expected: `main` up to date with `origin/main`, clean working tree.

- [ ] **Step 1.2: Create and check out the feature branch**

Run:
```bash
git checkout -b feature/phase2-plan2-engine-swap
```
Expected: `Switched to a new branch 'feature/phase2-plan2-engine-swap'`.

---

## Task 2: Install Handlebars

**Files:**
- Modify: `package.json`

- [ ] **Step 2.1: Install handlebars as a runtime dependency**

Run:
```bash
pnpm add handlebars
```
Expected: `package.json` `dependencies` now contains `"handlebars": "^4.x"`. `pnpm-lock.yaml` updated.

- [ ] **Step 2.2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add handlebars runtime for template engine swap"
```

---

## Task 3: Extend `StorageShape` with `schemaVersion`

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 3.1: Add the optional field**

Open `src/shared/types.ts`. Modify the `StorageShape` interface so it reads:

```ts
export interface StorageShape {
  schemaVersion?: number;
  rules: Rule[];
  templates: Templates;
  hostSkipList: HostSkipList;
}
```

The field is optional because v1 users have no `schemaVersion` key — their absence signals "needs migration".

- [ ] **Step 3.2: Typecheck to confirm no downstream breakage**

Run:
```bash
pnpm typecheck
```
Expected: no errors (optional field, existing consumers unaffected).

- [ ] **Step 3.3: Commit**

```bash
git add src/shared/types.ts
git commit -m "storage: add optional schemaVersion to StorageShape"
```

---

## Task 4: Write the v1 → v2 syntax migrator (TDD)

**Files:**
- Create: `src/engine/migrate.ts`
- Create: `src/engine/migrate.test.ts`

- [ ] **Step 4.1: Write the failing tests**

Create `src/engine/migrate.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { migrateTemplate } from './migrate';

describe('migrateTemplate — v1 → v2', () => {
  it('returns pure text unchanged', () => {
    expect(migrateTemplate('<p>hello</p>')).toBe('<p>hello</p>');
  });

  it('leaves v2-compatible inline expressions unchanged', () => {
    expect(migrateTemplate('<p>{{id}} {{user.name}}</p>')).toBe(
      '<p>{{id}} {{user.name}}</p>',
    );
  });

  it('rewrites {{@var}} to {{vars.var}}', () => {
    expect(migrateTemplate('<p>{{@env}} / {{@adminHost}}</p>')).toBe(
      '<p>{{vars.env}} / {{vars.adminHost}}</p>',
    );
  });

  it('rewrites bare #when to #if (eq ...)', () => {
    expect(migrateTemplate('{{#when status "UP"}}<green>{{/when}}')).toBe(
      '{{#if (eq status "UP")}}<green>{{/if}}',
    );
  });

  it('rewrites #when + #else to #if / else / /if', () => {
    expect(
      migrateTemplate('{{#when x "y"}}<green>{{#else}}<red>{{/when}}'),
    ).toBe('{{#if (eq x "y")}}<green>{{else}}<red>{{/if}}');
  });

  it('rewrites #when on @variable', () => {
    expect(migrateTemplate('{{#when @env "qa"}}[QA]{{/when}}')).toBe(
      '{{#if (eq vars.env "qa")}}[QA]{{/if}}',
    );
  });

  it('rewrites nested #when/#each combinations', () => {
    const input = '{{#each items}}{{#when this.type "A"}}[A]{{/when}}{{/each}}';
    const expected = '{{#each items}}{{#if (eq this.type "A")}}[A]{{/if}}{{/each}}';
    expect(migrateTemplate(input)).toBe(expected);
  });

  it('rewrites #when with dotted-path LHS', () => {
    expect(migrateTemplate('{{#when user.role "admin"}}X{{/when}}')).toBe(
      '{{#if (eq user.role "admin")}}X{{/if}}',
    );
  });

  it('leaves {{date x "fmt"}} / {{link "tmpl"}} / {{num x}} helpers unchanged', () => {
    const template = '{{date t "yyyy-MM-dd"}} / {{link "https://h/{{id}}"}} / {{num count}}';
    expect(migrateTemplate(template)).toBe(template);
  });

  it('migrates a realistic mixed template', () => {
    const input =
      '<p>{{@adminHost}}</p>{{#when status "UP"}}<g>{{/when}}{{#each items}}{{this.name}}{{/each}}';
    const expected =
      '<p>{{vars.adminHost}}</p>{{#if (eq status "UP")}}<g>{{/if}}{{#each items}}{{this.name}}{{/each}}';
    expect(migrateTemplate(input)).toBe(expected);
  });
});
```

- [ ] **Step 4.2: Run the tests to verify they fail**

Run:
```bash
pnpm test -- src/engine/migrate.test.ts
```
Expected: FAIL with "Cannot find module './migrate'".

- [ ] **Step 4.3: Implement the migrator**

Create `src/engine/migrate.ts` with:

```ts
/**
 * Convert a v1 template (hand-rolled engine syntax) to v2 (Handlebars syntax).
 *
 * Transforms applied, in order (order matters — later rules must not see earlier-rule artifacts):
 *   1. {{#when X "Y"}}...{{#else}}...{{/when}}  →  {{#if (eq X "Y")}}...{{else}}...{{/if}}
 *   2. {{#when X "Y"}}...{{/when}}              →  {{#if (eq X "Y")}}...{{/if}}
 *   3. {{@varName}}                              →  {{vars.varName}}
 *
 * Inline `{{path}}`, `{{{path}}}`, `{{date x "fmt"}}`, `{{link "tmpl"}}`, `{{num x}}`, and
 * `{{#each x}}...{{/each}}` are already valid Handlebars and pass through unchanged.
 *
 * An `@var` inside a `#when` LHS (e.g. `{{#when @env "qa"}}`) is rewritten by step 1/2 first to
 * `{{#if (eq @env "qa")}}`, then step 3 converts the remaining `@env` to `vars.env`.
 */

const WHEN_WITH_ELSE =
  /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/when\}\}/g;

const WHEN_NO_ELSE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{\/when\}\}/g;

const AT_VAR = /\{\{@(\w+)\}\}/g;

export function migrateTemplate(v1: string): string {
  let out = v1;

  out = out.replace(
    WHEN_WITH_ELSE,
    (_m, lhs: string, rhs: string, trueBranch: string, elseBranch: string) =>
      `{{#if (eq ${lhs} "${rhs}")}}${trueBranch}{{else}}${elseBranch}{{/if}}`,
  );

  out = out.replace(
    WHEN_NO_ELSE,
    (_m, lhs: string, rhs: string, body: string) =>
      `{{#if (eq ${lhs} "${rhs}")}}${body}{{/if}}`,
  );

  // Rewrite @var → vars.var EVERYWHERE, including inside the just-rewritten #if arguments.
  out = out.replace(AT_VAR, (_m, name: string) => `{{vars.${name}}}`);

  // Also handle @var as a bare identifier inside subexpressions, e.g. `(eq @env "qa")` produced
  // by the #when rewriter above. These aren't matched by AT_VAR (which requires `{{@` and `}}`).
  out = out.replace(/\(\s*eq\s+@(\w+)\s+/g, (_m, name: string) => `(eq vars.${name} `);

  return out;
}
```

- [ ] **Step 4.4: Run the tests to verify they pass**

Run:
```bash
pnpm test -- src/engine/migrate.test.ts
```
Expected: 10 tests passed.

- [ ] **Step 4.5: Commit**

```bash
git add src/engine/migrate.ts src/engine/migrate.test.ts
git commit -m "engine: add v1 → v2 template syntax migrator (10 snapshot tests)"
```

---

## Task 5: Replace the engine with a Handlebars wrapper

**Files:**
- Modify: `src/engine/engine.ts` (replace entirely)
- Modify: `src/engine/helpers.ts` (add `registerHelpers` export)
- Keep: `src/engine/sanitize.ts` unchanged
- Keep: `src/engine/lookup.ts` unchanged (still used by `buildLink`)
- Delete: `src/engine/escape.ts` (Handlebars handles HTML escape natively)

- [ ] **Step 5.1: Extend `helpers.ts` with a `registerHelpers` function**

Open `src/engine/helpers.ts`. Add at the top:

```ts
import Handlebars from 'handlebars';
```

Append at the bottom of the file:

```ts
/**
 * Register all Present-JSON helpers on a Handlebars environment. Idempotent — safe to call
 * multiple times (Handlebars overwrites by name).
 *
 * Helpers:
 * - `eq a b` — stringwise equality (matches v1 `#when` semantics where `String(value) === rhs`).
 * - `date value fmt?` — delegates to `formatDate`.
 * - `link template` — delegates to `buildLink`, pulling root data + vars from Handlebars options.
 * - `num value` — delegates to `formatNumber`.
 */
export function registerHelpers(hb: typeof Handlebars): void {
  hb.registerHelper('eq', (a: unknown, b: unknown) => String(a ?? '') === String(b ?? ''));

  hb.registerHelper('date', (value: unknown, fmt: unknown) =>
    formatDate(value, typeof fmt === 'string' ? fmt : undefined),
  );

  hb.registerHelper('link', function linkHelper(this: unknown, tmpl: unknown, options: Handlebars.HelperOptions) {
    const root = (options?.data?.root ?? {}) as Record<string, unknown>;
    const vars = ((root['vars'] as Record<string, string>) ?? {});
    // Pass `root` as the json context so migrated `{{vars.x}}` inside link URL strings resolves
    // via buildLink's dotted-path lookup (root.vars.x). The separate `vars` arg still supports
    // the legacy `{{@x}}` prefix in case a user hand-authors a v2 template with the old shape.
    const out = buildLink(typeof tmpl === 'string' ? tmpl : '', root, vars);
    // buildLink returns a plain string; we wrap it in SafeString so Handlebars doesn't double-escape
    // the percent-encoded bytes. The final sanitizer pass still runs.
    return new hb.SafeString(out);
  });

  hb.registerHelper('num', (value: unknown) => formatNumber(value));
}
```

- [ ] **Step 5.2: Rewrite `engine.ts` as a Handlebars wrapper**

Replace the contents of `src/engine/engine.ts` with:

```ts
import Handlebars from 'handlebars';
import { registerHelpers } from './helpers';
import { sanitize } from './sanitize';
import type { Variables } from '../shared/types';

// Each render call runs on a private Handlebars environment so tests and live code never
// contaminate each other's helper registry.
function makeEnv(): typeof Handlebars {
  const env = Handlebars.create();
  registerHelpers(env);
  return env;
}

/**
 * Render a Handlebars template with the given JSON data and rule-defined variables.
 * Always pipes output through the sanitizer as a final step.
 *
 * Variables are exposed under the `vars` namespace: `{{vars.adminHost}}` in templates.
 */
export function render(templateText: string, json: unknown, vars: Variables): string {
  const env = makeEnv();
  const compiled = env.compile(templateText, { noEscape: false, strict: false });
  const context = typeof json === 'object' && json !== null
    ? { ...(json as Record<string, unknown>), vars }
    : { vars };
  const output = compiled(context);
  return sanitize(output);
}
```

- [ ] **Step 5.3: Delete obsolete `escape.ts`**

Run:
```bash
git rm src/engine/escape.ts
```

(It's no longer imported anywhere — the Handlebars wrapper handles escape.)

- [ ] **Step 5.4: Typecheck to confirm engine compiles cleanly against the new shape**

Run:
```bash
pnpm typecheck
```
Expected: no errors. (If tests still reference `htmlEscape`, that's fine — Task 9 rewrites them.)

- [ ] **Step 5.5: Commit**

```bash
git add src/engine/engine.ts src/engine/helpers.ts
git commit -m "engine: swap hand-rolled renderer for handlebars wrapper"
```

---

## Task 6: Write the storage-layer template migration

**Files:**
- Modify: `src/storage/migration.ts` (add new export)
- Modify: `src/storage/migration.test.ts` (add test suite)

- [ ] **Step 6.1: Write the failing tests**

Open `src/storage/migration.test.ts` and append:

```ts
import { migrateTemplatesToV2 } from './migration';

describe('migrateTemplatesToV2', () => {
  function makeStubStorage(initial: Record<string, string>) {
    const state = { ...initial };
    return {
      async get(key: string) {
        return key in state ? state[key] : undefined;
      },
      async set(patch: Record<string, unknown>) {
        Object.assign(state, patch);
      },
      _peek: () => ({ ...state }),
    };
  }

  it('rewrites every template and stamps schemaVersion=2', async () => {
    const storage = {
      getTemplates: async () => ({
        'internal-user': '{{#when status "UP"}}<g>{{/when}}{{@env}}',
        'other': '{{@host}}',
      }),
      setTemplates: async (next: Record<string, string>) => {
        storage._lastWrite = next;
      },
      setSchemaVersion: async (v: number) => { storage._v = v; },
      _lastWrite: null as unknown,
      _v: 0,
    };
    const result = await migrateTemplatesToV2(storage);
    expect(result.ok).toBe(true);
    expect(result.migrated).toContain('internal-user');
    expect(result.migrated).toContain('other');
    expect(storage._lastWrite).toEqual({
      'internal-user': '{{#if (eq status "UP")}}<g>{{/if}}{{vars.env}}',
      'other': '{{vars.host}}',
    });
    expect(storage._v).toBe(2);
  });

  it('rolls back if any single rewritten template fails Handlebars compile', async () => {
    const storage = {
      getTemplates: async () => ({
        'good': '{{@host}}',
        'broken': '{{#each',           // unterminated — will fail compile after migration
      }),
      setTemplates: async (next: Record<string, string>) => {
        storage._lastWrite = next;
      },
      setSchemaVersion: async (v: number) => { storage._v = v; },
      _lastWrite: null as unknown,
      _v: 0,
    };
    const result = await migrateTemplatesToV2(storage);
    expect(result.ok).toBe(false);
    expect(result.failed).toContain('broken');
    expect(storage._lastWrite).toBeNull();
    expect(storage._v).toBe(0);
  });

  it('no-ops with schemaVersion=2 already set (caller responsibility, but safe)', async () => {
    // The migrator trusts its caller, so it will run regardless. But writing an empty template
    // map is a safe no-op-ish case.
    const storage = {
      getTemplates: async () => ({}),
      setTemplates: async (next: Record<string, string>) => {
        storage._lastWrite = next;
      },
      setSchemaVersion: async (v: number) => { storage._v = v; },
      _lastWrite: null as unknown,
      _v: 0,
    };
    const result = await migrateTemplatesToV2(storage);
    expect(result.ok).toBe(true);
    expect(result.migrated).toEqual([]);
    expect(storage._v).toBe(2);
  });
});
```

- [ ] **Step 6.2: Run the tests to verify they fail**

Run:
```bash
pnpm test -- src/storage/migration.test.ts
```
Expected: FAIL with "migrateTemplatesToV2 is not a function" (or similar).

- [ ] **Step 6.3: Implement `migrateTemplatesToV2`**

Open `src/storage/migration.ts`. Add at the top:

```ts
import Handlebars from 'handlebars';
import { migrateTemplate } from '../engine/migrate';
import { registerHelpers } from '../engine/helpers';
```

Append at the bottom:

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

/**
 * Batch-atomic v1 → v2 template migration. Compiles every rewritten template against a
 * disposable Handlebars environment (with Present-JSON helpers registered) as a dry-run. If
 * any single template fails to compile, the entire batch is rejected — no storage write, and
 * schemaVersion remains unset so a later run can retry. If all succeed, writes the full
 * rewritten template map atomically, then stamps schemaVersion=2.
 */
export async function migrateTemplatesToV2(
  storage: MigrateTemplatesStorage,
): Promise<MigrateResult> {
  const before = await storage.getTemplates();
  const env = Handlebars.create();
  registerHelpers(env);

  const rewritten: Record<string, string> = {};
  const migrated: string[] = [];
  const failed: string[] = [];

  for (const [key, source] of Object.entries(before)) {
    const next = migrateTemplate(source);
    try {
      env.compile(next, { noEscape: false, strict: false });
      rewritten[key] = next;
      migrated.push(key);
    } catch {
      failed.push(key);
    }
  }

  if (failed.length > 0) {
    return { ok: false, migrated: [], failed };
  }

  await storage.setTemplates(rewritten);
  await storage.setSchemaVersion(2);
  return { ok: true, migrated, failed: [] };
}
```

- [ ] **Step 6.4: Run the tests to verify they pass**

Run:
```bash
pnpm test -- src/storage/migration.test.ts
```
Expected: all new tests pass, plus any pre-existing tests in the same file.

- [ ] **Step 6.5: Commit**

```bash
git add src/storage/migration.ts src/storage/migration.test.ts
git commit -m "storage: add migrateTemplatesToV2 with atomic rollback on compile failure"
```

---

## Task 7: Extend the storage facade with `setSchemaVersion`

**Files:**
- Modify: `src/storage/storage.ts`
- Modify: `src/storage/storage.test.ts`

- [ ] **Step 7.1: Inspect the existing facade to find the pattern**

Run:
```bash
cat src/storage/storage.ts
```
Note how existing accessors (`getRules`, `setRules`, `getTemplates`, `setTemplates`, `getHostSkipList`, `setHostSkipList`) are shaped. Follow the same pattern.

- [ ] **Step 7.2: Write the failing test**

Open `src/storage/storage.test.ts`. Append inside an appropriate describe block (or add a new `describe('schemaVersion', () => {...})` if none exists):

```ts
import { createStorage } from './storage';

describe('schemaVersion', () => {
  it('returns undefined when unset', async () => {
    // Use whatever stubbing pattern the rest of this file uses (chrome.storage mock).
    const storage = await createStorage(/* mock chrome.storage with empty state */);
    expect(await storage.getSchemaVersion()).toBeUndefined();
  });

  it('round-trips an integer value', async () => {
    const storage = await createStorage(/* mock chrome.storage */);
    await storage.setSchemaVersion(2);
    expect(await storage.getSchemaVersion()).toBe(2);
  });
});
```

> **Note:** `createStorage` takes a chrome.storage-shaped argument. Reuse the existing mock/stub pattern from the rest of the test file — do NOT invent a new one. If a helper like `makeFakeChromeStorage()` already exists in the file, call it the same way.

- [ ] **Step 7.3: Run the test to verify it fails**

Run:
```bash
pnpm test -- src/storage/storage.test.ts
```
Expected: FAIL with "getSchemaVersion is not a function" or similar.

- [ ] **Step 7.4: Implement the accessors**

Open `src/storage/storage.ts`. Inside the object returned by `createStorage`, add the same pattern other accessors use:

```ts
async getSchemaVersion(): Promise<number | undefined> {
  const result = await area.get(['schemaVersion']);
  const v = result['schemaVersion'];
  return typeof v === 'number' ? v : undefined;
},

async setSchemaVersion(version: number): Promise<void> {
  await area.set({ schemaVersion: version });
},
```

(`area` is the name used by existing accessors in the file — check the file and use the same local binding name.)

- [ ] **Step 7.5: Run the tests to verify they pass**

Run:
```bash
pnpm test -- src/storage/storage.test.ts
```
Expected: pass.

- [ ] **Step 7.6: Commit**

```bash
git add src/storage/storage.ts src/storage/storage.test.ts
git commit -m "storage: add get/setSchemaVersion accessors"
```

---

## Task 8: Wire migration into the background service worker

**Files:**
- Modify: `src/background/background.ts`

- [ ] **Step 8.1: Read current background bootstrap**

Run:
```bash
cat src/background/background.ts
```
Note the existing `maybeMigrate` + `seedStartersIfEmpty` dance. The new template migration runs AFTER the existing sync→local storage check and BEFORE the starter seed, so that starters (which are v2) aren't inadvertently migrated.

- [ ] **Step 8.2: Replace the file with the extended bootstrap**

Replace `src/background/background.ts` contents with:

```ts
import { createStorage } from '../storage/storage';
import {
  estimateBytes,
  SYNC_SOFT_LIMIT,
  migrateSyncToLocal,
  migrateTemplatesToV2,
} from '../storage/migration';
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
  // Fresh installs are already v2 — starters are written in v2 syntax at source.
  await storage.setSchemaVersion(2);
}

async function maybeStorageAreaMigration(): Promise<void> {
  try {
    const all = await chrome.storage.sync.get(['rules', 'templates', 'hostSkipList']);
    if (estimateBytes(all) > SYNC_SOFT_LIMIT) {
      await migrateSyncToLocal(chrome.storage);
    }
  } catch (err) {
    console.warn('[present-json] storage-area migration skipped:', err);
  }
}

async function maybeSchemaMigration(): Promise<void> {
  try {
    const storage = await createStorage(chrome.storage);
    const current = await storage.getSchemaVersion();
    if (current !== undefined) return; // already migrated (or freshly seeded)
    const result = await migrateTemplatesToV2(storage);
    if (!result.ok) {
      console.warn(
        '[present-json] template migration rolled back; failing template IDs:',
        result.failed,
      );
    }
  } catch (err) {
    console.warn('[present-json] schema migration skipped:', err);
  }
}

void main();
```

- [ ] **Step 8.3: Build to verify the background script still compiles**

Run:
```bash
pnpm build
```
Expected: clean build, `dist/assets/background.ts-*.js` present.

- [ ] **Step 8.4: Commit**

```bash
git add src/background/background.ts
git commit -m "background: run v1→v2 template migration on first run after update"
```

---

## Task 9: Rewrite bundled starter templates in v2 syntax

**Files:**
- Modify: `src/starter/internal-user.html`
- Modify: `src/starter/github-repo.html`
- Modify: `src/starter/github-repo.test.ts` (if the asserted output changes)
- Modify: `test/fixtures/internal-user/template.html`
- Modify: `test/fixtures/internal-user/expected.html` (if output shape changes — should be identical after migration because semantics are preserved)

- [ ] **Step 9.1: Rewrite `internal-user.html`**

Replace `src/starter/internal-user.html` contents with:

```html
<div class="pj-row">
  <span class="pj-label">ID</span>
  <a href="https://{{vars.adminHost}}/user/{{id}}">{{id}}</a>
</div>
<div class="pj-row">
  <span class="pj-label">Insert Date</span>
  <span>{{date insertDate}}</span>
</div>
<div class="pj-row">
  <span class="pj-label">Status</span>
  {{#if (eq status "UP")}}<span class="pj-up">UP</span>{{/if}}
  {{#if (eq status "DOWN")}}<span class="pj-down">DOWN</span>{{/if}}
</div>
<style>
  .pj-row { display:flex; gap:12px; padding:6px 12px; border-bottom:1px solid #f3f4f6; }
  .pj-label { color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:.5px; min-width:120px; }
  .pj-up   { background:#10b981; color:#fff; padding:2px 8px; border-radius:3px; }
  .pj-down { background:#ef4444; color:#fff; padding:2px 8px; border-radius:3px; }
</style>
```

- [ ] **Step 9.2: Rewrite `github-repo.html`**

Open `src/starter/github-repo.html`. Make exactly these substitutions:
- `{{#when archived "true"}}` → `{{#if (eq archived "true")}}`
- `{{#else}}` (inside the archived block) → `{{else}}`
- `{{/when}}` (closing the archived block) → `{{/if}}`
- `{{#when homepage ""}}{{#else}}<p class="pj-gh__home">...</p>{{/when}}` → `{{#if (eq homepage "")}}{{else}}<p class="pj-gh__home">...</p>{{/if}}`
- `{{#when language ""}}{{#else}}<dt>Language</dt>...{{/when}}` → `{{#if (eq language "")}}{{else}}<dt>Language</dt>...{{/if}}`
- `{{#when license.name ""}}{{#else}}<dt>License</dt>...{{/when}}` → `{{#if (eq license.name "")}}{{else}}<dt>License</dt>...{{/if}}`

All other tags (`{{num ...}}`, `{{date ...}}`, `{{link ...}}`, `{{{...}}}`, `{{path.to.value}}`, `{{#each topics}}...{{/each}}`, `{{this}}`) are already valid Handlebars — leave unchanged.

- [ ] **Step 9.3: Update the fixture template in v2 syntax**

Open `test/fixtures/internal-user/template.html`. Apply the same rewrites as Step 9.1 (it should match the starter). The `expected.html` output should be unchanged because semantics are preserved by the migration — verify in Step 9.5.

- [ ] **Step 9.4: Run the github-repo starter tests**

Run:
```bash
pnpm test -- src/starter/github-repo.test.ts
```
Expected: all 10 tests pass against the v2 template.

- [ ] **Step 9.5: Run the fixture snapshot test**

Run:
```bash
pnpm test -- src/engine/fixture.test.ts
```
Expected: pass against the v2 template + unchanged expected.html.

- [ ] **Step 9.6: Commit**

```bash
git add src/starter/ test/fixtures/internal-user/template.html
git commit -m "starter: rewrite bundled templates in handlebars v2 syntax"
```

---

## Task 10: Rewrite the engine unit tests in v2 syntax

**Files:**
- Modify: `src/engine/engine.test.ts` (rewrite — replace every v1 syntax with v2)
- Modify: `src/engine/helpers.test.ts` (no change — helpers tested directly, still pass)
- Delete (implied): any test specifically asserting hand-rolled block-walker internals that don't survive the swap

- [ ] **Step 10.1: Replace the contents of `engine.test.ts` entirely**

Replace `src/engine/engine.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { render } from './engine';

describe('render — values and variables', () => {
  it('returns non-template text unchanged', () => {
    expect(render('<p>hello</p>', {}, {})).toBe('<p>hello</p>');
  });
  it('interpolates a dotted-path value', () => {
    expect(render('<p>{{id}}</p>', { id: 42 }, {})).toBe('<p>42</p>');
  });
  it('interpolates a variable', () => {
    expect(render('<p>{{vars.env}}</p>', {}, { env: 'qa' })).toBe('<p>qa</p>');
  });
  it('escapes HTML in values', () => {
    expect(render('<p>{{x}}</p>', { x: '<b>&' }, {})).toBe('<p>&lt;b&gt;&amp;</p>');
  });
  it('renders missing values as empty string', () => {
    expect(render('<p>[{{missing}}]</p>', {}, {})).toBe('<p>[]</p>');
  });
  it('triple-brace skips HTML escaping', () => {
    expect(render('<p>{{{x}}}</p>', { x: '<b>' }, {})).toBe('<p><b></p>');
  });
});

describe('render — #if (eq)', () => {
  it('renders the true branch when equal', () => {
    const t = '{{#if (eq status "UP")}}<green>{{/if}}';
    expect(render(t, { status: 'UP' }, {})).toBe('<green>');
  });
  it('renders nothing when unequal and no else', () => {
    const t = '{{#if (eq status "UP")}}<green>{{/if}}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('');
  });
  it('renders else branch when unequal', () => {
    const t = '{{#if (eq status "UP")}}<green>{{else}}<red>{{/if}}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('<red>');
  });
  it('supports vars.X as the left-hand side', () => {
    const t = '{{#if (eq vars.env "qa")}}[QA]{{/if}}';
    expect(render(t, {}, { env: 'qa' })).toBe('[QA]');
    expect(render(t, {}, { env: 'prod' })).toBe('');
  });
  it('compares boolean true to string "true" (v1 parity)', () => {
    expect(render('{{#if (eq archived "true")}}A{{/if}}', { archived: true }, {})).toBe('A');
    expect(render('{{#if (eq archived "true")}}A{{/if}}', { archived: false }, {})).toBe('');
  });
});

describe('render — #each', () => {
  it('iterates array elements using this', () => {
    const t = '{{#each items}}<li>{{this}}</li>{{/each}}';
    expect(render(t, { items: ['a', 'b', 'c'] }, {})).toBe('<li>a</li><li>b</li><li>c</li>');
  });
  it('scopes dotted paths to the current element', () => {
    const t = '{{#each users}}{{this.name}};{{/each}}';
    expect(render(t, { users: [{ name: 'Alice' }, { name: 'Bob' }] }, {})).toBe('Alice;Bob;');
  });
  it('renders empty for empty array', () => {
    expect(render('{{#each items}}x{{/each}}', { items: [] }, {})).toBe('');
  });
  it('renders empty when missing', () => {
    expect(render('{{#each items}}x{{/each}}', {}, {})).toBe('');
  });
});

describe('render — helpers', () => {
  it('formats an ISO timestamp with custom format', () => {
    process.env.TZ = 'UTC';
    const t = '{{date insertDate "yyyy-MM-dd"}}';
    expect(render(t, { insertDate: '2026-04-17T23:09:30Z' }, {})).toBe('2026-04-17');
  });
  it('interpolates vars and json into a link URL', () => {
    const t = '{{link "https://{{vars.adminHost}}/user/{{id}}"}}';
    expect(render(t, { id: 9 }, { adminHost: 'a.com' })).toBe('https://a.com/user/9');
  });
  it('percent-encodes query components in a link', () => {
    const t = '{{link "https://x/?q={{q}}"}}';
    expect(render(t, { q: 'a&b' }, {})).toBe('https://x/?q=a%26b');
  });
  it('compacts large numbers via num', () => {
    expect(render('{{num stars}}', { stars: 234567 }, {})).toBe('235k');
  });
});

describe('render — sanitizer pass', () => {
  it('strips a <script> tag from the final output', () => {
    // The template itself contains the script; sanitizer runs after Handlebars expands.
    expect(render('<p>hi</p><script>alert(1)</script>', {}, {})).toBe('<p>hi</p>');
  });
});
```

- [ ] **Step 10.2: Run the full test suite**

Run:
```bash
pnpm test
```
Expected: all tests pass. Count baseline is 100 (from main after github-repo merged); this task should leave count in the 100–110 range depending on how many v1-specific tests got folded into v2 equivalents.

- [ ] **Step 10.3: Commit**

```bash
git add src/engine/engine.test.ts
git commit -m "test: rewrite engine tests in handlebars v2 syntax"
```

---

## Task 11: Remove obsolete engine internals

**Files:**
- Modify: `src/engine/helpers.ts` (drop unused `TOKEN_RE` + `htmlEscape` usage in the top of the file if any is orphaned)
- Keep: `src/engine/lookup.ts` (still called by `buildLink` for inner `{{token}}` expansion — verify it's imported)
- Delete: any helper that's become dead code

- [ ] **Step 11.1: Find what's imported where**

Run:
```bash
grep -rn "from './escape'" src/
grep -rn "from './lookup'" src/
grep -rn "from './engine'" src/
```

Expected: `./escape` has no remaining importers. `./lookup` is imported by `./helpers` (inside `buildLink`). `./engine` is imported by the content script + tests.

- [ ] **Step 11.2: If Step 11.1 reveals any dead imports in `helpers.ts`, remove them**

Open `src/engine/helpers.ts`. Remove any `import { htmlEscape } from './escape'` (already deleted file), and any local `htmlEscape` references inside the file that are no longer reachable.

- [ ] **Step 11.3: Run the full suite + typecheck + lint**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm test
```
Expected: all green.

- [ ] **Step 11.4: Commit**

```bash
git add src/engine/helpers.ts
git commit -m "engine: prune dead imports after handlebars swap"
```

---

## Task 12: Full verification (tests + typecheck + lint + build + E2E)

**Files:** none — verification only.

- [ ] **Step 12.1: Run the full unit test suite**

Run:
```bash
pnpm test
```
Expected: all tests pass.

- [ ] **Step 12.2: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 12.3: Run lint**

Run:
```bash
pnpm lint
```
Expected: no errors.

- [ ] **Step 12.4: Run production build, inspect bundle sizes**

Run:
```bash
pnpm build
```
Expected: clean build. The content-script bundle will grow significantly (Handlebars runtime+compile is ~22 KB gzipped) — this is expected per the spec's bundle-impact table. Record the new size in the final handoff for Matt's awareness.

- [ ] **Step 12.5: Update the fixture server rule if it seeds a v1 template in any script**

Run:
```bash
grep -rn "{{#when\|{{@\|{{/when}}\|{{#else}}" test/ src/starter/
```
Expected: no matches (all v1 syntax purged from fixtures + starters).

- [ ] **Step 12.6: Run the E2E spec**

Run:
```bash
pnpm test:e2e
```
Expected: 1 passed. The E2E seeds its own rule against the v2 internal-user template (already updated in Task 9.3).

- [ ] **Step 12.7: Confirm clean tree**

Run:
```bash
git status
```
Expected: "nothing to commit, working tree clean".

- [ ] **Step 12.8: Push the branch**

Run:
```bash
git push -u origin feature/phase2-plan2-engine-swap
```

---

## Task 13: Code review pass (required phase per Matt's workflow)

**Files:** none — review is external.

- [ ] **Step 13.1: Dispatch a fresh code-reviewer agent**

Per Matt's global rule: "Multi-step implementation plans must include a code-review pass as the second-to-last phase, before final verification. Dispatch a fresh reviewer agent so it has no implementation bias."

Invoke the `feature-dev:code-reviewer` agent. Brief it with:
- Branch name + base
- What the plan shipped (engine swap + migrator + starter rewrites)
- That bundle growth is expected
- All automated verification is green

Ask the reviewer to look for:
- Migration correctness (regex ordering, edge cases, nested blocks)
- `eq` helper semantics (stringwise match with v1)
- Sanitizer still runs post-render
- Template compile failure → atomic rollback path actually rolls back
- Any un-migrated syntax lurking in tests or starters

- [ ] **Step 13.2: Address high-confidence findings**

For any must-fix issue surfaced, make a targeted fix commit on the branch. Re-run full verification (Task 12.1–12.6) after each round of fixes.

---

## Task 14: Documentation updates

**Files:**
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `CLAUDE.md` (architecture note — engine is now Handlebars-based)

- [ ] **Step 14.1: Update README template-syntax section**

In `README.md`, replace the v1 syntax table + examples with the Handlebars v2 syntax:

```markdown
## Template syntax

Templates are Handlebars. Placeholders resolve against the parsed JSON body (`this` is the JSON root inside an `#each`).

| Syntax | Meaning |
|---|---|
| `{{path.to.value}}` | Interpolate (HTML-escaped). |
| `{{{path.to.value}}}` | Interpolate raw (no escape). |
| `{{vars.varName}}` | Interpolate a rule-defined variable. |
| `{{#if (eq x "literal")}}...{{/if}}` | Render block if `x` equals the literal (stringwise). |
| `{{#if (eq x "y")}}...{{else}}...{{/if}}` | Two-way conditional. |
| `{{#each items}}...{{this.field}}...{{/each}}` | Iterate an array; `this` scopes to each element. |
| `{{date timestamp}}` | Default format: `Apr 17, 2026 4:09 PM`. |
| `{{date timestamp "yyyy-MM-dd HH:mm"}}` | Custom format. |
| `{{link "https://host/{{id}}"}}` | URL-safe interpolation (query values percent-encoded). |
| `{{num value}}` | Compact number format (234567 → 235k, 1234567 → 1.2M). |

All standard Handlebars builtins also work: `{{#unless}}`, `{{#with}}`, partials, subexpressions. Missing values render as the empty string.
```

Also bump the test-count badge + line-171-ish count to the new totals.

- [ ] **Step 14.2: Update ROADMAP Plan 2 status**

In `ROADMAP.md`, change `Plan 2 — Engine swap: ...— pending` to `— done YYYY-MM-DD` (use today's date).

- [ ] **Step 14.3: Update CLAUDE.md architecture section**

In `CLAUDE.md`, update the Architecture bullet describing the engine: replace the hand-rolled block-walker description with "thin Handlebars wrapper; registers `eq`, `date`, `link`, `num` helpers; sanitizer runs post-render".

- [ ] **Step 14.4: Commit**

```bash
git add README.md ROADMAP.md CLAUDE.md
git commit -m "docs: update syntax table + architecture for handlebars engine"
```

- [ ] **Step 14.5: Push**

Run:
```bash
git push
```

---

## Task 15: Hand off for Matt's review

**Files:** none.

- [ ] **Step 15.1: Report to Matt**

Summarize:
- Branch: `feature/phase2-plan2-engine-swap`
- Commit chain: deps → schemaVersion field → migrator → engine swap → storage migration → storage accessors → background wiring → starter rewrites → test rewrites → dead-code pruning → verification → code-review fixups → docs
- Bundle impact: content-script bundle gzipped from 1.27 KB → ~22–25 KB (expected per spec).
- Test count delta.
- Push URL.

- [ ] **Step 15.2: Wait for explicit FF-merge approval**

Do NOT FF-merge to `main` until Matt explicitly says merge.

---

## Done when

- [ ] All unit tests pass (count documented in handoff).
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e` all clean.
- [ ] Existing fixture test still green — internal-user v2 template produces the same `expected.html` output.
- [ ] A fresh install seeds v2 starters and stamps `schemaVersion: 2` without running migration.
- [ ] A simulated update-from-v1 flow migrates templates atomically, keeps v1 source on failure.
- [ ] Content script renders via Handlebars end-to-end; sanitizer still runs as the final pass.
- [ ] `grep '{{#when\|{{@\|{{/when}}\|{{#else}}'` in `src/` and `test/fixtures/` returns nothing.
- [ ] Code review done; high-confidence findings addressed.
- [ ] README, CLAUDE.md, ROADMAP.md updated.
- [ ] Matt has approved the branch for FF-merge to `main`.
