import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useStorage } from './useStorage';

type Listener = (changes: Record<string, { newValue: unknown; oldValue?: unknown }>) => void;

function installChromeMock(initial: Record<string, unknown>): {
  set: (patch: Record<string, unknown>) => Promise<void>;
} {
  const listeners: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: (key: string | string[], cb: (v: Record<string, unknown>) => void) => {
          const keys = Array.isArray(key) ? key : [key];
          const out: Record<string, unknown> = {};
          for (const k of keys) if (k in initial) out[k] = initial[k];
          cb(out);
        },
        set: async (patch: Record<string, unknown>) => {
          const change: Record<string, { newValue: unknown; oldValue: unknown }> = {};
          for (const k of Object.keys(patch)) {
            change[k] = { newValue: patch[k], oldValue: initial[k] };
            initial[k] = patch[k];
          }
          listeners.forEach((l) => l(change));
        },
      },
      onChanged: {
        addListener: (l: Listener) => listeners.push(l),
        removeListener: (l: Listener) => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        },
      },
    },
  };
  return {
    set: async (patch) => {
      await (globalThis as unknown as { chrome: { storage: { local: { set: (p: Record<string, unknown>) => Promise<void> } } } }).chrome.storage.local.set(patch);
    },
  };
}

describe('useStorage', () => {
  beforeEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('loads the initial value from storage', async () => {
    installChromeMock({ rules: [{ id: 'r1' }] });
    const { result } = renderHook(() => useStorage<'rules', Array<{ id: string }>>('rules', []));
    await waitFor(() => expect(result.current[0]).toEqual([{ id: 'r1' }]));
  });

  it('reacts to onChanged', async () => {
    const mock = installChromeMock({ rules: [{ id: 'r1' }] });
    const { result } = renderHook(() => useStorage<'rules', Array<{ id: string }>>('rules', []));
    await waitFor(() => expect(result.current[0]).toEqual([{ id: 'r1' }]));
    await act(async () => {
      await mock.set({ rules: [{ id: 'r2' }] });
    });
    expect(result.current[0]).toEqual([{ id: 'r2' }]);
  });

  it('write() updates state and calls storage.set', async () => {
    installChromeMock({ rules: [] });
    const { result } = renderHook(() => useStorage<'rules', Array<{ id: string }>>('rules', []));
    await act(async () => {
      await result.current[1]([{ id: 'r3' }]);
    });
    expect(result.current[0]).toEqual([{ id: 'r3' }]);
  });
});
