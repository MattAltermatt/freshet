# Phase 2, Plan 3 — Options Page Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled `src/options/options.ts` DOM-manipulation code with a Preact 10 single-page application that delivers the locked UX spec: split-view Rules tab with card stack + URL tester, CodeMirror 6 template editor with Liquid grammar + autocomplete, overhauled rule-edit modal with validation + KV editor, autosave pipeline with `Saved ✓` / Undo / retry toasts, dark mode via `prefers-color-scheme` + user override, and QOL wins (remembered sample JSON, friendlier starter docs).

**Scope clarifications vs. the Phase 2 spec:**
- Popup and rendered top-strip are explicitly **out of scope** — those are Plans 4 and 5.
- Engine swap (spec Rollout step 2) already shipped as Plan 2 using **LiquidJS** instead of Handlebars. Every reference to Handlebars in the spec translates to Liquid in this plan: CodeMirror grammar, autocomplete helper list, cheatsheet content, and the per-template migration banner all reflect Liquid syntax.
- `src/ui/` foundation from Plan 1 already has Button, Toggle, Toast, ToastHost, useTheme, useToast. This plan **adds** Menu, KVEditor, Cheatsheet, CodeMirrorBox, useStorage, useDebounce, useAutosave.
- Phase 7 backlog QOLs that fit here: **remembered/optional sample JSON** (stored per-template, loaded on open) and **friendlier starter templates with inline docs** (the AI-hint header block from the spec already accomplishes this; extended slightly to include a human-readable comment too).

**Architecture:**
- One Preact root mounted from `src/options/options.tsx` into `<div id="app">` inside `src/options/options.html`.
- Top-level `App.tsx` owns global concerns: theme provider, toast host, storage subscriptions, tab state.
- Rules tab lives in `src/options/rules/` (5 components). Templates tab lives in `src/options/templates/` (5 components). Rule edit modal in `src/options/rules/RuleEditModal.tsx`.
- Autosave is a hook (`useAutosave`) — debounces state changes, writes through storage facade, emits toast outcomes. Undo is implemented by holding a pre-mutation snapshot in `useRef` until the toast dismiss-or-click deadline.
- All styling uses the CSS custom properties from `src/ui/theme.css` (already declared in Plan 1). Theme swap is a single `data-theme` attribute flip.
- **No CodeMirror feature may bundle `unsafe-eval`** — CodeMirror 6 is all ES modules, no codegen; still, Task 3 proves it actually runs in the MV3 build before we invest in editor wiring.

**Tech Stack:** Preact 10, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/commands`, `@codemirror/lang-json`), `@testing-library/preact` for component tests, Playwright for E2E. Existing LiquidJS, Vite, Vitest, TypeScript retained.

**Critical de-risk path (from Plan 2 playbook):** Task 3 is a CSP smoke test that proves a non-trivial CodeMirror 6 editor (line numbers + autocomplete + JSON highlight) actually boots inside the MV3 options page with no `'unsafe-eval'`. If CSP rejects CodeMirror, stop and re-plan. All other editor work depends on this pass.

**Phases (roadmap-style, strategic):**

1. **Foundation** — spec branch, impl branch, scaffolding. (Tasks 1–2)
2. **De-risk** — CodeMirror CSP smoke test. (Task 3)
3. **UI primitives + hooks** — Menu, KVEditor, Cheatsheet, CodeMirrorBox, useStorage, useDebounce, useAutosave. (Tasks 4–10)
4. **App shell** — Preact root, header, tab switcher, theme toggle, quota bar, toast host. (Tasks 11–14)
5. **Rules tab** — rule stack + URL tester + rule-edit modal. (Tasks 15–20)
6. **Templates tab** — CodeMirror editor with Liquid grammar + autocomplete + preview + delete-guard + cheatsheet + migration banner. (Tasks 21–27)
7. **Autosave + dark mode** — pipeline wiring, Saved/Undo/retry semantics, prefers-color-scheme, user override. (Tasks 28–30)
8. **QOL** — remembered sample JSON, friendlier starter docs. (Tasks 31–32)
9. **E2E + accessibility** — Playwright CRUD flows, axe-core sweep. (Tasks 33–35)
10. **Code review + docs + FF-merge** — fresh reviewer agent, README/CLAUDE.md/ROADMAP update. (Tasks 36–38)

**Todos (current tactical focus):** Task 1 (branch) → Task 3 (CSP smoke). Everything downstream gates on that proof.

---

## Task 1: Create the impl branch

After this plan is reviewed and FF-merged on `feature/phase2-plan3-spec`, cut the impl branch:

```bash
git checkout main
git pull origin main
git checkout -b feature/phase2-plan3-options
```

---

## Task 2: Install CodeMirror 6 dependencies

- [ ] **Step 2.1: Add CodeMirror modules**

```bash
pnpm add -D @codemirror/state @codemirror/view @codemirror/language \
  @codemirror/autocomplete @codemirror/commands @codemirror/lang-json \
  @codemirror/legacy-modes @lezer/highlight
```

Rationale: `@codemirror/legacy-modes` ships a Handlebars/Mustache mode that covers Liquid's `{% %}` and `{{ }}` delimiters well enough for v1; we layer a small custom autocomplete source on top. `@lezer/highlight` pulls in `tags` for our own theme.

- [ ] **Step 2.2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add codemirror 6 for template editor"
```

---

## Task 3: CSP smoke test — CodeMirror 6 under MV3

**Purpose:** prove that CodeMirror 6 boots inside the options page with the extension's CSP (no `'unsafe-eval'`) before we invest in the editor wiring.

- [ ] **Step 3.1: Create a minimal smoke harness in the options page**

Temporarily edit `src/options/options.ts` (keep the rest of the file working — we are only proving loadability; full Preact rewrite comes in Task 11). At the top of `boot()`, before any rules/templates wiring:

```ts
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';

const smokeHost = document.createElement('div');
smokeHost.id = 'cm-smoke';
smokeHost.style.cssText = 'position:fixed;bottom:8px;right:8px;width:300px;height:120px;border:1px solid #888;background:#fff;z-index:99999';
document.body.appendChild(smokeHost);

new EditorView({
  state: EditorState.create({
    doc: '{ "hello": "world" }',
    extensions: [lineNumbers(), keymap.of(defaultKeymap), autocompletion(), json()],
  }),
  parent: smokeHost,
});
console.log('[pj] cm6 smoke: mounted');
```

- [ ] **Step 3.2: Write a Playwright test asserting it loads without CSP violations**

Create `test/e2e/cm-csp-smoke.spec.ts`:

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

test('CodeMirror 6 boots under MV3 CSP on the options page', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;

  const page = await ctx.newPage();
  const cspViolations: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().toLowerCase().includes('content security policy') ||
        msg.text().toLowerCase().includes('unsafe-eval')) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto(`chrome-extension://${extId}/src/options/options.html`);
  await expect(page.locator('#cm-smoke .cm-editor')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#cm-smoke .cm-gutter-lineNumber, #cm-smoke .cm-lineNumbers')).toBeVisible();

  expect(cspViolations, `CSP violations: ${cspViolations.join('\n')}`).toEqual([]);
  await ctx.close();
});
```

- [ ] **Step 3.3: Build and run**

```bash
pnpm build
pnpm test:e2e test/e2e/cm-csp-smoke.spec.ts
```

Expected: test passes, no CSP violations logged, a 300×120 CodeMirror editor with line numbers is visible bottom-right on the options page.

**If this fails:** do not proceed. Investigate the violating module; swap to a CSP-safe alternative or drop the offending feature. (Handlebars was the cautionary tale — do not invest more tasks on a broken foundation.)

- [ ] **Step 3.4: Remove the smoke harness but keep the Playwright test**

Revert the ad-hoc insertion in `options.ts`. Keep `test/e2e/cm-csp-smoke.spec.ts` but update it to assert against the real editor we mount in Task 21 (a placeholder for now is fine; the task will update the selector).

- [ ] **Step 3.5: Commit**

```bash
git add test/e2e/cm-csp-smoke.spec.ts src/options/options.ts
git commit -m "test(e2e): cm6 csp smoke on options page"
```

---

## Task 4: UI primitive — Menu

**Files:**
- Create: `src/ui/components/Menu.tsx`
- Create: `src/ui/components/Menu.test.tsx`
- Modify: `src/ui/index.ts` (export)

- [ ] **Step 4.1: Write the failing test**

`src/ui/components/Menu.test.tsx`:

```tsx
import { render, fireEvent, screen } from '@testing-library/preact';
import { Menu } from './Menu';

test('renders trigger and opens on click', () => {
  render(
    <Menu trigger={<button>⋯</button>} items={[{ label: 'Copy', onSelect: () => {} }]} />
  );
  expect(screen.queryByText('Copy')).toBeNull();
  fireEvent.click(screen.getByText('⋯'));
  expect(screen.getByText('Copy')).toBeInTheDocument();
});

test('invokes onSelect and closes', () => {
  const onSelect = vi.fn();
  render(<Menu trigger={<button>⋯</button>} items={[{ label: 'Copy', onSelect }]} />);
  fireEvent.click(screen.getByText('⋯'));
  fireEvent.click(screen.getByText('Copy'));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(screen.queryByText('Copy')).toBeNull();
});

