# Export / Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the template + rule export/import feature described in `docs/superpowers/specs/2026-04-19-export-import-design.md`. Users can export rules/templates to a plain `.freshet.json` bundle and import bundles back with collision review, secret-sniff warnings, and a persistent "needs attention" badge on flagged items.

**Architecture:** One new pure-core module `src/bundle/` (Node-testable, zero `chrome.*`) containing schema, serialize, parse, sniff, collide. Three UI surfaces under `src/options/` (export/, import/, badges/) — Preact dialogs that call into the core. One new optional `Rule.name` field, one new storage key `pj_import_flags`. `Rule.id` already exists and is required in the schema (`src/shared/types.ts`), so no id migration is needed.

**Tech Stack:** Preact + TypeScript + Vitest + Playwright + `@crxjs/vite-plugin`. No new runtime deps — `crypto.randomUUID` is browser-native, `navigator.clipboard` is MV3-permitted, `File` / `FileReader` / drag-drop are DOM-standard.

**Critical de-risk:** Task 3 writes a minimal `parse → write → read back` smoke using real `chrome.storage` behind a Vitest mock. If the storage facade can't round-trip a bundle payload, stop and re-plan the storage interaction shape before building out the rest.

---

## Phases

1. **Foundation** (Tasks 1–4) — branch verify, schema extension, storage facade extension, round-trip smoke.
2. **Pure bundle core** (Tasks 5–9) — `schema.ts`, `sniff.ts`, `collide.ts`, `serialize.ts`, `parse.ts`. TDD, zero `chrome.*`.
3. **Export UI** (Tasks 10–14) — footer wiring, ExportDialog shell, ExportPicker, ExportScrub, ExportOutput.
4. **Import UI** (Tasks 15–18) — ImportDialog shell, ImportInput, ImportReview, ImportAppendModal.
5. **Needs-attention badge** (Tasks 19–20) — NeedsAttention component, wire into RuleCard + template cards, dismiss handling.
6. **E2E + a11y** (Tasks 21–24) — Playwright round-trip + append + paste + file-picker; axe-core for new dialogs.
7. **Code review** (Task 25) — dispatch fresh `feature-dev:code-reviewer` agent, fix findings.
8. **Docs + ship** (Tasks 26–29) — README Principles section + export/import mention, CLAUDE.md gotchas, ROADMAP.md P0 marked done, final verification + handoff for FF-merge.

---

## Task 1: Verify feature branch state

- [ ] **Step 1.1: Confirm branch + clean working tree**

```bash
git status
git branch --show-current
```

Expected: on `feature/export-import`, working tree clean (or only has the design spec committed).

- [ ] **Step 1.2: Confirm spec is present**

```bash
ls docs/superpowers/specs/2026-04-19-export-import-design.md
```

Expected: file exists.

---

## Task 2: Add optional `name` field to `Rule`

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 2.1: Add `name?: string` to the `Rule` interface**

Edit `src/shared/types.ts` to add the field. Full file after edit:

```ts
export type Variables = Record<string, string>;

export interface Rule {
  id: string;
  /** Optional human-readable label. Display falls back to hostPattern if unset. */
  name?: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
  variables: Variables;
  active: boolean;
  /** True if this rule was bundled by the install seed; informational only. */
  isExample?: boolean;
  /** Canonical demo URL for an example rule — opened when the user clicks the Example pill. */
  exampleUrl?: string;
}

export type Templates = Record<string, string>;

export type HostSkipList = string[];

export interface StorageShape {
  schemaVersion?: number;
  rules: Rule[];
  templates: Templates;
  hostSkipList: HostSkipList;
}
```

- [ ] **Step 2.2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors (the field is optional so existing code is unaffected).

- [ ] **Step 2.3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(types): add optional Rule.name field"
```

---

## Task 3: Extend storage facade with `pj_import_flags` + `pj_sample_json`

**Files:**
- Modify: `src/storage/storage.ts`
- Create: `src/storage/storage.test.ts` (new tests only — if the file exists, add to it)

**Context:** The facade currently wraps `rules`, `templates`, `hostSkipList`, `schemaVersion`, `pj_migrated_v2`. We need typed accessors for `pj_sample_json` (read during sniff/export/import) and `pj_import_flags` (new).

- [ ] **Step 3.1: Write failing tests for the new accessors**

Create or extend `src/storage/storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createStorage } from './storage';

function fakeStorageApi(seed: Record<string, unknown> = {}): typeof chrome.storage {
  const local = { ...seed };
  const sync: Record<string, unknown> = {};
  const area = (store: Record<string, unknown>): chrome.storage.StorageArea => ({
    get: ((keys?: string | string[] | Record<string, unknown> | null) => {
      if (typeof keys === 'string') return Promise.resolve({ [keys]: store[keys] });
      if (Array.isArray(keys)) return Promise.resolve(Object.fromEntries(keys.map((k) => [k, store[k]])));
      return Promise.resolve({ ...store });
    }) as chrome.storage.StorageArea['get'],
    set: ((items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    }) as chrome.storage.StorageArea['set'],
  } as unknown as chrome.storage.StorageArea);
  return {
    local: area(local),
    sync: area(sync),
  } as unknown as typeof chrome.storage;
}

describe('storage — sample JSON + import flags', () => {
  it('reads sample JSON map (empty by default)', async () => {
    const api = fakeStorageApi({ pj_storage_area: 'local' });
    const s = await createStorage(api);
    expect(await s.getSampleJsonMap()).toEqual({});
  });

  it('writes and reads a sample JSON map', async () => {
    const api = fakeStorageApi({ pj_storage_area: 'local' });
    const s = await createStorage(api);
    await s.setSampleJsonMap({ foo: '{"a":1}' });
    expect(await s.getSampleJsonMap()).toEqual({ foo: '{"a":1}' });
  });

  it('reads import flags (empty by default)', async () => {
    const api = fakeStorageApi({ pj_storage_area: 'local' });
    const s = await createStorage(api);
    expect(await s.getImportFlags()).toEqual({});
  });

  it('writes and reads import flags', async () => {
    const api = fakeStorageApi({ pj_storage_area: 'local' });
    const s = await createStorage(api);
    const entry = {
      source: 'append' as const,
      importedAt: '2026-04-19T00:00:00Z',
      flags: [
        { field: 'variables.auth', pattern: '/token/i', matchedText: 'abc' },
      ],
    };
    await s.setImportFlags({ 'some-template': entry });
    expect(await s.getImportFlags()).toEqual({ 'some-template': entry });
  });
});
```

- [ ] **Step 3.2: Run tests — expect failures**

```bash
pnpm test -- storage.test
```

Expected: 4 failing tests (methods don't exist).

- [ ] **Step 3.3: Implement the accessors**

Edit `src/storage/storage.ts`. Full file after edit:

```ts
import type { Rule, Templates, HostSkipList } from '../shared/types';

const K_RULES = 'rules';
const K_TEMPLATES = 'templates';
const K_SKIP = 'hostSkipList';
const K_AREA = 'pj_storage_area';
const K_SCHEMA = 'schemaVersion';
const K_MIGRATED = 'pj_migrated_v2';
const K_SAMPLE = 'pj_sample_json';
const K_FLAGS = 'pj_import_flags';

export type SampleJsonMap = Record<string, string>;

export interface ImportFlag {
  field: string;
  pattern: string;
  matchedText: string;
}

export interface ImportFlagEntry {
  source: 'import' | 'append';
  importedAt: string;
  flags: ImportFlag[];
}

export type ImportFlagMap = Record<string, ImportFlagEntry>;

export interface Storage {
  getRules(): Promise<Rule[]>;
  setRules(rules: Rule[]): Promise<void>;
  getTemplates(): Promise<Templates>;
  setTemplates(templates: Templates): Promise<void>;
  getHostSkipList(): Promise<HostSkipList>;
  setHostSkipList(list: HostSkipList): Promise<void>;
  getSchemaVersion(): Promise<number | undefined>;
  setSchemaVersion(version: number): Promise<void>;
  setMigratedList(names: string[]): Promise<void>;
  getSampleJsonMap(): Promise<SampleJsonMap>;
  setSampleJsonMap(map: SampleJsonMap): Promise<void>;
  getImportFlags(): Promise<ImportFlagMap>;
  setImportFlags(map: ImportFlagMap): Promise<void>;
}

export async function createStorage(api: typeof chrome.storage): Promise<Storage> {
  const sentinel = await api.local.get([K_AREA]);
  const area = (sentinel as Record<string, unknown>)[K_AREA] === 'local' ? api.local : api.sync;
  const getOne = async <T>(key: string, fallback: T): Promise<T> => {
    const result = await area.get([key]);
    return (result[key] as T | undefined) ?? fallback;
  };
  return {
    getRules: () => getOne<Rule[]>(K_RULES, []),
    setRules: (rules) => area.set({ [K_RULES]: rules }),
    getTemplates: () => getOne<Templates>(K_TEMPLATES, {}),
    setTemplates: (templates) => area.set({ [K_TEMPLATES]: templates }),
    getHostSkipList: () => getOne<HostSkipList>(K_SKIP, []),
    setHostSkipList: (list) => area.set({ [K_SKIP]: list }),
    getSchemaVersion: async () => {
      const result = await area.get([K_SCHEMA]);
      const v = result[K_SCHEMA];
      return typeof v === 'number' ? v : undefined;
    },
    setSchemaVersion: (version) => area.set({ [K_SCHEMA]: version }),
    setMigratedList: (names) => area.set({ [K_MIGRATED]: names }),
    getSampleJsonMap: () => getOne<SampleJsonMap>(K_SAMPLE, {}),
    setSampleJsonMap: (map) => area.set({ [K_SAMPLE]: map }),
    getImportFlags: () => getOne<ImportFlagMap>(K_FLAGS, {}),
    setImportFlags: (map) => area.set({ [K_FLAGS]: map }),
  };
}
```

- [ ] **Step 3.4: Run tests — expect pass**

```bash
pnpm test -- storage.test
```

Expected: all 4 new tests pass, existing tests still pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/storage/storage.ts src/storage/storage.test.ts
git commit -m "feat(storage): expose sample JSON map + import flags"
```

---

## Task 4: Round-trip smoke — bundle shape writes + reads back

**Purpose:** de-risk the storage interaction shape before building the core. Simple end-to-end "write a fake bundle payload, read it back, assert equality."

**Files:**
- Create: `src/bundle/smoke.test.ts`

- [ ] **Step 4.1: Write the smoke test**

```ts
import { describe, it, expect } from 'vitest';
import { createStorage } from '../storage/storage';

function fakeApi(seed: Record<string, unknown> = { pj_storage_area: 'local' }): typeof chrome.storage {
  const local = { ...seed };
  const sync: Record<string, unknown> = {};
  const mk = (store: Record<string, unknown>) => ({
    get: ((keys?: string | string[]) =>
      Promise.resolve(
        typeof keys === 'string'
          ? { [keys]: store[keys] }
          : Array.isArray(keys)
          ? Object.fromEntries(keys.map((k) => [k, store[k]]))
          : { ...store },
      )) as chrome.storage.StorageArea['get'],
    set: ((items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    }) as chrome.storage.StorageArea['set'],
  }) as unknown as chrome.storage.StorageArea;
  return { local: mk(local), sync: mk(sync) } as unknown as typeof chrome.storage;
}

describe('bundle smoke — storage round-trip', () => {
  it('writes all bundle-adjacent keys and reads them back identically', async () => {
    const storage = await createStorage(fakeApi());
    await storage.setTemplates({ t1: '<div>{{x}}</div>' });
    await storage.setSampleJsonMap({ t1: '{"x":1}' });
    await storage.setRules([
      {
        id: 'r1',
        name: 'r1 name',
        hostPattern: 'api.x.com',
        pathPattern: '/**',
        templateName: 't1',
        variables: { env: 'qa' },
        active: false,
      },
    ]);
    await storage.setImportFlags({
      t1: {
        source: 'append',
        importedAt: '2026-04-19T00:00:00Z',
        flags: [{ field: 'variables.env', pattern: '/token/i', matchedText: 'qa' }],
      },
    });

    expect(await storage.getTemplates()).toEqual({ t1: '<div>{{x}}</div>' });
    expect(await storage.getSampleJsonMap()).toEqual({ t1: '{"x":1}' });
    expect((await storage.getRules())[0]?.name).toBe('r1 name');
    expect(await storage.getImportFlags()).toHaveProperty('t1');
  });
});
```

- [ ] **Step 4.2: Run the smoke — expect pass**

```bash
pnpm test -- bundle/smoke.test
```

Expected: pass. If it fails, stop and re-plan the storage interaction before proceeding.

- [ ] **Step 4.3: Commit**

```bash
git add src/bundle/smoke.test.ts
git commit -m "test(bundle): storage round-trip smoke"
```

---

## Task 5: `src/bundle/schema.ts` — types + validator

**Files:**
- Create: `src/bundle/schema.ts`
- Create: `src/bundle/schema.test.ts`

- [ ] **Step 5.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { validateBundle, type FreshetBundle } from './schema';

const mkBundle = (override: Partial<FreshetBundle> = {}): unknown => ({
  bundleSchemaVersion: 1,
  exportedAt: '2026-04-19T00:00:00Z',
  appVersion: '1.0.0',
  templates: [{ name: 't1', source: '<div>{{x}}</div>' }],
  rules: [
    {
      id: 'r1',
      hostPattern: 'api.x.com',
      pathPattern: '/**',
      templateName: 't1',
      active: true,
    },
  ],
  ...override,
});

