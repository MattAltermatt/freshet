# Phase 2, Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Preact + wire JSX into the Vite/Vitest/TypeScript pipeline, and scaffold the shared `src/ui/` component library (theme tokens, `useTheme` hook, `Button`, `Toggle`, `Toast` + `ToastHost`) — without changing any existing user-visible behavior.

**Architecture:** All existing functionality stays untouched (rules, templates, engine, matcher, storage, popup, content script). A new `src/ui/` directory holds Preact components and hooks that subsequent plans will consume. Tests run with `jsdom` for UI components and Node for pure modules. The `{>` palette is defined once in `src/ui/theme.css` as CSS custom properties with a `[data-theme="dark"]` dark-mode variant.

**Tech Stack:** Preact 10, `@preact/preset-vite`, `@testing-library/preact`, jsdom. Existing Vite, Vitest, TypeScript, ESLint, Playwright retained unchanged.

**Reference spec:** [`docs/superpowers/specs/2026-04-18-phase2-ux-polish-design.md`](../specs/2026-04-18-phase2-ux-polish-design.md) (sections: Architecture, State model, Build & pipeline changes).

---

## Task 1: Create the feature branch

**Files:** none — git operation only.

- [ ] **Step 1.1: Ensure working tree is clean, on `main`, up to date**

Run:
```bash
git status
git checkout main
git pull origin main
```
Expected: `main` up to date with `origin/main`, clean working tree.

- [ ] **Step 1.2: Create and check out the feature branch**

Run:
```bash
git checkout -b feature/phase2-plan1-foundation
```
Expected: `Switched to a new branch 'feature/phase2-plan1-foundation'`.

---

## Task 2: Install UI dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 2.1: Install Preact + preset + testing-library + jsdom as devDependencies**

Run:
```bash
pnpm add -D preact @preact/preset-vite @testing-library/preact @testing-library/jest-dom jsdom
```

Expected: `package.json` `devDependencies` now includes these five packages with minor-version ranges (e.g. `"preact": "^10.x"`). `pnpm-lock.yaml` updated.

- [ ] **Step 2.2: Verify no install errors**

Run:
```bash
pnpm install
```
Expected: "Already up to date" (or similar clean output); no errors.

- [ ] **Step 2.3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add preact + testing-library + jsdom for ui library"
```

---

## Task 3: Configure Vite to compile JSX via Preact preset

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 3.1: Add the preset import + plugin entry**

Replace the entire contents of `vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Present-JSON',
  version: '0.1.0',
  description: 'Render JSON responses as user-templated HTML.',
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: {
      '16': 'public/icon-16.png',
      '48': 'public/icon-48.png',
      '128': 'public/icon-128.png',
    },
  },
  options_page: 'src/options/options.html',
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'tabs'],
  host_permissions: ['<all_urls>'],
  icons: {
    '16': 'public/icon-16.png',
    '48': 'public/icon-48.png',
    '128': 'public/icon-128.png',
  },
});

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: { outDir: 'dist', emptyOutDir: true },
});
```

- [ ] **Step 3.2: Run build to verify JSX compilation is active but nothing regressed**

Run:
```bash
pnpm build
```
Expected: `✓ built in ...`. No errors. `dist/` regenerated.

- [ ] **Step 3.3: Commit**

```bash
git add vite.config.ts
git commit -m "build: enable preact jsx compilation via @preact/preset-vite"
```

---

## Task 4: Configure TypeScript + Vitest for JSX and jsdom

**Files:**
- Modify: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 4.1: Read the current `tsconfig.json` to capture existing settings**

Run:
```bash
cat tsconfig.json
```
Note the current `compilerOptions`. The next step preserves them and adds JSX settings.

- [ ] **Step 4.2: Update `tsconfig.json` to emit Preact-compatible JSX**

Read `tsconfig.json`. In `compilerOptions`, add (or update) these keys without removing any existing settings:

```json
"jsx": "react-jsx",
"jsxImportSource": "preact"
```

The final `compilerOptions` should contain at minimum: whatever was there before, plus those two JSX keys. Save.

- [ ] **Step 4.3: Run typecheck to confirm the JSX config is accepted**

Run:
```bash
pnpm typecheck
```
Expected: no errors (no `.tsx` files exist yet, so this just validates config parses).

- [ ] **Step 4.4: Create `vitest.config.ts` to enable jsdom for `.tsx` tests while keeping Node for `.ts` tests**

Create `vitest.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    environmentMatchGlobs: [
      ['src/ui/**', 'jsdom'],
      ['**/*.tsx', 'jsdom'],
    ],
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 4.5: Create the test setup file**

