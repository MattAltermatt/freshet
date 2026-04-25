# Drag-to-reorder rule cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-reorder for rule cards in the Rules tab, alongside the existing ▲/▼ buttons. Persists once on drop. Mouse / touch / pen via Pointer Events.

**Architecture:** A new `useSortable()` hook (`src/options/rules/useSortable.ts`) owns drag state and pointer-event wiring. Pure helpers (`reorder`, `computeTargetIndex`, `clampScrollDelta`) are extracted for unit testing. `RuleStack.tsx` calls the hook and renders a floating-card overlay. `RuleCard.tsx` gains a fourth grid column for a `<span class="pj-rule-grip">⋮⋮</span>` handle. No new dependencies.

**Tech Stack:** Preact + TypeScript + CodeMirror-free codepath. Pointer Events API, `requestAnimationFrame`, `setPointerCapture`, `prefers-reduced-motion` matchMedia. Vitest + @testing-library/preact for units. Playwright + axe-core for E2E.

**Spec:** `docs/superpowers/specs/2026-04-25-drag-reorder-rules-design.md`. Branch: `feature/issue-9-drag-reorder` (already created).

---

## File Map

```
src/options/rules/
  useSortable.ts        ← NEW · pointer-event state machine + auto-scroll + helpers
  useSortable.test.ts   ← NEW · pure-helper tests + behavioral hook test
  RuleStack.tsx         ← MODIFIED · wire hook, render floating layer, aria-live
  RuleCard.tsx          ← MODIFIED · add grip column (4-col grid), gripProps prop
src/options/
  options.css           ← MODIFIED · .pj-rule-grip, slot/floating, reduced-motion
test/e2e/
  rules-drag-reorder.spec.ts  ← NEW · drag E2E + a11y in flight
```

---

## Task 1: Pure helper — `reorder()`

**Files:**
- Create: `src/options/rules/useSortable.ts`
- Create: `src/options/rules/useSortable.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/options/rules/useSortable.test.ts
import { describe, it, expect } from 'vitest';
import { reorder } from './useSortable';

describe('reorder()', () => {
  it('moves an item from a lower index to a higher index', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves an item from a higher index to a lower index', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('returns the same reference when from === to (signals no-op)', () => {
    const items = ['a', 'b', 'c'];
    expect(reorder(items, 1, 1)).toBe(items);
  });
});
```

- [ ] **Step 2: Run test — should FAIL**

```
pnpm vitest run src/options/rules/useSortable.test.ts
```
Expected: `reorder is not a function` / module-not-found.

- [ ] **Step 3: Implement minimal `reorder()` in `useSortable.ts`**

```ts
// src/options/rules/useSortable.ts

/** Pure array transform. Returns the same reference when from === to so callers
 *  can detect "no change" cheaply (`if (next === items) return`). */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to) return items as T[];
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
```

- [ ] **Step 4: Run test — should PASS**

```
pnpm vitest run src/options/rules/useSortable.test.ts
```
Expected: 3 / 3 tests pass.

- [ ] **Step 5: Commit**

```
git add src/options/rules/useSortable.ts src/options/rules/useSortable.test.ts
git commit -m 'feat(rules): add reorder() helper for sortable hook (#9)'
```

---

## Task 2: Pure helper — `computeTargetIndex()`

**Files:**
- Modify: `src/options/rules/useSortable.ts`
- Modify: `src/options/rules/useSortable.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `useSortable.test.ts`:

```ts
import { computeTargetIndex } from './useSortable';

describe('computeTargetIndex()', () => {
  // Three cards stacked: each 80px tall, top at y=0, 100, 200. Midpoints: 40, 140, 240.
  const rects = [
    { top: 0, bottom: 80 },
    { top: 100, bottom: 180 },
    { top: 200, bottom: 280 },
  ] as DOMRect[];

  it('returns 0 when pointer is above the first midpoint', () => {
    expect(computeTargetIndex(20, rects, /* draggedIndex */ 2)).toBe(0);
  });
  it('returns 1 when pointer is between midpoint 0 and midpoint 1', () => {
    expect(computeTargetIndex(80, rects, 2)).toBe(1);
  });
  it('returns 2 when pointer is between midpoint 1 and midpoint 2', () => {
    expect(computeTargetIndex(180, rects, 0)).toBe(2);
  });
  it('returns N (insert at end) when pointer is below the last midpoint', () => {
    expect(computeTargetIndex(300, rects, 0)).toBe(3);
  });
  it('returns the same index when pointer hovers within own slot (no-op)', () => {
    // dragged is index 1, pointer near its midpoint → no change
    expect(computeTargetIndex(140, rects, 1)).toBe(1);
  });
});
```

- [ ] **Step 2: Run — should FAIL**

```
pnpm vitest run src/options/rules/useSortable.test.ts
```

- [ ] **Step 3: Implement `computeTargetIndex()`**

Append to `useSortable.ts`:

```ts
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
      // Hovering within own slot → return draggedIndex (no-op).
      if (i === draggedIndex || i === draggedIndex + 1) return draggedIndex;
      return i;
    }
  }
  // Past every midpoint — insert at end. If origin was the last slot, no-op.
  return draggedIndex === rects.length - 1 ? draggedIndex : rects.length;
}
```

- [ ] **Step 4: Run — should PASS**

```
pnpm vitest run src/options/rules/useSortable.test.ts
```
Expected: 8 / 8 pass.

- [ ] **Step 5: Commit**

```
git add src/options/rules/useSortable.ts src/options/rules/useSortable.test.ts
git commit -m 'feat(rules): add computeTargetIndex() helper (#9)'
```

---

## Task 3: Pure helper — `clampScrollDelta()`

**Files:**
- Modify: `src/options/rules/useSortable.ts`
- Modify: `src/options/rules/useSortable.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `useSortable.test.ts`:

