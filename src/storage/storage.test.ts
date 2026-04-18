import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage } from './storage';
import type { Rule } from '../shared/types';

function memoryStorage() {
  const db = new Map<string, unknown>();
  return {
    sync: {
      get: (keys: string[]) =>
        Promise.resolve(
          Object.fromEntries(keys.filter((k) => db.has(k)).map((k) => [k, db.get(k)])),
        ),
      set: (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) db.set(k, v);
        return Promise.resolve();
      },
    },
    local: {
      get: (_keys: string[]) => Promise.resolve({}),
      set: (_obj: Record<string, unknown>) => Promise.resolve(),
    },
  };
}

describe('storage', () => {
  let storage: ReturnType<typeof createStorage>;
  beforeEach(() => {
    storage = createStorage(memoryStorage() as unknown as typeof chrome.storage);
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
});
