import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { useFocusTrap } from './useFocusTrap';

interface HarnessProps {
  active: boolean;
  onEscape?: () => void;
  includeInputs?: boolean;
}

function Harness({ active, onEscape, includeInputs = true }: HarnessProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap({ containerRef: ref, active, onEscape });
  return (
    <div>
      <button type="button">outside-before</button>
      <div ref={ref} data-testid="dialog">
        {includeInputs ? (
          <>
            <button type="button">first</button>
            <input type="text" aria-label="middle" />
            <button type="button">last</button>
          </>
        ) : null}
      </div>
      <button type="button">outside-after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable inside the container on activate', () => {
    const { getByText } = render(<Harness active />);
    expect(document.activeElement).toBe(getByText('first'));
  });

  it('cycles forward from the last focusable back to the first on Tab', () => {
    const { getByText, getByTestId } = render(<Harness active />);
    const last = getByText('last');
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(getByTestId('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(getByText('first'));
  });

  it('cycles backward from the first focusable to the last on Shift+Tab', () => {
    const { getByText, getByTestId } = render(<Harness active />);
    const first = getByText('first');
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(getByTestId('dialog'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByText('last'));
  });

  it('invokes onEscape when Escape is pressed inside the container', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness active onEscape={onEscape} />);
    fireEvent.keyDown(getByTestId('dialog'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('restores focus to the previously focused element on deactivate', () => {
    const outside = document.createElement('button');
    outside.textContent = 'external-trigger';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { rerender } = render(<Harness active />);
    rerender(<Harness active={false} />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('falls back to focusing the container when it has no focusables', () => {
    const { getByTestId } = render(<Harness active includeInputs={false} />);
    expect(document.activeElement).toBe(getByTestId('dialog'));
  });

  it('does not attempt to restore focus when the previously focused element has been removed', () => {
    const outside = document.createElement('button');
    outside.textContent = 'doomed-trigger';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { rerender } = render(<Harness active />);
    outside.remove();
    rerender(<Harness active={false} />);
    expect(document.activeElement).not.toBe(outside);
    expect(document.body.contains(outside)).toBe(false);
  });

  it('does not re-focus the first element when a fresh onEscape arrow re-renders the parent', () => {
    const { getByLabelText, rerender } = render(
      <Harness active onEscape={() => {}} />,
    );
    const middle = getByLabelText('middle') as HTMLInputElement;
    middle.focus();
    expect(document.activeElement).toBe(middle);
    rerender(<Harness active onEscape={() => {}} />);
    expect(document.activeElement).toBe(middle);
  });
});
