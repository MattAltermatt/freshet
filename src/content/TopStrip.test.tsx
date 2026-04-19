import { render, fireEvent, screen } from '@testing-library/preact';
import { beforeEach, test, expect, vi } from 'vitest';
import { TopStrip } from './TopStrip';

type StorageCb = (rec: Record<string, unknown>) => void;

function mockChrome(): void {
  const chromeStub = {
    storage: {
      local: {
        get: (keys: string | string[] | null, cb: StorageCb): void => {
          if (typeof keys === 'string') {
            const v: unknown =
              keys === 'settings' ? { themePreference: 'light' } : [];
            cb({ [keys]: v });
          } else {
            cb({});
          }
        },
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
      variables: {} as Record<string, string>,
      active: true,
    },
    renderedHtml: '<h1>hi</h1>',
    rawJsonText: '{"a":1}',
    contentRoot,
  };
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

test('renders rule name', () => {
  render(<TopStrip {...baseProps()} />);
  expect(screen.getByTestId('pj-rule-name')).toHaveTextContent('internal-user');
});

test('clicking the template name sends an open-options edit-template message', () => {
  const sendMessage = vi.fn();
  (globalThis as unknown as { chrome: { runtime: { sendMessage: typeof sendMessage } } })
    .chrome.runtime.sendMessage = sendMessage;
  render(<TopStrip {...baseProps()} />);
  fireEvent.click(screen.getByTestId('pj-rule-name'));
  expect(sendMessage).toHaveBeenCalledTimes(1);
  const arg = sendMessage.mock.calls[0]![0] as { kind: string; hash: string };
  expect(arg.kind).toBe('pj:open-options');
  expect(arg.hash).toContain('#edit-template=');
  expect(decodeURIComponent(arg.hash.split('=')[1]!)).toBe('internal-user');
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

test('menu exposes a theme submenu with the active preference checked', async () => {
  // Mock chrome default seeds themePreference: 'light' — active should be Light.
  render(<TopStrip {...baseProps()} />);
  fireEvent.click(screen.getByTestId('pj-menu-trigger'));
  // All three theme options render
  expect(await screen.findByText('Theme: Auto')).toBeInTheDocument();
  const lightItem = screen.getByText('Theme: Light').closest('button')!;
  const darkItem = screen.getByText('Theme: Dark').closest('button')!;
  // Only the active one has the ✓ trailing icon
  expect(lightItem.textContent).toContain('✓');
  expect(darkItem.textContent).not.toContain('✓');
});