Create `test/setup.ts` with:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4.6: Run the existing test suite to verify nothing regressed**

Run:
```bash
pnpm test
```
Expected: `Tests  65 passed (65)`. No environment errors.

- [ ] **Step 4.7: Commit**

```bash
git add tsconfig.json vitest.config.ts test/setup.ts
git commit -m "test: enable jsdom for src/ui tests, preserve node env for pure modules"
```

---

## Task 5: Create the theme-token CSS file

**Files:**
- Create: `src/ui/theme.css`

- [ ] **Step 5.1: Create `src/ui/theme.css` with the full light + dark palette**

Create `src/ui/theme.css` with:

```css
/* Present-JSON design tokens
 * Source of truth for the warm cream / warm near-black palette.
 * Light is default; dark activates via [data-theme="dark"] on the root element.
 */

:root {
  /* Surface */
  --pj-bg:            #fef7ed;   /* warm cream (orange-50) */
  --pj-bg-elevated:   #ffffff;
  --pj-bg-subtle:     #fff7ed;   /* hover / accent-wash */
  --pj-border:        #fed7aa;
  --pj-border-subtle: #fef3e2;

  /* Text */
  --pj-fg:            #111827;   /* near-black */
  --pj-fg-muted:      #44403c;
  --pj-fg-subtle:     #78716c;
  --pj-fg-disabled:   #a8a29e;

  /* Brand accent */
  --pj-accent:        #ea580c;
  --pj-accent-fg:     #ffffff;   /* text on accent surfaces */
  --pj-accent-hover:  #c2410c;
  --pj-accent-wash:   #fff7ed;   /* low-opacity accent background */

  /* Status */
  --pj-success:       #10b981;
  --pj-success-fg:    #ffffff;
  --pj-danger:        #ef4444;
  --pj-danger-fg:     #ffffff;

  /* Layout */
  --pj-radius:        4px;
  --pj-radius-lg:     6px;
  --pj-space-1:       4px;
  --pj-space-2:       8px;
  --pj-space-3:       12px;
  --pj-space-4:       16px;

  /* Typography */
  --pj-font:          -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --pj-font-mono:     ui-monospace, SFMono-Regular, Menlo, monospace;
  --pj-font-size-sm:  11px;
  --pj-font-size-md:  13px;
  --pj-font-size-lg:  15px;
}

:root[data-theme="dark"] {
  --pj-bg:            #1c1917;   /* warm near-black (stone-950) */
  --pj-bg-elevated:   #292524;
  --pj-bg-subtle:     #27211c;
  --pj-border:        #44403c;
  --pj-border-subtle: #292524;

  --pj-fg:            #fafafa;
  --pj-fg-muted:      #d6d3d1;
  --pj-fg-subtle:     #a8a29e;
  --pj-fg-disabled:   #78716c;

  --pj-accent:        #ea580c;
  --pj-accent-fg:     #ffffff;
  --pj-accent-hover:  #f97316;
  --pj-accent-wash:   rgba(234, 88, 12, 0.12);

  --pj-success:       #10b981;
  --pj-danger:        #f87171;
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/ui/theme.css
git commit -m "ui: add theme.css with warm cream + warm near-black palette"
```

