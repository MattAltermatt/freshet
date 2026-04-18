import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

interface UseFocusTrapOptions {
  /** The container whose descendants the trap applies to. */
  containerRef: RefObject<HTMLElement | null>;
  /** Whether the trap is currently engaged. */
  active: boolean;
  /** Called when Escape is pressed inside the container. */
  onEscape?: (() => void) | undefined;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableWithin(root: HTMLElement): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

/**
 * Dialog focus management: moves focus into `containerRef` on activate,
 * cycles Tab / Shift+Tab at the boundaries, forwards Escape, and restores
 * focus to the previously focused element on deactivate.
 */
export function useFocusTrap({ containerRef, active, onEscape }: UseFocusTrapOptions): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const initialFocusables = focusableWithin(container);
    if (initialFocusables.length > 0) {
      initialFocusables[0]!.focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = focusableWithin(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;
      const inside = activeEl ? container.contains(activeEl) : false;

      if (event.shiftKey) {
        if (!inside || activeEl === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!inside || activeEl === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef, onEscape]);
}
