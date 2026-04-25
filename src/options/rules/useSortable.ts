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
 *  the user is currently dragging, returns the slot index where a drop would land.
 *  Returns 0..rects.length (inclusive). Returns `draggedIndex` when the pointer
 *  is inside the card's own slot (no-op drop). */
export function computeTargetIndex(
  pointerY: number,
  rects: readonly Pick<DOMRect, 'top' | 'bottom'>[],
  draggedIndex: number,
): number {
  for (let i = 0; i < rects.length; i++) {
    const midpoint = (rects[i]!.top + rects[i]!.bottom) / 2;
    if (pointerY < midpoint) {
      // Hovering within own slot or its immediate top edge → no-op.
      if (i === draggedIndex || i === draggedIndex + 1) return draggedIndex;
      return i;
    }
  }
  // Past every midpoint — insert at end. If origin was the last slot, no-op.
  return draggedIndex === rects.length - 1 ? draggedIndex : rects.length;
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
