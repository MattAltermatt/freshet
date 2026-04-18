import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { Header } from './Header';

type Listener = () => void;

function installChromeMock(bytes: number): void {
  const listeners: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      sync: {
        getBytesInUse: (_keys: null, cb: (n: number) => void) => cb(bytes),
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
}

describe('<Header>', () => {
  beforeEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('renders storage quota label', async () => {
    installChromeMock(12000);
    render(
      <Header tab="rules" onTab={() => {}} themePref="system" onThemePref={() => {}} />,
    );
    await waitFor(() => expect(screen.getByText(/11\.7 KB/)).toBeInTheDocument());
  });

  it('fires onTab when a tab is clicked', () => {
    installChromeMock(0);
    const onTab = vi.fn();
    render(
      <Header tab="rules" onTab={onTab} themePref="system" onThemePref={() => {}} />,
    );
    fireEvent.click(screen.getByText('Templates'));
    expect(onTab).toHaveBeenCalledWith('templates');
  });

  it('fires onThemePref on select change', () => {
    installChromeMock(0);
    const onThemePref = vi.fn();
    render(
      <Header tab="rules" onTab={() => {}} themePref="system" onThemePref={onThemePref} />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dark' } });
    expect(onThemePref).toHaveBeenCalledWith('dark');
  });

  it('flags quota tone as danger above 80%', async () => {
    installChromeMock(90000);
    render(
      <Header tab="rules" onTab={() => {}} themePref="system" onThemePref={() => {}} />,
    );
    await waitFor(() => {
      const quota = document.querySelector('.pj-quota') as HTMLElement;
      expect(quota.dataset['tone']).toBe('danger');
    });
  });
});
