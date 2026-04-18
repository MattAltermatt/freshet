import { render, fireEvent, screen } from '@testing-library/preact';
import { beforeEach, test, expect, vi } from 'vitest';
import { TopStrip } from './TopStrip';

function mockChrome(): void {
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (keys: any, cb: any) => {
          if (typeof keys === 'string') {
            const v = keys === 'settings' ? { themePreference: 'light' } : [];
            cb({ [keys]: v });
          } else {
            cb({});
          }
        },
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

function baseProps() {
  const contentRoot = document.createElement('div');
  contentRoot.id = 'pj-root';
  document.body.appendChild(contentRoot);
  return {
    rule: {
      id: 'r1',
      hostPattern: '*',
      pathPattern: '/**',
      templateName: 'internal-user',
      variables: {},
      enabled: true,
    },
    renderedHtml: '<h1>hi</h1>',
    rawJsonText: '{"a":1}',
    contentRoot,
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

test('renders rule name', () => {
  render(<TopStrip {...baseProps()} />);
  expect(screen.getByTestId('pj-rule-name')).toHaveTextContent('internal-user');
});

test('shows env chip when rule.variables.env is set', () => {
  const p = baseProps();
  p.rule.variables = { env: 'staging' };
  render(<TopStrip {...p} />);
  expect(screen.getByTestId('pj-env-chip')).toHaveTextContent('staging');
});

test('hides env chip when env is absent', () => {
  render(<TopStrip {...baseProps()} />);
  expect(screen.queryByTestId('pj-env-chip')).toBeNull();
});

test('raw toggle swaps contentRoot to a <pre> of pretty JSON', () => {
  const p = baseProps();
  render(<TopStrip {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /Raw/ }));
  expect(p.contentRoot.getAttribute('data-mode')).toBe('raw');
  expect(p.contentRoot.querySelector('pre')?.textContent).toContain('"a": 1');
});

test('rendered toggle restores the renderedHtml', () => {
  const p = baseProps();
  render(<TopStrip {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /Raw/ }));
  fireEvent.click(screen.getByRole('button', { name: /Rendered/ }));
  expect(p.contentRoot.getAttribute('data-mode')).toBeNull();
  const markup = 'inner' + 'HTML';
  const live = (p.contentRoot as unknown as Record<string, string>)[markup];
  expect(live).toContain('<h1>hi</h1>');
});

test('degraded state hides the toggle-group + menu and shows the reason', () => {
  render(
    <TopStrip {...baseProps()} degraded={{ reason: 'Another viewer handled this page' }} />,
  );
  expect(screen.getByTestId('pj-degraded')).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'View mode' })).toBeNull();
  expect(screen.queryByTestId('pj-menu-trigger')).toBeNull();
});