describe('validateBundle', () => {
  it('accepts a minimal valid bundle', () => {
    const r = validateBundle(mkBundle());
    expect(r.ok).toBe(true);
  });

  it('rejects wrong schema version', () => {
    const r = validateBundle(mkBundle({ bundleSchemaVersion: 2 as 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/bundleSchemaVersion/);
  });

  it('rejects rule referencing non-existent template', () => {
    const r = validateBundle(
      mkBundle({
        rules: [
          {
            id: 'r1',
            hostPattern: 'api.x.com',
            pathPattern: '/**',
            templateName: 'missing',
            active: true,
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/templateName.*missing/);
  });

  it('rejects duplicate template names', () => {
    const r = validateBundle(
      mkBundle({
        templates: [
          { name: 'dup', source: 'a' },
          { name: 'dup', source: 'b' },
        ],
        rules: [],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/duplicate/i);
  });

  it('keeps sampleJson as string (never parsed)', () => {
    const r = validateBundle(
      mkBundle({
        templates: [{ name: 't1', source: 'x', sampleJson: '{"unterminated' }],
        rules: [],
      }),
    );
    // Malformed sample JSON does not break validation — it's opaque.
    expect(r.ok).toBe(true);
  });

  it('drops unknown top-level keys', () => {
    const r = validateBundle({ ...(mkBundle() as object), unknownKey: 'x' });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 5.2: Run tests — expect failures**

```bash
pnpm test -- schema.test
```

Expected: import errors / undefined `validateBundle`.

- [ ] **Step 5.3: Implement `schema.ts`**

```ts
export interface BundleTemplate {
  name: string;
  source: string;
  sampleJson?: string;
}

export interface BundleRule {
  id: string;
  name?: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
  variables?: Record<string, string>;
  active: boolean;
}

export interface FreshetBundle {
  bundleSchemaVersion: 1;
  exportedAt: string;
  exportedBy?: string;
  appVersion: string;
  templates: BundleTemplate[];
  rules: BundleRule[];
}

export type ValidationResult =
  | { ok: true; bundle: FreshetBundle }
  | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

export function validateBundle(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['bundle must be a JSON object'] };
  }

  if (raw.bundleSchemaVersion !== 1) {
    errors.push(
      `bundleSchemaVersion must be 1 (got ${JSON.stringify(raw.bundleSchemaVersion)})`,
    );
  }
  if (!isString(raw.exportedAt)) errors.push('exportedAt must be a string');
  if (!isString(raw.appVersion)) errors.push('appVersion must be a string');
  if (raw.exportedBy !== undefined && !isString(raw.exportedBy)) {
    errors.push('exportedBy, if present, must be a string');
  }
  if (!Array.isArray(raw.templates)) errors.push('templates must be an array');
  if (!Array.isArray(raw.rules)) errors.push('rules must be an array');

  if (errors.length > 0) return { ok: false, errors };

  const templates: BundleTemplate[] = [];
  const seen = new Set<string>();
  for (const [i, t] of (raw.templates as unknown[]).entries()) {
    if (!isPlainObject(t)) {
      errors.push(`templates[${i}] must be an object`);
      continue;
    }
    if (!isString(t.name)) errors.push(`templates[${i}].name must be a string`);
    if (!isString(t.source)) errors.push(`templates[${i}].source must be a string`);
    if (t.sampleJson !== undefined && !isString(t.sampleJson)) {
      errors.push(`templates[${i}].sampleJson, if present, must be a string`);
    }
    if (isString(t.name) && seen.has(t.name)) {
      errors.push(`duplicate template name: ${t.name}`);
    }
    if (isString(t.name) && isString(t.source)) {
      seen.add(t.name);
      templates.push({
        name: t.name,
        source: t.source,
        ...(isString(t.sampleJson) ? { sampleJson: t.sampleJson } : {}),
      });
    }
  }

  const templateNames = new Set(templates.map((t) => t.name));
  const rules: BundleRule[] = [];
  for (const [i, r] of (raw.rules as unknown[]).entries()) {
    if (!isPlainObject(r)) {
      errors.push(`rules[${i}] must be an object`);
      continue;
    }
    if (!isString(r.id)) errors.push(`rules[${i}].id must be a string`);
    if (!isString(r.hostPattern)) errors.push(`rules[${i}].hostPattern must be a string`);
    if (!isString(r.pathPattern)) errors.push(`rules[${i}].pathPattern must be a string`);
    if (!isString(r.templateName)) errors.push(`rules[${i}].templateName must be a string`);
    if (!isBoolean(r.active)) errors.push(`rules[${i}].active must be a boolean`);
    if (r.name !== undefined && !isString(r.name)) {
      errors.push(`rules[${i}].name, if present, must be a string`);
    }
    if (r.variables !== undefined) {
      if (!isPlainObject(r.variables)) {
        errors.push(`rules[${i}].variables, if present, must be an object`);
      } else {
        for (const [k, v] of Object.entries(r.variables)) {
          if (!isString(v)) errors.push(`rules[${i}].variables.${k} must be a string`);
        }
      }
    }
    if (
      isString(r.templateName) &&
      !templateNames.has(r.templateName)
    ) {
      errors.push(
        `rules[${i}].templateName "${r.templateName}" does not match any template in the bundle`,
      );
    }
    if (
      isString(r.id) &&
      isString(r.hostPattern) &&
      isString(r.pathPattern) &&
      isString(r.templateName) &&
      isBoolean(r.active)
    ) {
      rules.push({
        id: r.id,
        hostPattern: r.hostPattern,
        pathPattern: r.pathPattern,
        templateName: r.templateName,
        active: r.active,
        ...(isString(r.name) ? { name: r.name } : {}),
        ...(isPlainObject(r.variables)
          ? { variables: r.variables as Record<string, string> }
          : {}),
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    bundle: {
      bundleSchemaVersion: 1,
      exportedAt: raw.exportedAt as string,
      appVersion: raw.appVersion as string,
      ...(isString(raw.exportedBy) ? { exportedBy: raw.exportedBy } : {}),
      templates,
      rules,
    },
  };
}
```

- [ ] **Step 5.4: Run tests — expect pass**

```bash
pnpm test -- schema.test
```

Expected: all 6 tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/bundle/schema.ts src/bundle/schema.test.ts
git commit -m "feat(bundle): schema + validator (bundleSchemaVersion=1)"
```

---

## Task 6: `src/bundle/sniff.ts` — secret scanner

**Files:**
- Create: `src/bundle/sniff.ts`
- Create: `src/bundle/sniff.test.ts`

- [ ] **Step 6.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { sniff } from './sniff';
import type { FreshetBundle } from './schema';

function mk(partial: Partial<FreshetBundle> = {}): FreshetBundle {
  return {
    bundleSchemaVersion: 1,
    exportedAt: '2026-04-19T00:00:00Z',
    appVersion: '1.0.0',
    templates: [],
    rules: [],
    ...partial,
  };
}

describe('sniff', () => {
  it('returns no hits on a clean bundle', () => {
    const hits = sniff(mk({ templates: [{ name: 't', source: 'x' }] }));
    expect(hits).toEqual([]);
  });

  it('flags KEY_SECRETY on rule.variables key `auth_token`', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x' }],
        rules: [
          {
            id: 'r',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            active: true,
            variables: { auth_token: 'abc' },
          },
        ],
      }),
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.patternId).toBe('KEY_SECRETY');
    expect(hits[0]?.field).toBe('rules[0].variables.auth_token');
    expect(hits[0]?.matchedText).toBe('auth_token');
  });

  it('flags BEARER_PREFIX on rule.variables value', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x' }],
        rules: [
          {
            id: 'r',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            active: true,
            variables: { header: 'Bearer abc123' },
          },
        ],
      }),
    );
    const ids = hits.map((h) => h.patternId);
    expect(ids).toContain('BEARER_PREFIX');
  });

  it('flags JWT in sample JSON nested string value', () => {
    const sampleJson = JSON.stringify({
      resp: { auth: 'eyJhbGciOi.eyJzdWIi.signature' },
    });
    const hits = sniff(
      mk({ templates: [{ name: 't', source: 'x', sampleJson }], rules: [] }),
    );
    const ids = hits.map((h) => h.patternId);
    expect(ids).toContain('JWT');
    expect(hits.find((h) => h.patternId === 'JWT')?.field).toBe(
      'templates[0].sampleJson.resp.auth',
    );
  });

  it('does not throw on malformed sampleJson', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x', sampleJson: '{not valid' }],
      }),
    );
    expect(Array.isArray(hits)).toBe(true);
  });

  it('does not flag regular field names like `title` or `id`', () => {
    const sampleJson = JSON.stringify({ title: 'hi', id: 'x1' });
    const hits = sniff(
      mk({ templates: [{ name: 't', source: 'x', sampleJson }] }),
    );
    expect(hits).toEqual([]);
  });

  it('exports a readable patternRegex string on every hit', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x' }],
        rules: [
          {
            id: 'r',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            active: true,
            variables: { api_key: 'x' },
          },
        ],
      }),
    );
    expect(hits[0]?.patternRegex).toMatch(/^\/.+\/[gimsuy]*$/);
  });
});
```

- [ ] **Step 6.2: Run tests — expect failures**

```bash
pnpm test -- sniff.test
```

- [ ] **Step 6.3: Implement `sniff.ts`**

```ts
import type { FreshetBundle } from './schema';

export interface SniffPattern {
  id: string;
  kind: 'key' | 'value';
  regex: RegExp;
}

export const SNIFF_PATTERNS: readonly SniffPattern[] = [
  { id: 'KEY_SECRETY',   kind: 'key',   regex: /token|secret|key|password|auth|bearer|api[_-]?key|credential/i },
  { id: 'BEARER_PREFIX', kind: 'value', regex: /^Bearer\s+\S+/ },
  { id: 'JWT',           kind: 'value', regex: /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/ },
  { id: 'OAUTH_GOOGLE',  kind: 'value', regex: /^ya29\./ },
];

export interface SniffHit {
  field: string;
  patternId: string;
  patternRegex: string;
  matchedText: string;
}

function patternString(re: RegExp): string {
  return re.toString();
}

function scanKey(key: string, field: string, out: SniffHit[]): void {
  for (const p of SNIFF_PATTERNS) {
    if (p.kind !== 'key') continue;
    const m = key.match(p.regex);
    if (m) {
      out.push({
        field,
        patternId: p.id,
        patternRegex: patternString(p.regex),
        matchedText: m[0],
      });
    }
  }
}

function scanValue(value: string, field: string, out: SniffHit[]): void {
  for (const p of SNIFF_PATTERNS) {
    if (p.kind !== 'value') continue;
    const m = value.match(p.regex);
    if (m) {
      out.push({
        field,
        patternId: p.id,
        patternRegex: patternString(p.regex),
        matchedText: m[0],
      });
    }
  }
}

function walkJson(node: unknown, path: string, out: SniffHit[]): void {
  if (typeof node === 'string') {
    scanValue(node, path, out);
    return;
  }
  if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) walkJson(v, `${path}[${i}]`, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const childPath = `${path}.${k}`;
      scanKey(k, childPath, out);
      walkJson(v, childPath, out);
    }
  }
}

export function sniff(bundle: FreshetBundle): SniffHit[] {
  const hits: SniffHit[] = [];
  for (const [i, r] of bundle.rules.entries()) {
    if (!r.variables) continue;
    for (const [k, v] of Object.entries(r.variables)) {
      const field = `rules[${i}].variables.${k}`;
      scanKey(k, field, hits);
      scanValue(v, field, hits);
    }
  }
  for (const [i, t] of bundle.templates.entries()) {
    if (!t.sampleJson) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(t.sampleJson);
    } catch {
      continue;
    }
    walkJson(parsed, `templates[${i}].sampleJson`, hits);
  }
  return hits;
}
```

- [ ] **Step 6.4: Run tests — expect pass**

```bash
pnpm test -- sniff.test
```

- [ ] **Step 6.5: Commit**

```bash
git add src/bundle/sniff.ts src/bundle/sniff.test.ts
git commit -m "feat(bundle): secret-sniff with literal pattern output"
```

---

## Task 7: `src/bundle/collide.ts` — collision detection + rename

**Files:**
- Create: `src/bundle/collide.ts`
- Create: `src/bundle/collide.test.ts`

- [ ] **Step 7.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { nextAvailableName, detectCollisions } from './collide';
import type { FreshetBundle } from './schema';
import type { Rule, Templates } from '../shared/types';

describe('nextAvailableName', () => {
  it('returns name-2 when base already exists', () => {
    expect(nextAvailableName('github-repo', new Set(['github-repo']))).toBe('github-repo-2');
  });

  it('skips past name-2, name-3 to find the first free', () => {
    expect(
      nextAvailableName(
        'x',
        new Set(['x', 'x-2', 'x-3']),
      ),
    ).toBe('x-4');
  });

  it('returns base unchanged when no collision', () => {
    expect(nextAvailableName('fresh', new Set([]))).toBe('fresh');
  });
});

describe('detectCollisions', () => {
  const existingRules: Rule[] = [
    {
      id: 'existing-1',
      hostPattern: 'a',
      pathPattern: 'b',
      templateName: 'foo',
      variables: {},
      active: true,
    },
  ];
  const existingTemplates: Templates = { foo: '<div></div>' };

  const bundle: FreshetBundle = {
    bundleSchemaVersion: 1,
    exportedAt: '2026-04-19T00:00:00Z',
    appVersion: '1.0.0',
    templates: [{ name: 'foo', source: '<div>new</div>' }],
    rules: [
      {
        id: 'existing-1', // id collision
        hostPattern: 'a',
        pathPattern: 'b',
        templateName: 'foo',
        active: true,
      },
    ],
  };

  it('detects template name collision', () => {
    const c = detectCollisions(bundle, existingRules, existingTemplates);
    expect(c.templateCollisions).toHaveLength(1);
    expect(c.templateCollisions[0]?.name).toBe('foo');
    expect(c.templateCollisions[0]?.proposedRename).toBe('foo-2');
  });

  it('detects rule id collision', () => {
    const c = detectCollisions(bundle, existingRules, existingTemplates);
    expect(c.ruleIdCollisions).toHaveLength(1);
    expect(c.ruleIdCollisions[0]?.id).toBe('existing-1');
  });

  it('flags pattern overlap for rules with different ids but same pattern', () => {
    const b = { ...bundle, rules: [{ ...bundle.rules[0]!, id: 'different' }] };
    const c = detectCollisions(b, existingRules, existingTemplates);
    expect(c.rulePatternOverlaps).toHaveLength(1);
  });
});
```

- [ ] **Step 7.2: Run tests — expect failures**

```bash
pnpm test -- collide.test
```

- [ ] **Step 7.3: Implement `collide.ts`**

```ts
import type { FreshetBundle } from './schema';
import type { Rule, Templates } from '../shared/types';

export interface TemplateCollision {
  name: string;
  proposedRename: string;
}

export interface RuleIdCollision {
  id: string;
}

export interface RulePatternOverlap {
  bundleRuleId: string;
  existingRuleId: string;
  hostPattern: string;
  pathPattern: string;
}

export interface RuleNameCollision {
  name: string;
  bundleRuleId: string;
  existingRuleId: string;
}

export interface CollisionReport {
  templateCollisions: TemplateCollision[];
  ruleIdCollisions: RuleIdCollision[];
  ruleNameCollisions: RuleNameCollision[];
  rulePatternOverlaps: RulePatternOverlap[];
}

export function nextAvailableName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function detectCollisions(
  bundle: FreshetBundle,
  existingRules: Rule[],
  existingTemplates: Templates,
): CollisionReport {
  const existingTemplateNames = new Set(Object.keys(existingTemplates));
  const templateCollisions: TemplateCollision[] = bundle.templates
    .filter((t) => existingTemplateNames.has(t.name))
    .map((t) => ({
      name: t.name,
      proposedRename: nextAvailableName(t.name, new Set([
        ...existingTemplateNames,
        ...bundle.templates.map((bt) => bt.name),
      ])),
    }));

  const existingIds = new Map(existingRules.map((r) => [r.id, r]));
  const ruleIdCollisions: RuleIdCollision[] = bundle.rules
    .filter((r) => existingIds.has(r.id))
    .map((r) => ({ id: r.id }));

  const existingNames = new Map(
    existingRules.filter((r) => r.name).map((r) => [r.name!, r]),
  );
  const ruleNameCollisions: RuleNameCollision[] = bundle.rules
    .filter((r) => r.name && existingNames.has(r.name) && !existingIds.has(r.id))
    .map((r) => ({
      name: r.name!,
      bundleRuleId: r.id,
      existingRuleId: existingNames.get(r.name!)!.id,
    }));

  const rulePatternOverlaps: RulePatternOverlap[] = [];
  for (const br of bundle.rules) {
    if (existingIds.has(br.id)) continue;
    const overlap = existingRules.find(
      (er) => er.hostPattern === br.hostPattern && er.pathPattern === br.pathPattern,
    );
    if (overlap) {
      rulePatternOverlaps.push({
        bundleRuleId: br.id,
        existingRuleId: overlap.id,
        hostPattern: br.hostPattern,
        pathPattern: br.pathPattern,
      });
    }
  }

  return { templateCollisions, ruleIdCollisions, ruleNameCollisions, rulePatternOverlaps };
}
```

- [ ] **Step 7.4: Run tests — expect pass**

```bash
pnpm test -- collide.test
```

- [ ] **Step 7.5: Commit**

```bash
git add src/bundle/collide.ts src/bundle/collide.test.ts
git commit -m "feat(bundle): collision detection + rename helper"
```

---

## Task 8: `src/bundle/serialize.ts` — export

**Files:**
- Create: `src/bundle/serialize.ts`
- Create: `src/bundle/serialize.test.ts`

- [ ] **Step 8.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { buildBundle } from './serialize';
import type { Rule, Templates } from '../shared/types';

const rules: Rule[] = [
  {
    id: 'r1',
    name: '[qa] ghr',
    hostPattern: 'api.github.com',
    pathPattern: '/repos/**',
    templateName: 'github-repo',
    variables: { env: 'qa' },
    active: true,
    isExample: true,
    exampleUrl: 'https://example.com',
  },
];

const templates: Templates = { 'github-repo': '<div>{{name}}</div>' };

const sampleJson = { 'github-repo': '{"name":"demo"}' };

describe('buildBundle', () => {
  it('includes selected rules + selected templates + sample JSON by default', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.bundleSchemaVersion).toBe(1);
    expect(b.templates).toHaveLength(1);
    expect(b.templates[0]?.sampleJson).toBe('{"name":"demo"}');
    expect(b.rules).toHaveLength(1);
    expect(b.rules[0]?.variables).toEqual({ env: 'qa' });
  });

  it('omits sampleJson when strip set includes the template name', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(['github-repo']),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.templates[0]?.sampleJson).toBeUndefined();
  });

  it('omits variables when strip set includes the rule id', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(['r1']),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.rules[0]?.variables).toBeUndefined();
  });

  it('strips isExample and exampleUrl from exported rules', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect((b.rules[0] as Record<string, unknown>).isExample).toBeUndefined();
    expect((b.rules[0] as Record<string, unknown>).exampleUrl).toBeUndefined();
  });

  it('preserves selected order of rules', () => {
    const moreRules: Rule[] = [
      { ...rules[0]!, id: 'rA' },
      { ...rules[0]!, id: 'rB' },
      { ...rules[0]!, id: 'rC' },
    ];
    const b = buildBundle({
      selectedRuleIds: ['rC', 'rA'],
      selectedTemplateNames: ['github-repo'],
      rules: moreRules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.rules.map((r) => r.id)).toEqual(['rC', 'rA']);
  });
});
```

- [ ] **Step 8.2: Run tests — expect failures**

```bash
pnpm test -- serialize.test
```

- [ ] **Step 8.3: Implement `serialize.ts`**

```ts
import type { Rule, Templates } from '../shared/types';
import type { FreshetBundle, BundleRule, BundleTemplate } from './schema';

export interface BuildBundleInput {
  selectedRuleIds: string[];
  selectedTemplateNames: string[];
  rules: Rule[];
  templates: Templates;
  sampleJson: Record<string, string>;
  appVersion: string;
  stripSampleJson: Set<string>;
  stripVariables: Set<string>;
  exportedAt: string;
  exportedBy?: string;
}

export function buildBundle(input: BuildBundleInput): FreshetBundle {
  const ruleById = new Map(input.rules.map((r) => [r.id, r]));
  const bundleRules: BundleRule[] = input.selectedRuleIds
    .map((id) => ruleById.get(id))
    .filter((r): r is Rule => r !== undefined)
    .map((r) => {
      const out: BundleRule = {
        id: r.id,
        hostPattern: r.hostPattern,
        pathPattern: r.pathPattern,
        templateName: r.templateName,
        active: r.active,
      };
      if (r.name) out.name = r.name;
      if (!input.stripVariables.has(r.id) && Object.keys(r.variables).length > 0) {
        out.variables = { ...r.variables };
      }
      return out;
    });

  const bundleTemplates: BundleTemplate[] = input.selectedTemplateNames
    .filter((n) => n in input.templates)
    .map((n) => {
      const out: BundleTemplate = { name: n, source: input.templates[n]! };
      const sample = input.sampleJson[n];
      if (sample !== undefined && !input.stripSampleJson.has(n)) {
        out.sampleJson = sample;
      }
      return out;
    });

  return {
    bundleSchemaVersion: 1,
    exportedAt: input.exportedAt,
    appVersion: input.appVersion,
    ...(input.exportedBy ? { exportedBy: input.exportedBy } : {}),
    templates: bundleTemplates,
    rules: bundleRules,
  };
}
```

- [ ] **Step 8.4: Run tests — expect pass**

```bash
pnpm test -- serialize.test
```

- [ ] **Step 8.5: Commit**

```bash
git add src/bundle/serialize.ts src/bundle/serialize.test.ts
git commit -m "feat(bundle): serialize (export) with strip options"
```

---

## Task 9: `src/bundle/parse.ts` — safe parse + validate

**Files:**
- Create: `src/bundle/parse.ts`
- Create: `src/bundle/parse.test.ts`

- [ ] **Step 9.1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseBundle } from './parse';

const valid = JSON.stringify({
  bundleSchemaVersion: 1,
  exportedAt: '2026-04-19T00:00:00Z',
  appVersion: '1.0.0',
  templates: [{ name: 't', source: 'x' }],
  rules: [
    { id: 'r', hostPattern: 'a', pathPattern: 'b', templateName: 't', active: true },
  ],
});

describe('parseBundle', () => {
  it('parses a valid JSON string', () => {
    const r = parseBundle(valid);
    expect(r.ok).toBe(true);
  });

  it('returns a JSON_PARSE error for malformed JSON', () => {
    const r = parseBundle('{ not valid');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/JSON/);
  });

  it('returns VALIDATION errors for wrong schema', () => {
    const r = parseBundle('{"bundleSchemaVersion":99}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/bundleSchemaVersion/);
  });

  it('accepts arbitrary string for sampleJson (no re-parse)', () => {
    const withBadSample = JSON.stringify({
      bundleSchemaVersion: 1,
      exportedAt: 'x',
      appVersion: '1.0.0',
      templates: [{ name: 't', source: 'x', sampleJson: '{not json' }],
      rules: [],
    });
    const r = parseBundle(withBadSample);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 9.2: Run tests — expect failures**

```bash
pnpm test -- parse.test
```

- [ ] **Step 9.3: Implement `parse.ts`**

```ts
import { validateBundle, type ValidationResult } from './schema';

export function parseBundle(rawText: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return { ok: false, errors: [`JSON parse error: ${(err as Error).message}`] };
  }
  return validateBundle(parsed);
}
```

- [ ] **Step 9.4: Run tests — expect pass**

```bash
pnpm test -- parse.test
```

- [ ] **Step 9.5: Commit**

```bash
git add src/bundle/parse.ts src/bundle/parse.test.ts
git commit -m "feat(bundle): parse wraps validate with JSON-parse errors"
```

---

## Task 10: Wire Export + Import buttons into `ShortcutsFooter`

**Files:**
- Modify: `src/options/ShortcutsFooter.tsx`
- Modify: `src/options/App.tsx` (to host the dialog state)
- Modify: `src/options/options.css` (or nearest existing stylesheet) for the center slot

- [ ] **Step 10.1: Add a center slot with two buttons to the footer**

Edit `src/options/ShortcutsFooter.tsx` — add a center `<div>` between the shortcuts toggle and the project links. The buttons fire props-based callbacks so the parent can open its dialogs:

```tsx
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const SHORTCUTS: Array<[string, string]> = [
  ['⌘⇧J', 'Toggle raw/rendered on a matched page'],
  ['⌘⇧C', "Copy current tab's URL"],
  ['⌘/', 'Focus URL tester (this page)'],
  ['⌘S', 'Disabled — your changes autosave'],
  ['?', 'Open this panel'],
];

function focusUrlTester(): void {
  const input = document.querySelector<HTMLInputElement>('.pj-url-input');
  if (input) {
    input.focus();
    input.select();
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.matches('input, textarea, select')) return true;
  if (target.closest('.cm-content')) return true;
  if (target.isContentEditable) return true;
  return false;
}

export interface ShortcutsFooterProps {
  onExport: () => void;
  onImport: () => void;
}

export function ShortcutsFooter({ onExport, onImport }: ShortcutsFooterProps): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        focusUrlTester();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        return;
      }
      if (e.key === '?' && !isTypingTarget(e.target)) {
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <footer class="pj-shortcuts">
      <div class="pj-shortcuts-bar">
        <button
          type="button"
          class="pj-shortcuts-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▾' : '▸'} Keyboard shortcuts
        </button>
        <div class="pj-shortcuts-portloo">
          <button type="button" class="pj-btn pj-btn-ghost" onClick={onExport}>
            ⬇ Export
          </button>
          <button type="button" class="pj-btn pj-btn-ghost" onClick={onImport}>
            ⬆ Import
          </button>
        </div>
        <nav class="pj-shortcuts-links" aria-label="Project links">
          <a
            href="https://mattaltermatt.github.io/freshet/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Freshet site
            <span class="pj-ext-arrow" aria-hidden="true">↗</span>
          </a>
          <a
            href="https://github.com/MattAltermatt/freshet"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
            <span class="pj-ext-arrow" aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
      {open ? (
        <dl class="pj-shortcuts-body">
          {SHORTCUTS.map(([keys, desc]) => (
            <div class="pj-shortcut-row" key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </footer>
  );
}
```

- [ ] **Step 10.2: Add the CSS for the center slot**

Find the existing `.pj-shortcuts-bar` style (grep for it; likely in `src/options/options.css` or a co-located CSS file). Ensure the bar is a flex row with the center slot pushing the nav to the right. If the bar already uses `justify-content: space-between` with only two children, change it to a three-child layout:

```css
.pj-shortcuts-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}
.pj-shortcuts-toggle {
  flex: 0 0 auto;
}
.pj-shortcuts-portloo {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.pj-shortcuts-links {
  flex: 0 0 auto;
}
```

(Adapt selectors if the existing CSS uses different names.)

- [ ] **Step 10.3: Wire `onExport` / `onImport` into `App.tsx` with stubs**

Edit `src/options/App.tsx`. Find where `<ShortcutsFooter />` is rendered and add the two callbacks. Wire them to `useState` flags for now; the dialogs come in later tasks.

```tsx
// within App(), near other hooks:
const [exportOpen, setExportOpen] = useState(false);
const [importOpen, setImportOpen] = useState(false);

// in the render:
<ShortcutsFooter
  onExport={() => setExportOpen(true)}
  onImport={() => setImportOpen(true)}
/>
{/* placeholder dialogs — replaced in later tasks */}
{exportOpen ? <div data-test="export-open-marker" hidden /> : null}
{importOpen ? <div data-test="import-open-marker" hidden /> : null}
```

- [ ] **Step 10.4: Verify typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 10.5: Commit**

```bash
git add src/options/ShortcutsFooter.tsx src/options/App.tsx src/options/options.css
git commit -m "feat(options): footer export/import buttons with stub wiring"
```

---

## Task 11: `ExportDialog` shell — three-step state machine

**Files:**
- Create: `src/options/export/ExportDialog.tsx`
- Create: `src/options/export/ExportDialog.test.tsx`
- Modify: `src/options/App.tsx` (swap the export placeholder for the real dialog)

- [ ] **Step 11.1: Write failing test for the state machine**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportDialog } from './ExportDialog';

describe('ExportDialog', () => {
  const base = {
    rules: [
      {
        id: 'r1',
        name: 'only rule',
        hostPattern: 'a',
        pathPattern: 'b',
        templateName: 't1',
        variables: {},
        active: true,
      },
    ],
    templates: { t1: 'x' },
    sampleJson: {},
    appVersion: '1.0.0',
    onClose: (): void => {},
  };

  it('opens on picker step and advances on Next', () => {
    render(<ExportDialog {...base} />);
    expect(screen.getByRole('heading', { name: /pick/i })).toBeTruthy();
    // Pre-select the only rule and click Next
    fireEvent.click(screen.getByLabelText(/only rule/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('heading', { name: /scrub/i })).toBeTruthy();
  });
});
```

- [ ] **Step 11.2: Run test — expect failure**

```bash
pnpm test -- ExportDialog.test
```

- [ ] **Step 11.3: Implement the shell**

```tsx
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Rule, Templates } from '../../shared/types';
import { ExportPicker } from './ExportPicker';
import { ExportScrub } from './ExportScrub';
import { ExportOutput } from './ExportOutput';
import { buildBundle } from '../../bundle/serialize';
import type { FreshetBundle } from '../../bundle/schema';

export interface ExportDialogProps {
  rules: Rule[];
  templates: Templates;
  sampleJson: Record<string, string>;
  appVersion: string;
  onClose: () => void;
}

type Step = 'pick' | 'scrub' | 'output';

export function ExportDialog(props: ExportDialogProps): JSX.Element {
  const [step, setStep] = useState<Step>('pick');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<string[]>([]);
  const [stripSampleJson, setStripSampleJson] = useState<Set<string>>(new Set());
  const [stripVariables, setStripVariables] = useState<Set<string>>(new Set());
  const [bundle, setBundle] = useState<FreshetBundle | null>(null);

  function goToScrub(ruleIds: string[], templateNames: string[]): void {
    setSelectedRuleIds(ruleIds);
    setSelectedTemplateNames(templateNames);
    setStep('scrub');
  }

  function goToOutput(): void {
    const b = buildBundle({
      selectedRuleIds,
      selectedTemplateNames,
      rules: props.rules,
      templates: props.templates,
      sampleJson: props.sampleJson,
      appVersion: props.appVersion,
      stripSampleJson,
      stripVariables,
      exportedAt: new Date().toISOString(),
    });
    setBundle(b);
    setStep('output');
  }

  return (
    <div class="pj-modal-backdrop" role="dialog" aria-modal="true">
      <div class="pj-modal">
        {step === 'pick' ? (
          <ExportPicker
            rules={props.rules}
            templates={Object.keys(props.templates)}
            onCancel={props.onClose}
            onNext={goToScrub}
          />
        ) : null}
        {step === 'scrub' ? (
          <ExportScrub
            rules={props.rules.filter((r) => selectedRuleIds.includes(r.id))}
            templateNames={selectedTemplateNames}
            sampleJson={props.sampleJson}
            stripSampleJson={stripSampleJson}
            stripVariables={stripVariables}
            onToggleStripSampleJson={(n) =>
              setStripSampleJson((prev) => {
                const next = new Set(prev);
                if (next.has(n)) next.delete(n);
                else next.add(n);
                return next;
              })
            }
            onToggleStripVariables={(id) =>
              setStripVariables((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onBack={() => setStep('pick')}
            onNext={goToOutput}
          />
        ) : null}
        {step === 'output' && bundle ? (
          <ExportOutput bundle={bundle} onDone={props.onClose} />
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 11.4: Stub out `ExportPicker`, `ExportScrub`, `ExportOutput` minimally**

To avoid blocking the test, create placeholder files you'll flesh out in the next tasks:

`src/options/export/ExportPicker.tsx`:
```tsx
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Rule } from '../../shared/types';

export interface ExportPickerProps {
  rules: Rule[];
  templates: string[];
  onCancel: () => void;
  onNext: (ruleIds: string[], templateNames: string[]) => void;
}

export function ExportPicker(props: ExportPickerProps): JSX.Element {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  return (
    <div>
      <h2>Pick what to export</h2>
      {props.rules.map((r) => (
        <label key={r.id}>
          <input
            type="checkbox"
            checked={picked.has(r.id)}
            onChange={() =>
              setPicked((prev) => {
                const next = new Set(prev);
                if (next.has(r.id)) next.delete(r.id);
                else next.add(r.id);
                return next;
              })
            }
          />
          {r.name ?? r.hostPattern}
        </label>
      ))}
      <button type="button" onClick={props.onCancel}>Cancel</button>
      <button
        type="button"
        onClick={() => {
          const ruleIds = Array.from(picked);
          const templateNames = Array.from(
            new Set(
              props.rules
                .filter((r) => ruleIds.includes(r.id))
                .map((r) => r.templateName),
            ),
          );
          props.onNext(ruleIds, templateNames);
        }}
      >
        Next: Scrub
      </button>
    </div>
  );
}
```

`src/options/export/ExportScrub.tsx`:
```tsx
import type { JSX } from 'preact';
import type { Rule } from '../../shared/types';

export interface ExportScrubProps {
  rules: Rule[];
  templateNames: string[];
  sampleJson: Record<string, string>;
  stripSampleJson: Set<string>;
  stripVariables: Set<string>;
  onToggleStripSampleJson: (name: string) => void;
  onToggleStripVariables: (ruleId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ExportScrub(props: ExportScrubProps): JSX.Element {
  return (
    <div>
      <h2>Scrub before share</h2>
      <button type="button" onClick={props.onBack}>Back</button>
      <button type="button" onClick={props.onNext}>Next: Output</button>
    </div>
  );
}
```

`src/options/export/ExportOutput.tsx`:
```tsx
import type { JSX } from 'preact';
import type { FreshetBundle } from '../../bundle/schema';

export interface ExportOutputProps {
  bundle: FreshetBundle;
  onDone: () => void;
}

export function ExportOutput(props: ExportOutputProps): JSX.Element {
  return (
    <div>
      <h2>Export ready</h2>
      <button type="button" onClick={props.onDone}>Done</button>
    </div>
  );
}
```

- [ ] **Step 11.5: Run test — expect pass**

```bash
pnpm test -- ExportDialog.test
```

- [ ] **Step 11.6: Wire into `App.tsx`**

Replace the placeholder marker:

```tsx
{exportOpen ? (
  <ExportDialog
    rules={rules}
    templates={templates}
    sampleJson={sampleJson}
    appVersion={APP_VERSION /* from vite define or package.json import */}
    onClose={() => setExportOpen(false)}
  />
) : null}
```

For `APP_VERSION`, import via:
```tsx
import pkg from '../../package.json';
const APP_VERSION = pkg.version;
```

Ensure `App.tsx` already has `sampleJson` state; if not, add a `useStorage('pj_sample_json', {})` hook call mirroring the existing storage hooks.

- [ ] **Step 11.7: Commit**

```bash
git add src/options/export/ src/options/App.tsx
git commit -m "feat(options): ExportDialog shell with step state machine"
```

---

## Task 12: Flesh out `ExportPicker` — filter, auto-pull of referenced templates

**Files:**
- Modify: `src/options/export/ExportPicker.tsx`
- Create: `src/options/export/ExportPicker.test.tsx`

- [ ] **Step 12.1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportPicker } from './ExportPicker';

const rules = [
  { id: 'r1', name: '[qa] one', hostPattern: 'a', pathPattern: 'x', templateName: 't1', variables: {}, active: true },
  { id: 'r2', name: '[prod] two', hostPattern: 'b', pathPattern: 'y', templateName: 't1', variables: {}, active: true },
  { id: 'r3', name: 'three', hostPattern: 'c', pathPattern: 'z', templateName: 't2', variables: {}, active: true },
];

describe('ExportPicker', () => {
  it('auto-pulls the template referenced by a selected rule', () => {
    const onNext = vi.fn();
    render(
      <ExportPicker rules={rules} templates={['t1', 't2']} onCancel={() => {}} onNext={onNext} />,
    );
    fireEvent.click(screen.getByLabelText(/\[qa\] one/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onNext).toHaveBeenCalledWith(['r1'], ['t1']);
  });

  it('filters rule list by substring match', () => {
    render(
      <ExportPicker rules={rules} templates={['t1', 't2']} onCancel={() => {}} onNext={() => {}} />,
    );
    fireEvent.input(screen.getByPlaceholderText(/filter/i), { target: { value: '[qa]' } });
    expect(screen.queryByLabelText(/\[prod\] two/)).toBeNull();
    expect(screen.getByLabelText(/\[qa\] one/)).toBeTruthy();
  });
});
```

- [ ] **Step 12.2: Run test — expect failures**

```bash
pnpm test -- ExportPicker.test
```

- [ ] **Step 12.3: Implement filter + auto-pull UI**

Replace `src/options/export/ExportPicker.tsx`:

```tsx
import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { Rule } from '../../shared/types';

export interface ExportPickerProps {
  rules: Rule[];
  templates: string[];
  onCancel: () => void;
  onNext: (ruleIds: string[], templateNames: string[]) => void;
}

function ruleMatches(r: Rule, q: string): boolean {
  if (!q) return true;
  const hay = `${r.name ?? ''} ${r.hostPattern} ${r.pathPattern} ${r.templateName}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function ExportPicker(props: ExportPickerProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [pickedRules, setPickedRules] = useState<Set<string>>(new Set());
  const [pickedTemplates, setPickedTemplates] = useState<Set<string>>(new Set());

  const visibleRules = useMemo(
    () => props.rules.filter((r) => ruleMatches(r, query)),
    [props.rules, query],
  );

  // Auto-pulled templates: referenced by any checked rule.
  const autoPulledTemplates = useMemo(
    () =>
      new Set(
        props.rules
          .filter((r) => pickedRules.has(r.id))
          .map((r) => r.templateName),
      ),
    [props.rules, pickedRules],
  );

  function toggleRule(id: string): void {
    setPickedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTemplate(name: string): void {
    if (autoPulledTemplates.has(name)) return; // locked while auto-pulled
    setPickedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleNext(): void {
    const finalTemplates = new Set<string>([
      ...pickedTemplates,
      ...autoPulledTemplates,
    ]);
    props.onNext(Array.from(pickedRules), Array.from(finalTemplates));
  }

  return (
    <div class="pj-export-picker">
      <h2>Pick what to export</h2>
      <p>Rules that reference a template will pull that template in automatically.</p>
      <input
        type="search"
        placeholder="filter (e.g. [qa])"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <section aria-label="Rules">
        <h3>Rules ({visibleRules.length})</h3>
        {visibleRules.map((r) => (
          <label key={r.id}>
            <input
              type="checkbox"
              checked={pickedRules.has(r.id)}
              onChange={() => toggleRule(r.id)}
            />
            {r.name ?? r.hostPattern}
          </label>
        ))}
      </section>

      <section aria-label="Templates">
        <h3>Templates ({props.templates.length})</h3>
        {props.templates.map((n) => {
          const auto = autoPulledTemplates.has(n);
          return (
            <label key={n}>
              <input
                type="checkbox"
                checked={auto || pickedTemplates.has(n)}
                onChange={() => toggleTemplate(n)}
                disabled={auto}
              />
              {n} {auto ? <em>(auto-pulled)</em> : null}
            </label>
          );
        })}
      </section>

      <footer class="pj-dialog-footer">
        <button type="button" onClick={props.onCancel}>Cancel</button>
        <button type="button" onClick={handleNext}>Next: Scrub</button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 12.4: Run tests — expect pass**

```bash
pnpm test -- ExportPicker.test
```

- [ ] **Step 12.5: Commit**

```bash
git add src/options/export/ExportPicker.tsx src/options/export/ExportPicker.test.tsx
git commit -m "feat(export): picker filter + auto-pull referenced templates"
```

---

## Task 13: Flesh out `ExportScrub` — per-row include/strip + sniff flags

**Files:**
- Modify: `src/options/export/ExportScrub.tsx`
- Create: `src/options/export/ExportScrub.test.tsx`

- [ ] **Step 13.1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportScrub } from './ExportScrub';

describe('ExportScrub', () => {
  it('shows sniff flag inline under the rule variables row', () => {
    const rules = [
      {
        id: 'r1',
        hostPattern: 'a',
        pathPattern: 'b',
        templateName: 't',
        variables: { auth_token: 'abc' },
        active: true,
      },
    ];
    render(
      <ExportScrub
        rules={rules}
        templateNames={['t']}
        sampleJson={{ t: '{}' }}
        stripSampleJson={new Set()}
        stripVariables={new Set()}
        onToggleStripSampleJson={() => {}}
        onToggleStripVariables={() => {}}
        onBack={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByText(/Matched/i)).toBeTruthy();
    expect(screen.getByText(/auth_token/)).toBeTruthy();
  });

  it('fires onToggleStripVariables when the strip toggle is clicked', () => {
    const onToggle = vi.fn();
    const rules = [
      { id: 'r1', hostPattern: 'a', pathPattern: 'b', templateName: 't', variables: { env: 'qa' }, active: true },
    ];
    render(
      <ExportScrub
        rules={rules}
        templateNames={['t']}
        sampleJson={{}}
        stripSampleJson={new Set()}
        stripVariables={new Set()}
        onToggleStripSampleJson={() => {}}
        onToggleStripVariables={onToggle}
        onBack={() => {}}
        onNext={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText(/strip variables for r1/i));
    expect(onToggle).toHaveBeenCalledWith('r1');
  });
});
```

- [ ] **Step 13.2: Run tests — expect failures**

```bash
pnpm test -- ExportScrub.test
```

- [ ] **Step 13.3: Implement**

Replace `src/options/export/ExportScrub.tsx`:

```tsx
import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { Rule } from '../../shared/types';
import { sniff, type SniffHit } from '../../bundle/sniff';
import type { FreshetBundle } from '../../bundle/schema';

export interface ExportScrubProps {
  rules: Rule[];
  templateNames: string[];
  sampleJson: Record<string, string>;
  stripSampleJson: Set<string>;
  stripVariables: Set<string>;
  onToggleStripSampleJson: (name: string) => void;
  onToggleStripVariables: (ruleId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function buildPreviewBundle(props: ExportScrubProps): FreshetBundle {
  return {
    bundleSchemaVersion: 1,
    exportedAt: '',
    appVersion: '',
    templates: props.templateNames.map((n) => ({
      name: n,
      source: '',
      ...(props.stripSampleJson.has(n) || props.sampleJson[n] === undefined
        ? {}
        : { sampleJson: props.sampleJson[n]! }),
    })),
    rules: props.rules.map((r) => ({
      id: r.id,
      hostPattern: r.hostPattern,
      pathPattern: r.pathPattern,
      templateName: r.templateName,
      active: r.active,
      ...(r.name ? { name: r.name } : {}),
      ...(props.stripVariables.has(r.id) ? {} : { variables: r.variables }),
    })),
  };
}

function hitsForRule(hits: SniffHit[], ruleIdx: number): SniffHit[] {
  return hits.filter((h) => h.field.startsWith(`rules[${ruleIdx}].`));
}

function hitsForTemplate(hits: SniffHit[], tmplIdx: number): SniffHit[] {
  return hits.filter((h) => h.field.startsWith(`templates[${tmplIdx}].`));
}

export function ExportScrub(props: ExportScrubProps): JSX.Element {
  const hits = useMemo(() => sniff(buildPreviewBundle(props)), [props]);

  return (
    <div class="pj-export-scrub">
      <h2>Scrub before share</h2>
      <p class="pj-warn">⚠ Once shared, assume this can't be un-shared.</p>

      <section aria-label="Rules">
        <h3>Rules</h3>
        {props.rules.map((r, i) => {
          const rh = hitsForRule(hits, i);
          return (
            <div key={r.id} class="pj-scrub-row">
              <div>
                <strong>{r.name ?? r.hostPattern}</strong>
                {Object.keys(r.variables).length > 0 ? (
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Strip variables for ${r.id}`}
                      checked={props.stripVariables.has(r.id)}
                      onChange={() => props.onToggleStripVariables(r.id)}
                    />
                    Strip variables
                  </label>
                ) : null}
              </div>
              {rh.map((h) => (
                <div class="pj-sniff-flag" key={h.field + h.patternId}>
                  🚩 Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>.
                  Matched text: <code>{h.matchedText}</code>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <section aria-label="Templates">
        <h3>Templates</h3>
        {props.templateNames.map((n, i) => {
          const th = hitsForTemplate(hits, i);
          const hasSample = props.sampleJson[n] !== undefined;
          return (
            <div key={n} class="pj-scrub-row">
              <div>
                <strong>{n}</strong>
                {hasSample ? (
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Strip sample JSON for ${n}`}
                      checked={props.stripSampleJson.has(n)}
                      onChange={() => props.onToggleStripSampleJson(n)}
                    />
                    Strip sample JSON
                  </label>
                ) : null}
              </div>
              {th.map((h) => (
                <div class="pj-sniff-flag" key={h.field + h.patternId}>
                  🚩 Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>.
                  Matched text: <code>{h.matchedText}</code>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <footer class="pj-dialog-footer">
        <button type="button" onClick={props.onBack}>Back</button>
        <button type="button" onClick={props.onNext}>Next: Output</button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 13.4: Run tests — expect pass**

```bash
pnpm test -- ExportScrub.test
```

- [ ] **Step 13.5: Commit**

```bash
git add src/options/export/ExportScrub.tsx src/options/export/ExportScrub.test.tsx
git commit -m "feat(export): scrub with per-row toggles + literal sniff flags"
```

---

## Task 14: Flesh out `ExportOutput` — download + clipboard

**Files:**
- Modify: `src/options/export/ExportOutput.tsx`
- Create: `src/options/export/ExportOutput.test.tsx`

- [ ] **Step 14.1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportOutput } from './ExportOutput';

const bundle = {
  bundleSchemaVersion: 1 as const,
  exportedAt: '2026-04-19T00:00:00Z',
  appVersion: '1.0.0',
  templates: [],
  rules: [],
};

describe('ExportOutput', () => {
  it('builds a downloadable blob with the bundle JSON', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
    render(<ExportOutput bundle={bundle} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(createSpy).toHaveBeenCalled();
  });

  it('copies the JSON to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ExportOutput bundle={bundle} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalled();
    const arg = writeText.mock.calls[0][0];
    expect(JSON.parse(arg).bundleSchemaVersion).toBe(1);
  });
});
```

- [ ] **Step 14.2: Run tests — expect failures**

```bash
pnpm test -- ExportOutput.test
```

- [ ] **Step 14.3: Implement**

Replace `src/options/export/ExportOutput.tsx`:

```tsx
import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { FreshetBundle } from '../../bundle/schema';

export interface ExportOutputProps {
  bundle: FreshetBundle;
  onDone: () => void;
}

function filename(): string {
  const d = new Date().toISOString().slice(0, 10);
  return `freshet-export-${d}.freshet.json`;
}

export function ExportOutput(props: ExportOutputProps): JSX.Element {
  const json = useMemo(() => JSON.stringify(props.bundle, null, 2), [props.bundle]);

  function handleDownload(): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(json);
  }

  return (
    <div class="pj-export-output">
      <h2>Export ready</h2>
      <p>
        {props.bundle.rules.length} rule(s), {props.bundle.templates.length} template(s).
      </p>
      <div class="pj-dialog-footer">
        <button type="button" onClick={handleDownload}>Download</button>
        <button type="button" onClick={handleCopy}>Copy JSON to clipboard</button>
        <button type="button" onClick={props.onDone}>Done</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.4: Run tests — expect pass**

```bash
pnpm test -- ExportOutput.test
```

- [ ] **Step 14.5: Commit**

```bash
git add src/options/export/ExportOutput.tsx src/options/export/ExportOutput.test.tsx
git commit -m "feat(export): output step with download + clipboard"
```

---

## Task 15: `ImportDialog` shell + step state machine

**Files:**
- Create: `src/options/import/ImportDialog.tsx`
- Create: `src/options/import/ImportDialog.test.tsx`
- Modify: `src/options/App.tsx` (swap import placeholder for real dialog)

- [ ] **Step 15.1: Implement the shell with four steps: `input`, `mode`, `review`, `append`**

```tsx
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { FreshetBundle } from '../../bundle/schema';
import { ImportInput } from './ImportInput';
import { ImportReview } from './ImportReview';
import { ImportAppendModal } from './ImportAppendModal';
import { sniff, type SniffHit } from '../../bundle/sniff';

export interface ImportDialogProps {
  onCommit: (plan: ImportPlan) => Promise<void>;
  onClose: () => void;
}

export interface ImportPlan {
  bundle: FreshetBundle;
  mode: 'review' | 'append';
  skipRuleIds: Set<string>;
  skipTemplateNames: Set<string>;
  templateCollisionResolution: Map<string, 'rename' | 'replace' | 'skip'>;
  ruleCollisionResolution: Map<string, 'replace' | 'skip' | 'keepBoth'>;
  templateRenameMap: Map<string, string>;
}

type Step = 'input' | 'mode' | 'review' | 'append';

export function ImportDialog(props: ImportDialogProps): JSX.Element {
  const [step, setStep] = useState<Step>('input');
  const [bundle, setBundle] = useState<FreshetBundle | null>(null);
  const [hits, setHits] = useState<SniffHit[]>([]);

  function handleParsed(b: FreshetBundle): void {
    setBundle(b);
    setHits(sniff(b));
    setStep('mode');
  }

  return (
    <div class="pj-modal-backdrop" role="dialog" aria-modal="true">
      <div class="pj-modal">
        {step === 'input' ? (
          <ImportInput onCancel={props.onClose} onParsed={handleParsed} />
        ) : null}
        {step === 'mode' && bundle ? (
          <div>
            <h2>Ready to review</h2>
            <p>
              Bundle from: <strong>{bundle.exportedBy ?? '(unlabeled)'}</strong>, exported{' '}
              {bundle.exportedAt}
            </p>
            <p>
              Contains {bundle.rules.length} rule(s) + {bundle.templates.length} template(s).
            </p>
            {hits.length > 0 ? (
              <section aria-label="Flags">
                <strong>🚩 Secret-sniff flags ({hits.length}):</strong>
                <ul>
                  {hits.map((h) => (
                    <li key={h.field + h.patternId}>
                      Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div class="pj-dialog-footer">
              <button type="button" onClick={() => setStep('review')}>Review & pick</button>
              <button type="button" onClick={() => setStep('append')}>Just append all</button>
            </div>
          </div>
        ) : null}
        {step === 'review' && bundle ? (
          <ImportReview
            bundle={bundle}
            hits={hits}
            onBack={() => setStep('mode')}
            onCommit={(plan) => props.onCommit({ ...plan, mode: 'review' })}
          />
        ) : null}
        {step === 'append' && bundle ? (
          <ImportAppendModal
            bundle={bundle}
            hits={hits}
            onBack={() => setStep('mode')}
            onCommit={() =>
              props.onCommit({
                bundle,
                mode: 'append',
                skipRuleIds: new Set(),
                skipTemplateNames: new Set(),
                templateCollisionResolution: new Map(),
                ruleCollisionResolution: new Map(),
                templateRenameMap: new Map(),
              })
            }
          />
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 15.2: Create minimal stubs for `ImportInput`, `ImportReview`, `ImportAppendModal`**

`src/options/import/ImportInput.tsx`:
```tsx
import type { JSX } from 'preact';
import type { FreshetBundle } from '../../bundle/schema';

export interface ImportInputProps {
  onCancel: () => void;
  onParsed: (bundle: FreshetBundle) => void;
}

export function ImportInput(props: ImportInputProps): JSX.Element {
  return (
    <div>
      <h2>Import a bundle</h2>
      <button type="button" onClick={props.onCancel}>Cancel</button>
    </div>
  );
}
```

`src/options/import/ImportReview.tsx`:
```tsx
import type { JSX } from 'preact';
import type { FreshetBundle } from '../../bundle/schema';
import type { SniffHit } from '../../bundle/sniff';
import type { ImportPlan } from './ImportDialog';

export interface ImportReviewProps {
  bundle: FreshetBundle;
  hits: SniffHit[];
  onBack: () => void;
  onCommit: (plan: Omit<ImportPlan, 'mode'>) => void;
}

export function ImportReview(props: ImportReviewProps): JSX.Element {
  return (
    <div>
      <h2>Review import</h2>
      <button type="button" onClick={props.onBack}>Back</button>
    </div>
  );
}
```

`src/options/import/ImportAppendModal.tsx`:
```tsx
import type { JSX } from 'preact';
import type { FreshetBundle } from '../../bundle/schema';
import type { SniffHit } from '../../bundle/sniff';

export interface ImportAppendModalProps {
  bundle: FreshetBundle;
  hits: SniffHit[];
  onBack: () => void;
  onCommit: () => void;
}

export function ImportAppendModal(props: ImportAppendModalProps): JSX.Element {
  return (
    <div>
      <h2>Just append: confirm</h2>
      <button type="button" onClick={props.onBack}>Back</button>
      <button type="button" onClick={props.onCommit}>Append all</button>
    </div>
  );
}
```

- [ ] **Step 15.3: Write a basic ImportDialog test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { ImportDialog } from './ImportDialog';

describe('ImportDialog', () => {
  it('opens on input step', () => {
    render(<ImportDialog onCommit={async () => {}} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: /import a bundle/i })).toBeTruthy();
  });
});
```

- [ ] **Step 15.4: Run tests — expect pass**

```bash
pnpm test -- ImportDialog.test
```

- [ ] **Step 15.5: Wire into `App.tsx`**

In `src/options/App.tsx`, replace the import placeholder:

```tsx
{importOpen ? (
  <ImportDialog
    onCommit={async (plan) => {
      await commitImport(plan, {
        rules, templates, sampleJson, setRules, setTemplates, setSampleJson, setImportFlags,
      });
      setImportOpen(false);
    }}
    onClose={() => setImportOpen(false)}
  />
) : null}
```

`commitImport` will be added in Task 18. For now, import it from a stub:

`src/options/import/commit.ts`:
```ts
import type { ImportPlan } from './ImportDialog';

export async function commitImport(plan: ImportPlan, ctx: unknown): Promise<void> {
  // implemented in Task 18
  void plan; void ctx;
}
```

- [ ] **Step 15.6: Commit**

```bash
git add src/options/import/ src/options/App.tsx
git commit -m "feat(options): ImportDialog shell + step state machine"
```

---

## Task 16: `ImportInput` — file picker + drag-drop + paste textarea

**Files:**
- Modify: `src/options/import/ImportInput.tsx`
- Create: `src/options/import/ImportInput.test.tsx`

- [ ] **Step 16.1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ImportInput } from './ImportInput';

const validJSON = JSON.stringify({
  bundleSchemaVersion: 1,
  exportedAt: '2026-04-19',
  appVersion: '1.0.0',
  templates: [{ name: 't', source: 'x' }],
  rules: [],
});

describe('ImportInput', () => {
  it('parses the pasted JSON and fires onParsed', () => {
    const onParsed = vi.fn();
    render(<ImportInput onCancel={() => {}} onParsed={onParsed} />);
    const ta = screen.getByPlaceholderText(/paste/i) as HTMLTextAreaElement;
    fireEvent.input(ta, { target: { value: validJSON } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onParsed).toHaveBeenCalled();
  });

  it('renders parse errors inline without calling onParsed', () => {
    const onParsed = vi.fn();
    render(<ImportInput onCancel={() => {}} onParsed={onParsed} />);
    const ta = screen.getByPlaceholderText(/paste/i) as HTMLTextAreaElement;
    fireEvent.input(ta, { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onParsed).not.toHaveBeenCalled();
    expect(screen.getByText(/JSON/i)).toBeTruthy();
  });

  it('shows the three-methods blurb', () => {
    render(<ImportInput onCancel={() => {}} onParsed={() => {}} />);
    expect(screen.getByText(/drag a \.freshet\.json/i)).toBeTruthy();
    expect(screen.getByText(/choose file/i)).toBeTruthy();
    expect(screen.getByText(/paste bundle json/i)).toBeTruthy();
  });
});
```

- [ ] **Step 16.2: Run tests — expect failures**

```bash
pnpm test -- ImportInput.test
```

- [ ] **Step 16.3: Implement**

Replace `src/options/import/ImportInput.tsx`:

```tsx
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { parseBundle } from '../../bundle/parse';
import type { FreshetBundle } from '../../bundle/schema';

export interface ImportInputProps {
  onCancel: () => void;
  onParsed: (bundle: FreshetBundle) => void;
}

async function readFile(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(f);
  });
}

export function ImportInput(props: ImportInputProps): JSX.Element {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(f: File): Promise<void> {
    const t = await readFile(f);
    setText(t);
  }

  function handleNext(): void {
    const r = parseBundle(text);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    props.onParsed(r.bundle);
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) void handleFile(f);
  }

  return (
    <div class="pj-import-input">
      <h2>Import a bundle</h2>
      <p>You can import a Freshet bundle three ways:</p>
      <ul>
        <li>Drag a <code>.freshet.json</code> file onto this window</li>
        <li>Click "Choose file…" to pick one from disk</li>
        <li>Paste bundle JSON directly into the box below</li>
      </ul>
      <div
        class="pj-drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <button type="button" onClick={() => fileInput.current?.click()}>
          Choose file…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.freshet.json,application/json"
          hidden
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
      <textarea
        placeholder="Paste bundle JSON here"
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        rows={8}
      />
      {errors.length > 0 ? (
        <div class="pj-errors" role="alert">
          {errors.map((err) => (
            <div key={err}>{err}</div>
          ))}
        </div>
      ) : null}
      <div class="pj-dialog-footer">
        <button type="button" onClick={props.onCancel}>Cancel</button>
        <button type="button" onClick={handleNext}>Next: Review</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 16.4: Run tests — expect pass**

```bash
pnpm test -- ImportInput.test
```

- [ ] **Step 16.5: Commit**

```bash
git add src/options/import/ImportInput.tsx src/options/import/ImportInput.test.tsx
git commit -m "feat(import): three-way input (file/drop/paste) with visible blurb"
```

---

## Task 17: `ImportReview` — collision resolution + cascading rename

**Files:**
- Modify: `src/options/import/ImportReview.tsx`
- Create: `src/options/import/ImportReview.test.tsx`

- [ ] **Step 17.1: Implement with full behavior**

Replace `src/options/import/ImportReview.tsx`:

```tsx
import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { FreshetBundle } from '../../bundle/schema';
import type { SniffHit } from '../../bundle/sniff';
import { detectCollisions } from '../../bundle/collide';
import type { Rule, Templates } from '../../shared/types';
import type { ImportPlan } from './ImportDialog';

export interface ImportReviewProps {
  bundle: FreshetBundle;
  hits: SniffHit[];
  existingRules: Rule[];
  existingTemplates: Templates;
  onBack: () => void;
  onCommit: (plan: Omit<ImportPlan, 'mode'>) => void;
}

export function ImportReview(props: ImportReviewProps): JSX.Element {
  const report = useMemo(
    () => detectCollisions(props.bundle, props.existingRules, props.existingTemplates),
    [props.bundle, props.existingRules, props.existingTemplates],
  );

  const [query, setQuery] = useState('');
  const [skipRules, setSkipRules] = useState<Set<string>>(new Set());
  const [skipTemplates, setSkipTemplates] = useState<Set<string>>(new Set());
  const [templateResolution, setTemplateResolution] = useState<
    Map<string, 'rename' | 'replace' | 'skip'>
  >(new Map(report.templateCollisions.map((c) => [c.name, 'rename'])));
  const [ruleResolution, setRuleResolution] = useState<Map<string, 'replace' | 'skip' | 'keepBoth'>>(
    new Map(report.ruleIdCollisions.map((c) => [c.id, 'replace'])),
  );
  const [replaceConfirmed, setReplaceConfirmed] = useState<Set<string>>(new Set());

  const renameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of report.templateCollisions) {
      if (templateResolution.get(c.name) === 'rename') {
        m.set(c.name, c.proposedRename);
      }
    }
    return m;
  }, [report.templateCollisions, templateResolution]);

  function toggleSkipRule(id: string): void {
    setSkipRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSkipTemplate(name: string): void {
    setSkipTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function handleCommit(): void {
    props.onCommit({
      bundle: props.bundle,
      skipRuleIds: skipRules,
      skipTemplateNames: skipTemplates,
      templateCollisionResolution: templateResolution,
      ruleCollisionResolution: ruleResolution,
      templateRenameMap: renameMap,
    });
  }

  const visibleRules = props.bundle.rules.filter((r) => {
    if (!query) return true;
    const hay = `${r.name ?? ''} ${r.hostPattern} ${r.pathPattern}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div class="pj-import-review">
      <h2>Review import</h2>
      <input
        type="search"
        placeholder="filter"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <section aria-label="Rules">
        <h3>Rules ({visibleRules.length})</h3>
        {visibleRules.map((r) => {
          const isIdCol = report.ruleIdCollisions.some((c) => c.id === r.id);
          const resolution = ruleResolution.get(r.id);
          const needsReplaceConfirm = resolution === 'replace';
          return (
            <div key={r.id} class="pj-review-row">
              <label>
                <input
                  type="checkbox"
                  checked={!skipRules.has(r.id)}
                  onChange={() => toggleSkipRule(r.id)}
                />
                {r.name ?? r.hostPattern}
              </label>
              {renameMap.has(r.templateName) ? (
                <div class="pj-rename-cascade">
                  → template: {r.templateName} → {renameMap.get(r.templateName)}
                </div>
              ) : null}
              {isIdCol ? (
                <div class="pj-collision">
                  <strong>⚠ Round-trip collision (same id).</strong>
                  <label>
                    <input
                      type="radio"
                      name={`rule-res-${r.id}`}
                      checked={resolution === 'replace'}
                      onChange={() =>
                        setRuleResolution((prev) => new Map(prev).set(r.id, 'replace'))
                      }
                    />
                    Replace existing
                  </label>
                  {needsReplaceConfirm ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={replaceConfirmed.has(r.id)}
                        onChange={() =>
                          setReplaceConfirmed((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                            return next;
                          })
                        }
                      />
                      Confirm replace
                    </label>
                  ) : null}
                  <label>
                    <input
                      type="radio"
                      name={`rule-res-${r.id}`}
                      checked={resolution === 'skip'}
                      onChange={() =>
                        setRuleResolution((prev) => new Map(prev).set(r.id, 'skip'))
                      }
                    />
                    Skip
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`rule-res-${r.id}`}
                      checked={resolution === 'keepBoth'}
                      onChange={() =>
                        setRuleResolution((prev) => new Map(prev).set(r.id, 'keepBoth'))
                      }
                    />
                    Keep both
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section aria-label="Templates">
        <h3>Templates ({props.bundle.templates.length})</h3>
        {props.bundle.templates.map((t) => {
          const col = report.templateCollisions.find((c) => c.name === t.name);
          const res = templateResolution.get(t.name);
          return (
            <div key={t.name} class="pj-review-row">
              <label>
                <input
                  type="checkbox"
                  checked={!skipTemplates.has(t.name)}
                  onChange={() => toggleSkipTemplate(t.name)}
                />
                {t.name}
              </label>
              {col ? (
                <div class="pj-collision">
                  <strong>⚠ Name already exists.</strong>
                  <label>
                    <input
                      type="radio"
                      name={`tmpl-res-${t.name}`}
                      checked={res === 'rename'}
                      onChange={() =>
                        setTemplateResolution((prev) => new Map(prev).set(t.name, 'rename'))
                      }
                    />
                    Rename to {col.proposedRename}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`tmpl-res-${t.name}`}
                      checked={res === 'replace'}
                      onChange={() =>
                        setTemplateResolution((prev) => new Map(prev).set(t.name, 'replace'))
                      }
                    />
                    Replace existing
                  </label>
                  {res === 'replace' ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={replaceConfirmed.has(`t:${t.name}`)}
                        onChange={() =>
                          setReplaceConfirmed((prev) => {
                            const next = new Set(prev);
                            if (next.has(`t:${t.name}`)) next.delete(`t:${t.name}`);
                            else next.add(`t:${t.name}`);
                            return next;
                          })
                        }
                      />
                      Confirm replace
                    </label>
                  ) : null}
                  <label>
                    <input
                      type="radio"
                      name={`tmpl-res-${t.name}`}
                      checked={res === 'skip'}
                      onChange={() =>
                        setTemplateResolution((prev) => new Map(prev).set(t.name, 'skip'))
                      }
                    />
                    Skip
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <p class="pj-note">Imported rules start <strong>INACTIVE</strong> — toggle on per rule after import.</p>

      <div class="pj-dialog-footer">
        <button type="button" onClick={props.onBack}>Back</button>
        <button type="button" onClick={handleCommit}>Import</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 17.2: Update `ImportDialog` to pass `existingRules` + `existingTemplates` through**

Edit `ImportDialog.tsx` — add the two props and forward to `ImportReview`:

```tsx
// Add to ImportDialogProps:
existingRules: Rule[];
existingTemplates: Templates;

// Pass to ImportReview:
<ImportReview
  bundle={bundle}
  hits={hits}
  existingRules={props.existingRules}
  existingTemplates={props.existingTemplates}
  onBack={() => setStep('mode')}
  onCommit={(plan) => props.onCommit({ ...plan, mode: 'review' })}
/>
```

Wire the two new props through from `App.tsx`:
```tsx
<ImportDialog
  existingRules={rules}
  existingTemplates={templates}
  onCommit={...}
  onClose={...}
/>
```

- [ ] **Step 17.3: Write a basic test**

`src/options/import/ImportReview.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { ImportReview } from './ImportReview';
import type { FreshetBundle } from '../../bundle/schema';

const bundle: FreshetBundle = {
  bundleSchemaVersion: 1,
  exportedAt: 'x',
  appVersion: '1',
  templates: [{ name: 'foo', source: 'x' }],
  rules: [],
};

describe('ImportReview', () => {
  it('surfaces a template collision row when the name already exists', () => {
    render(
      <ImportReview
        bundle={bundle}
        hits={[]}
        existingRules={[]}
        existingTemplates={{ foo: 'x' }}
        onBack={() => {}}
        onCommit={() => {}}
      />,
    );
    expect(screen.getByText(/Rename to foo-2/)).toBeTruthy();
  });
});
```

- [ ] **Step 17.4: Run tests — expect pass**

```bash
pnpm test -- ImportReview.test
```

- [ ] **Step 17.5: Commit**

```bash
git add src/options/import/ImportReview.tsx src/options/import/ImportReview.test.tsx src/options/import/ImportDialog.tsx src/options/App.tsx
git commit -m "feat(import): review with collision resolution + cascading rename"
```

---

## Task 18: `ImportAppendModal` + commit function

**Files:**
- Modify: `src/options/import/ImportAppendModal.tsx`
- Modify: `src/options/import/commit.ts`
- Create: `src/options/import/commit.test.ts`

- [ ] **Step 18.1: Flesh out `ImportAppendModal`**

```tsx
import type { JSX } from 'preact';
import type { FreshetBundle } from '../../bundle/schema';
import type { SniffHit } from '../../bundle/sniff';

export interface ImportAppendModalProps {
  bundle: FreshetBundle;
  hits: SniffHit[];
  onBack: () => void;
  onCommit: () => void;
}

export function ImportAppendModal(props: ImportAppendModalProps): JSX.Element {
  return (
    <div>
      <h2>Just append: confirm</h2>
      <p>
        This will add {props.bundle.rules.length} rule(s) +{' '}
        {props.bundle.templates.length} template(s) without a review.
      </p>
      <ul>
        <li>Collisions auto-renamed (no replacements)</li>
        <li>Rules added INACTIVE</li>
        <li>Flagged items get a persistent "⚠ needs attention" badge until dismissed</li>
      </ul>
      {props.hits.length > 0 ? (
        <section aria-label="Flags">
          <strong>🚩 Flags that will carry over as badges:</strong>
          <ul>
            {props.hits.map((h) => (
              <li key={h.field + h.patternId}>
                Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>. Matched text:{' '}
                <code>{h.matchedText}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div class="pj-dialog-footer">
        <button type="button" onClick={props.onBack}>Back</button>
        <button type="button" onClick={props.onCommit}>Append all</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 18.2: Write tests for `commitImport`**

`src/options/import/commit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { applyImport } from './commit';
import type { FreshetBundle } from '../../bundle/schema';
import type { Rule, Templates } from '../../shared/types';

const bundle: FreshetBundle = {
  bundleSchemaVersion: 1,
  exportedAt: 'x',
  appVersion: '1',
  templates: [{ name: 'foo', source: '<div>new</div>', sampleJson: '{"a":1}' }],
  rules: [
    { id: 'rA', name: 'imp', hostPattern: 'a', pathPattern: 'b', templateName: 'foo', active: true },
  ],
};

describe('applyImport — append mode', () => {
  it('appends rule to end, inactive, and includes template with auto-rename on collision', () => {
    const existingRules: Rule[] = [
      { id: 'rExist', hostPattern: 'c', pathPattern: 'd', templateName: 'foo', variables: {}, active: true },
    ];
    const existingTemplates: Templates = { foo: '<div>old</div>' };
    const existingSample = { foo: '{"old":true}' };

    const result = applyImport({
      plan: {
        bundle,
        mode: 'append',
        skipRuleIds: new Set(),
        skipTemplateNames: new Set(),
        templateCollisionResolution: new Map(),
        ruleCollisionResolution: new Map(),
        templateRenameMap: new Map(),
      },
      existingRules,
      existingTemplates,
      existingSample,
      now: '2026-04-19T00:00:00Z',
    });

    expect(Object.keys(result.templates)).toEqual(['foo', 'foo-2']);
    expect(result.templates['foo']).toBe('<div>old</div>');
    expect(result.templates['foo-2']).toBe('<div>new</div>');
    expect(result.sample['foo-2']).toBe('{"a":1}');
    expect(result.rules).toHaveLength(2);
    expect(result.rules[1]?.active).toBe(false);
    expect(result.rules[1]?.templateName).toBe('foo-2');
  });
});
```

- [ ] **Step 18.3: Implement `commit.ts`**

```ts
import type { FreshetBundle } from '../../bundle/schema';
import type { Rule, Templates } from '../../shared/types';
import type { ImportPlan } from './ImportDialog';
import { nextAvailableName } from '../../bundle/collide';
import type { ImportFlagMap, ImportFlagEntry } from '../../storage/storage';
import { sniff } from '../../bundle/sniff';

export interface ApplyImportInput {
  plan: ImportPlan;
  existingRules: Rule[];
  existingTemplates: Templates;
  existingSample: Record<string, string>;
  now: string;
}

export interface ApplyImportResult {
  rules: Rule[];
  templates: Templates;
  sample: Record<string, string>;
  flagsDelta: ImportFlagMap;
}

export function applyImport(input: ApplyImportInput): ApplyImportResult {
  const existingTmplNames = new Set(Object.keys(input.existingTemplates));
  const rename = new Map<string, string>(input.plan.templateRenameMap);

  // Append mode auto-renames on any collision.
  if (input.plan.mode === 'append') {
    for (const t of input.plan.bundle.templates) {
      if (existingTmplNames.has(t.name)) {
        rename.set(
          t.name,
          nextAvailableName(t.name, new Set([...existingTmplNames, ...rename.values()])),
        );
      }
    }
  }

  // Build new template map.
  const mergedTemplates: Templates = { ...input.existingTemplates };
  const mergedSample: Record<string, string> = { ...input.existingSample };
  for (const t of input.plan.bundle.templates) {
    if (input.plan.skipTemplateNames.has(t.name)) continue;
    const res = input.plan.templateCollisionResolution.get(t.name);
    if (res === 'skip') continue;
    const targetName = rename.get(t.name) ?? t.name;
    mergedTemplates[targetName] = t.source;
    if (t.sampleJson !== undefined) {
      mergedSample[targetName] = t.sampleJson;
    }
  }

  // Build new rules list.
  const mergedRules: Rule[] = [...input.existingRules];
  for (const br of input.plan.bundle.rules) {
    if (input.plan.skipRuleIds.has(br.id)) continue;
    const ruleRes = input.plan.ruleCollisionResolution.get(br.id);
    if (ruleRes === 'skip') continue;

    const resolvedTemplateName = rename.get(br.templateName) ?? br.templateName;
    const appended: Rule = {
      id: ruleRes === 'keepBoth' ? `${br.id}-imported` : br.id,
      hostPattern: br.hostPattern,
      pathPattern: br.pathPattern,
      templateName: resolvedTemplateName,
      variables: br.variables ?? {},
      active: false,
      ...(br.name ? { name: br.name } : {}),
    };

    if (ruleRes === 'replace') {
      const idx = mergedRules.findIndex((r) => r.id === br.id);
      if (idx >= 0) mergedRules[idx] = appended;
      else mergedRules.push(appended);
    } else {
      mergedRules.push(appended);
    }
  }

  // Flags — group sniff hits by the rule id or template name they apply to.
  const hits = sniff(input.plan.bundle);
  const flagsDelta: ImportFlagMap = {};
  for (const h of hits) {
    const m = h.field.match(/^rules\[(\d+)\]/);
    if (m) {
      const ruleIdx = Number(m[1]);
      const br = input.plan.bundle.rules[ruleIdx];
      if (!br || input.plan.skipRuleIds.has(br.id)) continue;
      const key = br.id;
      const entry: ImportFlagEntry = flagsDelta[key] ?? {
        source: input.plan.mode,
        importedAt: input.now,
        flags: [],
      };
      entry.flags.push({ field: h.field, pattern: h.patternRegex, matchedText: h.matchedText });
      flagsDelta[key] = entry;
      continue;
    }
    const mt = h.field.match(/^templates\[(\d+)\]/);
    if (mt) {
      const tmplIdx = Number(mt[1]);
      const bt = input.plan.bundle.templates[tmplIdx];
      if (!bt || input.plan.skipTemplateNames.has(bt.name)) continue;
      const resolved = rename.get(bt.name) ?? bt.name;
      const entry: ImportFlagEntry = flagsDelta[resolved] ?? {
        source: input.plan.mode,
        importedAt: input.now,
        flags: [],
      };
      entry.flags.push({ field: h.field, pattern: h.patternRegex, matchedText: h.matchedText });
      flagsDelta[resolved] = entry;
    }
  }

  return { rules: mergedRules, templates: mergedTemplates, sample: mergedSample, flagsDelta };
}

export interface CommitImportCtx {
  rules: Rule[];
  templates: Templates;
  sampleJson: Record<string, string>;
  setRules: (r: Rule[]) => Promise<void>;
  setTemplates: (t: Templates) => Promise<void>;
  setSampleJson: (s: Record<string, string>) => Promise<void>;
  existingFlags: ImportFlagMap;
  setImportFlags: (f: ImportFlagMap) => Promise<void>;
}

export async function commitImport(plan: ImportPlan, ctx: CommitImportCtx): Promise<void> {
  const result = applyImport({
    plan,
    existingRules: ctx.rules,
    existingTemplates: ctx.templates,
    existingSample: ctx.sampleJson,
    now: new Date().toISOString(),
  });
  // Templates first, then sample JSON, then rules.
  await ctx.setTemplates(result.templates);
  await ctx.setSampleJson(result.sample);
  await ctx.setRules(result.rules);
  const mergedFlags = { ...ctx.existingFlags, ...result.flagsDelta };
  await ctx.setImportFlags(mergedFlags);
}
```

- [ ] **Step 18.4: Run tests — expect pass**

```bash
pnpm test -- commit.test
```

- [ ] **Step 18.5: Wire `App.tsx` to the real `commitImport`**

In `src/options/App.tsx`, the `ImportDialog`'s `onCommit` should call `commitImport(plan, ctx)` with the real storage-backed setters. Read `importFlags` via `useStorage` (or equivalent hook) and pass it in.

- [ ] **Step 18.6: Commit**

```bash
git add src/options/import/ImportAppendModal.tsx src/options/import/commit.ts src/options/import/commit.test.ts src/options/App.tsx
git commit -m "feat(import): append modal + atomic commit function"
```

---

## Task 19: `NeedsAttention` badge component

**Files:**
- Create: `src/options/badges/NeedsAttention.tsx`
- Create: `src/options/badges/NeedsAttention.test.tsx`

- [ ] **Step 19.1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { NeedsAttention } from './NeedsAttention';

describe('NeedsAttention', () => {
  const entry = {
    source: 'append' as const,
    importedAt: '2026-04-19T00:00:00Z',
    flags: [
      { field: 'variables.auth', pattern: '/token/i', matchedText: 'abc' },
    ],
  };

  it('renders the literal pattern + field + matched text', () => {
    render(<NeedsAttention entry={entry} onDismiss={() => {}} />);
    expect(screen.getByText(/\/token\/i/)).toBeTruthy();
    expect(screen.getByText(/variables\.auth/)).toBeTruthy();
    expect(screen.getByText(/abc/)).toBeTruthy();
  });

  it('fires onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<NeedsAttention entry={entry} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 19.2: Run tests — expect failures**

```bash
pnpm test -- NeedsAttention.test
```

- [ ] **Step 19.3: Implement**

```tsx
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ImportFlagEntry } from '../../storage/storage';

export interface NeedsAttentionProps {
  entry: ImportFlagEntry;
  onDismiss: () => void;
}

export function NeedsAttention(props: NeedsAttentionProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div class="pj-needs-attention">
      <button
        type="button"
        class="pj-needs-attention-badge"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⚠ needs attention ({props.entry.flags.length})
      </button>
      {open ? (
        <div class="pj-needs-attention-body">
          <p>Imported at: {props.entry.importedAt}</p>
          <ul>
            {props.entry.flags.map((f) => (
              <li key={f.field + f.pattern}>
                Matched <code>{f.pattern}</code> on <code>{f.field}</code>. Matched text:{' '}
                <code>{f.matchedText}</code>
              </li>
            ))}
          </ul>
          <button type="button" onClick={props.onDismiss}>Dismiss</button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 19.4: Run tests — expect pass**

```bash
pnpm test -- NeedsAttention.test
```

- [ ] **Step 19.5: Commit**

```bash
git add src/options/badges/
git commit -m "feat(badges): NeedsAttention component with literal flag details"
```

---

## Task 20: Wire `NeedsAttention` into RuleCard + Templates cards

**Files:**
- Modify: `src/options/rules/RuleCard.tsx`
- Modify: `src/options/templates/TemplatesTab.tsx` (or wherever individual template cards render)
- Modify: `src/options/App.tsx` (thread `importFlags` + `setImportFlags` down)

- [ ] **Step 20.1: In `RuleCard`, render `NeedsAttention` when the rule id has a flag entry**

Add to `RuleCardProps`:
```ts
flagEntry?: ImportFlagEntry;
onDismissFlags?: () => void;
```

In render, near the rule header:
```tsx
{props.flagEntry ? (
  <NeedsAttention entry={props.flagEntry} onDismiss={props.onDismissFlags!} />
) : null}
```

- [ ] **Step 20.2: Thread `importFlags` from `App.tsx` → `RulesTab` → `RuleStack` → `RuleCard`**

At each hand-off, add two props:

```ts
importFlags: ImportFlagMap;
onDismissFlag: (key: string) => void;
```

In `RuleStack`, forward per-rule:
```tsx
<RuleCard
  // existing props
  flagEntry={importFlags[rule.id]}
  onDismissFlags={() => onDismissFlag(rule.id)}
/>
```

In `App.tsx`, the handler deletes the keyed entry and writes back:
```tsx
const [importFlags, setImportFlags] = useStorage<ImportFlagMap>('pj_import_flags', {});

function dismissFlag(key: string): void {
  const next = { ...importFlags };
  delete next[key];
  void setImportFlags(next);
}

// Pass to both RulesTab and TemplatesTab
<RulesTab
  // existing props
  importFlags={importFlags}
  onDismissFlag={dismissFlag}
/>
```

- [ ] **Step 20.3: Do the same for templates in `TemplatesTab`**

Render `NeedsAttention` under the template name header when `importFlags[templateName]` is set. Dismiss removes the keyed entry.

- [ ] **Step 20.4: Verify typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 20.5: Commit**

```bash
git add src/options/
git commit -m "feat(options): NeedsAttention wired into rule + template cards"
```

---

## Task 21: E2E — round-trip integrity

**Files:**
- Create: `test/e2e/export-import.spec.ts`

- [ ] **Step 21.1: Write the round-trip spec**

```ts
import { test, expect, type Worker } from '@playwright/test';
import { launchExtension } from './helpers/launchExtension';

test('export → clear → import round-trip preserves rules + templates + sample JSON', async () => {
  const { context, serviceWorker, optionsUrl } = await launchExtension();

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [
        { id: 'r1', name: 'qa', hostPattern: 'api.x.com', pathPattern: '/**', templateName: 't1', variables: { env: 'qa' }, active: true },
      ],
      templates: { t1: '<div>{{x}}</div>' },
      pj_sample_json: { t1: '{"x":1}' },
    });
  });

  const page = await context.newPage();
  await page.goto(optionsUrl);

  await page.getByRole('button', { name: '⬇ Export' }).click();
  await page.getByLabel(/qa/).check();
  await page.getByRole('button', { name: /next: scrub/i }).click();
  await page.getByRole('button', { name: /next: output/i }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download/i }).click(),
  ]);
  const savedPath = await download.path();
  expect(savedPath).toBeTruthy();

  // Clear storage
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      rules: [],
      templates: {},
      pj_sample_json: {},
    });
  });

  await page.reload();
  await page.getByRole('button', { name: '⬆ Import' }).click();

  const fileContents = await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = [];
    for await (const c of stream!) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  });

  await page.getByPlaceholder(/paste bundle json/i).fill(fileContents);
  await page.getByRole('button', { name: /next: review/i }).click();
  await page.getByRole('button', { name: /just append all/i }).click();
  await page.getByRole('button', { name: /^append all$/i }).click();

  const rules = await serviceWorker.evaluate(
    async () => (await chrome.storage.local.get('rules')).rules,
  );
  expect(rules).toHaveLength(1);
  expect(rules[0].id).toBe('r1');
  expect(rules[0].active).toBe(false);

  const templates = await serviceWorker.evaluate(
    async () => (await chrome.storage.local.get('templates')).templates,
  );
  expect(Object.keys(templates)).toEqual(['t1']);

  await context.close();
});
```

(If `test/e2e/helpers/launchExtension.ts` does not exist, reuse whatever helper the existing E2E specs use — grep `test/e2e/` for `launch` to find the shared pattern.)

- [ ] **Step 21.2: Run E2E — expect pass**

```bash
pnpm build
pnpm test:e2e -- export-import
```

- [ ] **Step 21.3: Commit**

```bash
git add test/e2e/export-import.spec.ts
git commit -m "test(e2e): export→import round-trip integrity"
```

---

## Task 22: E2E — append collisions + persistent badge

- [ ] **Step 22.1: Add a new E2E scenario to `test/e2e/export-import.spec.ts`**

```ts
test('append mode auto-renames collisions and persists the needs-attention badge', async () => {
  const { context, serviceWorker, optionsUrl } = await launchExtension();

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [],
      templates: { foo: '<div>old</div>' },
      pj_sample_json: { foo: '{}' },
    });
  });

  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.getByRole('button', { name: '⬆ Import' }).click();
  await page.getByPlaceholder(/paste bundle json/i).fill(
    JSON.stringify({
      bundleSchemaVersion: 1,
      exportedAt: 'x',
      appVersion: '1.0.0',
      templates: [
        { name: 'foo', source: '<div>new</div>', sampleJson: '{"api_token":"abc"}' },
      ],
      rules: [],
    }),
  );
  await page.getByRole('button', { name: /next: review/i }).click();
  await page.getByRole('button', { name: /just append all/i }).click();
  await page.getByRole('button', { name: /^append all$/i }).click();

  const tmpls = await serviceWorker.evaluate(
    async () => (await chrome.storage.local.get('templates')).templates,
  );
  expect(Object.keys(tmpls).sort()).toEqual(['foo', 'foo-2']);

  await page.reload();
  await expect(page.getByText(/needs attention/i)).toBeVisible();

  await context.close();
});
```

- [ ] **Step 22.2: Run + commit**

```bash
pnpm test:e2e -- export-import
git add test/e2e/export-import.spec.ts
git commit -m "test(e2e): append-mode collision rename + persistent badge"
```

---

## Task 23: E2E — paste + malformed + file-picker

- [ ] **Step 23.1: Add scenarios**

Append to `test/e2e/export-import.spec.ts`:

```ts
test('malformed paste renders inline errors and blocks advance', async () => {
  const { context, optionsUrl } = await launchExtension();
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.getByRole('button', { name: '⬆ Import' }).click();
  await page.getByPlaceholder(/paste bundle json/i).fill('{not valid');
  await page.getByRole('button', { name: /next: review/i }).click();
  await expect(page.getByText(/JSON parse error/i)).toBeVisible();
  await context.close();
});

test('file picker path opens review UI on valid file', async () => {
  const { context, optionsUrl } = await launchExtension();
  const page = await context.newPage();
  await page.goto(optionsUrl);
  await page.getByRole('button', { name: '⬆ Import' }).click();

  const validBundle = JSON.stringify({
    bundleSchemaVersion: 1,
    exportedAt: 'x',
    appVersion: '1.0.0',
    templates: [{ name: 't', source: 'x' }],
    rules: [],
  });
  const buffer = Buffer.from(validBundle, 'utf8');

  await page.setInputFiles('input[type="file"]', {
    name: 'bundle.freshet.json',
    mimeType: 'application/json',
    buffer,
  });
  await page.getByRole('button', { name: /next: review/i }).click();
  await expect(page.getByRole('heading', { name: /ready to review/i })).toBeVisible();
  await context.close();
});
```

- [ ] **Step 23.2: Run + commit**

```bash
pnpm test:e2e -- export-import
git add test/e2e/export-import.spec.ts
git commit -m "test(e2e): paste error + file-picker success paths"
```

---

## Task 24: a11y — axe-core on new dialogs

**Files:**
- Create: `test/e2e/export-import.a11y.spec.ts`

- [ ] **Step 24.1: Locate the existing a11y helper pattern**

Run:
```bash
grep -rl AxeBuilder test/e2e
```

Open one of the matches to confirm the existing `new AxeBuilder(page).analyze()` pattern and the project's per-theme iteration. Use that exact helper rather than re-importing `@axe-core/playwright` directly if the existing specs wrap it.

- [ ] **Step 24.2: Write the spec — one scenario per dialog surface, each in both themes**

```ts
import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright'; // replace with the local helper if the grep above finds one
import { launchExtension } from './helpers/launchExtension';

const THEMES = ['light', 'dark'] as const;

for (const theme of THEMES) {
  test(`a11y: export picker (${theme})`, async () => {
    const { context, serviceWorker, optionsUrl } = await launchExtension();
    await serviceWorker.evaluate(
      async (t) => chrome.storage.local.set({ settings: { themePreference: t } }),
      theme,
    );
    const page = await context.newPage();
    await page.goto(optionsUrl);
    await page.getByRole('button', { name: '⬇ Export' }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await context.close();
  });

  test(`a11y: export scrub (${theme})`, async () => {
    const { context, serviceWorker, optionsUrl } = await launchExtension();
    await serviceWorker.evaluate(async (t) => {
      await chrome.storage.local.set({
        pj_storage_area: 'local',
        settings: { themePreference: t },
        rules: [{ id: 'r1', name: 'x', hostPattern: 'a', pathPattern: 'b', templateName: 't', variables: {}, active: true }],
        templates: { t: 'x' },
      });
    }, theme);
    const page = await context.newPage();
    await page.goto(optionsUrl);
    await page.getByRole('button', { name: '⬇ Export' }).click();
    await page.getByLabel('x').check();
    await page.getByRole('button', { name: /next: scrub/i }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await context.close();
  });

  test(`a11y: import input (${theme})`, async () => {
    const { context, serviceWorker, optionsUrl } = await launchExtension();
    await serviceWorker.evaluate(
      async (t) => chrome.storage.local.set({ settings: { themePreference: t } }),
      theme,
    );
    const page = await context.newPage();
    await page.goto(optionsUrl);
    await page.getByRole('button', { name: '⬆ Import' }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await context.close();
  });

  test(`a11y: import review (${theme})`, async () => {
    const { context, serviceWorker, optionsUrl } = await launchExtension();
    await serviceWorker.evaluate(async (t) => {
      await chrome.storage.local.set({
        pj_storage_area: 'local',
        settings: { themePreference: t },
      });
    }, theme);
    const page = await context.newPage();
    await page.goto(optionsUrl);
    await page.getByRole('button', { name: '⬆ Import' }).click();
    await page.getByPlaceholder(/paste bundle json/i).fill(
      JSON.stringify({ bundleSchemaVersion: 1, exportedAt: 'x', appVersion: '1', templates: [{ name: 't', source: 'x' }], rules: [] }),
    );
    await page.getByRole('button', { name: /next: review/i }).click();
    await page.getByRole('button', { name: /review & pick/i }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await context.close();
  });
}
```

Repeat the pattern for the remaining dialog surfaces (output, mode step, append modal) if coverage is incomplete. Each assertion rejects `serious` + `critical` violations only.

- [ ] **Step 24.2: Run + commit**

```bash
pnpm test:e2e -- export-import.a11y
git add test/e2e/export-import.a11y.spec.ts
git commit -m "test(a11y): axe-core coverage for export/import dialogs"
```

---

## Task 25: Code review pass

**Purpose:** required second-to-last phase per global workflow. Dispatch a fresh reviewer with no implementation bias.

- [ ] **Step 25.1: Dispatch a `feature-dev:code-reviewer` agent**

Launch an Agent with `subagent_type: feature-dev:code-reviewer`. Prompt:

> Review the `feature/export-import` branch against the spec at `docs/superpowers/specs/2026-04-19-export-import-design.md` and the plan at `docs/superpowers/plans/2026-04-19-export-import.md`. Focus on:
> - Pure-core purity (no `chrome.*` in `src/bundle/*`).
> - Sniff output never redacts matched text (per "no hiding" rule).
> - Atomic commit behavior (templates → sample → rules → flags).
> - Schema validator rejects bundleSchemaVersion !== 1.
> - Imported rules default to `active: false`.
> - No TBDs, no placeholder code, no unused files.
> Report only high-confidence findings.

- [ ] **Step 25.2: Address findings**

For each finding returned by the reviewer, either fix it (commit with message `fix: address review — <one-line>`) or justify keeping it (reply to Matt with the rationale before FF-merge).

- [ ] **Step 25.3: Commit any review fixes**

```bash
git add -A
git commit -m "fix: address code-review findings"
```

---

## Task 26: README — Principles section + export/import mention

**Files:**
- Modify: `README.md`

- [ ] **Step 26.1: Insert the Principles section**

Place after the "Features" section (or between the tagline intro and "Install" — wherever fits the existing flow). Use the wording agreed in the spec:

```markdown
## Principles

Freshet makes a few deliberate choices about how it treats you and your data:

- **Warn, don't block.** When Freshet detects something worth pointing out
  (a possible secret in a shared bundle, a template that might conflict,
  a sample payload that looks like it holds real tokens) it tells you and
  steps out of the way. You decide.
- **No hiding.** Every flag shows the exact pattern or condition that
  matched — literal regex, literal matched text. If we can't explain why
  we flagged something, we don't flag it.
- **Local-first, always.** Rules, templates, and sample JSON live in your
  browser's `chrome.storage`. Nothing is sent to a server. There is no
  server.
- **Plain formats.** Bundles are plain JSON you can open, diff, and audit
  in any text editor. No binary blobs, no base64 obfuscation, no custom
  encoding.
- **No telemetry.** No analytics, no error reporting, no phone-home.
```

- [ ] **Step 26.2: Add a short export/import mention near the feature list**

Add a line to the Features list (wherever it lives):

> - **Export / import** — share rules and templates with teammates as a single `.freshet.json` bundle. Imports are always reviewed; imported rules start disabled; secrets in shared payloads are flagged, never hidden.

- [ ] **Step 26.3: Commit**

```bash
git add README.md
git commit -m "docs(readme): add Principles section + export/import mention"
```

---

## Task 27: CLAUDE.md — Gotchas additions

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 27.1: Add three new bullets to the Gotchas section**

```markdown
- **Bundle schema version is strict.** `src/bundle/parse.ts` rejects any bundle with `bundleSchemaVersion !== 1`. When bumping the bundle schema, add a migration — never loosen the check.
- **Sample JSON is carried as an opaque string on write.** `chrome.storage.local.pj_sample_json[name]` is never re-parsed by the importer. The sniff scanner parses it to locate flags but never transforms the stored value. Preserve that invariant if you touch `src/bundle/` or `src/options/import/commit.ts`.
- **`pj_import_flags` is keyed by rule `id` or template `name`.** Values are `ImportFlagEntry` records. The `NeedsAttention` badge reads this key; dismissal removes the keyed entry. Never auto-clear flags on edit — dismissal is explicit.
```

- [ ] **Step 27.2: Add `pj_import_flags` to the Storage keys table**

Append to the table:

```markdown
| `pj_import_flags` | `Record<string, ImportFlagEntry>` | Per-rule-id or per-template-name "needs attention" flags seeded by import sniff hits. Cleared on user dismiss. |
```

- [ ] **Step 27.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): gotchas + storage keys for export/import"
```

---

## Task 28: ROADMAP.md — mark P0 done

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 28.1: Move the export/import entry into a "Recently shipped" block at the top of Post-launch backlog, or mark it ✅ and the date.**

Example shape:

```markdown
## Post-launch backlog

### ✅ Shipped (2026-04-19)

- **Template export / import.** Unified `.freshet.json` bundle format, picker/scrub/output flow, import review with collision resolution or "just append all" mode, secret-sniff warnings on both sides, persistent needs-attention badge. Principles section added to README.

### P0 — Next up

(new P0 item, or promote former P1)
```

Decide with Matt whether a former P1 (extension-conflict detection or Templates UX convergence) is promoted to P0. If unsure, leave P0 blank and note "next P0 TBD pending Matt's call."

- [ ] **Step 28.2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): mark export/import shipped; promote next P0"
```

---

## Task 29: Final verification + handoff

- [ ] **Step 29.1: Run the full test suite**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

All must be green. If anything fails, fix and re-run before proceeding.

- [ ] **Step 29.2: Manual Chrome verification**

Reload the extension in `chrome://extensions/`, then manually walk through:

1. Export: click ⬇ Export in footer → pick rules → advance through scrub → download the file. Open the downloaded file in a text editor and eyeball the JSON.
2. Import via file picker: clear some rules, click ⬆ Import, use Choose file, advance to review, commit.
3. Import via paste: paste the JSON from Step 1, use append mode.
4. Import via drag-drop: drag the file onto the import dialog.
5. Sniff: edit a rule to have a `variables.auth_token: 'abc'` value, export, observe the scrub flag.
6. Persistent badge: import a bundle with a sniff hit, navigate away, reload, verify the badge is still there.
7. Dismiss badge: click it, dismiss, verify it disappears and is gone after reload.

Note any issues; if any, go back and fix before handoff.

- [ ] **Step 29.3: Hand off to Matt for manual FF-merge inspection**

Post a summary to Matt including:
- Feature branch name: `feature/export-import`
- What to look at in Chrome (the 7 scenarios above)
- Test counts before vs. after
- Any non-obvious trade-offs

Wait for explicit FF-merge approval.

- [ ] **Step 29.4: After Matt approves, FF-merge + push**

Only after Matt's go-ahead:

```bash
git checkout main
git merge --ff-only feature/export-import
git push origin main
git branch -d feature/export-import
```

(The branch delete happens only after Matt approves — don't pre-empt it.)

---

## Notes on expected scale

- ~29 tasks, ~140 steps, ~25 commits.
- Pure core modules (`src/bundle/`) are TDD-heavy and will feel front-loaded. UI work accelerates once the core lands.
- The two de-risk points are Task 4 (storage round-trip smoke) and Task 25 (reviewer pass). Neither should surprise, but both should be honored.
