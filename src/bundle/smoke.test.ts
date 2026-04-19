import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage } from '../storage/storage';

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

describe('bundle smoke — storage round-trip', () => {
  let api: ReturnType<typeof memoryStorage>;
  let storage: Awaited<ReturnType<typeof createStorage>>;
  beforeEach(async () => {
    api = memoryStorage();
    storage = await createStorage(api as unknown as typeof chrome.storage);
  });

  it('writes all bundle-adjacent keys and reads them back identically', async () => {
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