---

## Task 6: Create the `useTheme` hook

**Files:**
- Create: `src/ui/theme.ts`
- Create: `src/ui/hooks/useTheme.ts`
- Create: `src/ui/hooks/useTheme.test.ts`

- [ ] **Step 6.1: Create `src/ui/theme.ts` with the `Theme` + `ThemePreference` types**

Create `src/ui/theme.ts` with:

```ts
export type Theme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Resolve a preference into the actual theme by consulting matchMedia when preference is 'system'. */
export function resolveTheme(
  preference: ThemePreference,
  matcher: Pick<MediaQueryList, 'matches'> = window.matchMedia('(prefers-color-scheme: dark)'),
): Theme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return matcher.matches ? 'dark' : 'light';
}

/** Apply the resolved theme to the DOM by setting data-theme on the root element. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', theme);
}
```

- [ ] **Step 6.2: Write the failing test**

Create `src/ui/hooks/useTheme.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { resolveTheme, applyTheme } from '../theme';

describe('resolveTheme', () => {
  it('returns light when preference is light regardless of matcher', () => {
    expect(resolveTheme('light', { matches: true })).toBe('light');
    expect(resolveTheme('light', { matches: false })).toBe('light');
  });

  it('returns dark when preference is dark regardless of matcher', () => {
    expect(resolveTheme('dark', { matches: true })).toBe('dark');
    expect(resolveTheme('dark', { matches: false })).toBe('dark');
  });

  it('returns matcher result when preference is system', () => {
    expect(resolveTheme('system', { matches: true })).toBe('dark');
    expect(resolveTheme('system', { matches: false })).toBe('light');
  });
});

describe('applyTheme', () => {
  it('sets data-theme attribute on the provided root', () => {
    const root = document.createElement('div');
    applyTheme('dark', root);
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyTheme('light', root);
    expect(root.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 6.3: Run the test to confirm it passes (no useTheme hook needed yet — pure functions only)**

Run:
```bash
pnpm test -- src/ui/hooks/useTheme.test.ts
```
Expected: 4 tests passed in this file.

- [ ] **Step 6.4: Create the `useTheme` Preact hook**

Create `src/ui/hooks/useTheme.ts` with:

```ts
import { useEffect, useState } from 'preact/hooks';
import { applyTheme, resolveTheme, type Theme, type ThemePreference } from '../theme';

interface UseThemeOptions {
  preference: ThemePreference;
  onPreferenceChange?: (next: ThemePreference) => void;
  root?: HTMLElement;
}

interface UseThemeResult {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

/**
 * Reactive theme hook. Given a preference ('system' | 'light' | 'dark'), resolves the effective
 * theme, writes data-theme onto the root, and re-resolves on prefers-color-scheme changes.
 */
export function useTheme(options: UseThemeOptions): UseThemeResult {
  const { preference, onPreferenceChange, root } = options;
  const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(preference, mql ?? { matches: false }));

  useEffect(() => {
    const next = resolveTheme(preference, mql ?? { matches: false });
    setTheme(next);
    applyTheme(next, root);
  }, [preference, mql, root]);

  useEffect(() => {
    if (!mql || preference !== 'system') return;
    const handler = (event: MediaQueryListEvent) => {
      const next: Theme = event.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next, root);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mql, preference, root]);

  return {
    theme,
    preference,
    setPreference: (next) => onPreferenceChange?.(next),
  };
}
```

- [ ] **Step 6.5: Typecheck to confirm the hook compiles**

Run:
```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 6.6: Commit**

```bash
git add src/ui/theme.ts src/ui/hooks/useTheme.ts src/ui/hooks/useTheme.test.ts
git commit -m "ui: add theme tokens + useTheme hook with prefers-color-scheme support"
```

---

## Task 7: Create the `Button` component

**Files:**
- Create: `src/ui/components/Button.tsx`
- Create: `src/ui/components/Button.test.tsx`

