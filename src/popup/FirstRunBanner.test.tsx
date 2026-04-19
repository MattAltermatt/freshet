import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/preact';
import { FirstRunBanner, TRY_PAGE_URL } from './FirstRunBanner';
import type { Rule } from '../shared/types';

interface ChromeStub {
  storage: {
    local: {
      get: (k: string, cb: (rec: Record<string, unknown>) => void) => void;
      set: (rec: Record<string, unknown>) => Promise<void>;
    };
    onChanged: {
      addListener: (fn: unknown) => void;
      removeListener: (fn: unknown) => void;
    };
  };
  tabs: { create: (opts: { url: string }) => void };
}

let store: Record<string, unknown> = {};
let listeners: Array<(c: Record<string, { newValue?: unknown }>) => void> = [];

beforeEach(() => {
  store = {};
  listeners = [];
  const chromeStub: ChromeStub = {
    storage: {
      local: {
        get: (key, cb) => cb({ [key]: store[key] }),
        set: async (rec) => {
          for (const [k, v] of Object.entries(rec)) {
            store[k] = v;
            for (const l of listeners) l({ [k]: { newValue: v } });
          }
        },
      },
      onChanged: {
        addListener: (fn) => {
          listeners.push(fn as (c: Record<string, { newValue?: unknown }>) => void);
        },
        removeListener: (fn) => {
          listeners = listeners.filter((l) => l !== (fn as unknown));
        },
      },
    },
    tabs: { create: vi.fn() },
  };
  // @ts-expect-error — stubbing the global for tests
  globalThis.chrome = chromeStub;
});

const exampleRule: Rule = {
  id: 'starter-x',
  hostPattern: 'a.com',
  pathPattern: '/',
  templateName: 't',
  variables: {},
  active: true,
  isExample: true,
};
const userRule: Rule = { ...exampleRule, id: 'user-y', isExample: false };

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('<FirstRunBanner>', () => {
  it('renders the welcome card on a fresh install (no rules dismissed, no user rules)', async () => {
    render(<FirstRunBanner rules={[exampleRule]} />);
    await flush();
    expect(screen.getByText('Welcome to Freshet')).toBeInTheDocument();
    expect(screen.getByText('Try the demos →')).toBeInTheDocument();
  });

  it('hides itself once the user has any non-example rule', async () => {
    render(<FirstRunBanner rules={[exampleRule, userRule]} />);
    await flush();
    expect(screen.queryByText('Welcome to Freshet')).not.toBeInTheDocument();
  });

  it('hides itself once the dismissed flag is set in storage', async () => {
    store['pj_first_run_dismissed'] = true;
    render(<FirstRunBanner rules={[exampleRule]} />);
    await flush();
    expect(screen.queryByText('Welcome to Freshet')).not.toBeInTheDocument();
  });

  it('writes the dismissed flag when × is clicked', async () => {
    render(<FirstRunBanner rules={[exampleRule]} />);
    await flush();
    fireEvent.click(screen.getByLabelText('Dismiss welcome'));
    await flush();
    expect(store['pj_first_run_dismissed']).toBe(true);
    expect(screen.queryByText('Welcome to Freshet')).not.toBeInTheDocument();
  });

  it('does not render until the dismissed-flag storage read has resolved (no flash)', async () => {
    // Replace the storage.local.get stub with one that NEVER calls back, so
    // the `loaded` gate stays false. The banner must render nothing — not even
    // the welcome card — until the storage read returns. Without the gate
    // useStorage's fallback (`false`) would briefly produce a "not dismissed"
    // banner flash on every popup open for already-dismissed users.
    globalThis.chrome.storage.local.get = ((_k: string, _cb: (rec: Record<string, unknown>) => void) => {
      // intentionally never calls _cb
    }) as unknown as typeof chrome.storage.local.get;
    const { container } = render(<FirstRunBanner rules={[exampleRule]} />);
    await flush();
    expect(container.textContent ?? '').not.toContain('Welcome to Freshet');
  });

  it('opens the docs /try/ page and dismisses when the CTA is clicked', async () => {
    // window.close throws in jsdom — stub it for the test.
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<FirstRunBanner rules={[exampleRule]} />);
    await flush();
    fireEvent.click(screen.getByText('Try the demos →'));
    await flush();
    expect((globalThis.chrome.tabs.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ url: TRY_PAGE_URL });
    expect(store['pj_first_run_dismissed']).toBe(true);
    expect(closeSpy).toHaveBeenCalled();
    closeSpy.mockRestore();
  });
});