test('closes on Escape', () => {
  render(<Menu trigger={<button>⋯</button>} items={[{ label: 'Copy', onSelect: () => {} }]} />);
  fireEvent.click(screen.getByText('⋯'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByText('Copy')).toBeNull();
});
```

- [ ] **Step 4.2: Run — expect FAIL (no Menu module)**

```bash
pnpm test src/ui/components/Menu.test.tsx
```

- [ ] **Step 4.3: Implement**

`src/ui/components/Menu.tsx`:

```tsx
import { h, ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ComponentChildren;
}

export interface MenuProps {
  trigger: ComponentChildren;
  items: MenuItem[];
  align?: 'left' | 'right';
}

export function Menu({ trigger, items, align = 'right' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  return (
    <div class="pj-menu" ref={root} style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div class="pj-menu-list" role="menu" data-align={align}>
          {items.map((item) => (
            <button
              key={item.label}
              class="pj-menu-item"
              role="menuitem"
              onClick={() => { item.onSelect(); setOpen(false); }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Add to `src/ui/theme.css` (light + dark shared):

```css
.pj-menu-list {
  position: absolute; top: calc(100% + 4px); min-width: 180px;
  background: var(--bg); color: var(--fg);
  border: 1px solid var(--border); border-radius: 6px;
  box-shadow: 0 6px 16px rgba(0,0,0,.12);
  padding: 4px 0; z-index: 100;
}
.pj-menu-list[data-align="right"] { right: 0; }
.pj-menu-list[data-align="left"]  { left: 0; }
.pj-menu-item {
  display: block; width: 100%; text-align: left; padding: 6px 12px;
  background: transparent; border: 0; color: inherit; cursor: pointer;
  font: inherit;
}
.pj-menu-item:hover { background: var(--muted-bg); }
```

- [ ] **Step 4.4: Export + run**

In `src/ui/index.ts` add `export { Menu, type MenuItem } from './components/Menu';`.

```bash
pnpm test src/ui/components/Menu.test.tsx
```

Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/ui/
git commit -m "ui: Menu primitive"
```

---

## Task 5: UI primitive — KVEditor

A controlled key/value editor used in the rule-edit modal for `variables`. Keys must be non-empty and unique; invalid rows render a visible error.

**Files:**
- Create: `src/ui/components/KVEditor.tsx`, `src/ui/components/KVEditor.test.tsx`
- Modify: `src/ui/index.ts`

- [ ] **Step 5.1: Write the failing tests**

`src/ui/components/KVEditor.test.tsx`:

```tsx
import { render, fireEvent, screen } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { KVEditor } from './KVEditor';

function Harness() {
  const [v, setV] = useState<Record<string, string>>({ env: 'prod' });
  return <KVEditor value={v} onChange={setV} />;
}

test('renders existing pairs', () => {
  render(<Harness />);
  expect(screen.getByDisplayValue('env')).toBeInTheDocument();
  expect(screen.getByDisplayValue('prod')).toBeInTheDocument();
});

test('adds a new blank pair on + click', () => {
  render(<Harness />);
  fireEvent.click(screen.getByText('+ Add variable'));
  // blank key field appears
  const keys = screen.getAllByPlaceholderText('key');
  expect(keys.length).toBe(2);
});

test('removes pair on × click', () => {
  render(<Harness />);
  fireEvent.click(screen.getByLabelText('remove env'));
  expect(screen.queryByDisplayValue('env')).toBeNull();
});

test('shows duplicate-key error', () => {
  const { container } = render(<Harness />);
  fireEvent.click(screen.getByText('+ Add variable'));
  const keys = container.querySelectorAll<HTMLInputElement>('input[placeholder="key"]');
  fireEvent.input(keys[1]!, { target: { value: 'env' } });
  expect(screen.getByText(/duplicate key/i)).toBeInTheDocument();
});
```

- [ ] **Step 5.2: Run — expect FAIL**

```bash
pnpm test src/ui/components/KVEditor.test.tsx
```

- [ ] **Step 5.3: Implement**

`src/ui/components/KVEditor.tsx`:

```tsx
import { h } from 'preact';
import { useMemo } from 'preact/hooks';

export interface KVEditorProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

interface Row { key: string; value: string; id: number; }

function toRows(value: Record<string, string>): Row[] {
  return Object.entries(value).map(([k, v], i) => ({ key: k, value: v, id: i }));
}
function toObject(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) if (r.key) out[r.key] = r.value;
  return out;
}

export function KVEditor({ value, onChange }: KVEditorProps) {
  const rows = useMemo(() => toRows(value), [value]);

  const dupKeys = useMemo(() => {
    const seen = new Set<string>(); const dup = new Set<string>();
    for (const r of rows) {
      if (!r.key) continue;
      if (seen.has(r.key)) dup.add(r.key); else seen.add(r.key);
    }
    return dup;
  }, [rows]);

  const update = (idx: number, patch: Partial<Row>) => {
    const next = rows.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onChange(toObject(next));
  };
  const remove = (idx: number) => onChange(toObject(rows.filter((_, i) => i !== idx)));
  const add = () => onChange({ ...value, '': '' });

  return (
    <div class="pj-kv-editor">
      {rows.map((r, i) => (
        <div key={r.id} class="pj-kv-row">
          <input placeholder="key" value={r.key}
                 class={dupKeys.has(r.key) ? 'pj-invalid' : ''}
                 onInput={(e) => update(i, { key: (e.target as HTMLInputElement).value })} />
          <span>=</span>
          <input placeholder="value" value={r.value}
                 onInput={(e) => update(i, { value: (e.target as HTMLInputElement).value })} />
          <button type="button" aria-label={`remove ${r.key || 'blank'}`} onClick={() => remove(i)}>✕</button>
          {dupKeys.has(r.key) && <div class="pj-kv-err">duplicate key</div>}
        </div>
      ))}
      <button type="button" onClick={add}>+ Add variable</button>
    </div>
  );
}
```

Add minimal CSS to `theme.css`:

```css
.pj-kv-row { display: grid; grid-template-columns: 1fr auto 1fr auto; gap: 8px; align-items: center; margin-bottom: 6px; }
.pj-kv-err { grid-column: 1 / -1; color: #b91c1c; font-size: 12px; }
.pj-invalid { border-color: #b91c1c !important; }
```

- [ ] **Step 5.4: Export + run + commit**

```bash
pnpm test src/ui/components/KVEditor.test.tsx
git add src/ui/
git commit -m "ui: KVEditor primitive"
```

---

## Task 6: UI primitive — Cheatsheet

The pinned Liquid syntax reference for the Templates tab.

**Files:**
- Create: `src/ui/components/Cheatsheet.tsx`, `src/ui/components/Cheatsheet.test.tsx`
- Modify: `src/ui/index.ts`

- [ ] **Step 6.1: Write failing tests**

```tsx
import { render, fireEvent, screen } from '@testing-library/preact';
import { Cheatsheet } from './Cheatsheet';

test('collapses and expands', () => {
  render(<Cheatsheet />);
  expect(screen.queryByText(/interpolation/i)).toBeNull();  // default collapsed
  fireEvent.click(screen.getByRole('button', { name: /cheatsheet/i }));
  expect(screen.getByText(/interpolation/i)).toBeInTheDocument();
});

test('shows Liquid snippets', () => {
  render(<Cheatsheet defaultOpen />);
  expect(screen.getByText(/{{ path.to.value }}/)).toBeInTheDocument();
  expect(screen.getByText(/{% if .* %}/)).toBeInTheDocument();
  expect(screen.getByText(/{% for .* in .* %}/)).toBeInTheDocument();
  expect(screen.getByText(/\| date:/)).toBeInTheDocument();
});
```

- [ ] **Step 6.2: Implement**

`src/ui/components/Cheatsheet.tsx`:

```tsx
import { h } from 'preact';
import { useState } from 'preact/hooks';

const ROWS: Array<[string, string]> = [
  ['Interpolation (escaped)',   '{{ path.to.value }}'],
  ['Raw (no escape)',           '{{ html | raw }}'],
  ['Rule variable',             '{{ vars.env }}'],
  ['Conditional',               '{% if status == "ok" %}…{% else %}…{% endif %}'],
  ['Loop',                      '{% for item in items %}{{ item.name }}{% endfor %}'],
  ['Date',                      '{{ ts | date: "yyyy-MM-dd" }}'],
  ['Link (URL-safe)',           '{{ "https://h/{{id}}" | link }}'],
  ['Number',                    '{{ n | num }}'],
];

export function Cheatsheet({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <aside class="pj-cheatsheet" data-open={open}>
      <button type="button" class="pj-cheatsheet-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '×' : '?'} Cheatsheet
      </button>
      {open && (
        <dl class="pj-cheatsheet-body">
          {ROWS.map(([label, code]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd><code>{code}</code></dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}
```

- [ ] **Step 6.3: Export + run + commit**

```bash
pnpm test src/ui/components/Cheatsheet.test.tsx
git add src/ui/
git commit -m "ui: Cheatsheet primitive (liquid)"
```

---

## Task 7: UI primitive — CodeMirrorBox

A thin Preact wrapper over a CodeMirror 6 `EditorView` so components don't have to juggle lifecycle. Accepts `value`, `onChange`, and `extensions` (extra extensions beyond the defaults). Single-direction flow: `value` prop overrides internal doc on change.

**Files:**
- Create: `src/ui/components/CodeMirrorBox.tsx`, `src/ui/components/CodeMirrorBox.test.tsx`
- Modify: `src/ui/index.ts`

- [ ] **Step 7.1: Write failing tests**

`src/ui/components/CodeMirrorBox.test.tsx`:

```tsx
import { render, screen } from '@testing-library/preact';
import { CodeMirrorBox } from './CodeMirrorBox';

test('mounts and exposes initial value', () => {
  const { container } = render(<CodeMirrorBox value="hello" onChange={() => {}} />);
  expect(container.querySelector('.cm-editor')).toBeTruthy();
  // CodeMirror renders text inside .cm-content
  expect(container.querySelector('.cm-content')?.textContent).toContain('hello');
});

test('updates internal doc when value prop changes', async () => {
  const { container, rerender } = render(<CodeMirrorBox value="a" onChange={() => {}} />);
  rerender(<CodeMirrorBox value="b" onChange={() => {}} />);
  expect(container.querySelector('.cm-content')?.textContent).toContain('b');
});
```

- [ ] **Step 7.2: Implement**

`src/ui/components/CodeMirrorBox.tsx`:

```tsx
import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

export interface CodeMirrorBoxProps {
  value: string;
  onChange: (next: string) => void;
  extensions?: Extension[];
  minHeight?: string;
}

export function CodeMirrorBox({ value, onChange, extensions = [], minHeight = '200px' }: CodeMirrorBoxProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const theme = EditorView.theme({
      '&': { height: '100%', minHeight },
      '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '13px' },
    });
    const updater = EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.state.doc.toString());
    });
    view.current = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap]), theme, updater, ...extensions],
      }),
      parent: host.current,
    });
    return () => view.current?.destroy();
    // deliberately only once — value sync handled in the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div class="pj-cm-box" ref={host} style={{ minHeight }} />;
}
```

- [ ] **Step 7.3: Export + run + commit**

```bash
pnpm test src/ui/components/CodeMirrorBox.test.tsx
git add src/ui/
git commit -m "ui: CodeMirrorBox (thin cm6 wrapper)"
```

---

## Task 8: Hook — useDebounce

**Files:**
- Create: `src/ui/hooks/useDebounce.ts`, `src/ui/hooks/useDebounce.test.ts`
- Modify: `src/ui/index.ts`

- [ ] **Step 8.1: Test**

```ts
import { renderHook, act } from '@testing-library/preact';
import { useDebounce } from './useDebounce';

test('emits after delay and collapses rapid updates', () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook(({ v }: { v: string }) => useDebounce(v, 100), {
    initialProps: { v: 'a' },
  });
  expect(result.current).toBe('a');
  rerender({ v: 'b' });
  rerender({ v: 'c' });
  expect(result.current).toBe('a');
  act(() => { vi.advanceTimersByTime(100); });
  expect(result.current).toBe('c');
  vi.useRealTimers();
});
```

- [ ] **Step 8.2: Implement**

```ts
import { useEffect, useState } from 'preact/hooks';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 8.3: Export + run + commit**

```bash
pnpm test src/ui/hooks/useDebounce.test.ts
git add src/ui/
git commit -m "ui: useDebounce hook"
```

---

## Task 9: Hook — useStorage

Subscribes to `chrome.storage.onChanged` and exposes a reactive view of storage. Uses the existing `createStorage` facade from `src/storage/`.

**Files:**
- Create: `src/ui/hooks/useStorage.ts`, `src/ui/hooks/useStorage.test.ts`
- Modify: `src/ui/index.ts`

- [ ] **Step 9.1: Test** (mock `chrome.storage` via a tiny shim)

```ts
import { renderHook, act } from '@testing-library/preact';
import { useStorage } from './useStorage';

function mockChromeStorage(initial: Record<string, unknown>) {
  const listeners: Array<(c: Record<string, { newValue: unknown }>) => void> = [];
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (_k: string | string[], cb: (v: Record<string, unknown>) => void) => cb(initial),
        set: (patch: Record<string, unknown>) => {
          Object.assign(initial, patch);
          const change: Record<string, { newValue: unknown }> = {};
          for (const k of Object.keys(patch)) change[k] = { newValue: patch[k] };
          listeners.forEach((l) => l(change));
          return Promise.resolve();
        },
      },
      onChanged: { addListener: (l: any) => listeners.push(l), removeListener: () => {} },
    },
  };
}

test('exposes initial + reacts to onChanged', async () => {
  mockChromeStorage({ rules: [{ id: 'r1' }] });
  const { result, rerender } = renderHook(() => useStorage<'rules'>('rules', []));
  await act(async () => {}); // flush get
  expect(result.current[0]).toEqual([{ id: 'r1' }]);
  await act(async () => { (globalThis as any).chrome.storage.local.set({ rules: [{ id: 'r2' }] }); });
  expect(result.current[0]).toEqual([{ id: 'r2' }]);
});
```

- [ ] **Step 9.2: Implement**

```ts
import { useEffect, useState } from 'preact/hooks';

export function useStorage<K extends string, T = unknown>(key: K, fallback: T): [T, (next: T) => Promise<void>] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(key, (rec) => {
      if (cancelled) return;
      setValue((rec as Record<string, T>)[key] ?? fallback);
    });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[key]) setValue(changes[key]!.newValue as T ?? fallback);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => { cancelled = true; chrome.storage.onChanged.removeListener(onChange); };
  }, [key]);

  const write = async (next: T) => {
    setValue(next);
    await chrome.storage.local.set({ [key]: next });
  };

  return [value, write];
}
```

Note: this is a read-through; the options page will wire through the existing `createStorage` facade for the sync/local area-aware writes. For read subscription the raw API is fine because `chrome.storage.onChanged` fires for both areas — we filter by key.

- [ ] **Step 9.3: Export + run + commit**

```bash
pnpm test src/ui/hooks/useStorage.test.ts
git add src/ui/
git commit -m "ui: useStorage hook"
```

---

## Task 10: Hook — useAutosave

Debounces writes, emits `Saved ✓` toast on success, retries on failure with exponential backoff, emits `Save failed — retrying` toast until success or 3 attempts exhausted.

**Files:**
- Create: `src/ui/hooks/useAutosave.ts`, `src/ui/hooks/useAutosave.test.ts`
- Modify: `src/ui/index.ts`

- [ ] **Step 10.1: Test**

```ts
import { renderHook, act } from '@testing-library/preact';
import { useAutosave } from './useAutosave';

test('debounces then calls save once with latest value', async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockResolvedValue(undefined);
  const { rerender } = renderHook(({ v }: { v: number }) => useAutosave(v, save, { delayMs: 100 }), {
    initialProps: { v: 1 },
  });
  rerender({ v: 2 }); rerender({ v: 3 });
  expect(save).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(100); });
  expect(save).toHaveBeenCalledWith(3);
  expect(save).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

test('retries on failure up to 3 times', async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
  const { rerender } = renderHook(({ v }: { v: number }) => useAutosave(v, save, { delayMs: 100 }), {
    initialProps: { v: 1 },
  });
  rerender({ v: 2 });
  await act(async () => { vi.advanceTimersByTime(100); });
  await act(async () => { vi.advanceTimersByTime(500); });  // first retry backoff
  expect(save).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});
```

- [ ] **Step 10.2: Implement**

```ts
import { useEffect, useRef } from 'preact/hooks';
import { useToast } from './useToast';

export interface AutosaveOptions {
  delayMs?: number;
  onSaved?: () => void;
  onFailed?: (err: Error) => void;
  suppressToast?: boolean;
}

export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, opts: AutosaveOptions = {}) {
  const { delayMs = 300, suppressToast = false } = opts;
  const toast = useToast();
  const first = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const attempt = async (tryN: number) => {
      try {
        const p = save(latest.current);
        inFlight.current = p;
        await p;
        if (!suppressToast) toast.push({ kind: 'ok', message: 'Saved ✓', ttlMs: 2000 });
        opts.onSaved?.();
      } catch (err) {
        if (tryN >= 3) {
          if (!suppressToast) toast.push({ kind: 'err', message: 'Save failed — retry?', persistent: true });
          opts.onFailed?.(err as Error);
          return;
        }
        if (!suppressToast) toast.push({ kind: 'warn', message: 'Save failed — retrying', ttlMs: 1500 });
        setTimeout(() => void attempt(tryN + 1), 250 * 2 ** tryN);
      }
    };
    const id = setTimeout(() => void attempt(1), delayMs);
    return () => clearTimeout(id);
  }, [value]);
}
```

(Relies on `useToast` already exported from `src/ui/hooks/useToast.ts`. If `ToastInput` doesn't have a `persistent` flag yet, add it — tiny change.)

- [ ] **Step 10.3: Export + run + commit**

```bash
pnpm test src/ui/hooks/useAutosave.test.ts
git add src/ui/
git commit -m "ui: useAutosave hook (debounce + retry + toast)"
```

---

## Task 11: Options app shell — Preact root + HTML

Replace the imperative DOM in `options.html` + `options.ts` with a Preact SPA.

**Files:**
- Modify: `src/options/options.html` (reduce to `<div id="app">` container)
- Create: `src/options/options.tsx` (Preact entry)
- Create: `src/options/App.tsx` (top-level component)
- Delete: `src/options/options.ts` (replaced by .tsx)
- Modify: `vite.config.ts` if the manifest referenced `options.ts` — keep `options.html` as the input; Vite resolves the `<script type="module" src="./options.tsx">` reference.

- [ ] **Step 11.1: Simplify `options.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Present-JSON · Options</title>
  <link rel="stylesheet" href="/src/ui/theme.css">
  <link rel="stylesheet" href="./options.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./options.tsx"></script>
</body>
</html>
```

- [ ] **Step 11.2: Create `options.tsx`**

```tsx
import { h, render } from 'preact';
import { App } from './App';

const host = document.getElementById('app')!;
render(<App />, host);
```

- [ ] **Step 11.3: Create initial `App.tsx`**

```tsx
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { ToastHost, useTheme } from '../ui';

export function App() {
  useTheme();
  const [tab, setTab] = useState<'rules' | 'templates'>('rules');
  return (
    <div class="pj-app">
      <header class="pj-header">
        <span class="pj-logo">{'{>'}</span>
        <h1>Present-JSON</h1>
        <nav>
          <button class={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>Rules</button>
          <button class={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>Templates</button>
        </nav>
      </header>
      <main>
        {tab === 'rules' ? <RulesTabPlaceholder /> : <TemplatesTabPlaceholder />}
      </main>
      <ToastHost />
    </div>
  );
}

function RulesTabPlaceholder()     { return <p>Rules coming in Task 15.</p>; }
function TemplatesTabPlaceholder() { return <p>Templates coming in Task 21.</p>; }
```

- [ ] **Step 11.4: Delete `options.ts`**

```bash
rm src/options/options.ts
```

- [ ] **Step 11.5: Build + manual check**

```bash
pnpm build
```

Load `dist/` in Chrome, open the options page, verify: header renders, tab buttons switch, no console errors, dark mode works via `prefers-color-scheme`.

- [ ] **Step 11.6: Commit**

```bash
git add src/options/ src/ui/ vite.config.ts
git commit -m "options: preact shell + tab switcher"
```

---

## Task 12: Options header — theme toggle + quota bar

**Files:**
- Create: `src/options/Header.tsx`, `src/options/Header.test.tsx`
- Modify: `src/options/App.tsx` (import)

- [ ] **Step 12.1: Implement `Header.tsx`**

```tsx
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Toggle } from '../ui';
import type { ThemePreference } from '../ui';

export interface HeaderProps {
  tab: 'rules' | 'templates';
  onTab: (t: 'rules' | 'templates') => void;
  themePref: ThemePreference;
  onThemePref: (p: ThemePreference) => void;
}

export function Header({ tab, onTab, themePref, onThemePref }: HeaderProps) {
  const [bytes, setBytes] = useState(0);
  useEffect(() => {
    const update = () => {
      chrome.storage.sync.getBytesInUse(null, (n) => setBytes(n));
    };
    update();
    chrome.storage.onChanged.addListener(update);
    return () => chrome.storage.onChanged.removeListener(update);
  }, []);

  const limit = 102400;  // chrome.storage.sync quota
  const pct = Math.min(100, (bytes / limit) * 100);
  const tone = pct > 80 ? 'red' : pct > 50 ? 'orange' : 'ok';
  const kb = (bytes / 1024).toFixed(1);

  return (
    <header class="pj-header">
      <div class="pj-brand">
        <span class="pj-logo">{'{>'}</span>
        <h1>Present-JSON</h1>
      </div>
      <nav class="pj-tabs">
        <button class={tab === 'rules' ? 'active' : ''} onClick={() => onTab('rules')}>Rules</button>
        <button class={tab === 'templates' ? 'active' : ''} onClick={() => onTab('templates')}>Templates</button>
      </nav>
      <div class="pj-quota" data-tone={tone} title={`${kb} KB of 100 KB sync storage`}>
        <div class="pj-quota-fill" style={{ width: `${pct}%` }} />
        <span class="pj-quota-label">{kb} KB / 100 KB</span>
      </div>
      <select class="pj-theme-toggle" value={themePref}
              onChange={(e) => onThemePref((e.target as HTMLSelectElement).value as ThemePreference)}>
        <option value="system">Auto</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </header>
  );
}
```

- [ ] **Step 12.2: Component test**

```tsx
import { render, screen, fireEvent } from '@testing-library/preact';
import { Header } from './Header';

beforeEach(() => {
  (globalThis as any).chrome = {
    storage: {
      sync: { getBytesInUse: (_k: null, cb: (n: number) => void) => cb(12000) },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  };
});

test('renders quota', async () => {
  render(<Header tab="rules" onTab={() => {}} themePref="system" onThemePref={() => {}} />);
  expect(await screen.findByText(/11\.7 KB/)).toBeInTheDocument();
});

test('fires theme change', () => {
  const onThemePref = vi.fn();
  render(<Header tab="rules" onTab={() => {}} themePref="system" onThemePref={onThemePref} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dark' } });
  expect(onThemePref).toHaveBeenCalledWith('dark');
});
```

- [ ] **Step 12.3: Wire into App.tsx**

Remove the inline `<header>` block from `App.tsx`; replace with:

```tsx
import { Header } from './Header';
import { useStorage } from '../ui';
...
const [settings, setSettings] = useStorage<'settings', { themePreference: ThemePreference }>('settings', { themePreference: 'system' });
...
<Header tab={tab} onTab={setTab}
        themePref={settings.themePreference}
        onThemePref={(p) => setSettings({ ...settings, themePreference: p })} />
```

- [ ] **Step 12.4: Run + commit**

```bash
pnpm test src/options/Header.test.tsx
pnpm build
git add src/options/ src/ui/
git commit -m "options: Header with quota bar + theme toggle"
```

---

## Task 13: Wire useTheme to settings.themePreference

Until now `useTheme` read a one-shot storage value. Update it to subscribe to `settings.themePreference` changes.

**Files:**
- Modify: `src/ui/hooks/useTheme.ts` (add `useStorage`-backed subscription)
- Modify: `src/ui/hooks/useTheme.test.ts`

- [ ] **Step 13.1: Update `useTheme.ts`**

```ts
import { useEffect, useState } from 'preact/hooks';
import { resolveTheme, applyTheme, type ThemePreference } from '../theme';

export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    chrome.storage.local.get('settings', (rec) => {
      const s = (rec as { settings?: { themePreference?: ThemePreference } }).settings;
      if (s?.themePreference) setPref(s.themePreference);
    });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      const s = changes['settings']?.newValue as { themePreference?: ThemePreference } | undefined;
      if (s?.themePreference) setPref(s.themePreference);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(pref);
    applyTheme(resolved);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqChange = () => applyTheme(resolveTheme('system'));
    mq.addEventListener('change', onMqChange);
    return () => mq.removeEventListener('change', onMqChange);
  }, [pref]);
}
```

- [ ] **Step 13.2: Update the test to mock `chrome.storage` and assert data-theme flips**

Minor revision of existing test — add storage mock, assert `document.documentElement.getAttribute('data-theme')` follows pref changes.

- [ ] **Step 13.3: Run + commit**

```bash
pnpm test src/ui/hooks/useTheme.test.ts
git add src/ui/
git commit -m "ui: useTheme subscribes to settings.themePreference"
```

---

## Task 14: Toast host into App.tsx (already imported in Task 11) — sanity check

- [ ] **Step 14.1: Verify ToastHost is mounted in App.tsx and accepts toasts**

Manually: open the options page, run in the DevTools console:

```js
// Toasts push via useToast; we don't have a UI trigger yet. Force one:
window.dispatchEvent(new CustomEvent('pj:toast-test')); // TEMP — not implemented; use hook in later task
```

No formal test needed here since ToastHost already has unit coverage from Plan 1. Skip the step if ToastHost mount is already visible.

---

## Task 15: Rules tab — file skeleton + data wiring

**Files:**
- Create: `src/options/rules/RulesTab.tsx`, `src/options/rules/RulesTab.test.tsx`
- Modify: `src/options/App.tsx` (replace placeholder)

- [ ] **Step 15.1: Implement — split-view shell, no URL tester yet**

```tsx
import { h } from 'preact';
import { useStorage } from '../../ui';
import type { Rule, Templates } from '../../shared/types';
import { RuleStack } from './RuleStack';
import { UrlTester } from './UrlTester';

export function RulesTab() {
  const [rules, setRules] = useStorage<'rules', Rule[]>('rules', []);
  const [templates] = useStorage<'templates', Templates>('templates', {});

  return (
    <div class="pj-rules-tab">
      <section class="pj-rules-left">
        <RuleStack rules={rules} onChange={setRules} templates={templates} />
      </section>
      <section class="pj-rules-right">
        <UrlTester rules={rules} />
      </section>
    </div>
  );
}
```

`src/options/options.css` gets the grid:

```css
.pj-rules-tab { display: grid; grid-template-columns: 65% 35%; gap: 24px; }
.pj-rules-right { position: sticky; top: 16px; align-self: start; }
```

Create stubs for `RuleStack.tsx` and `UrlTester.tsx` that render `<p>stub</p>` so the file compiles.

- [ ] **Step 15.2: Wire into App.tsx, build, commit**

```bash
pnpm build
git add src/options/
git commit -m "options: Rules tab split-view shell"
```

---

## Task 16: Rules tab — RuleStack (cards, drag reorder, enable toggle, add)

**Files:**
- Create: `src/options/rules/RuleStack.tsx`, `src/options/rules/RuleCard.tsx`, `src/options/rules/RuleStack.test.tsx`

- [ ] **Step 16.1: Test first (drag-reorder via a testing-friendly handler)**

```tsx
import { render, fireEvent, screen } from '@testing-library/preact';
import { RuleStack } from './RuleStack';

const r = (id: string, host: string, enabled = true) => ({
  id, hostPattern: host, pathPattern: '/', templateName: 't', variables: {}, enabled,
});

test('renders card per rule + order badges', () => {
  render(<RuleStack rules={[r('a','a.com'), r('b','b.com')]} onChange={() => {}} templates={{ t: '' }} />);
  expect(screen.getByText('a.com · /')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});

test('disable toggle fires onChange with enabled=false', () => {
  const onChange = vi.fn();
  render(<RuleStack rules={[r('a','a.com')]} onChange={onChange} templates={{ t: '' }} />);
  fireEvent.click(screen.getByRole('switch'));
  expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ enabled: false })]);
});

test('add button opens new-rule modal path (fires onEdit sentinel)', () => {
  const onEdit = vi.fn();
  render(<RuleStack rules={[]} onChange={() => {}} templates={{ t: '' }} onEdit={onEdit} />);
  fireEvent.click(screen.getByText(/add rule/i));
  expect(onEdit).toHaveBeenCalledWith(null);
});

test('move up reorders', () => {
  const onChange = vi.fn();
  render(<RuleStack rules={[r('a','a.com'), r('b','b.com')]} onChange={onChange} templates={{ t: '' }} />);
  fireEvent.click(screen.getAllByLabelText('move up')[1]!);
  expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'b' }), expect.objectContaining({ id: 'a' })]);
});
```

- [ ] **Step 16.2: Implement**

`src/options/rules/RuleCard.tsx`:

```tsx
import { h } from 'preact';
import { Toggle } from '../../ui';
import type { Rule } from '../../shared/types';

export interface RuleCardProps {
  rule: Rule;
  index: number;
  total: number;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function RuleCard({ rule, index, total, onToggle, onEdit, onMoveUp, onMoveDown, onDelete }: RuleCardProps) {
  const varCount = Object.keys(rule.variables).length;
  return (
    <article class={`pj-rule-card ${rule.enabled ? 'active' : 'disabled'}`}>
      <div class="pj-rule-num">{index + 1}</div>
      <div class="pj-rule-body" onClick={onEdit}>
        <code class="pj-rule-pattern">{rule.hostPattern} · {rule.pathPattern}</code>
        <span class="pj-rule-template">{rule.templateName}</span>
        {varCount > 0 && <span class="pj-rule-vars">{varCount} var{varCount === 1 ? '' : 's'}</span>}
      </div>
      <div class="pj-rule-controls" onClick={(e) => e.stopPropagation()}>
        <Toggle checked={rule.enabled} onChange={onToggle} />
        <button aria-label="move up" disabled={index === 0} onClick={onMoveUp}>▲</button>
        <button aria-label="move down" disabled={index === total - 1} onClick={onMoveDown}>▼</button>
        <button aria-label="delete" onClick={onDelete}>✕</button>
      </div>
    </article>
  );
}
```

`src/options/rules/RuleStack.tsx`:

```tsx
import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Rule, Templates } from '../../shared/types';
import { RuleCard } from './RuleCard';
import { RuleEditModal } from './RuleEditModal';

export interface RuleStackProps {
  rules: Rule[];
  onChange: (next: Rule[]) => void;
  templates: Templates;
  onEdit?: (idx: number | null) => void;  // test hook
}

export function RuleStack({ rules, onChange, templates, onEdit }: RuleStackProps) {
  const [editing, setEditing] = useState<number | null | undefined>(undefined);
  const open = (idx: number | null) => { onEdit?.(idx); setEditing(idx); };
  const close = () => setEditing(undefined);

  const swap = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= rules.length || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const patch = (i: number, p: Partial<Rule>) => {
    const next = rules.map((r, k) => k === i ? { ...r, ...p } : r);
    onChange(next);
  };
  const save = (rule: Rule, idx: number | null) => {
    if (idx === null) onChange([...rules, rule]);
    else { const next = [...rules]; next[idx] = rule; onChange(next); }
    close();
  };
  const del = (i: number) => onChange(rules.filter((_, k) => k !== i));

  return (
    <div class="pj-rule-stack">
      <div class="pj-rule-stack-header">
        <h2>Rules</h2>
        <button class="pj-primary" onClick={() => open(null)}>+ Add rule</button>
      </div>
      {rules.length === 0 ? (
        <div class="pj-empty">No rules yet. Add your first.</div>
      ) : (
        rules.map((r, i) => (
          <RuleCard key={r.id} rule={r} index={i} total={rules.length}
                    onToggle={(en) => patch(i, { enabled: en })}
                    onEdit={() => open(i)}
                    onMoveUp={() => swap(i, i - 1)}
                    onMoveDown={() => swap(i, i + 1)}
                    onDelete={() => del(i)} />
        ))
      )}
      {editing !== undefined && (
        <RuleEditModal
          initial={editing === null ? null : rules[editing]!}
          templates={templates}
          onSave={(rule) => save(rule, editing ?? null)}
          onCancel={close} />
      )}
    </div>
  );
}
```

Stub `RuleEditModal.tsx` with `export function RuleEditModal() { return null; }` for now — Task 19 fills it in.

- [ ] **Step 16.3: Run + commit**

```bash
pnpm test src/options/rules/RuleStack.test.tsx
git add src/options/
git commit -m "options: RuleStack cards + reorder + toggle"
```

---

## Task 17: Rules tab — UrlTester

Large monospace URL input, per-rule match readout that reflects the same matcher the content script uses (`src/matcher/matcher.ts`), with "shadowed by rule N" reasoning.

**Files:**
- Create: `src/options/rules/UrlTester.tsx`, `src/options/rules/UrlTester.test.tsx`

- [ ] **Step 17.1: Test**

```tsx
import { render, fireEvent, screen } from '@testing-library/preact';
import { UrlTester } from './UrlTester';

const r = (id: string, host: string, path = '/') =>
  ({ id, hostPattern: host, pathPattern: path, templateName: 't', variables: {}, enabled: true });

test('shows match + shadowed', () => {
  render(<UrlTester rules={[r('a','*.api.com'), r('b','api.com','/v2/**')]} />);
  fireEvent.input(screen.getByPlaceholderText(/paste any url/i),
    { target: { value: 'https://api.api.com/v2/users' } });
  expect(screen.getByText(/✅/)).toBeInTheDocument();           // rule a matches
  expect(screen.getByText(/shadowed/i)).toBeInTheDocument();    // rule b shadowed
});

test('miss reason: host', () => {
  render(<UrlTester rules={[r('a','127.0.0.1')]} />);
  fireEvent.input(screen.getByPlaceholderText(/paste any url/i),
    { target: { value: 'https://api.api.com/users' } });
  expect(screen.getByText(/host/i)).toBeInTheDocument();
});
```

- [ ] **Step 17.2: Implement**

```tsx
import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { findMatchingRule, matchesHost, matchesPath } from '../../matcher/matcher';
import type { Rule } from '../../shared/types';

export interface UrlTesterProps { rules: Rule[]; }

export function UrlTester({ rules }: UrlTesterProps) {
  const [url, setUrl] = useState('');
  const rows = useMemo(() => {
    if (!url) return rules.map((r) => ({ rule: r, state: 'idle' as const }));
    let parsed: URL | null = null;
    try { parsed = new URL(url); } catch { parsed = null; }
    if (!parsed) return rules.map((r) => ({ rule: r, state: 'invalid' as const }));
    const winner = findMatchingRule(parsed.hostname, parsed.pathname, rules);
    return rules.map((r) => {
      if (!r.enabled) return { rule: r, state: 'disabled' as const };
      const hostOk = matchesHost(parsed!.hostname, r.hostPattern);
      const pathOk = matchesPath(parsed!.pathname, r.pathPattern);
      if (r === winner) return { rule: r, state: 'match' as const };
      if (hostOk && pathOk && winner && winner !== r) return { rule: r, state: 'shadowed' as const };
      if (!hostOk) return { rule: r, state: 'miss-host' as const };
      return { rule: r, state: 'miss-path' as const };
    });
  }, [url, rules]);

  return (
    <div class="pj-url-tester">
      <h2>URL tester</h2>
      <input class="pj-url-input" placeholder="Paste any URL to test"
             value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} />
      <ol class="pj-url-results">
        {rows.map(({ rule, state }) => (
          <li key={rule.id} data-state={state}>
            <span class="pj-icon">{ICONS[state]}</span>
            <code>{rule.hostPattern} · {rule.pathPattern}</code>
            <span class="pj-reason">{REASONS[state]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ICONS: Record<string, string> = { match: '✅', 'miss-host': '⏸', 'miss-path': '⏸', shadowed: '⚠', disabled: '—', idle: '·', invalid: '?' };
const REASONS: Record<string, string> = {
  match: 'matches',
  'miss-host': "host doesn't match",
  'miss-path': "path doesn't match",
  shadowed: 'shadowed by an earlier rule',
  disabled: 'disabled',
  idle: '',
  invalid: 'invalid URL',
};
```

Note: `matchesHost` and `matchesPath` need to be exported from `src/matcher/matcher.ts` — add named exports; the existing `findMatchingRule` stays. If they don't exist, extract them from the current private helpers.

- [ ] **Step 17.3: Run + commit**

```bash
pnpm test src/options/rules/UrlTester.test.tsx
git add src/options/ src/matcher/
git commit -m "options: URL tester with shadowed/miss reasoning"
```

---

## Task 18: Matcher API — expose helpers

Verify `src/matcher/matcher.ts` exports `matchesHost` and `matchesPath`. If not, export them and add test coverage.

- [ ] **Step 18.1: Grep**

```bash
rg 'export function matches(Host|Path)' src/matcher
```

If missing:

- [ ] **Step 18.2: Extract + export**

Factor the internal logic into exported helpers, keep `findMatchingRule` composed from them.

- [ ] **Step 18.3: Run existing matcher tests + commit**

```bash
pnpm test src/matcher
git add src/matcher/
git commit -m "matcher: export matchesHost/matchesPath"
```

---

## Task 19: Rule edit modal overhaul

**Files:**
- Replace stub: `src/options/rules/RuleEditModal.tsx`
- Create: `src/options/rules/RuleEditModal.test.tsx`
- Create: `src/options/rules/PatternField.tsx` (reused for host & path)

- [ ] **Step 19.1: `PatternField.tsx`**

```tsx
import { h } from 'preact';
import { useState } from 'preact/hooks';

export interface PatternFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  examples: string[];
  validate: (v: string) => string | null;  // returns error message or null
}

export function PatternField({ label, value, onChange, examples, validate }: PatternFieldProps) {
  const [showExamples, setShowExamples] = useState(false);
  const err = validate(value);
  return (
    <div class="pj-pattern-field">
      <label>{label}</label>
      <input class={err ? 'pj-invalid' : ''} value={value}
             onInput={(e) => onChange((e.target as HTMLInputElement).value)} />
      {err && <div class="pj-field-err">{err}</div>}
      <button type="button" class="pj-subtle" onClick={() => setShowExamples((v) => !v)}>
        {showExamples ? '▾' : '▸'} Examples
      </button>
      {showExamples && (
        <ul class="pj-examples">
          {examples.map((ex) => (
            <li key={ex}>
              <button type="button" onClick={() => onChange(ex)}><code>{ex}</code></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 19.2: `RuleEditModal.tsx`**

```tsx
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Toggle, KVEditor } from '../../ui';
import { PatternField } from './PatternField';
import type { Rule, Templates } from '../../shared/types';
import { isValidHostPattern, isValidPathPattern } from '../../matcher/glob';

export interface RuleEditModalProps {
  initial: Rule | null;
  templates: Templates;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}

const EMPTY: Omit<Rule, 'id'> = {
  hostPattern: '', pathPattern: '', templateName: '', variables: {}, enabled: true,
};

export function RuleEditModal({ initial, templates, onSave, onCancel }: RuleEditModalProps) {
  const [rule, setRule] = useState<Rule>(() =>
    initial ? structuredClone(initial) : { id: `rule-${Date.now()}`, ...EMPTY, templateName: Object.keys(templates)[0] ?? '' });

  const hostErr = isValidHostPattern(rule.hostPattern) ? null : 'Invalid glob or regex';
  const pathErr = isValidPathPattern(rule.pathPattern) ? null : 'Invalid glob or regex';
  const canSave = !hostErr && !pathErr && rule.templateName;

  return (
    <div class="pj-modal-backdrop" onClick={onCancel}>
      <dialog open class="pj-modal" onClick={(e) => e.stopPropagation()}>
        <header class="pj-modal-header">
          <h3>{initial ? `Edit rule · ${initial.id}` : 'New rule'}</h3>
          <Toggle label="Enabled" checked={rule.enabled}
                  onChange={(en) => setRule({ ...rule, enabled: en })} />
        </header>
        <PatternField label="Host pattern" value={rule.hostPattern}
                      onChange={(v) => setRule({ ...rule, hostPattern: v })}
                      examples={['*.server.com', '127.0.0.1', '/^admin.*/', 'api.example.com']}
                      validate={() => hostErr} />
        <PatternField label="Path pattern" value={rule.pathPattern}
                      onChange={(v) => setRule({ ...rule, pathPattern: v })}
                      examples={['/', '/api/**', '/users/*', '/^/v2/.*$/']}
                      validate={() => pathErr} />
        <div class="pj-field">
          <label>Template</label>
          <select value={rule.templateName}
                  onChange={(e) => setRule({ ...rule, templateName: (e.target as HTMLSelectElement).value })}>
            {Object.keys(templates).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div class="pj-field">
          <label>Variables</label>
          <KVEditor value={rule.variables} onChange={(vars) => setRule({ ...rule, variables: vars })} />
        </div>
        <footer class="pj-modal-footer">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={() => canSave && onSave(rule)}>
            Save changes
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
```

- [ ] **Step 19.3: Add `isValidHostPattern` / `isValidPathPattern` to `src/matcher/glob.ts`**

Wrap the existing glob/regex parser in a try/catch — any thrown error is a validation failure. Empty string is valid for host (spec says empty means any), invalid for path (needs leading `/`).

- [ ] **Step 19.4: Component test**

```tsx
test('shows validation error on invalid regex', () => {
  render(<RuleEditModal initial={null} templates={{ t: '' }} onSave={() => {}} onCancel={() => {}} />);
  fireEvent.input(screen.getByLabelText('Host pattern'), { target: { value: '/^(unclosed/' } });
  expect(screen.getByText(/invalid glob or regex/i)).toBeInTheDocument();
});

test('save button disabled when host invalid', () => {
  render(<RuleEditModal initial={null} templates={{ t: '' }} onSave={() => {}} onCancel={() => {}} />);
  fireEvent.input(screen.getByLabelText('Host pattern'), { target: { value: '/^(x/' } });
  expect(screen.getByText('Save changes')).toBeDisabled();
});
```

- [ ] **Step 19.5: Run + commit**

```bash
pnpm test src/options/rules/
git add src/options/ src/matcher/
git commit -m "options: rule edit modal with validation + KVEditor"
```

---

## Task 20: Wire modal open / save path through App.tsx

Already wired in Task 16's `RuleStack`. Sanity-check end to end in the build, then commit any last tweaks.

```bash
pnpm build
# load in Chrome, add a rule, edit it, toggle enabled, reorder, delete.
```

If behavior diverges from the spec, fix inline and commit.

---

## Task 21: Templates tab — shell + CodeMirror editor + Liquid grammar

**Files:**
- Create: `src/options/templates/TemplatesTab.tsx`, `TemplateEditor.tsx`, `SampleJsonEditor.tsx`, `PreviewIframe.tsx`
- Create: `src/options/templates/liquidMode.ts` (CodeMirror language mode)
- Modify: `src/options/App.tsx`

- [ ] **Step 21.1: `liquidMode.ts`**

```ts
import { StreamLanguage } from '@codemirror/language';
import { handlebars } from '@codemirror/legacy-modes/mode/handlebars';
// Handlebars mode already recognizes {{ }} and (roughly) {% %}; good-enough v1.
export const liquid = StreamLanguage.define(handlebars);
```

(If `@codemirror/legacy-modes/mode/handlebars` does not export what we need, swap to `@codemirror/legacy-modes/mode/htmlembedded` or write a ~40-line hand-rolled StreamParser that tokenizes `{{ … }}` and `{% … %}` — either is acceptable; we don't need deep Liquid AST, just coloring. Record the chosen approach in the commit message.)

- [ ] **Step 21.2: Liquid autocomplete source**

`src/options/templates/liquidCompletions.ts`:

```ts
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const HELPERS = ['date', 'link', 'num', 'raw'];
const TAGS    = ['if', 'else', 'endif', 'for', 'endfor', 'unless', 'endunless', 'assign', 'capture', 'endcapture'];

export function liquidCompletions(sampleJsonPaths: string[], ruleVars: string[]) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const word = ctx.matchBefore(/[\w.@]*/);
    if (!word || (word.from === word.to && !ctx.explicit)) return null;
    const before = ctx.state.doc.sliceString(Math.max(0, ctx.pos - 20), ctx.pos);
    const inOutput = /\{\{\s*[\w.@]*$/.test(before);
    const inTag    = /\{%\s*[\w]*$/.test(before);
    const afterPipe = /\|\s*\w*$/.test(before);

    const options = [];
    if (inOutput || afterPipe) {
      for (const h of HELPERS) options.push({ label: h, type: 'function' });
    }
    if (inOutput) {
      for (const p of sampleJsonPaths) options.push({ label: p, type: 'variable' });
      for (const v of ruleVars)        options.push({ label: `vars.${v}`, type: 'variable' });
    }
    if (inTag) {
      for (const t of TAGS) options.push({ label: t, type: 'keyword' });
    }
    if (options.length === 0) return null;
    return { from: word.from, options };
  };
}

export function walkJsonPaths(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(path);
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...walkJsonPaths(v, path));
  }
  return out;
}
```

- [ ] **Step 21.3: `TemplateEditor.tsx`**

```tsx
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { autocompletion } from '@codemirror/autocomplete';
import { CodeMirrorBox } from '../../ui';
import { liquid } from './liquidMode';
import { liquidCompletions, walkJsonPaths } from './liquidCompletions';

export interface TemplateEditorProps {
  value: string;
  onChange: (v: string) => void;
  sampleJson: unknown;
  ruleVars: string[];
}

export function TemplateEditor({ value, onChange, sampleJson, ruleVars }: TemplateEditorProps) {
  const completions = useMemo(() =>
    liquidCompletions(walkJsonPaths(sampleJson), ruleVars), [sampleJson, ruleVars]);
  const extensions = useMemo(() => [liquid, autocompletion({ override: [completions] })], [completions]);
  return <CodeMirrorBox value={value} onChange={onChange} extensions={extensions} minHeight="400px" />;
}
```

- [ ] **Step 21.4: `SampleJsonEditor.tsx` (small JSON editor)**

```tsx
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { json } from '@codemirror/lang-json';
import { CodeMirrorBox } from '../../ui';

export function SampleJsonEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ext = useMemo(() => [json()], []);
  return <CodeMirrorBox value={value} onChange={onChange} extensions={ext} minHeight="180px" />;
}
```

- [ ] **Step 21.5: `PreviewIframe.tsx`**

```tsx
import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { render as renderTemplate } from '../../engine/engine';
import { useDebounce } from '../../ui';

export function PreviewIframe({ template, sampleJsonText, vars }: { template: string; sampleJsonText: string; vars: Record<string, string> }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const debouncedTpl = useDebounce(template, 250);
  const debouncedJson = useDebounce(sampleJsonText, 250);

  useEffect(() => {
    let json: unknown = {};
    try { json = debouncedJson ? JSON.parse(debouncedJson) : {}; } catch {}
    let html: string;
    try { html = renderTemplate(debouncedTpl, json, vars); }
    catch (err) { html = `<pre style="color:#b91c1c">${(err as Error).message}</pre>`; }
    if (frame.current) frame.current.srcdoc = html;
  }, [debouncedTpl, debouncedJson, vars]);

  return <iframe class="pj-preview-iframe" sandbox="allow-same-origin" ref={frame} />;
}
```

- [ ] **Step 21.6: `TemplatesTab.tsx`**

```tsx
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Cheatsheet, useStorage } from '../../ui';
import type { Templates } from '../../shared/types';
import { TemplateEditor } from './TemplateEditor';
import { SampleJsonEditor } from './SampleJsonEditor';
import { PreviewIframe } from './PreviewIframe';
import { TemplatesToolbar } from './TemplatesToolbar';

export function TemplatesTab() {
  const [templates, setTemplates] = useStorage<'templates', Templates>('templates', {});
  const [samples, setSamples] = useStorage<'sampleJson', Record<string, string>>('sampleJson', {});
  const [current, setCurrent] = useState<string | null>(null);

  const active = current ?? Object.keys(templates)[0] ?? null;
  const tpl = active ? templates[active] ?? '' : '';
  const sample = active ? samples[active] ?? '{}' : '{}';

  return (
    <div class="pj-templates-tab">
      <TemplatesToolbar
        templates={templates} current={active}
        onSelect={setCurrent}
        onChange={setTemplates} />
      {active && (
        <div class="pj-templates-body">
          <section class="pj-templates-editor">
            <TemplateEditor value={tpl}
                            onChange={(v) => setTemplates({ ...templates, [active]: v })}
                            sampleJson={safeParse(sample)}
                            ruleVars={[]} />
          </section>
          <section class="pj-templates-preview">
            <SampleJsonEditor value={sample}
                              onChange={(v) => setSamples({ ...samples, [active]: v })} />
            <PreviewIframe template={tpl} sampleJsonText={sample} vars={{}} />
          </section>
          <Cheatsheet />
        </div>
      )}
    </div>
  );
}

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return {}; } }
```

- [ ] **Step 21.7: `TemplatesToolbar.tsx`** (stub first, full impl in Task 22)

```tsx
export function TemplatesToolbar({ templates, current, onSelect }: any) {
  return (
    <div class="pj-templates-toolbar">
      <select value={current ?? ''} onChange={(e) => onSelect((e.target as HTMLSelectElement).value)}>
        {Object.keys(templates).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      {/* New / Duplicate / Delete come in Task 22 */}
    </div>
  );
}
```

- [ ] **Step 21.8: Wire into App.tsx, build, manual check**

Open options page, switch to Templates tab, verify: CodeMirror editor mounts with line numbers, typing `{{` shows autocomplete suggestions including JSON paths, preview iframe updates on debounce.

```bash
pnpm build
```

- [ ] **Step 21.9: Update the Task 3 smoke test selector**

`test/e2e/cm-csp-smoke.spec.ts` — point at the real editor (`.pj-templates-editor .cm-editor`). Requires navigating to the Templates tab in the test.

- [ ] **Step 21.10: Commit**

```bash
git add src/options/ test/e2e/
git commit -m "options: Templates tab with cm6 editor + liquid autocomplete + preview"
```

---

## Task 22: Templates toolbar — new / rename / duplicate / delete (with guard)

- [ ] **Step 22.1: Test**

```tsx
import { render, fireEvent, screen } from '@testing-library/preact';
import { TemplatesToolbar } from './TemplatesToolbar';

test('new template creates blank entry', () => {
  const onChange = vi.fn();
  render(<TemplatesToolbar templates={{ a: 'x' }} current="a" onSelect={() => {}} onChange={onChange} rules={[]} />);
  window.prompt = () => 'b';
  fireEvent.click(screen.getByText('New'));
  expect(onChange).toHaveBeenCalledWith({ a: 'x', b: '' });
});

test('delete with referencing rule opens confirm modal', () => {
  const onChange = vi.fn();
  const rules = [{ id: 'r1', hostPattern: '*', pathPattern: '/', templateName: 'a', variables: {}, enabled: true }];
  render(<TemplatesToolbar templates={{ a: 'x' }} current="a" onSelect={() => {}} onChange={onChange} rules={rules} onDisableRules={() => {}} />);
  fireEvent.click(screen.getByText('Delete'));
  expect(screen.getByText(/affected rules/i)).toBeInTheDocument();
});
```

- [ ] **Step 22.2: Implement**

```tsx
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Button } from '../../ui';
import type { Rule, Templates } from '../../shared/types';

export interface TemplatesToolbarProps {
  templates: Templates;
  current: string | null;
  onSelect: (name: string) => void;
  onChange: (next: Templates) => void;
  rules: Rule[];
  onDisableRules?: (ids: string[]) => void;
}

export function TemplatesToolbar({ templates, current, onSelect, onChange, rules, onDisableRules }: TemplatesToolbarProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const doNew = () => {
    const name = window.prompt('New template name');
    if (!name || templates[name] !== undefined) return;
    onChange({ ...templates, [name]: '' });
    onSelect(name);
  };
  const doRename = () => {
    if (!current) return;
    const next = window.prompt('Rename to', current);
    if (!next || next === current || templates[next] !== undefined) return;
    const nextMap: Templates = {};
    for (const [k, v] of Object.entries(templates)) nextMap[k === current ? next : k] = v;
    onChange(nextMap);
    onSelect(next);
  };
  const doDuplicate = () => {
    if (!current) return;
    const copy = `${current}-copy`;
    if (templates[copy] !== undefined) return;
    onChange({ ...templates, [copy]: templates[current]! });
    onSelect(copy);
  };
  const doDelete = () => { if (current) setConfirmDelete(current); };

  const affected = confirmDelete ? rules.filter((r) => r.templateName === confirmDelete) : [];

  return (
    <div class="pj-templates-toolbar">
      <select value={current ?? ''} onChange={(e) => onSelect((e.target as HTMLSelectElement).value)}>
        {Object.keys(templates).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <Button onClick={doNew}>New</Button>
      <Button onClick={doRename}>Rename</Button>
      <Button onClick={doDuplicate}>Duplicate</Button>
      <Button onClick={doDelete} variant="danger">Delete</Button>

      {confirmDelete && (
        <div class="pj-modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <dialog open class="pj-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete template "{confirmDelete}"?</h3>
            {affected.length > 0 && (
              <>
                <p>Affected rules (will be disabled):</p>
                <ul>{affected.map((r) => <li key={r.id}><code>{r.hostPattern} · {r.pathPattern}</code></li>)}</ul>
              </>
            )}
            <footer class="pj-modal-footer">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => {
                const next = { ...templates }; delete next[confirmDelete!];
                onChange(next);
                if (affected.length > 0) onDisableRules?.(affected.map((r) => r.id));
                setConfirmDelete(null);
                onSelect(Object.keys(next)[0] ?? '');
              }}>
                {affected.length > 0 ? 'Delete template + disable rules' : 'Delete'}
              </Button>
            </footer>
          </dialog>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 22.3: Wire `onDisableRules` through `TemplatesTab` → `App`**

Add a prop to `TemplatesTab` that receives `setRules` and flips `enabled` to `false` for the given ids.

- [ ] **Step 22.4: Run + commit**

```bash
pnpm test src/options/templates/
git add src/options/
git commit -m "options: templates toolbar with delete guard"
```

---

## Task 23: Per-template migration banner

Task 15 of Plan 2 silently migrated templates. Surface a dismissible banner per migrated template (tracked in a new storage key `pj_migrated_v2: string[]`).

**Files:**
- Modify: `src/storage/migration.ts` (write the list)
- Modify: `src/options/templates/TemplatesTab.tsx` (render banner)

- [ ] **Step 23.1: Migration writes the list**

In `migrateTemplatesToV2`, after a successful batch write, also write `pj_migrated_v2: Object.keys(migrated)`.

- [ ] **Step 23.2: Banner**

In `TemplatesTab.tsx`, above the editor:

```tsx
const [migrated, setMigrated] = useStorage<'pj_migrated_v2', string[]>('pj_migrated_v2', []);
...
{active && migrated.includes(active) && (
  <div class="pj-banner" role="status">
    Migrated to Liquid syntax. Review and confirm.
    <button onClick={() => setMigrated(migrated.filter((n) => n !== active))}>Dismiss</button>
  </div>
)}
```

Banner also auto-dismisses on save (wire this in autosave hookup — Task 28).

- [ ] **Step 23.3: Commit**

```bash
git add src/storage/ src/options/
git commit -m "options: per-template liquid-migration banner"
```

---

## Task 24: Starter AI-hint + friendly header

QOL: every bundled starter begins with a header block that (a) helps LLMs infer the grammar and (b) is friendlier to humans.

**Files:**
- Modify: `src/starter/internal-user.html`, `src/starter/github-repo.html`

- [ ] **Step 24.1: Insert header on each starter**

Prepend:

```html
{%- comment -%}
  Present-JSON starter template.
  Grammar: LiquidJS (https://liquidjs.com).
  Quick reference:
    {{ path.to.value }}            - HTML-escaped interpolation
    {{ html | raw }}               - raw (no escape)
    {{ vars.env }}                 - rule variables
    {% if x == "y" %}...{% endif %} - conditional
    {% for item in items %}...{% endfor %} - loop
    {{ ts | date: "yyyy-MM-dd" }}  - date helper
    {{ "https://host/{{id}}" | link }} - URL-safe link
  Docs: see README.md
{%- endcomment -%}
```

(Liquid `{% comment %}` blocks are stripped at render time, so this doesn't leak into output.)

- [ ] **Step 24.2: Regenerate existing starter fixtures if any tests snapshot them**

```bash
pnpm test
```

Update snapshots where the banner now appears in template bodies. Verify render output is unchanged (comments are stripped).

- [ ] **Step 24.3: Commit**

```bash
git add src/starter/
git commit -m "starters: inline liquid syntax docs header"
```

---

## Task 25: Remembered sample JSON

Already wired in Task 21's `TemplatesTab` via `useStorage<'sampleJson', …>`. Verify:

- [ ] **Step 25.1: Manual check** — open templates tab, type JSON in the sample editor, switch template, switch back; JSON persists. Reload page; JSON persists.

- [ ] **Step 25.2: E2E test**

```ts
// test/e2e/template-sample-persist.spec.ts
test('sample JSON persists per template across reload', async ({ page }) => {
  await page.goto(`chrome-extension://${extId}/src/options/options.html`);
  await page.getByText('Templates').click();
  await page.locator('.pj-templates-preview .cm-content').first().fill('{"foo":1}');
  await page.reload();
  await expect(page.locator('.pj-templates-preview .cm-content').first()).toContainText('"foo":1');
});
```

(`fill` against a `.cm-content` isn't standard — use `page.keyboard.type()` after click; the exact API is CM6-specific. If the test is flaky, swap to asserting via storage read.)

- [ ] **Step 25.3: Commit**

```bash
git add test/e2e/
git commit -m "test(e2e): sample json persists per template"
```

---

## Task 26: URL-tester "Try these" chips (UI reserved, wiring Phase 3)

Per spec: reserve the chip UI. Render a row of chips above the URL input with placeholder labels; clicking fills the input.

- [ ] **Step 26.1: Add chips**

In `UrlTester.tsx`, above the input:

```tsx
const CHIPS = ['https://api.github.com/repos/MattAltermatt/present-json', 'http://127.0.0.1:4391/user'];
...
<div class="pj-chips">
  {CHIPS.map((u) => <button key={u} class="pj-chip" onClick={() => setUrl(u)}>{new URL(u).host}</button>)}
</div>
```

- [ ] **Step 26.2: Commit**

```bash
git add src/options/
git commit -m "options: url-tester 'try these' chips"
```

---

## Task 27: Keyboard shortcuts footer + `⌘/` to focus URL tester

- [ ] **Step 27.1: Footer component**

`src/options/ShortcutsFooter.tsx`:

```tsx
export function ShortcutsFooter() {
  const [open, setOpen] = useState(false);
  return (
    <footer class="pj-shortcuts">
      <button onClick={() => setOpen((v) => !v)}>{open ? '▾' : '▸'} Keyboard shortcuts</button>
      {open && (
        <dl>
          <dt>⌘⇧J</dt><dd>toggle raw/rendered on a matched page</dd>
          <dt>⌘⇧C</dt><dd>copy current tab's URL</dd>
          <dt>⌘/</dt><dd>focus URL tester (options page)</dd>
          <dt>⌘S</dt><dd>disabled — your changes autosave</dd>
          <dt>?</dt><dd>open this panel</dd>
        </dl>
      )}
    </footer>
  );
}
```

- [ ] **Step 27.2: `⌘/` handler in App.tsx**

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      document.querySelector<HTMLInputElement>('.pj-url-input')?.focus();
    }
    if (e.key === '?' && !(e.target as HTMLElement).matches('input, textarea, .cm-content')) {
      setShortcutsOpen((v) => !v);
    }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, []);
```

- [ ] **Step 27.3: Commit**

```bash
git add src/options/
git commit -m "options: shortcuts footer + ⌘/ focus url tester"
```

---

## Task 28: Autosave wiring — Rules + Templates

Until now `useStorage` writes through on every `setRules` / `setTemplates` call. That's fine for correctness but misses the debounce + toast UX. Layer `useAutosave` on top.

- [ ] **Step 28.1: In `App.tsx`, replace the raw `useStorage` write with a split pattern**

```tsx
const [rulesRemote, writeRules] = useStorage<'rules', Rule[]>('rules', []);
const [rulesLocal, setRulesLocal] = useState<Rule[]>(rulesRemote);
useEffect(() => setRulesLocal(rulesRemote), [rulesRemote]);
useAutosave(rulesLocal, writeRules, { delayMs: 300 });
```

Same pattern for `templates` and `settings`. Pass `rulesLocal` and `setRulesLocal` down to the UI.

- [ ] **Step 28.2: Undo for destructive actions**

Add a helper in `App.tsx`:

```tsx
const toast = useToast();
const withUndo = <T,>(label: string, prev: T, setter: (v: T) => void) => {
  toast.push({
    kind: 'undo', message: `${label} · Undo`, ttlMs: 8000,
    onClick: () => setter(prev),
  });
};
```

Thread `withUndo` into the delete paths in `RuleStack` and `TemplatesToolbar`.

(`useToast` needs a `'undo'` variant; extend `ToastVariant` + `Toast` CSS.)

- [ ] **Step 28.3: Commit**

```bash
git add src/options/ src/ui/
git commit -m "options: autosave + undo for destructive actions"
```

---

## Task 29: Dark mode final pass

- [ ] **Step 29.1: Walk every new component** (`RuleCard`, `UrlTester`, `RuleEditModal`, `PatternField`, `KVEditor`, `Cheatsheet`, `TemplatesToolbar`, `PreviewIframe`, `CodeMirrorBox`) and ensure no hard-coded colors leaked past `var(--bg)` / `var(--fg)` / `var(--accent)` / `var(--border)` / `var(--muted-bg)` / `var(--muted-fg)`.

- [ ] **Step 29.2: CodeMirror theme binding**

`src/ui/components/CodeMirrorBox.tsx` — the inline theme extension hardcodes font but not bg/fg. Replace with a CSS-var-driven theme:

```ts
const theme = EditorView.theme({
  '&': { height: '100%', minHeight, backgroundColor: 'var(--bg)', color: 'var(--fg)' },
  '.cm-gutters': { backgroundColor: 'var(--muted-bg)', color: 'var(--muted-fg)', border: 0 },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-selection, rgba(234,88,12,0.25))' },
});
```

- [ ] **Step 29.3: Manual check — light + dark, both tabs, modal open, preview visible**

- [ ] **Step 29.4: Commit**

```bash
git add src/options/ src/ui/
git commit -m "options: dark-mode token pass on all new components"
```

---

## Task 30: Axe-core accessibility sweep

- [ ] **Step 30.1: Install**

```bash
pnpm add -D @axe-core/playwright
```

- [ ] **Step 30.2: Test**

`test/e2e/a11y-options.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';

test('options page has no axe violations', async ({ page }, testInfo) => {
  await page.goto(`chrome-extension://${extId}/src/options/options.html`);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 30.3: Fix any findings** (common ones: missing `aria-label` on icon-only buttons, color contrast in dark mode).

- [ ] **Step 30.4: Commit**

```bash
git add test/e2e/ src/
git commit -m "test(e2e): axe-core accessibility sweep on options"
```

---

## Task 31: Full E2E Playwright — CRUD flows

`test/e2e/options-crud.spec.ts`:

- Add rule → autosave toast appears → reload → rule persists.
- Edit rule (change template via modal) → save → autosave toast.
- Delete rule → undo toast → click undo → rule restored.
- URL tester shows match on matching URL + shadowed on shadowed URL.
- Templates tab: create new template → autosave → switch templates → content preserved per template.
- Delete template with referencing rule → confirm modal lists rule → confirm → rule flipped to disabled.

- [ ] **Step 31.1: Implement (single spec file)**

Keep it under ~200 lines; each scenario a `test()`. Use a shared `beforeEach` that seeds `chrome.storage.local` via an in-page `chrome.storage.local.set(...)` `evaluate` call before navigating to the options page.

- [ ] **Step 31.2: Run + commit**

```bash
pnpm build && pnpm test:e2e test/e2e/options-crud.spec.ts
git add test/e2e/
git commit -m "test(e2e): options CRUD + undo + url tester"
```

---

## Task 32: Snapshot visual regression (optional but committed)

- [ ] **Step 32.1: Playwright `expect(page).toHaveScreenshot()`** on:
  - Rules tab populated (light + dark)
  - Templates tab with editor + preview (light + dark)
  - Rule edit modal with validation error

Commit baselines to `test/e2e/__screenshots__/`.

```bash
pnpm test:e2e test/e2e/visual.spec.ts --update-snapshots
git add test/e2e/
git commit -m "test(e2e): visual regression baselines"
```

---

## Task 33: Consolidation checkpoint

Before code review, run the full local gate:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

All green. Push the branch:

```bash
git push -u origin feature/phase2-plan3-options
```

---

## Task 34: Code review — fresh reviewer agent

Matt's standard flow: dispatch a fresh reviewer with no implementation context.

Suggested dispatch:

> Review the full diff of `feature/phase2-plan3-options` against `main`. Focus areas: Preact component boundaries; autosave correctness (debounce, retry, undo semantics); CodeMirror lifecycle (mount/unmount, value-prop sync); CSP compliance (no `unsafe-eval` introduced); accessibility (keyboard flow in modals, focus return); test coverage vs. `docs/superpowers/plans/2026-04-18-phase2-plan3-options.md`. Report must flag: any chrome.* call inside `src/engine/` or `src/matcher/` (purity regression), any inline `style` with hardcoded colors (dark-mode leak), any new CSP-relevant import. Max 20 findings, prioritized.

Address findings in fresh commits on the same branch.

---

## Task 35: Docs update

- [ ] **Step 35.1: `CLAUDE.md`**
  - Add `src/ui/components/` enumeration: Menu, KVEditor, Cheatsheet, CodeMirrorBox.
  - Add `src/ui/hooks/` enumeration: useStorage, useDebounce, useAutosave.
  - Replace the imperative-DOM description of `src/options/options.ts` with the Preact SPA structure (App, RulesTab, TemplatesTab, modal tree).
  - Add "CodeMirror runs under MV3 CSP; verified by `test/e2e/cm-csp-smoke.spec.ts`" as a gotcha.

- [ ] **Step 35.2: `README.md`**
  - Feature bullets: split-view rules, URL tester, CodeMirror editor with Liquid autocomplete, autosave, dark mode.
  - Updated screenshot (manual capture).

- [ ] **Step 35.3: `ROADMAP.md`**
  - Mark **Phase 2 Plan 3 (options page rewrite)** done with today's date.
  - Prune completed backlog items under Phase 2.
  - Note: popup (Plan 4) and top-strip (Plan 5) remain.

- [ ] **Step 35.4: Commit**

```bash
git add CLAUDE.md README.md ROADMAP.md
git commit -m "docs: phase 2 plan 3 shipped (options page rewrite)"
```

---

## Task 36: Hand off for manual verification

Push, summarize what to eyeball in Chrome, wait for Matt's go-ahead before FF-merging.

```bash
git push
```

Summary format:

> Plan 3 done on `feature/phase2-plan3-options`. Things to eyeball:
> - Rules tab: add/edit/delete/reorder, toggle enabled, autosave toast, Undo toast on delete.
> - URL tester: paste a URL that matches one rule and is shadowed by another; verify icons + copy.
> - Templates tab: CodeMirror editor, type `{{` to trigger autocomplete (JSON paths + helpers); preview re-renders on debounce; cheatsheet expand.
> - Template delete with a referencing rule → confirm modal lists the rule → delete flips rule enabled=false.
> - Dark mode: toggle in header; system-mode reacts to OS preference change.
> - Keyboard: ⌘/ focuses URL tester; ⌘S shows a tooltip, doesn't save.

Wait for explicit approval.

---

## Task 37: FF-merge to main

Only after explicit approval:

```bash
git checkout main
git merge --ff-only feature/phase2-plan3-options
git push origin main
```

---

## Task 38: Clean stale origin branches (after approval)

Per the handoff note: `feature/phase2-spec`, `feature/phase2-plan1-foundation`, `feature/github-repo-template`, `feature/phase2-plan2-liquid-spec`, `feature/phase2-plan2-engine-liquid`, `feature/phase2-plan3-spec`, and the just-merged `feature/phase2-plan3-options`.

```bash
git branch -d feature/phase2-plan3-options feature/phase2-plan3-spec
git push origin --delete feature/phase2-spec feature/phase2-plan1-foundation \
  feature/github-repo-template feature/phase2-plan2-liquid-spec \
  feature/phase2-plan2-engine-liquid feature/phase2-plan3-spec \
  feature/phase2-plan3-options
```

Only run the `--delete` commands when Matt explicitly approves — remote deletes are destructive.

---

## Self-review notes

- **Spec coverage:** every spec requirement in scope for Plan 3 has a task — Header quota bar (T12), theme toggle (T12–T13), Rules split-view (T15–T17), rule-edit modal overhaul (T19), Templates tab with CodeMirror + cheatsheet + preview (T21), delete-guard (T22), migration banner (T23), AI-hint header (T24), remembered sample JSON (T25), "Try these" chips (T26), keyboard shortcuts (T27), autosave pipeline + Undo (T28), dark mode final pass (T29), accessibility (T30), E2E CRUD (T31), visual regression (T32).

- **Placeholder scan:** no TBDs or "implement later". Two deferral notes are intentional: (1) `liquidMode.ts` may need a hand-rolled StreamParser fallback — the task names the concrete fallback. (2) `matchesHost`/`matchesPath` exports in Task 18 are conditional on a grep result; the task specifies what to do in either case.

- **Type consistency:** `Rule`, `Templates`, `ThemePreference` sourced from `src/shared/types.ts` and `src/ui/theme.ts`. `Toast` + `ToastInput` variants extended once in Task 28 (`'undo'`) — noted inline.

- **Out-of-scope guardrails:** Popup (Plan 4) and top-strip (Plan 5) are explicitly excluded. The Phase 4 conflict-detection UI slot is not part of this plan — it's an options-page concern only insofar as the spec calls for rendered top-strip; we're not touching top-strip here.
