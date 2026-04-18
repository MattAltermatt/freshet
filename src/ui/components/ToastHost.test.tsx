import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/preact';
import { ToastHost } from './ToastHost';
import { useToast, clearAllToasts } from '../hooks/useToast';

describe('<ToastHost>', () => {
  beforeEach(() => {
    clearAllToasts();
  });

  it('renders no toasts initially', () => {
    const { container } = render(<ToastHost />);
    expect(container.querySelectorAll('.pj-toast').length).toBe(0);
  });

  it('pushes a toast via useToast and renders it', () => {
    let pushFn: ReturnType<typeof useToast>['push'];
    function Harness() {
      pushFn = useToast().push;
      return null;
    }
    const { container } = render(
      <>
        <ToastHost />
        <Harness />
      </>
    );
    act(() => {
      pushFn!({ variant: 'success', message: 'Saved' });
    });
    const toasts = container.querySelectorAll('.pj-toast');
    expect(toasts.length).toBe(1);
    expect(toasts[0]?.textContent).toContain('Saved');
  });

  it('auto-dismisses after ttlMs', async () => {
    vi.useFakeTimers();
    let pushFn: ReturnType<typeof useToast>['push'];
    function Harness() {
      pushFn = useToast().push;
      return null;
    }
    const { container } = render(
      <>
        <ToastHost />
        <Harness />
      </>
    );
    act(() => { pushFn!({ variant: 'success', message: 'Bye', ttlMs: 1000 }); });
    expect(container.querySelectorAll('.pj-toast').length).toBe(1);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(container.querySelectorAll('.pj-toast').length).toBe(0);
    vi.useRealTimers();
  });
});
