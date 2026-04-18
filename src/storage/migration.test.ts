import { describe, it, expect } from 'vitest';
import { estimateBytes, migrateTemplatesToV2, needsMigration, SYNC_SOFT_LIMIT } from './migration';

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
