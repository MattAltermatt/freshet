import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import type { JSX } from 'preact';

const DRAG_THRESHOLD_PX = 5;

interface DragState {
  itemId: string;
  fromIndex: number;
  initialPointerY: number;
  initialOffsetY: number;       // pointer Y inside the card at pointerdown
  cardRects: DOMRect[];          // cached at threshold-cross
  cardEl: HTMLElement;           // the card being dragged
  pointerY: number;              // current pointer Y
  targetIndex: number;           // current target slot
  active: boolean;               // false until threshold crossed
}

export interface UseSortableReturn {
  gripProps: (index: number) => JSX.HTMLAttributes<HTMLSpanElement>;
  cardProps: (index: number) => JSX.HTMLAttributes<HTMLElement>;
  floatingLayer: JSX.Element | null;
  isDragging: boolean;
  /** Number that should display on card at the given index, accounting for any
   *  in-flight drag's predicted reorder. Pre-drag this is just `index + 1`. */
  displayNumber: (index: number) => number;
  /** True if the most recent pointerdown produced a drag past the threshold.
   *  Use to suppress edit-on-click after drag. */
  didDrag: () => boolean;
}

export interface UseSortableOpts<T extends { id: string }> {
  items: readonly T[];
  onReorder: (next: T[]) => void;
  /** Called to render the floating clone of the dragged card. The third
   *  argument is the predicted display number at the current target index —
   *  the hook computes this so the caller doesn't have to close over
   *  the not-yet-bound sortable return value. */
  renderClone: (item: T, index: number, displayNumber: number) => JSX.Element;
}

