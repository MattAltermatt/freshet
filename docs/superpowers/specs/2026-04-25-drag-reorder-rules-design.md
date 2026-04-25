# Drag-to-reorder rule cards

**Date:** 2026-04-25
**Issue:** [#9](https://github.com/MattAltermatt/freshet/issues/9)
**Milestone:** v1.2.0
**Scope:** UI/UX addition to the Rules tab. No schema changes, no migration. One new hook + one new test file + light edits to two existing components and the options stylesheet.

## 🐌 Problem

Rule order matters — the matcher is first-match-wins (`src/matcher/matcher.ts`) — but reordering today is one-step-at-a-time via the ▲ / ▼ buttons on every card (`src/options/rules/RuleCard.tsx:70-89`). Users with 5+ rules who want to promote a rule from the bottom of the list have to click ▲ four times. There's no way to "grab this rule and put it third."

## 🎯 Goals

1. Drag-to-reorder rule cards in the Rules tab via mouse / touch / pen.
2. Persist on drop with a single `chrome.storage.local.rules` write — no intermediate writes mid-drag.
3. Keep existing ▲ / ▼ buttons. They cover the keyboard a11y story and remain the fastest path for one-position nudges.
4. Respect `prefers-reduced-motion` — drag still functions, polish disappears.
5. Existing axe-core a11y suite continues to pass.

## 🚫 Non-goals

- Cross-tab drag (drag a rule onto a template / onto another tab). Per issue, out of scope.
- Multi-select drag. Per issue, out of scope.
- Replacing ▲ / ▼ buttons. Confirmed during brainstorming (Q1=A) — drag is *additional*, not a replacement.
- Drag-to-reorder for the Templates tab. Templates are name-keyed; ordering carries no semantic.
- Keyboard-operable drag handle (Space-to-lift, arrows-to-move). ▲ / ▼ already covers the keyboard story; adding a parallel keyboard drag flow would double the test surface for zero new capability.

## 🏗 Design

### § 1. Architecture

A new `useSortable()` hook in `src/options/rules/useSortable.ts` owns all drag state and Pointer-Event wiring. It returns:

```ts
interface UseSortableReturn<T> {
  gripProps: (index: number) => GripPointerHandlers;     // spread onto each grip
  cardProps: (index: number) => CardStyleProps;          // spread onto each card root
  floatingLayer: JSX.Element | null;                     // absolutely-positioned overlay
  isDragging: boolean;
}

function useSortable<T extends { id: string }>(opts: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderCard: (item: T, index: number) => JSX.Element;   // for the floating clone
}): UseSortableReturn<T>;
```

`RuleStack.tsx` calls `useSortable({ items: rules, onReorder: onChange, renderCard })`. `RuleCard.tsx` gains a `gripProps` prop and renders a new `<span class="pj-rule-grip" {...gripProps}>⋮⋮</span>` as the first grid column.

**Why a hook, not a component.** Drag state crosses card boundaries — handle inside one `<RuleCard>`, drop targets are siblings, floating layer sits at `RuleStack` level. A hook owned by `RuleStack` is the natural seam.

### § 2. UX details — drag interaction

#### Activation
- Pointer-down on `.pj-rule-grip` starts a *candidate* drag.
- Drag engages only after pointer movement ≥ 5px from start. Below threshold, the gesture is treated as a click. This keeps a stray click on the grip from triggering visual chaos.
- After threshold: floating card appears, `setPointerCapture()` is called on the grip so all subsequent `pointermove` / `pointerup` events route to it (no escape if pointer leaves the card or the editor area).
- Cursor: `grab` at rest on the grip; `grabbing` once dragging.

#### Floating card
- Rendered via portal into a sibling `<div class="pj-rule-card-floating-layer">` inside `.pj-rule-stack`. CSS: `position: absolute; pointer-events: none; will-change: transform;`. Position via `transform: translate(0, ...)` driven by `pointer.clientY - initialPointerOffset`.
- Visual: `box-shadow: 0 12px 28px rgba(0,0,0,0.18); transform: rotate(-1.2deg);` for the lift cue. Z-index above the slot.
- `aria-hidden="true"` on the clone — the original (now slotted out of normal flow) keeps the accessible name.

#### Insertion slot
- The dragged card's original DOM position becomes the slot. Same height, dashed accent border, faint accent-wash background. `transition: transform 180ms ease` on every sibling so they slide aside smoothly.
- Target index recomputes on every `pointermove`, throttled to one update per `requestAnimationFrame`. Target = closest sibling whose vertical midpoint the pointer crossed.
- No actual DOM reorder during drag. Only `transform: translateY()` on siblings to *visually* reflow. The real reorder fires once on drop.

#### Number badges
- **Live target numbering during drag.** As the slot moves, sibling badges update to show the order they'd take if the user dropped now. The dragged (floating) card's badge shows its predicted target number.
- *Why:* the user is actively choosing the new order, so showing it live is honest and removes mental math. Pure text re-render on each sibling — cheap.

#### Drop
- `pointerup` ends drag. Compute final target index, call `onReorder(reorder(items, fromIndex, toIndex))` once.
- Floating card animates a 180ms translate-back to the slot position before unmounting; the slot then becomes the real card again.
- If `prefers-reduced-motion`: no rotate, no shadow lift, no slot-shift transitions, no settle. The drop is instantaneous. Border accent color cue is preserved.

#### Cancel
- `Escape` while dragging cancels — floating card animates back to origin, no `onReorder` fires.

#### Tap-vs-drag disambiguation
- Clicks on `.pj-rule-body` (the existing edit-on-click path) only fire `onEdit` when `dragOccurred === false` for the current pointer interaction. `dragOccurred` flips true once the 5px threshold is crossed, resets on next `pointerdown`. Standard pattern.

### § 3. Auto-scroll, persistence, a11y

#### Auto-scroll
- Active only while a drag is in flight. When the pointer is within 50px of viewport top or bottom, `document.scrollingElement.scrollBy({ top: delta, behavior: 'instant' })` runs each frame in a dedicated rAF loop. `delta` ramps from 0 to ~12 px/frame as the pointer goes deeper into the trigger zone.
- `behavior: 'instant'` — `smooth` would feel laggy.
- The options page is full-window scrolling; no inner scroll containers in the Rules tab.

#### Persistence
- One write per drop. `RuleStack.onChange(next)` already routes through `RulesTab` → `useStorage('rules', ...)` which persists to `chrome.storage.local`. No new code path.
- Drop on origin (no index change) is a no-op — we skip `onChange` to avoid a phantom write.
- Atomicity is provided by `chrome.storage.local`'s serialized writes. No new race surface.

#### Keyboard / a11y
- ▲ / ▼ buttons unchanged.
- Grip is `<span role="button" aria-label="Drag to reorder rule {n}: {ruleName}" tabindex="-1">`. Focusable only by pointer-down, hidden from tab order.
- New `aria-live="polite"` region in `RuleStack` announces "Moved {ruleName} to position {n}." on drop. Benefits both drag users and (incidentally) ▲ / ▼ users — closes a small existing UX gap.
- `axe-core` Playwright a11y check on the Rules tab continues to pass.

#### `prefers-reduced-motion`
- Detected via `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, captured on drag start.
- Effects of "reduce": no rotation on the floating card · no slot-shift transitions on siblings · no drop-settle animation · drop is instant.
- Drag still functions; only polish is suppressed.

### § 4. Visual treatment & CSS

New CSS rules in `src/options/options.css`:

```css
/* Grip handle */
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

/* Card grid changes from 3 → 4 columns to make room for the grip */
.pj-rule-card { grid-template-columns: auto auto 1fr auto; }

/* Insertion slot — replaces the dragged card in the flow */
.pj-rule-card[data-dragging-slot] {
  background: rgba(234, 88, 12, 0.06);
  border-style: dashed;
  border-color: var(--pj-accent);
  /* visibility hidden for content but height preserved */
}
.pj-rule-card[data-dragging-slot] > * { visibility: hidden; }

/* Sibling reflow during drag.
   The actual translateY value is set inline by the hook (per-sibling, computed
   from the cached card heights at drag start). The CSS only owns the transition
   curve so siblings slide rather than jump. */
.pj-rule-card[data-drag-active] { transition: transform 180ms ease; }

/* Floating card layer */
.pj-rule-card-floating-layer { position: absolute; inset: 0; pointer-events: none; }
.pj-rule-card-floating {
  position: absolute;
  left: 0; right: 0;
  box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  transform: rotate(-1.2deg);
  z-index: 10;
}

/* Reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .pj-rule-card[data-drag-active] { transition: none; }
  .pj-rule-card-floating { transform: none; box-shadow: none; }
}
```

**Note on the 78px shift constant:** the actual card height varies (multi-line rule names wrap). The hook caches `getBoundingClientRect()` of every card on drag start; the inline `transform` value is computed per-sibling, not via a CSS literal. The `78px` in the snippet is illustrative.

## 📁 Files changed

```
src/options/rules/
  useSortable.ts        ← NEW · ~150 LOC pointer-event state machine + auto-scroll
  useSortable.test.ts   ← NEW · pure-helper unit tests + behavioral test of the hook
  RuleStack.tsx         ← MODIFIED · wires hook, renders floating layer, aria-live
  RuleCard.tsx          ← MODIFIED · adds grip column (4-col grid) + gripProps prop
src/options/
  options.css           ← MODIFIED · .pj-rule-grip, slot/shift/floating, reduced-motion
test/e2e/
  rules-drag-reorder.spec.ts  ← NEW · drag E2E in real Chrome + axe-core in-flight check
```

## 🧪 Testing

### Unit tests (`useSortable.test.ts`, vitest, jsdom)

Pure helpers extracted from the hook for isolated testing:
- `computeTargetIndex(pointerY, cardRects, draggedIndex)` — given pointer Y and the cached `getBoundingClientRect()` array, returns the new index. Tested against fixtures: drop above first / between any two / below last / hover within own slot (no-op).
- `reorder(items, fromIndex, toIndex)` — pure array transform. Tested for `from < to`, `from > to`, `from == to` (returns same reference, signals "no change").
- `clampScrollDelta(pointerY, viewportHeight, scrollY)` — auto-scroll pixels-per-frame. Tested at top / middle / bottom of viewport.

The hook itself gets a behavioral test using `@testing-library/preact` + `fireEvent.pointerDown / pointerMove / pointerUp` on a simulated `RuleStack`. Verifies:
- Below-threshold pointer moves don't fire `onReorder`.
- Above-threshold + drop fires `onReorder` exactly once with the correct array.
- `Escape` mid-drag fires nothing.
- Drop on origin index fires nothing.

### E2E (`test/e2e/rules-drag-reorder.spec.ts`, Playwright, real Chrome)

- Seeds three rules via `worker.evaluate(...)` (the existing pattern used elsewhere in the E2E suite).
- Opens the options page → Rules tab. Locates the grip on rule #1.
- Uses `page.mouse.down() / move() / up()` to drag onto position 3.
- Asserts: visual order matches expected; `chrome.storage.local.rules` (read via `worker.evaluate`) holds the new order; exactly one storage write fired (verified via SW listener).
- Reduced-motion variant: emulates `prefers-reduced-motion: reduce`, repeats the drag, asserts final order is correct.
- A11y: `axe-core` scan during a drag-in-progress (slot opened) and after drop — both must pass WCAG 2.1 AA.

### Out of scope (for tests)

- Pixel-perfect floating-card position. Brittle, low-value.
- 60fps perf — manual eyeball in Chrome will catch jank if it shows up at the rule counts users actually have (≤ ~20).

## ⚠️ Risks

1. **Pointer-capture quirks across browsers.** Pointer Events API is well-supported in Chromium (the only target). No polyfill needed. We use `setPointerCapture` to bind events; if the host releases capture early (e.g. during scroll), we explicitly handle the `pointercancel` event by re-running the cancel path.
2. **Auto-scroll fighting browser-native autoscroll.** Chromium sometimes auto-scrolls a contenteditable on its own. Rules tab has no contenteditable in the drag path, so this shouldn't bite, but we listen for `scroll` events on the document during drag to keep the slot's `getBoundingClientRect()` cache fresh.
3. **Storage write races.** If `chrome.storage` sync activity lands during a drag (unlikely — the user is actively interacting), the post-drop `onReorder` could write a stale array. Resolution: at drop time, the hook does NOT call `onReorder` with the snapshot it captured at drag start. Instead it captures only the `(fromIndex, toIndex)` pair and re-applies the move to whatever the latest `items` prop is — the closure over `items` updates each render. Net effect: the move is re-played on top of the freshest state, never on a stale snapshot.

## 🚦 Migration & rollout

None. This is purely additive UI. No schema bump, no `pj_migrated_v2`, no starter changes, no docs/try changes.

Existing rules unchanged. Existing ▲ / ▼ keep working. Users who don't notice the new grip continue working exactly as before.

## 🗒 Notes from brainstorming

Decisions and the questions they answered (transcribed from the visual-companion session):

- **Q1 / A** — keep ▲/▼ AND add drag (don't replace).
- **Q2 / A** — visible grip on the LEFT, before the number. Never hide affordances behind hover.
- **Q3 / A** — hand-rolled Pointer Events. ~150 LOC, ~1KB gz vs ~30KB gz for `@dnd-kit/sortable + preact/compat`. Bundle size matters for an extension.
- **Q4 / B** — insertion slot + lifted floating card. Direct-manipulation feel; siblings reflow to make room. Pays a small relayout cost for clearer landing target.

## 📜 Out-of-the-box-ness

This design intentionally does not pull in `@dnd-kit/sortable`, `react-sortablejs`, or `react-beautiful-dnd`. They're all great libraries, and they're all wrong for this case: every one of them would more than double the cost of this feature in shipped bytes, and we'd inherit accessibility primitives we don't need (▲/▼ already cover the keyboard story).
