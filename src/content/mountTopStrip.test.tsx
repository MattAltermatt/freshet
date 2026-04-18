import { beforeEach, test, expect, vi } from 'vitest';
import { mountTopStrip } from './mountTopStrip';

function mockChrome(): void {
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (_k: any, cb: any) => cb({}),
        set: (_p: any, cb?: any) => cb?.(),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      getURL: (p: string) => `chrome-extension://fake/${p}`,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { create: vi.fn() },
  };
}

beforeEach(() => {
  document.body.replaceChildren();
  mockChrome();
  (window as any).matchMedia = (_q: string) => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
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
