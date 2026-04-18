import { beforeEach, test, expect, vi } from 'vitest';
import { mountTopStrip } from './mountTopStrip';

function mockChrome(): void {
  const chromeStub = {
    storage: {
      local: {
        get: (_k: string | string[] | null, cb: (rec: Record<string, unknown>) => void): void =>
          cb({}),
        set: (_p: Record<string, unknown>, cb?: () => void): void => cb?.(),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      getURL: (p: string): string => `chrome-extension://fake/${p}`,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { create: vi.fn() },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = chromeStub;
}

beforeEach(() => {
  document.body.replaceChildren();
  mockChrome();
  (window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (
    _q: string,
  ) => ({
    matches: false,
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
  });
});

const baseRule = {
  id: 'r1',
  hostPattern: '*',
  pathPattern: '/**',
  templateName: 'x',
  variables: {},
  enabled: true,
};

test('mounts a host element prepended to document.body by default', () => {
  const contentRoot = document.createElement('div');
  contentRoot.id = 'pj-root';
  document.body.appendChild(contentRoot);

  const host = mountTopStrip({
    rule: baseRule,
    renderedHtml: '<h1>x</h1>',
    rawJsonText: '{}',
    contentRoot,
  });

  expect(host.id).toBe('pj-topstrip-host');
  expect(document.body.firstElementChild).toBe(host);
});

test('honors the parent option', () => {
  const parent = document.createElement('main');
  document.body.appendChild(parent);
  const contentRoot = document.createElement('div');
  parent.appendChild(contentRoot);

  const host = mountTopStrip({
    rule: baseRule,
    renderedHtml: '<h1>x</h1>',
    rawJsonText: '{}',
    contentRoot,
    parent,
  });

  expect(parent.firstElementChild).toBe(host);
});