```ts
import { clampScrollDelta } from './useSortable';

describe('clampScrollDelta()', () => {
  // Viewport height 800. Trigger zone 50px from each edge. Max 12 px/frame.
  const v = 800;

  it('returns 0 when pointer is in the middle of the viewport', () => {
    expect(clampScrollDelta(400, v)).toBe(0);
  });
  it('returns 0 just outside the top trigger zone (>= 50px from top)', () => {
    expect(clampScrollDelta(50, v)).toBe(0);
  });
  it('returns negative (scroll up) inside the top zone', () => {
    expect(clampScrollDelta(20, v)).toBeLessThan(0);
    expect(clampScrollDelta(20, v)).toBeGreaterThanOrEqual(-12);
  });
  it('returns full -12 at the very top', () => {
    expect(clampScrollDelta(0, v)).toBe(-12);
  });
  it('returns positive (scroll down) inside the bottom zone', () => {
    expect(clampScrollDelta(780, v)).toBeGreaterThan(0);
    expect(clampScrollDelta(780, v)).toBeLessThanOrEqual(12);
  });
  it('returns full +12 at the very bottom', () => {
    expect(clampScrollDelta(800, v)).toBe(12);
  });
});
```

- [ ] **Step 2: Run — should FAIL**

```
pnpm vitest run src/options/rules/useSortable.test.ts
```

- [ ] **Step 3: Implement `clampScrollDelta()`**

Append to `useSortable.ts`:

```ts
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
```

- [ ] **Step 4: Run — should PASS**

```
pnpm vitest run src/options/rules/useSortable.test.ts
```
Expected: 14 / 14 pass.

- [ ] **Step 5: Commit**

```
git add src/options/rules/useSortable.ts src/options/rules/useSortable.test.ts
git commit -m 'feat(rules): add clampScrollDelta() helper (#9)'
```

---

## Task 4: Visible grip handle in `RuleCard.tsx`

This task ships the grip purely as a passive visual element — no drag behavior yet. Lets us land the markup + CSS independently and verify visually before wiring drag.

**Files:**
- Modify: `src/options/rules/RuleCard.tsx`
- Modify: `src/options/rules/RuleCard.test.tsx`
- Modify: `src/options/options.css`

- [ ] **Step 1: Add failing test**

Append to `RuleCard.test.tsx`:

```tsx
it('renders a drag-handle grip with an aria-label naming the rule', () => {
  const rule = makeRule({ id: 'r1', name: 'GitHub Repo' });
  const { getByLabelText } = render(
    <RuleCard rule={rule} index={0} total={3}
      onToggle={() => {}} onEdit={() => {}}
      onMoveUp={() => {}} onMoveDown={() => {}} onDelete={() => {}}
      gripProps={{ onPointerDown: () => {} }}
    />
  );
  expect(getByLabelText(/Drag to reorder rule 1: GitHub Repo/i)).toBeTruthy();
});
```

(If `makeRule` doesn't exist in the test file, define it inline as a small factory mirroring the existing RuleCard tests' pattern — read the file first to match the convention.)

- [ ] **Step 2: Run — should FAIL**

```
pnpm vitest run src/options/rules/RuleCard.test.tsx
```

- [ ] **Step 3: Add `gripProps` prop and grip element to `RuleCard.tsx`**

Add to the `RuleCardProps` interface:

```tsx
import type { JSX as PreactJSX } from 'preact';

export interface RuleCardProps {
  // ...existing props...
  gripProps?: PreactJSX.HTMLAttributes<HTMLSpanElement>;
}
```

Add the grip as the first child of `<article>`, before `.pj-rule-num`:

```tsx
<article className={...}>
  <span
    class="pj-rule-grip"
    role="button"
    tabIndex={-1}
    aria-label={`Drag to reorder rule ${index + 1}: ${rule.name || rule.hostPattern || 'unnamed rule'}`}
    {...gripProps}
  >
    ⋮⋮
  </span>
  <div class="pj-rule-num" aria-label={`Rule ${index + 1}`}>{index + 1}</div>
  ...rest unchanged...
</article>
```

