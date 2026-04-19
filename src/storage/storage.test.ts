import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage } from './storage';
import type { Rule } from '../shared/types';

function makeArea(db: Map<string, unknown>) {
  return {
    get: (keys: string[]) =>
      Promise.resolve(
        Object.fromEntries(keys.filter((k) => db.has(k)).map((k) => [k, db.get(k)])),
      ),
    set: (obj: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) db.set(k, v);
      return Promise.resolve();
    },
  };
}

function memoryStorage() {
  return {
    sync: makeArea(new Map<string, unknown>()),
    local: makeArea(new Map<string, unknown>()),
  };
}

describe('storage', () => {
  let api: ReturnType<typeof memoryStorage>;
  let storage: Awaited<ReturnType<typeof createStorage>>;
  beforeEach(async () => {
    api = memoryStorage();
    storage = await createStorage(api as unknown as typeof chrome.storage);
  });
  it('returns [] when no rules are saved', async () => {
    expect(await storage.getRules()).toEqual([]);
  });
  it('round-trips rules', async () => {
    const r: Rule = {
      id: 'r1',
      hostPattern: '*.example.com',
      pathPattern: '/**',
      templateName: 't1',
      variables: {},
      active: true,
    };
    await storage.setRules([r]);
    expect(await storage.getRules()).toEqual([r]);
  });
  it('round-trips templates', async () => {
    await storage.setTemplates({ a: '<p>a</p>', b: '<p>b</p>' });
    expect(await storage.getTemplates()).toEqual({ a: '<p>a</p>', b: '<p>b</p>' });
  });
  it('round-trips host skip list', async () => {
    await storage.setHostSkipList(['x.com']);
    expect(await storage.getHostSkipList()).toEqual(['x.com']);
  });
  it('returns undefined schemaVersion when unset', async () => {
    expect(await storage.getSchemaVersion()).toBeUndefined();
  });
  it('round-trips schemaVersion', async () => {
    await storage.setSchemaVersion(2);
    expect(await storage.getSchemaVersion()).toBe(2);
  });
  it('reads from local area when sentinel is set', async () => {
    await api.local.set({ pj_storage_area: 'local' });
    await api.local.set({ rules: [{ id: 'r1', hostPattern: '*', pathPattern: '*', templateName: 't', variables: {}, active: true }] });
    const s = await createStorage(api as unknown as typeof chrome.storage);
    const rules = await s.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toBe('r1');
  });

  it('returns empty sample JSON map by default', async () => {
    expect(await storage.getSampleJsonMap()).toEqual({});
  });
  it('round-trips the sample JSON map', async () => {
    await storage.setSampleJsonMap({ foo: '{"a":1}' });
    expect(await storage.getSampleJsonMap()).toEqual({ foo: '{"a":1}' });
  });
  it('returns empty import flags by default', async () => {
    expect(await storage.getImportFlags()).toEqual({});
  });
  it('round-trips import flags', async () => {
    const entry = {
      source: 'append' as const,
      importedAt: '2026-04-19T00:00:00Z',
      flags: [
        { field: 'variables.auth', pattern: '/token/i', matchedText: 'abc' },
      ],
    };
    await storage.setImportFlags({ 'some-template': entry });
    expect(await storage.getImportFlags()).toEqual({ 'some-template': entry });
  });

  it('returns empty conflicts map by default', async () => {
    expect(await storage.getConflicts()).toEqual({});
  });
  it('round-trips the conflicts map', async () => {
    const entry = {
      viewer: 'jsonview' as const,
      displayName: 'JSONView',
      extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
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
});
