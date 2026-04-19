import { describe, it, expect } from 'vitest';
import {
  estimateBytes,
  migrateRulesEnabledToActive,
  migrateTemplatesToV2,
  needsMigration,
  SYNC_SOFT_LIMIT,
} from './migration';

describe('storage migration', () => {
  it('estimates byte size', () => {
    const payload = { rules: [], templates: { a: 'x'.repeat(100) }, hostSkipList: [] };
    const bytes = estimateBytes(payload);
    expect(bytes).toBeGreaterThan(100);
    expect(bytes).toBeLessThan(400);
  });
  it('flags migration when over the soft limit', () => {
    const big = { rules: [], templates: { a: 'x'.repeat(SYNC_SOFT_LIMIT) }, hostSkipList: [] };
    expect(needsMigration(big)).toBe(true);
  });
  it('does not flag migration when under the soft limit', () => {
    const small = { rules: [], templates: { a: 'x' }, hostSkipList: [] };
    expect(needsMigration(small)).toBe(false);
  });
});

describe('migrateTemplatesToV2', () => {
  function makeStubStorage(initial: Record<string, string>) {
    const state = { templates: { ...initial }, schemaVersion: undefined as number | undefined };
    const lastWrite = { value: null as Record<string, string> | null };
    return {
      state,
      lastWrite,
      async getTemplates() { return { ...state.templates }; },
      async setTemplates(next: Record<string, string>) {
        state.templates = { ...next };
        lastWrite.value = { ...next };
      },
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

describe('migrateRulesEnabledToActive', () => {
  function makeAreaStub(initial: Record<string, unknown> = {}) {
    const state: Record<string, unknown> = { ...initial };
    return {
      state,
      async get(key: string) { return key in state ? { [key]: state[key] } : {}; },
      async set(patch: Record<string, unknown>) { Object.assign(state, patch); },
    };
  }
  function makeApi(syncInit: Record<string, unknown> = {}, localInit: Record<string, unknown> = {}) {
    return { sync: makeAreaStub(syncInit), local: makeAreaStub(localInit) };
  }

  it('migrates rules in sync storage', async () => {
    const api = makeApi(
      { rules: [{ id: 'r1', hostPattern: '*', pathPattern: '/', templateName: 't', variables: {}, enabled: true }] },
      {},
    );
    const result = await migrateRulesEnabledToActive(api as unknown as typeof chrome.storage);
    expect(result.syncMigrated).toBe(1);
    expect(result.localMigrated).toBe(0);
    const rules = (api.sync.state.rules as Array<Record<string, unknown>>);
    expect(rules[0]).toMatchObject({ id: 'r1', active: true });
    expect('enabled' in rules[0]!).toBe(false);
  });

  it('migrates rules in local storage', async () => {
    const api = makeApi(
      {},
      { rules: [{ id: 'r1', hostPattern: '*', pathPattern: '/', templateName: 't', variables: {}, enabled: false }] },
    );
    const result = await migrateRulesEnabledToActive(api as unknown as typeof chrome.storage);
    expect(result.localMigrated).toBe(1);
    const rules = (api.local.state.rules as Array<Record<string, unknown>>);
    expect(rules[0]).toMatchObject({ active: false });
  });

  it('is idempotent on already-migrated rules', async () => {
    const api = makeApi(
      {},
      { rules: [{ id: 'r1', hostPattern: '*', pathPattern: '/', templateName: 't', variables: {}, active: true }] },
    );
    const result = await migrateRulesEnabledToActive(api as unknown as typeof chrome.storage);
    expect(result.localMigrated).toBe(0);
    const rules = (api.local.state.rules as Array<Record<string, unknown>>);
    expect(rules[0]).toMatchObject({ active: true });
  });

  it('handles a mixed array (some migrated, some not)', async () => {
    const api = makeApi(
      {},
      {
        rules: [
          { id: 'old', enabled: true },
          { id: 'new', active: false },
        ],
      },
    );
    const result = await migrateRulesEnabledToActive(api as unknown as typeof chrome.storage);
    expect(result.localMigrated).toBe(1);
    const rules = (api.local.state.rules as Array<Record<string, unknown>>);
    expect(rules[0]).toMatchObject({ id: 'old', active: true });
    expect('enabled' in rules[0]!).toBe(false);
    expect(rules[1]).toMatchObject({ id: 'new', active: false });
  });

  it('no-ops when neither area has rules', async () => {
    const api = makeApi();
    const result = await migrateRulesEnabledToActive(api as unknown as typeof chrome.storage);
    expect(result).toEqual({ syncMigrated: 0, localMigrated: 0 });
  });
});