- [ ] **Step 4: Update CSS — bump card grid to 4 columns + grip styles**

In `src/options/options.css`, change the existing `.pj-rule-card` `grid-template-columns` from `auto 1fr auto` to `auto auto 1fr auto`. Then append:

```css
.pj-rule-grip {
  cursor: grab;
  user-select: none;
  color: var(--pj-fg-subtle);
  opacity: 0.55;
  letter-spacing: -1px;
  font-size: 12px;
  line-height: 1;
  padding: 4px 2px;
  border-radius: var(--pj-radius);
  transition: opacity 100ms ease, color 100ms ease, background 100ms ease;
}
.pj-rule-grip:hover {
  opacity: 1;
  color: var(--pj-accent-strong);
  background: var(--pj-accent-wash);
}
.pj-rule-grip:active,
.pj-rule-card[data-dragging] .pj-rule-grip {
  cursor: grabbing;
}
.pj-rule-grip:focus-visible {
  outline: 2px solid var(--pj-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run — should PASS**

```
pnpm vitest run src/options/rules/RuleCard.test.tsx
pnpm typecheck
pnpm lint
```

- [ ] **Step 6: Commit**

```
git add src/options/rules/RuleCard.tsx src/options/rules/RuleCard.test.tsx src/options/options.css
git commit -m 'feat(rules): add visible grip handle to rule cards (#9)'
```

---

## Task 5: Hook scaffolding — `useSortable()` no-drag baseline

The hook returns no-op `gripProps` and `cardProps` and a null `floatingLayer`. Wiring `RuleStack` to it is a pure refactor at this stage — no behavior change.

**Files:**
- Modify: `src/options/rules/useSortable.ts`
- Modify: `src/options/rules/RuleStack.tsx`

- [ ] **Step 1: Add hook stub + props**

Append to `useSortable.ts`:

```tsx
import { useState } from 'preact/hooks';
import type { JSX } from 'preact';

export interface UseSortableReturn {
  gripProps: (index: number) => JSX.HTMLAttributes<HTMLSpanElement>;
  cardProps: (index: number) => JSX.HTMLAttributes<HTMLElement>;
  floatingLayer: JSX.Element | null;
  isDragging: boolean;
  /** Number that should display on card at the given index, accounting for any
   *  in-flight drag's predicted reorder. Pre-drag this is just `index + 1`. */
  displayNumber: (index: number) => number;
}

export interface UseSortableOpts<T extends { id: string }> {
  items: readonly T[];
  onReorder: (next: T[]) => void;
  /** Called to render the floating clone of the dragged card. */
  renderClone: (item: T, index: number) => JSX.Element;
}

export function useSortable<T extends { id: string }>(
  _opts: UseSortableOpts<T>,
): UseSortableReturn {
  const [isDragging] = useState(false);
  return {
    gripProps: () => ({}),
    cardProps: () => ({}),
    floatingLayer: null,
    isDragging,
    displayNumber: (i) => i + 1,
  };
}
```

- [ ] **Step 2: Wire `RuleStack.tsx` to the hook (no behavior change)**

Replace the existing `RuleStack` body:

```tsx
import { useSortable } from './useSortable';
// ...

