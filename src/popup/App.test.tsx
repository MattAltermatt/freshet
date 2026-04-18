import { render, screen, waitFor } from '@testing-library/preact';
import { vi, beforeEach, test, expect } from 'vitest';
import { App } from './App';

function mockChrome(): void {
  const store: Record<string, unknown> = {
    pj_storage_area: 'local',
    rules: [],
    hostSkipList: [],
  };

  const getKeys = (keys: string | string[] | null): Record<string, unknown> => {
    const k = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(store);
    const rec: Record<string, unknown> = {};
    for (const key of k) if (key in store) rec[key] = store[key];
    return rec;
  };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    tabs: {
      query: (_q: unknown, cb: (t: Array<{ url: string }>) => void): void =>
        cb([{ url: 'http://127.0.0.1:4391/internal/user/1' }]),
      create: vi.fn(),
    },
    storage: {
      local: {
        get: (
          keys: string | string[] | null,
          cb?: (rec: Record<string, unknown>) => void,
        ): Promise<Record<string, unknown>> | void => {
          const rec = getKeys(keys);
          if (cb) {
            cb(rec);
            return;
          }
          return Promise.resolve(rec);
        },
        set: (patch: Record<string, unknown>, cb?: () => void): Promise<void> | void => {
          Object.assign(store, patch);
          if (cb) {
            cb();
            return;
          }
          return Promise.resolve();
        },
      },
      sync: {
        get: (
          _keys: unknown,
          cb?: (rec: Record<string, unknown>) => void,
        ): Promise<Record<string, unknown>> | void => {
          if (cb) {
            cb({});
            return;
          }
          return Promise.resolve({});
        },
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      openOptionsPage: vi.fn(),
      getURL: (p: string): string => `chrome-extension://fake/${p}`,
    },
  };
}

beforeEach(() => mockChrome());

test('shows no-match CTA when rules is empty', async () => {
  render(<App />);
  await waitFor(() =>
    expect(screen.getByText(/No rule matches this URL/)).toBeInTheDocument(),
  );
  expect(screen.getByText('+ Add rule for this host')).toBeInTheDocument();
});

test('shows test-url input pre-filled with the active tab url', async () => {
  render(<App />);
  const input = await waitFor(() =>
    screen.getByLabelText('Test URL') as HTMLInputElement,
  );
  expect(input.value).toBe('http://127.0.0.1:4391/internal/user/1');
});