- [ ] **Step 7.1: Write the failing test**

Create `src/ui/components/Button.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Button } from './Button';

describe('<Button>', () => {
  it('renders children', () => {
    const { getByRole } = render(<Button>Save</Button>);
    expect(getByRole('button').textContent).toBe('Save');
  });

  it('applies variant data attribute', () => {
    const { getByRole } = render(<Button variant="primary">Primary</Button>);
    expect(getByRole('button').getAttribute('data-variant')).toBe('primary');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button disabled onClick={onClick}>Click</Button>);
    fireEvent.click(getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7.2: Run the test to verify it fails**

Run:
```bash
pnpm test -- src/ui/components/Button.test.tsx
```
Expected: FAIL with "Cannot find module './Button'".

- [ ] **Step 7.3: Implement `Button`**

Create `src/ui/components/Button.tsx` with:

```tsx
import type { ComponentChildren, JSX } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  children?: ComponentChildren;
}

export function Button({ variant = 'secondary', children, class: className, ...rest }: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-variant={variant}
      class={`pj-btn${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 7.4: Run the test to verify it passes**

Run:
```bash
pnpm test -- src/ui/components/Button.test.tsx
```
Expected: 4 tests passed.

- [ ] **Step 7.5: Commit**

```bash
git add src/ui/components/Button.tsx src/ui/components/Button.test.tsx
git commit -m "ui: add Button component with primary/secondary/ghost/danger variants"
```

---

## Task 8: Create the `Toggle` component

**Files:**
- Create: `src/ui/components/Toggle.tsx`
- Create: `src/ui/components/Toggle.test.tsx`

- [ ] **Step 8.1: Write the failing test**

Create `src/ui/components/Toggle.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Toggle } from './Toggle';

describe('<Toggle>', () => {
  it('renders with given label', () => {
    const { getByLabelText } = render(<Toggle label="Enable X" checked={false} onChange={() => {}} />);
    expect(getByLabelText('Enable X')).toBeDefined();
  });

  it('reflects checked state via aria-checked', () => {
    const { getByRole } = render(<Toggle label="x" checked={true} onChange={() => {}} />);
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('calls onChange(true) when off → on', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Toggle label="x" checked={false} onChange={onChange} />);
    fireEvent.click(getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange(false) when on → off', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Toggle label="x" checked={true} onChange={onChange} />);
    fireEvent.click(getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 8.2: Run the test to verify it fails**

Run:
```bash
pnpm test -- src/ui/components/Toggle.test.tsx
```
Expected: FAIL with "Cannot find module './Toggle'".

- [ ] **Step 8.3: Implement `Toggle`**

Create `src/ui/components/Toggle.tsx` with:

```tsx
import type { JSX } from 'preact';
import { useId } from 'preact/hooks';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps): JSX.Element {
  const labelId = useId();
  return (
    <label class="pj-toggle" for={labelId}>
      <button
        id={labelId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        class={`pj-toggle__track${checked ? ' pj-toggle__track--on' : ''}`}
      >
        <span class="pj-toggle__thumb" />
      </button>
      <span class="pj-toggle__label">{label}</span>
    </label>
  );
}
```

- [ ] **Step 8.4: Run the test to verify it passes**

Run:
```bash
pnpm test -- src/ui/components/Toggle.test.tsx
```
Expected: 4 tests passed.

- [ ] **Step 8.5: Commit**

```bash
git add src/ui/components/Toggle.tsx src/ui/components/Toggle.test.tsx
git commit -m "ui: add Toggle component with aria-switch semantics"
```

---

## Task 9: Create the `Toast` + `ToastHost` components with the `useToast` hook

**Files:**
- Create: `src/ui/components/Toast.tsx`
- Create: `src/ui/components/ToastHost.tsx`
- Create: `src/ui/hooks/useToast.ts`
- Create: `src/ui/components/ToastHost.test.tsx`

- [ ] **Step 9.1: Write the failing test**

Create `src/ui/components/ToastHost.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/preact';
import { ToastHost } from './ToastHost';
import { useToast } from '../hooks/useToast';

describe('<ToastHost>', () => {
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
```

- [ ] **Step 9.2: Run the test to verify it fails**

Run:
```bash
pnpm test -- src/ui/components/ToastHost.test.tsx
```
Expected: FAIL with "Cannot find module './ToastHost'".

- [ ] **Step 9.3: Create the toast shared state (module-scoped signal store)**

Create `src/ui/hooks/useToast.ts` with:

```ts
import { useEffect, useState } from 'preact/hooks';

export type ToastVariant = 'success' | 'info' | 'danger';

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  ttlMs?: number;             // default 2000 for success/info, 5000 for danger
  action?: { label: string; onClick: () => void };
}

export interface Toast extends ToastInput {
  id: string;
  createdAt: number;
}

type Listener = (toasts: Toast[]) => void;
const listeners = new Set<Listener>();
let state: Toast[] = [];

function emit(next: Toast[]): void {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function pushToastImpl(input: ToastInput): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: Toast = {
    ...input,
    id,
    createdAt: Date.now(),
    ttlMs: input.ttlMs ?? (input.variant === 'danger' ? 5000 : 2000),
  };
  emit([...state, toast]);
  if (toast.ttlMs && toast.ttlMs > 0) {
    setTimeout(() => dismissToastImpl(id), toast.ttlMs);
  }
  return id;
}

export function dismissToastImpl(id: string): void {
  emit(state.filter((t) => t.id !== id));
}

export function useToast(): {
  toasts: Toast[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
} {
  const [toasts, setToasts] = useState<Toast[]>(state);
  useEffect(() => {
    const listener: Listener = (next) => setToasts(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { toasts, push: pushToastImpl, dismiss: dismissToastImpl };
}
```

- [ ] **Step 9.4: Create the `Toast` presentational component**

Create `src/ui/components/Toast.tsx` with:

```tsx
import type { JSX } from 'preact';
import type { Toast as ToastModel } from '../hooks/useToast';

interface ToastProps {
  toast: ToastModel;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps): JSX.Element {
  return (
    <div class={`pj-toast pj-toast--${toast.variant}`} role="status" aria-live="polite">
      <span class="pj-toast__message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          class="pj-toast__action"
          onClick={() => {
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 9.5: Create the `ToastHost` container**

Create `src/ui/components/ToastHost.tsx` with:

```tsx
import type { JSX } from 'preact';
import { Toast } from './Toast';
import { useToast } from '../hooks/useToast';

export function ToastHost(): JSX.Element {
  const { toasts, dismiss } = useToast();
  return (
    <div class="pj-toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
```

- [ ] **Step 9.6: Run the test to verify it passes**

Run:
```bash
pnpm test -- src/ui/components/ToastHost.test.tsx
```
Expected: 3 tests passed.

- [ ] **Step 9.7: Commit**

```bash
git add src/ui/components/Toast.tsx src/ui/components/ToastHost.tsx src/ui/hooks/useToast.ts src/ui/components/ToastHost.test.tsx
git commit -m "ui: add Toast + ToastHost + useToast with auto-dismiss"
```

---

## Task 10: Create the `src/ui/index.ts` public-API barrel

**Files:**
- Create: `src/ui/index.ts`

- [ ] **Step 10.1: Create the barrel file**

Create `src/ui/index.ts` with:

```ts
export { Button, type ButtonVariant } from './components/Button';
export { Toggle } from './components/Toggle';
export { Toast } from './components/Toast';
export { ToastHost } from './components/ToastHost';

export { useTheme } from './hooks/useTheme';
export { useToast, type Toast as ToastModel, type ToastInput, type ToastVariant } from './hooks/useToast';

export { resolveTheme, applyTheme, type Theme, type ThemePreference } from './theme';
```

- [ ] **Step 10.2: Typecheck**

Run:
```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 10.3: Commit**

```bash
git add src/ui/index.ts
git commit -m "ui: add public-api barrel for src/ui"
```

---

## Task 11: Full verification — existing behavior unchanged

**Files:** none — verification only.

- [ ] **Step 11.1: Run the full unit test suite**

Run:
```bash
pnpm test
```
Expected: all tests pass. Count should be 65 (existing) + 4 (useTheme) + 4 (Button) + 4 (Toggle) + 3 (ToastHost) = 80 passing.

- [ ] **Step 11.2: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 11.3: Update ESLint config to understand TSX**

The existing `.eslintrc.cjs` sets `parserOptions.ecmaVersion` + `sourceType` but has no JSX flag, and the `lint` script in `package.json` globs only `src/**/*.ts` — it will miss `.tsx` files. Update both.

Replace `.eslintrc.cjs` contents with:

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, node: true, es2022: true, webextensions: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

Update `package.json`'s `lint` script value from:
```
"lint": "eslint --no-error-on-unmatched-pattern 'src/**/*.ts'",
```
to:
```
"lint": "eslint --no-error-on-unmatched-pattern 'src/**/*.{ts,tsx}'",
```

- [ ] **Step 11.4: Run lint**

Run:
```bash
pnpm lint
```
Expected: no errors.

- [ ] **Step 11.5: Commit the ESLint update**

```bash
git add .eslintrc.cjs package.json
git commit -m "lint: enable tsx parsing + include .tsx in lint glob"
```

- [ ] **Step 11.6: Run production build**

Run:
```bash
pnpm build
```
Expected: clean build, `dist/` regenerated. No user-visible manifest changes.

- [ ] **Step 11.7: Run the existing E2E spec to confirm no regression**

Run:
```bash
pnpm test:e2e
```
Expected: 1 passed (the existing render spec).

- [ ] **Step 11.8: Confirm no stray untracked files**

Run:
```bash
git status
```
Expected: "nothing to commit, working tree clean".

- [ ] **Step 11.9: Push the branch**

Run:
```bash
git push -u origin feature/phase2-plan1-foundation
```
Expected: branch created on `origin`, tracking set up. The push output will include a `pull/new/feature/phase2-plan1-foundation` URL.

---

## Task 12: Hand off for review

**Files:** none.

- [ ] **Step 12.1: Summarize for the human reviewer**

Report to Matt:
- Branch: `feature/phase2-plan1-foundation`
- Commits added (in order): deps → vite JSX → tsconfig/vitest jsdom → theme.css → useTheme → Button → Toggle → Toast/ToastHost → barrel
- Verification: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` all green
- Test count: 65 → 80 (15 new UI tests)
- No user-visible changes — options, popup, top-strip, content script all still behave identically
- Push URL: `https://github.com/MattAltermatt/present-json/pull/new/feature/phase2-plan1-foundation`

- [ ] **Step 12.2: Wait for explicit approval before FF-merge**

Do NOT FF-merge to `main` until Matt explicitly says merge. Matt's workflow: automated checks green is necessary but not sufficient — manual inspection required before shipping.

---

## Done when

- [ ] All 80 tests pass (65 existing + 15 new).
- [ ] Typecheck, lint, build, E2E all clean.
- [ ] Options page, popup, top-strip, and content script behave identically to pre-plan `main` (zero user-visible changes).
- [ ] `src/ui/` contains: `theme.css`, `theme.ts`, `index.ts`, `hooks/useTheme.ts`, `hooks/useTheme.test.ts`, `hooks/useToast.ts`, `components/Button.tsx`, `components/Button.test.tsx`, `components/Toggle.tsx`, `components/Toggle.test.tsx`, `components/Toast.tsx`, `components/ToastHost.tsx`, `components/ToastHost.test.tsx`.
- [ ] Matt has approved the branch for FF-merge to `main`.