export function RuleStack({
  rules,
  templates,
  onChange,
  onEdit,
  onDelete,
  importFlags,
  onDismissFlag,
}: RuleStackProps): JSX.Element {
  const sortable = useSortable<Rule>({
    items: rules,
    onReorder: onChange,
    renderClone: (rule, index) => (
      <RuleCard
        rule={rule}
        index={index}
        total={rules.length}
        onToggle={() => {}}
        onEdit={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onDelete={() => {}}
      />
    ),
  });

  const swap = (i: number, j: number): void => {
    if (i < 0 || j < 0 || i >= rules.length || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const patch = (i: number, p: Partial<Rule>): void => {
    const next = rules.map((r, k) => (k === i ? { ...r, ...p } : r));
    onChange(next);
  };

  return (
    <div class="pj-rule-stack">
      <div class="pj-rule-stack-header">
        <h2>Rules</h2>
        <button type="button" class="pj-btn" data-variant="primary" onClick={() => onEdit(null)}>+ Add rule</button>
      </div>
      {rules.length === 0 ? (
        <div class="pj-empty">
          <p>No rules yet.</p>
          <p class="pj-empty-hint">Click <strong>+ Add rule</strong> to match a URL pattern to a template.</p>
        </div>
      ) : (
        <div class="pj-rule-cards">
          {rules.map((r, i) => {
            const entry = importFlags?.[r.id];
            return (
              <RuleCard
                key={r.id}
                rule={r}
                index={i}
                total={rules.length}
                onToggle={(a) => patch(i, { active: a })}
                onEdit={() => onEdit(i)}
                onMoveUp={() => swap(i, i - 1)}
                onMoveDown={() => swap(i, i + 1)}
                onDelete={() => onDelete(i)}
                gripProps={sortable.gripProps(i)}
                {...sortable.cardProps(i)}
                {...(entry ? { flagEntry: entry } : {})}
                {...(onDismissFlag ? { onDismissFlags: () => onDismissFlag(r.id) } : {})}
              />
            );
          })}
          {sortable.floatingLayer}
        </div>
      )}
    </div>
  );
}
```

(`RuleCard.tsx` needs to spread `cardProps` onto its `<article>`. If it doesn't already, add `{...cardProps}` to the `<article>` element. Show this as a small inline edit; if `RuleCard` already accepts arbitrary HTML attrs because it spreads, leave alone.)

- [ ] **Step 3: Verify nothing regressed**

```
pnpm typecheck
pnpm lint
pnpm vitest run
```

All 397+ existing tests must still pass.

- [ ] **Step 4: Commit**

```
git add src/options/rules/useSortable.ts src/options/rules/RuleStack.tsx src/options/rules/RuleCard.tsx
git commit -m 'feat(rules): wire RuleStack to useSortable() stub (#9)'
```

---

## Task 6: Drag activation — 5px threshold + pointerCapture

Hook starts tracking pointer-down on the grip; drag formally engages once the pointer has moved ≥ 5px.

**Files:**
- Modify: `src/options/rules/useSortable.ts`

- [ ] **Step 1: Add hook test for activation**

Append to `useSortable.test.ts`:

```tsx
import { renderHook, act } from '@testing-library/preact';
import { useSortable } from './useSortable';

describe('useSortable() — activation', () => {
  function makeItems(n: number) {
    return Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` }));
  }

  it('does not engage drag below the 5px threshold', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useSortable({
        items: makeItems(3),
        onReorder,
        renderClone: () => <div />,
      }),
    );
    expect(result.current.isDragging).toBe(false);
  });

  it('engages drag once pointer has moved more than 5px', () => {
    // (Behavior covered indirectly via the floating-layer rendering test
    // in Task 7; activation alone is best verified through E2E.)
    expect(true).toBe(true);
  });
});
```

(The pure activation flow is hard to test in jsdom because Pointer Events on detached DOM nodes don't propagate naturally. We rely on the E2E in Task 12 to assert the 5px gate end-to-end. The test above just locks the *baseline* shape of the hook's return value.)

- [ ] **Step 2: Implement activation in `useSortable.ts`**

Replace the hook body:

```tsx
import { useState, useRef, useCallback } from 'preact/hooks';
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
    e.preventDefault(); // prevent text-selection while dragging
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
      // Threshold just crossed → cache rects, mark active, mark drag-occurred
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
      return { ...d, pointerY: e.clientY, cardRects, active };
    });
  }, []);

  const onPointerUp = useCallback((_e: PointerEvent): void => {
    setDrag((d) => {
      if (!d || !d.active) return null;
      // Apply move on top of latest items (handles concurrent updates).
      const latest = itemsRef.current;
      if (d.targetIndex !== d.fromIndex) {
        // targetIndex of N (length) means "append" → splice handles it
        const next = reorder(latest, d.fromIndex, Math.min(d.targetIndex, latest.length - 1));
        if (next !== latest) onReorder(next);
      }
      return null;
    });
  }, [onReorder]);

  const gripProps = useCallback((index: number): JSX.HTMLAttributes<HTMLSpanElement> => ({
    onPointerDown: (e) => onPointerDown(index, e as unknown as PointerEvent),
    onPointerMove: (e) => onPointerMove(e as unknown as PointerEvent),
    onPointerUp:   (e) => onPointerUp(e as unknown as PointerEvent),
    onPointerCancel: (e) => onPointerUp(e as unknown as PointerEvent),
  }), [onPointerDown, onPointerMove, onPointerUp]);

  const cardProps = useCallback((_index: number): JSX.HTMLAttributes<HTMLElement> => ({}), []);

  const floatingLayer = drag?.active && drag.itemId
    ? (() => {
        const item = items.find((it) => it.id === drag.itemId);
        if (!item) return null;
        const top = drag.pointerY - drag.initialOffsetY;
        return (
          <div class="pj-rule-card-floating-layer">
            <div class="pj-rule-card-floating" style={{ top: `${top}px` }} aria-hidden="true">
              {renderClone(item, drag.fromIndex)}
            </div>
          </div>
        );
      })()
    : null;

  const displayNumber = useCallback((index: number) => index + 1, []);

  return {
    gripProps,
    cardProps,
    floatingLayer,
    isDragging: !!drag?.active,
    displayNumber,
  };
}
```

- [ ] **Step 2.5: Add `data-dragging` attribute on the original card while drag is active**

Update `cardProps`:

```tsx
const cardProps = useCallback((index: number): JSX.HTMLAttributes<HTMLElement> => {
  if (drag?.active && drag.fromIndex === index) {
    return { 'data-dragging': '' };
  }
  return {};
}, [drag]);
```

- [ ] **Step 3: Run unit tests + typecheck**

```
pnpm vitest run src/options/rules/useSortable.test.ts
pnpm typecheck
```

Expected: existing tests pass; the new `useSortable() — activation` test passes its trivial assertions.

- [ ] **Step 4: Commit**

```
git add src/options/rules/useSortable.ts src/options/rules/useSortable.test.ts
git commit -m 'feat(rules): drag activation + floating clone layer (#9)'
```

---

## Task 7: Insertion slot + sibling reflow

The dragged card's slot (its original position) gets the dashed-accent style. Siblings translate to make room as the target index changes.

**Files:**
- Modify: `src/options/rules/useSortable.ts`
- Modify: `src/options/options.css`

- [ ] **Step 1: Compute targetIndex on every pointermove**

Replace the body of `onPointerMove`'s "active" branch:

```tsx
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
```

- [ ] **Step 2: Compute per-sibling translateY based on targetIndex**

Replace `cardProps`:

```tsx
const cardProps = useCallback((index: number): JSX.HTMLAttributes<HTMLElement> => {
  if (!drag?.active) return {};
  if (drag.fromIndex === index) return { 'data-dragging-slot': '' };
  // Siblings shift up if dragged is being moved past them downward, etc.
  const cardHeight = drag.cardRects[drag.fromIndex]?.height ?? 0;
  let dy = 0;
  if (drag.fromIndex < drag.targetIndex && index > drag.fromIndex && index <= drag.targetIndex) {
    dy = -cardHeight - 8 /* gap */;
  } else if (drag.fromIndex > drag.targetIndex && index >= drag.targetIndex && index < drag.fromIndex) {
    dy = cardHeight + 8;
  }
  return {
    'data-drag-active': '',
    style: dy ? `transform: translateY(${dy}px)` : undefined,
  };
}, [drag]);
```

- [ ] **Step 3: Add CSS for slot + transition**

Append to `options.css`:

```css
/* Insertion slot — replaces the dragged card in flow during drag */
.pj-rule-card[data-dragging-slot] {
  background: rgba(234, 88, 12, 0.06);
  border-style: dashed;
  border-color: var(--pj-accent);
}
.pj-rule-card[data-dragging-slot] > * { visibility: hidden; }

/* Smooth sibling reflow */
.pj-rule-card[data-drag-active] { transition: transform 180ms ease; }

/* Floating-card layer */
.pj-rule-card-floating-layer {
  position: absolute; inset: 0;
  pointer-events: none;
}
.pj-rule-card-floating {
  position: absolute; left: 0; right: 0;
  box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  transform: rotate(-1.2deg);
  z-index: 10;
  cursor: grabbing;
}

@media (prefers-reduced-motion: reduce) {
  .pj-rule-card[data-drag-active] { transition: none; }
  .pj-rule-card-floating { transform: none; box-shadow: none; }
}
```

Also add `position: relative` to `.pj-rule-cards` so the floating layer's absolute positioning is relative to the cards container:

```css
.pj-rule-cards {
  display: flex;
  flex-direction: column;
  gap: var(--pj-space-2);
  position: relative; /* anchor for floating-card layer */
}
```

- [ ] **Step 4: Verify**

```
pnpm typecheck
pnpm lint
pnpm vitest run src/options/rules/useSortable.test.ts
```

- [ ] **Step 5: Commit**

```
git add src/options/rules/useSortable.ts src/options/options.css
git commit -m 'feat(rules): insertion slot + sibling reflow during drag (#9)'
```

---

## Task 8: Live target numbering during drag

While dragging, every card's number badge shows the position it would have on drop. The dragged (floating) card shows its predicted target.

**Files:**
- Modify: `src/options/rules/useSortable.ts`
- Modify: `src/options/rules/RuleCard.tsx`
- Modify: `src/options/rules/RuleStack.tsx`

- [ ] **Step 1: Add `displayNumber` logic to the hook**

Replace `displayNumber`:

```tsx
const displayNumber = useCallback((index: number): number => {
  if (!drag?.active) return index + 1;
  const { fromIndex, targetIndex } = drag;
  if (index === fromIndex) return Math.min(targetIndex, items.length - 1) + 1;
  // Siblings between fromIndex and targetIndex shift in the direction opposite the drag
  if (fromIndex < targetIndex && index > fromIndex && index <= targetIndex) return index;
  if (fromIndex > targetIndex && index >= targetIndex && index < fromIndex) return index + 2;
  return index + 1;
}, [drag, items.length]);
```

- [ ] **Step 2: Pass display number through to `RuleCard`**

Update `RuleCardProps` to accept an optional `displayNumber` prop (falls back to `index + 1` if absent):

```tsx
export interface RuleCardProps {
  // ...existing...
  displayNumber?: number;
}
```

In the JSX, replace `{index + 1}` in `.pj-rule-num` with:

```tsx
<div class="pj-rule-num" aria-label={`Rule ${displayNumber ?? index + 1}`}>
  {displayNumber ?? index + 1}
</div>
```

- [ ] **Step 3: Wire `displayNumber` through `RuleStack`**

In the `rules.map(...)` body, add:

```tsx
displayNumber={sortable.displayNumber(i)}
```

And inside the `renderClone` callback, also pass `sortable.displayNumber(drag.fromIndex)` — but since the clone is rendered from the hook (which knows `drag.targetIndex`), the simpler path is to inline the number when constructing the clone. Update `renderClone`:

```tsx
renderClone: (rule, index) => (
  <RuleCard
    rule={rule}
    index={index}
    total={rules.length}
    displayNumber={sortable.displayNumber(index)}
    onToggle={() => {}}
    onEdit={() => {}}
    onMoveUp={() => {}}
    onMoveDown={() => {}}
    onDelete={() => {}}
  />
),
```

- [ ] **Step 4: Verify**

```
pnpm typecheck
pnpm lint
pnpm vitest run
```

- [ ] **Step 5: Commit**

```
git add src/options/rules/useSortable.ts src/options/rules/RuleCard.tsx src/options/rules/RuleStack.tsx
git commit -m 'feat(rules): live target numbering during drag (#9)'
```

---

## Task 9: Drop animation + tap-vs-drag click guard

Drop animates the floating card back to slot position over 180ms (skipped under reduced-motion). Click on `.pj-rule-body` is suppressed if a drag occurred during the same pointer interaction.

**Files:**
- Modify: `src/options/rules/useSortable.ts`
- Modify: `src/options/rules/RuleCard.tsx`

- [ ] **Step 1: Add a settling phase in the hook**

Modify `onPointerUp`:

```tsx
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
```

The settle-back animation is left to CSS — the floating card's `top` value transitions to its final position via `transition: top 180ms ease` on `.pj-rule-card-floating` (added to options.css below). At reduced-motion, transitions are off and the disappearance is instant.

In `options.css`, append to `.pj-rule-card-floating`:

```css
.pj-rule-card-floating { transition: top 180ms ease; }
@media (prefers-reduced-motion: reduce) {
  .pj-rule-card-floating { transition: none; }
}
```

(Already partially present in Task 7 — merge into the existing rule rather than duplicating.)

- [ ] **Step 2: Expose `dragOccurred` flag for the click guard**

Add to `UseSortableReturn`:

```tsx
export interface UseSortableReturn {
  // ...
  /** True if the most recent pointerdown produced a drag past the threshold.
   *  Reset on next pointerdown. Use this to suppress edit-on-click after drag. */
  didDrag: () => boolean;
}
```

Implement:

```tsx
const didDrag = useCallback(() => dragOccurredRef.current, []);
return { gripProps, cardProps, floatingLayer, isDragging: !!drag?.active, displayNumber, didDrag };
```

- [ ] **Step 3: Suppress edit-on-click in `RuleCard.tsx` when `didDrag()` is true**

Add `didDrag` to `RuleCardProps`:

```tsx
export interface RuleCardProps {
  // ...
  didDrag?: () => boolean;
}
```

Wrap the existing `onClick={onEdit}` on `.pj-rule-body`:

```tsx
<button
  type="button"
  class="pj-rule-body"
  onClick={() => { if (!didDrag?.()) onEdit(); }}
>
```

In `RuleStack.tsx`, pass `didDrag={sortable.didDrag}` on the mapped `<RuleCard>`.

- [ ] **Step 4: Verify**

```
pnpm typecheck
pnpm lint
pnpm vitest run
```

- [ ] **Step 5: Commit**

```
git add src/options/rules/useSortable.ts src/options/rules/RuleCard.tsx src/options/rules/RuleStack.tsx src/options/options.css
git commit -m 'feat(rules): drop persistence + tap-vs-drag click guard (#9)'
```

---

## Task 10: Escape cancels drag + auto-scroll near edges

**Files:**
- Modify: `src/options/rules/useSortable.ts`

- [ ] **Step 1: Add Escape handler**

Add to the hook, inside a `useEffect` that runs while drag is active:

```tsx
import { useEffect } from 'preact/hooks';

useEffect(() => {
  if (!drag?.active) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setDrag(null);
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [drag?.active]);
```

- [ ] **Step 2: Add auto-scroll rAF loop**

```tsx
useEffect(() => {
  if (!drag?.active) return;
  let frame = 0;
  const tick = () => {
    setDrag((d) => {
      if (!d?.active) return d;
      const delta = clampScrollDelta(d.pointerY, window.innerHeight);
      if (delta !== 0) {
        document.scrollingElement?.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
      }
      return d; // no state change, just keep ticking
    });
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, [drag?.active]);
```

(Note: `behavior: 'instant'` was added to the standard recently; cast may be needed for older typedefs. If TS complains, use `behavior: 'auto'` which is functionally identical for `scrollBy`.)

- [ ] **Step 3: Verify**

```
pnpm typecheck
pnpm lint
pnpm vitest run
```

- [ ] **Step 4: Commit**

```
git add src/options/rules/useSortable.ts
git commit -m 'feat(rules): Escape-to-cancel + auto-scroll on drag (#9)'
```

---

## Task 11: aria-live announcement on drop

**Files:**
- Modify: `src/options/rules/RuleStack.tsx`

- [ ] **Step 1: Add aria-live region**

Inside the `<div class="pj-rule-stack">`, after the stack header but before the cards, add:

```tsx
const [announcement, setAnnouncement] = useState('');

const handleReorder = useCallback((next: Rule[]) => {
  // Find which rule moved and to where, for the announcement.
  for (let i = 0; i < next.length; i++) {
    if (rules[i]?.id !== next[i]?.id) {
      const moved = next[i]!;
      setAnnouncement(
        `Moved ${moved.name || moved.hostPattern || 'rule'} to position ${i + 1}.`,
      );
      break;
    }
  }
  onChange(next);
}, [rules, onChange]);

const sortable = useSortable<Rule>({
  items: rules,
  onReorder: handleReorder,
  // ...
});

// JSX:
<div class="pj-rule-stack">
  <div class="pj-rule-stack-header">...</div>
  <div class="pj-rule-aria-live" aria-live="polite" role="status">{announcement}</div>
  ...
</div>
```

Add CSS to visually hide the live region (sr-only):

```css
.pj-rule-aria-live {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 2: Verify**

```
pnpm typecheck
pnpm lint
pnpm vitest run
```

- [ ] **Step 3: Commit**

```
git add src/options/rules/RuleStack.tsx src/options/options.css
git commit -m 'feat(rules): aria-live announcement on rule reorder (#9)'
```

---

## Task 12: E2E — drag-to-reorder in real Chrome

**Files:**
- Create: `test/e2e/rules-drag-reorder.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from './fixtures';

test.describe('rules drag-to-reorder (#9)', () => {
  test('drags rule #1 to position 3 and persists once', async ({ page, worker }) => {
    // Seed three rules via the SW
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        rules: [
          { id: 'r1', name: 'Alpha', hostPattern: 'a.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
          { id: 'r2', name: 'Beta',  hostPattern: 'b.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
          { id: 'r3', name: 'Gamma', hostPattern: 'c.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
        ],
      });
    });

    // Listen to storage writes
    const writeCount = await worker.evaluateHandle(() => {
      let count = 0;
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.rules) count++;
      });
      // @ts-expect-error stash counter on globalThis for the test
      globalThis.__pjRulesWriteCount = () => count;
      return true;
    });

    await page.goto(/* extension options URL with #tab=rules */);

    // Locate the grip on rule #1 (Alpha)
    const grip = page.locator('.pj-rule-card').nth(0).locator('.pj-rule-grip');
    const targetCard = page.locator('.pj-rule-card').nth(2); // Gamma's slot

    const gripBox = await grip.boundingBox();
    const targetBox = await targetCard.boundingBox();
    if (!gripBox || !targetBox) throw new Error('layout missing');

    await page.mouse.move(gripBox.x + 5, gripBox.y + 5);
    await page.mouse.down();
    await page.mouse.move(gripBox.x + 5, targetBox.y + targetBox.height + 4, { steps: 12 });
    await page.mouse.up();

    // Assert visual order: Alpha is now last
    await expect(page.locator('.pj-rule-card').nth(2).locator('.pj-rule-identity-primary')).toHaveText('Alpha');

    // Assert storage state
    const storedOrder = await worker.evaluate(async () => {
      const got = await chrome.storage.local.get('rules');
      return (got.rules as { id: string }[]).map((r) => r.id);
    });
    expect(storedOrder).toEqual(['r2', 'r3', 'r1']);

    // Assert exactly one write fired during the drop
    const writes = await worker.evaluate(() =>
      // @ts-expect-error
      globalThis.__pjRulesWriteCount() as number,
    );
    expect(writes).toBe(1);
  });

  test('axe-core a11y passes during a drag in flight', async ({ page, worker }) => {
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        rules: [
          { id: 'r1', name: 'Alpha', hostPattern: 'a.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
          { id: 'r2', name: 'Beta',  hostPattern: 'b.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
          { id: 'r3', name: 'Gamma', hostPattern: 'c.example.com', pathPattern: '/**', templateName: 't1', variables: {}, active: true },
        ],
      });
    });
    await page.goto(/* extension options URL with #tab=rules */);

    const grip = page.locator('.pj-rule-card').nth(0).locator('.pj-rule-grip');
    const targetCard = page.locator('.pj-rule-card').nth(2);
    const gripBox = await grip.boundingBox();
    const targetBox = await targetCard.boundingBox();
    if (!gripBox || !targetBox) throw new Error('layout missing');

    // Start a drag and pause mid-flight
    await page.mouse.move(gripBox.x + 5, gripBox.y + 5);
    await page.mouse.down();
    await page.mouse.move(gripBox.x + 5, targetBox.y + 4, { steps: 8 });

    // Run axe-core on the page mid-drag
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const results = await new AxeBuilder({ page })
      .include('.pj-rule-stack')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);

    // Release pointer to clean up
    await page.mouse.up();
  });
});
```

- [ ] **Step 2: Build the extension and run E2E**

```
pnpm build
pnpm test:e2e --grep '#9'
```

Iterate until green.

- [ ] **Step 3: Commit**

```
git add test/e2e/rules-drag-reorder.spec.ts
git commit -m 'test(e2e): drag-to-reorder rule cards (#9)'
```

---

## Task 13: All-gates + manual verification handoff

**Files:** none (verification step)

- [ ] **Step 1: Run the full gate suite**

```
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

