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
      enabled: true,
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
  it('reads from local area when sentinel is set', async () => {
    await api.local.set({ pj_storage_area: 'local' });
    await api.local.set({ rules: [{ id: 'r1', hostPattern: '*', pathPattern: '*', templateName: 't', variables: {}, enabled: true }] });
    const s = await createStorage(api as unknown as typeof chrome.storage);
    const rules = await s.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.id).toBe('r1');
  });
});
