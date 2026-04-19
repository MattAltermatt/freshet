import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/preact';
import { TemplatesTab } from './TemplatesTab';

type Listener = (
  changes: Record<string, { newValue: unknown; oldValue?: unknown }>,
) => void;

function installChromeMock(seed: Record<string, unknown> = {}): {
  listeners: Listener[];
  data: Record<string, unknown>;
} {
  const data: Record<string, unknown> = { ...seed };
  const listeners: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: (
          key: string | string[],
          cb: (v: Record<string, unknown>) => void,
        ) => {
          const keys = Array.isArray(key) ? key : [key];
          const out: Record<string, unknown> = {};
          for (const k of keys) if (k in data) out[k] = data[k];
          cb(out);
        },
        set: async (patch: Record<string, unknown>) => {
          const change: Record<string, { newValue: unknown; oldValue: unknown }> = {};
          for (const k of Object.keys(patch)) {
            change[k] = { newValue: patch[k], oldValue: data[k] };
            data[k] = patch[k];
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
  return { listeners, data };
}

function chipFor(root: HTMLElement, area: 'template' | 'sample' | 'preview'): HTMLButtonElement {
  const section = root.querySelector(`[data-area="${area}"]`);
  if (!section) throw new Error(`missing section for ${area}`);
  const btn = section.querySelector('button.pj-templates-label');
  if (!btn) throw new Error(`missing disclosure for ${area}`);
  return btn as HTMLButtonElement;
}

function isCollapsed(root: HTMLElement, area: 'template' | 'sample' | 'preview'): boolean {
  const section = root.querySelector(`[data-area="${area}"]`);
  return section?.getAttribute('data-collapsed') === 'true';
}

describe('<TemplatesTab> disclosures', () => {
  beforeEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('clicking a chip toggles only its own section', async () => {
    installChromeMock();
    const { container } = render(
      <TemplatesTab
        templates={{ 'internal-user': '<div>hi</div>' }}
        onTemplatesChange={() => {}}
        rules={[]}
        onDisableRules={() => {}}
      />,
    );
    // Wait for initial load (collapse state async)
    await waitFor(() => expect(container.querySelector('[data-area="template"]')).toBeTruthy());

    // All start expanded.
    expect(isCollapsed(container as HTMLElement, 'template')).toBe(false);
    expect(isCollapsed(container as HTMLElement, 'sample')).toBe(false);
    expect(isCollapsed(container as HTMLElement, 'preview')).toBe(false);

    // Click sample chip: only sample collapses.
    await act(async () => {
      fireEvent.click(chipFor(container as HTMLElement, 'sample'));
    });
    await waitFor(() => expect(isCollapsed(container as HTMLElement, 'sample')).toBe(true));
    expect(isCollapsed(container as HTMLElement, 'template')).toBe(false);
    expect(isCollapsed(container as HTMLElement, 'preview')).toBe(false);

    // Click preview chip: preview collapses; sample stays collapsed.
    await act(async () => {
      fireEvent.click(chipFor(container as HTMLElement, 'preview'));
    });
    await waitFor(() => expect(isCollapsed(container as HTMLElement, 'preview')).toBe(true));
    expect(isCollapsed(container as HTMLElement, 'template')).toBe(false);
    expect(isCollapsed(container as HTMLElement, 'sample')).toBe(true);

    // Click template chip: all three now collapsed.
    await act(async () => {
      fireEvent.click(chipFor(container as HTMLElement, 'template'));
    });
    await waitFor(() => expect(isCollapsed(container as HTMLElement, 'template')).toBe(true));
    expect(isCollapsed(container as HTMLElement, 'sample')).toBe(true);
    expect(isCollapsed(container as HTMLElement, 'preview')).toBe(true);

    // Click sample chip again: sample re-expands; others stay collapsed.
    await act(async () => {
      fireEvent.click(chipFor(container as HTMLElement, 'sample'));
    });
    await waitFor(() => expect(isCollapsed(container as HTMLElement, 'sample')).toBe(false));
    expect(isCollapsed(container as HTMLElement, 'template')).toBe(true);
    expect(isCollapsed(container as HTMLElement, 'preview')).toBe(true);
  });

  it('rapid clicks on different chips all land on correct sections', async () => {
    installChromeMock();
    const { container } = render(
      <TemplatesTab
        templates={{ 'internal-user': '<div>hi</div>' }}
        onTemplatesChange={() => {}}
        rules={[]}
        onDisableRules={() => {}}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-area="template"]')).toBeTruthy());

    // Fire three clicks in one tick without awaiting between each.
    await act(async () => {
      fireEvent.click(chipFor(container as HTMLElement, 'template'));
      fireEvent.click(chipFor(container as HTMLElement, 'sample'));
      fireEvent.click(chipFor(container as HTMLElement, 'preview'));
    });

    await waitFor(() => {
      expect(isCollapsed(container as HTMLElement, 'template')).toBe(true);
      expect(isCollapsed(container as HTMLElement, 'sample')).toBe(true);
      expect(isCollapsed(container as HTMLElement, 'preview')).toBe(true);
    });
  });
});