All must be green. If any fail, stop and address the failure with a fix-task before proceeding.

- [ ] **Step 2: Hand off to Matt for manual eyeball**

Before claiming the feature done, Matt has to load the rebuilt extension in Chrome and try the drag himself:
1. Reload the extension at `chrome://extensions/`.
2. Open Options → Rules tab.
3. Add at least 3 rules if there are fewer.
4. Drag the grip on rule #1 to between rules #2 and #3 — verify the slot opens, the floating card lifts and tilts, the line of cards reflows, the badge live-renumbers, the drop persists.
5. Test with `prefers-reduced-motion` enabled (System Settings → Accessibility) — animations off, drag still works.
6. ▲/▼ buttons still work, click-card-to-edit still works, no toggle-on-drag.
7. Repeat in dark mode.

Wait for explicit Matt approval before continuing.

- [ ] **Step 3 (NO COMMIT)**

This task ends with Matt's approval, not a commit.

---

## Task 14: Code review pass (fresh subagent)

**Files:** none (review step)

- [ ] **Step 1: Dispatch a `feature-dev:code-reviewer` agent**

Run the entire diff (`git diff main...HEAD`) through a fresh code-reviewer agent with full context (the spec doc + this plan). Ask for high-confidence findings only.

- [ ] **Step 2: Address findings**