export function useSortable<T extends { id: string }>(
  opts: UseSortableOpts<T>,
): UseSortableReturn {
  const { items, onReorder, renderClone } = opts;
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragOccurredRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onPointerDown = useCallback((index: number, e: PointerEvent): void => {
    const cardEl = (e.currentTarget as HTMLElement | null)?.closest<HTMLElement>('.pj-rule-card');
    if (!cardEl) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragOccurredRef.current = false;
    const initialPointerY = e.clientY;
    const initialOffsetY = e.clientY - cardEl.getBoundingClientRect().top;
    setDrag({
      itemId: itemsRef.current[index]!.id,
      fromIndex: index,
      initialPointerY,
      initialOffsetY,
      cardRects: [],
      cardEl,
      pointerY: e.clientY,
      targetIndex: index,
      active: false,
    });
  }, []);

  const onPointerMove = useCallback((e: PointerEvent): void => {
    setDrag((d) => {
      if (!d) return d;
      const movedPx = Math.abs(e.clientY - d.initialPointerY);
      if (!d.active && movedPx < DRAG_THRESHOLD_PX) {
        return { ...d, pointerY: e.clientY };
      }
      let cardRects = d.cardRects;
      let active = d.active;
      if (!d.active) {
        const stack = d.cardEl.parentElement;
        if (stack) {
          cardRects = Array.from(stack.querySelectorAll<HTMLElement>('.pj-rule-card'))
            .filter((el) => !el.dataset.floatingClone)
            .map((el) => el.getBoundingClientRect());
        }
        active = true;
        dragOccurredRef.current = true;
      }
      const targetIndex = computeTargetIndex(e.clientY, cardRects, d.fromIndex);
      return { ...d, pointerY: e.clientY, cardRects, active, targetIndex };
    });
  }, []);

  const onPointerUp = useCallback((_e: PointerEvent): void => {
    setDrag((d) => {
      if (!d || !d.active) return null;
      const latest = itemsRef.current;
      const targetIndex = Math.min(d.targetIndex, latest.length - 1);
      const next = reorder(latest, d.fromIndex, targetIndex);
      if (next !== latest) onReorder(next);
      return null;
    });
  }, [onReorder]);

  const onPointerCancel = useCallback((): void => {
    // Browser forcibly interrupted the gesture (system dialog, touch stolen by
    // scroll, device sleep). Cancel — never commit a drop the user didn't make.
    dragOccurredRef.current = false;
    setDrag(null);
  }, []);

  const gripProps = useCallback((index: number): JSX.HTMLAttributes<HTMLSpanElement> => ({
    onPointerDown: (e) => onPointerDown(index, e as unknown as PointerEvent),
    onPointerMove: (e) => onPointerMove(e as unknown as PointerEvent),
    onPointerUp: (e) => onPointerUp(e as unknown as PointerEvent),
    onPointerCancel: () => onPointerCancel(),
  }), [onPointerDown, onPointerMove, onPointerUp, onPointerCancel]);

  const cardProps = useCallback((index: number): JSX.HTMLAttributes<HTMLElement> => {
    if (!drag?.active) return {};
    const cardHeight = drag.cardRects[drag.fromIndex]?.height ?? 0;
    const gap = 8; // matches --pj-space-2 used by .pj-rule-cards
    const step = cardHeight + gap;

    if (drag.fromIndex === index) {
      // Slot — translateY toward the target position so the dashed box visually
      // sits where the card would land. Sibling cards in [origin..target] shift
      // in the opposite direction to make room.
      const slotShift = (drag.targetIndex - drag.fromIndex) * step;
      return {
        'data-dragging-slot': '',
        'data-drag-active': '',
        style: slotShift ? `transform: translateY(${slotShift}px)` : undefined,
      } as unknown as JSX.HTMLAttributes<HTMLElement>;
    }

    let dy = 0;
    if (drag.fromIndex < drag.targetIndex && index > drag.fromIndex && index <= drag.targetIndex) {
      dy = -step;
    } else if (drag.fromIndex > drag.targetIndex && index >= drag.targetIndex && index < drag.fromIndex) {
      dy = step;
    }
    return {
      'data-drag-active': '',
      style: dy ? `transform: translateY(${dy}px)` : undefined,
    } as unknown as JSX.HTMLAttributes<HTMLElement>;
  }, [drag]);

  const floatingLayer = drag?.active && drag.itemId
    ? (() => {
        const item = items.find((it) => it.id === drag.itemId);
        if (!item) return null;
        // pointerY is viewport-relative; the floating layer is
        // position: absolute inside .pj-rule-cards, so we subtract the
        // container's viewport top to get container-relative coords.
        const containerTop = drag.cardEl.parentElement?.getBoundingClientRect().top ?? 0;
        const top = drag.pointerY - drag.initialOffsetY - containerTop;
        const cloneDisplayNumber = Math.min(drag.targetIndex, items.length - 1) + 1;
        return (
          <div class="pj-rule-card-floating-layer" aria-hidden="true">
            <div
              class="pj-rule-card-floating"
              data-floating-clone
              style={`top: ${top}px`}
              ref={(el) => {
                // The floating clone is purely visual — no interaction allowed.
                // `inert` removes descendants from focus order AND the a11y tree.
                if (el) el.inert = true;
              }}
            >
              {renderClone(item, drag.fromIndex, cloneDisplayNumber)}
            </div>
          </div>
        );
      })()
    : null;

  // Escape-to-cancel
  useEffect(() => {
    if (!drag?.active) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        dragOccurredRef.current = false;
        setDrag(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drag?.active]);

  // Auto-scroll near viewport edges while dragging
  useEffect(() => {
    if (!drag?.active) return;
    let frame = 0;
    const tick = (): void => {
      setDrag((d) => {
        if (!d?.active) return d;
        const delta = clampScrollDelta(d.pointerY, window.innerHeight);
        if (delta !== 0) {
          document.scrollingElement?.scrollBy({ top: delta, behavior: 'auto' });
        }
        return d;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [drag?.active]);

  const displayNumber = useCallback((index: number): number => {
    if (!drag?.active) return index + 1;
    const { fromIndex, targetIndex } = drag;
    if (index === fromIndex) return Math.min(targetIndex, items.length - 1) + 1;
    if (fromIndex < targetIndex && index > fromIndex && index <= targetIndex) return index;
    if (fromIndex > targetIndex && index >= targetIndex && index < fromIndex) return index + 2;
    return index + 1;
  }, [drag, items.length]);
  const didDrag = useCallback(() => dragOccurredRef.current, []);

  return {
    gripProps,
    cardProps,
    floatingLayer,
    isDragging: !!drag?.active,
    displayNumber,
    didDrag,
  };
}

/** Pure array transform. Returns the same reference when from === to so callers
 *  can detect "no change" cheaply (`if (next === items) return`). */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return items as T[];
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Given pointer Y in viewport coords, the cached card rects, and the index
 *  the user is currently dragging, returns the slot index where a drop would land
 *  when passed to `reorder(items, draggedIndex, target)`. Returns 0..rects.length-1.
 *
 *  The caller's reorder semantics use splice: items at draggedIndex are removed
 *  first, then re-inserted at `target`. So "drop above visual card i" maps to
 *  target i when i <= draggedIndex, and target i-1 when i > draggedIndex
 *  (because removing the dragged card shifts subsequent indices down by one). */
export function computeTargetIndex(
  pointerY: number,
  rects: readonly Pick<DOMRect, 'top' | 'bottom'>[],
  draggedIndex: number,
): number {
  for (let i = 0; i < rects.length; i++) {
    const midpoint = (rects[i]!.top + rects[i]!.bottom) / 2;
    if (pointerY < midpoint) {
      if (i === draggedIndex) return draggedIndex; // hovering own slot → no-op
      if (i > draggedIndex) return i - 1;
      return i;
    }
  }
  // Past every midpoint — drop at end. After splice removal, last index is length-1.
  return rects.length - 1;
}

const SCROLL_TRIGGER_PX = 50;
const SCROLL_MAX_PER_FRAME = 12;

/** Auto-scroll pixels-per-frame for a drag in flight. Negative = scroll up,
 *  positive = scroll down, 0 = no scroll. Ramps from 0 to ±SCROLL_MAX_PER_FRAME
 *  as the pointer enters the trigger zone near each edge. */
export function clampScrollDelta(pointerY: number, viewportHeight: number): number {
  if (pointerY < SCROLL_TRIGGER_PX) {
    const ratio = (SCROLL_TRIGGER_PX - pointerY) / SCROLL_TRIGGER_PX;
    return -Math.round(SCROLL_MAX_PER_FRAME * ratio);
  }
  const bottomBoundary = viewportHeight - SCROLL_TRIGGER_PX;
  if (pointerY > bottomBoundary) {
    const ratio = (pointerY - bottomBoundary) / SCROLL_TRIGGER_PX;
    return Math.round(SCROLL_MAX_PER_FRAME * Math.min(ratio, 1));
  }
  return 0;
}
