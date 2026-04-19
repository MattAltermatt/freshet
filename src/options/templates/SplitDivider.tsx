import type { JSX, RefObject } from 'preact';
import { useRef } from 'preact/hooks';

export interface SplitDividerProps {
  // Container that holds the two panels. Its getBoundingClientRect() is used
  // to translate pointer y into a 0–1 ratio.
  containerRef: RefObject<HTMLElement>;
  // Current ratio — used to seed keyboard nudges.
  ratio: number;
  onRatioChange: (next: number) => void;
  // How tightly to clamp the ratio so one panel never fully eats the other.
  // Defaults to [0.1, 0.9].
  min?: number;
  max?: number;
}

const KEYBOARD_STEP = 0.04;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function SplitDivider({
  containerRef,
  ratio,
  onRatioChange,
  min = 0.1,
  max = 0.9,
}: SplitDividerProps): JSX.Element {
  // Track whether we're currently dragging so the styling can respond
  // without needing React state (which would re-render on every pointer tick).
  const dragging = useRef(false);

  const onPointerDown = (e: PointerEvent): void => {
    const el = containerRef.current;
    if (!el) return;
    e.preventDefault();
    dragging.current = true;
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent): void => {
      const y = ev.clientY - rect.top;
      const next = clamp(y / rect.height, min, max);
      onRatioChange(next);
    };
    const up = (): void => {
      dragging.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    // pointercancel fires when the pointer is lost without a pointerup —
    // e.g. touch drags off-screen, stylus disconnect, OS gesture steal. Must
    // clean up the same listeners or they'd leak until the next pointerup.
    window.addEventListener('pointercancel', up);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onRatioChange(clamp(ratio - KEYBOARD_STEP, min, max));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      onRatioChange(clamp(ratio + KEYBOARD_STEP, min, max));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onRatioChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onRatioChange(max);
    }
  };

  return (
    <div
      class="pj-split-divider"
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={Math.round(min * 100)}
      aria-valuemax={Math.round(max * 100)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span class="pj-split-divider-grip" aria-hidden="true" />
    </div>
  );
}