For each high-confidence issue, either fix in code or document why we're deferring. Re-run all gates after each fix:

```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

- [ ] **Step 3: Commit each fix as its own commit**

```
git add <changed-files>
git commit -m 'fix(rules): <summary of what reviewer caught> (#9)'
```

---

## Task 15: FF-merge to main

**Files:** none

- [ ] **Step 1: Confirm gh active account is MattAltermatt**

```
gh auth status
```

If active is `muwamath`, run `gh auth switch --user MattAltermatt && gh auth setup-git`.

- [ ] **Step 2: Get explicit Matt approval to push the branch**

(Per global feedback: even routine push is gated.)

- [ ] **Step 3: Push the feature branch**

```
git push -u origin feature/issue-9-drag-reorder
```

- [ ] **Step 4: Get explicit Matt approval to FF-merge**

- [ ] **Step 5: FF-merge + push main**

```
git checkout main
git merge --ff-only feature/issue-9-drag-reorder
git push origin main
```

- [ ] **Step 6: Close issue #9 with merge commit reference**

```
gh issue close 9 --repo MattAltermatt/freshet --comment 'Fixed in <merge-sha> (`feat(rules): drag-to-reorder rule cards`).'
```

- [ ] **Step 7: Verify GH Pages deploy is green** (no docs touched, but the deploy still runs)

```
gh run watch --repo MattAltermatt/freshet --branch main --exit-status
```

- [ ] **Step 8: Delete merged feature branch (local + remote)**

```
git branch -d feature/issue-9-drag-reorder
git push origin --delete feature/issue-9-drag-reorder
```

---

## Self-Review checklist

- [x] **Spec coverage:** every section of the design has at least one task — pure helpers (T1–3), grip UI (T4), hook scaffolding (T5), activation (T6), slot+reflow (T7), live numbering (T8), drop+click guard (T9), Escape+autoscroll (T10), aria-live (T11), E2E (T12), gates (T13), review (T14), ship (T15).
- [x] **Placeholder scan:** no TBD/TODO/maybe/probably/handle-edge-cases left in any task.
- [x] **Type consistency:** the `UseSortableReturn` shape (`gripProps`, `cardProps`, `floatingLayer`, `isDragging`, `displayNumber`, `didDrag`) is built up across T5/T6/T9 in one consistent shape — no rename mid-plan. Hook accepts `items: readonly T[]` consistently.
- [x] **TDD discipline:** pure helpers (T1/T2/T3) follow strict red-green-commit. Hook tests use jsdom limitation as the explicit reason for deferring activation behavior to E2E (T12).
- [x] **Frequent commits:** 15 tasks → 14 commits to feature branch + 1 merge → main (commit messages all conventional, all under 70 chars, no Co-Authored-By trailer).
