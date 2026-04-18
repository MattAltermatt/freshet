# Phase 2 — UX polish redesign

**Date:** 2026-04-18
**Status:** Design approved; implementation pending
**Scope:** Options page + popup + rendered top-strip (a cohesive visual system)
**Out of scope:** Examples site (Phase 3), extension-conflict handling logic (Phase 4; UI slot reserved), expanded test suite beyond Phase 2's needs (Phase 5, ongoing), export/import (Phase 6).

## Purpose

The extension ships today with functional but minimal UX. Templates render, rules match, the popup shows status — but the visual language is generic, the rule-edit flow has ambiguous validation and save semantics, the Templates tab lacks a real editor, and the rendered top-strip feels barebones. Phase 2 pulls all three user-facing surfaces into a cohesive design system with the `{>` brand palette, a real template editor, a rules playground for debugging patterns, autosave throughout, and dark mode from day one.

## Decisions locked during brainstorm

| # | Decision | Choice |
|---|---|---|
| 1 | Scope of the single design pass | Options + popup + rendered top-strip (all three surfaces together) |
| 2 | Save semantics | Autosave everywhere with "Saved ✓" toast + 8 s Undo toast on destructive actions |
| 3 | Rules tab layout | Split view: card stack on the left, URL tester on the right |
| 4 | Template editor | CodeMirror 6 with stock Handlebars grammar |
| 5 | Template runtime parser | **Swap to Handlebars** — drop the hand-rolled engine. Use idiomatic Handlebars syntax; automated migration for existing templates. |
| 6 | Top-strip layout | Full control surface: brand, env, rule name, Rendered/Raw toggle-group, ⋯ menu for secondary actions |
| 7 | Top-strip palette | Warm cream `#fef7ed` (light) / warm near-black `#1c1917` (dark); logo brace flips light↔dark, orange `>` stays put |
| 8 | UI framework | Preact 10 + JSX (3.5 KB gzipped runtime, big DX win for reactive UIs) |
| 9 | Dark mode | From day one, on all three surfaces; CSS custom properties + `prefers-color-scheme` + user override |

## Architecture

### Module boundaries

**Kept pure** (no DOM, no Chrome API, no Preact — keep Node-testable):
- `src/matcher/` — URL → rule matching; unchanged.
- `src/storage/` — chrome.storage facade; unchanged except for migration hook.
- `src/engine/sanitize.ts` — final-pass sanitizer; unchanged, still runs after render.

**Replaced:**
- `src/engine/engine.ts` + `lookup.ts` + `helpers.ts` — thin Handlebars wrapper. The public signature (`render(template: string, data: unknown, vars: Variables): string`) stays the same so callers don't change.

**New:**
```
src/ui/                        # shared Preact component library
  components/
    Button.tsx
    Toggle.tsx
    Menu.tsx
    Toast.tsx
    ToastHost.tsx
    Cheatsheet.tsx
    KVEditor.tsx
    CodeMirrorBox.tsx          # thin wrapper over CM6
  hooks/
    useTheme.ts
    useStorage.ts
    useAutosave.ts
    useDebounce.ts
  theme.css                    # CSS custom properties for light + dark
  theme.ts                     # token → CSS-var map, prefers-color-scheme subscriber

src/engine/
  engine.ts                    # Handlebars wrapper
  helpers.ts                   # register eq, date, link as Handlebars helpers
  migrate.ts                   # v1 → v2 syntax rewriter
  sanitize.ts                  # unchanged
```

**Rewritten as Preact apps (three entry points):**
- `src/options/App.tsx` — top-level layout, tab switcher, toast host, theme provider.
- `src/popup/Popup.tsx` — small status panel.
- `src/content/TopStrip.tsx` — injected banner, mounted via shadow root.

### Bundle impact (gzipped estimates)

| Surface | Before | After | Delta | Notes |
|---|---|---|---|---|
| content script | ~2.7 KB | 20–25 KB | +17–22 KB | Preact + Handlebars (compile+runtime) + TopStrip + theme tokens |
| options | ~5 KB | 120–180 KB | +115–175 KB | CodeMirror dominates; loads only on options-page open |
| popup | ~0.5 KB | ~5 KB | +4.5 KB | Preact + ui/ |

Final numbers depend on tree-shaking CodeMirror 6 packages (we only need state/view/language/autocomplete/commands + 2 language modes — full CM6 is modular and tree-shakes well).

**Deferred optimization:** precompile templates at save-time in the options page, store compiled function bodies, drop Handlebars compile-time from content script → saves ~13 KB gzipped in the content script. Not part of Phase 2; architecture does not preclude it.

## State model & data flow

### Storage shape (extended)

```ts
interface StorageShape {
  schemaVersion: 2;                                    // NEW
  rules: Rule[];
  templates: Templates;                                // Record<string, string>
  hostSkipList: HostSkipList;
  settings: {                                          // NEW
    themePreference: 'system' | 'light' | 'dark';
  };
}
```

The existing `chrome.storage.sync` → `.local` auto-migration at ~90 KB stays. `settings` and `schemaVersion` are small; storage pressure comes from templates.

### Autosave pipeline

1. User mutates UI state → Preact `setState` → UI reflects **immediately**.
2. `useAutosave` hook observes the state change, debounces 300 ms, writes to storage.
3. On success: `"Saved ✓"` toast (orange check, fades 2 s, top-right).
4. On failure: `"Save failed — retrying"` toast (red). Automatic retry 3× with exponential backoff; then manual retry button.
5. **Undo on destructive action:** delete rule / delete template / clear variables → `"Deleted 'name' · Undo"` toast (8 s). Pre-write state held in memory; if user clicks Undo, state restored before storage write. Otherwise, write commits at 8 s + 300 ms debounce.

### Cross-surface sync

All three apps (options, popup, content TopStrip) subscribe to `chrome.storage.onChanged`. A `useStorage` hook pushes the change into Preact state for that surface.

Consequence: edit a rule in options → popup on any open tab reflects the new match state → any already-open top-strip on a matched tab reflects the change without reload.

### Theme flow

`useTheme` hook:
1. Reads `settings.themePreference` from storage.
2. If `'system'`, consults `window.matchMedia('(prefers-color-scheme: dark)')`.
3. Sets `data-theme="light" | "dark"` on the Preact root element.
4. Subscribes to both storage changes (user override) and matchMedia changes (system).

All styling uses CSS custom properties declared in `theme.css`:
```css
:root                           { --bg: #fef7ed; --fg: #111827; --accent: #ea580c; --muted: #44403c; ... }
:root[data-theme="dark"]        { --bg: #1c1917; --fg: #fafafa; --accent: #ea580c; --muted: #a8a29e; ... }
```

No runtime JS recalculation — theme swap is a single attribute change.

### Shadow DOM for the top-strip

The content script injects into arbitrary pages where hostile CSS may exist. The top-strip mounts inside `attachShadow({ mode: 'closed' })` with its own inlined `<style>` block. Preact renders into the shadow root. This ensures the injected banner's visual integrity regardless of the host page.

### Migration (v1 → v2)

Background service worker checks `schemaVersion` on install/update. If missing, run migrator:

1. Read all templates from storage.
2. For each template, apply ordered regex rewrites (order is important to avoid double substitution):
   - `{{#when X "Y"}}…{{#else}}…{{/when}}` → `{{#if (eq X "Y")}}…{{else}}…{{/if}}`
   - `{{#when X "Y"}}…{{/when}}` → `{{#if (eq X "Y")}}…{{/if}}`
   - `{{@varName}}` → `{{vars.varName}}`
3. Write all migrated templates back atomically. If any single template fails to compile under Handlebars after rewrite, roll back the batch, surface error on that template only, keep v1 source for manual fix.
4. Set `schemaVersion: 2`.
5. Emit a per-template dismissible banner in the Templates tab: *"Migrated to Handlebars syntax. Review and confirm."* Dismisses when user saves the template (even without edits).
6. Bundled `src/starter/internal-user.html` is rewritten at the source level in the new syntax.

### Handlebars syntax reference (what ships)

- `{{path.to.value}}` — HTML-escaped interpolation (Handlebars default).
- `{{{path.to.value}}}` — raw (triple brace).
- `{{vars.varName}}` — rule-defined variables.
- `{{#if (eq x "literal")}}…{{else}}…{{/if}}` — equality conditional (via the `eq` helper we register).
- `{{#each items}}…{{this.field}}…{{/each}}` — iteration, native.
- `{{date timestamp}}` / `{{date timestamp "yyyy-MM-dd HH:mm"}}` — helper we register.
- `{{link "https://host/{{id}}"}}` — helper we register (URL-safe interpolation with percent-encoding).
- All the free goods Handlebars brings: `{{#unless}}`, `{{#with}}`, partials, subexpressions like `{{formatDate (lastUpdated record) "yyyy-MM-dd"}}`.

## Options page design

### Header (persistent across tabs)
- `{>` logo + "Present-JSON" title.
- Tab switcher: Rules | Templates.
- Storage quota bar: e.g. "12 KB / 100 KB sync" with visual fill. Orange > 50%, red > 80%. A marker at 90 KB labels the auto-migration threshold (sync → local).
- Theme toggle: sun / moon / auto icon (writes `settings.themePreference`).

### Rules tab — split view (65/35 split)

**Left column — rule stack:**
- Card per rule. Card contents:
  - Numbered order badge (1, 2, 3 …) — makes first-match-wins visible.
  - Pattern block (monospace): `host-pattern · path-pattern`.
  - Template chip (orange background on light / orange text on dark).
  - Variable count: "3 vars" or blank.
  - Enabled toggle (right side).
  - Drag handle (far right) for reorder.
  - Active rules get the orange left-bar accent.
- Click a card (anywhere except toggle/handle) → opens the edit modal.
- Drag reorders; order persists immediately via autosave.
- `+ Add rule` CTA floats top-right.
- **Empty state:** *"No rules yet. Add your first, or import a bundled example."* (The bundled-example link hooks into Phase 3 when it ships.)

**Right column — URL tester (sticky, scrolls with the rules):**
- Large monospace input: *"Paste any URL to test"*.
- Below the input, each rule in the same order shown on the left, with color-coded status:
  - ✅ `1. *.api.com` — green row, orange accent on rule name (match).
  - ⏸ `2. 127.0.0.1` — gray (miss — host doesn't match).
  - ⚠ `3. httpbin.org` — dimmed (shadowed by rule 1).
- Click a miss-reason → opens that rule's edit modal scrolled to the relevant field.
- "Try these" quick-fill chips pre-populate with bundled examples (Phase 3 wires them; Phase 2 reserves the chip UI).

### Rules tab — rule edit modal (overhauled)

- **Header:** *"New rule"* (when opened via `+ Add rule`) or *"Edit rule · rule-name"* (when editing an existing rule) + enabled toggle in the top-right (status indicator, not buried mid-form).
- **Host pattern:**
  - Input field + inline validation (red border + message on invalid glob / regex).
  - Expandable *Examples* panel showing clickable-to-fill patterns: `*.server.com`, `127.0.0.1`, `/^admin.*/`, exact `api.example.com`.
- **Path pattern:** same structure — input + validation + examples panel.
- **Template:** select dropdown; `"+ New template…"` as the last option opens a nested create dialog (name + blank template).
- **Variables:** proper KV editor:
  - Each row: `[key-input]` `=` `[value-input]` `[× remove]`.
  - `+ Add variable` button.
  - Validation: keys non-empty, keys unique within the rule.
- **Footer:** `Cancel` · `Save changes` (primary, orange). Cancel discards modal edits; Save commits to Preact state, which triggers autosave.

### Templates tab

- **Top toolbar:** template selector (click-to-rename inline), `New`, `Duplicate`, `Delete` buttons.
  - **Delete guard:** if the template is referenced by one or more rules, `Delete` opens a confirmation modal listing the affected rules and offering two paths: *"Delete template and disable affected rules"* (rule's `enabled` flag flips to `false`) or *"Cancel"*. Never delete silently while a rule still points at the template.
- **Editor (left or top on narrow viewports):** CodeMirror 6 with Handlebars grammar + autocomplete fed by:
  1. Sample-JSON paths (walk the sample JSON's object tree, suggest dotted paths).
  2. Rule variables from the currently-editing rule (if opened from rule-modal context) or all declared variables across rules (fallback).
  3. Handlebars helper names (`eq`, `date`, `link`, native `if`, `each`, etc.).
- Line numbers, error gutter, find/replace via CM6 defaults.
- **Preview panel (2× current size, resizable drag handle on the left edge):**
  - Top half: sample-JSON editor — small CodeMirror with JSON grammar.
  - Bottom half: rendered preview in a sandboxed iframe.
  - Re-renders on 250 ms debounce after either the template or sample JSON changes.
- **Syntax cheatsheet:** pinned collapsible sidebar (right). Always-visible header shows current helper reference. Collapsed state shows just the header and `…` icon.
- **Starter-template AI-hint header:** every bundled template begins with:
  ```
  <!-- present-json / Handlebars / syntax: {{path}} {{#if (eq)}} {{#each}} {{date}} {{link}} {{vars.name}} -->
  ```
  so LLMs picking up a shipped template can infer the grammar from the file itself.

### Autosave + toast system

- Host: top-right, max 2 concurrent toasts (newer displaces oldest).
- Types:
  - `Saved ✓` — orange check, 2 s fade.
  - `Deleted "rule-name" · Undo` — 8 s, click to restore.
  - `Save failed — retrying` — red, auto-retries, collapses on success.
- Toast region is `role="status"` with `aria-live="polite"` for accessibility.

### Keyboard shortcuts (documented inline)

Footer panel: *"Keyboard shortcuts"* (collapsible, default collapsed). Lists:
- `⌘⇧J` — toggle raw/rendered on a matched page (works on any tab, registered via `chrome.commands`).
- `⌘⇧C` — copy current tab's URL.
- `⌘/` — focus URL tester input (options page only).
- `⌘S` — disabled; shows a tooltip: *"Your changes autosave."*
- `?` — open this panel.

## Popup design

Size: ~280 × 240 px. Same warm palette, theme-reactive.

- **Header:** `{>` logo + "Present-JSON" (small).
- **Active tab status block:**
  - URL (middle-truncated, monospace).
  - Matched rule: name as orange chip + "Edit rule" quick-link. If no match: *"No rule matches this URL"* + `[+ Add rule for this host]` button (opens options page with host pattern pre-filled).
- **Skip toggle:** `[ ] Skip Present-JSON on {hostname}` — checkbox syncs to `hostSkipList`.
- **Test URL quick-jump:** single-line input pre-filled with current tab URL + `[Test in options]` button that opens the options URL tester with this URL pre-filled.
- **Footer:** `Open options` link.

Reactive via `useStorage` + `chrome.tabs`. Edits in options reflect in popup without reopening.

## Rendered top-strip design

### Layout
```
[logo]  [env badge]  [rule name]                    [toggle: Rendered|Raw]  [⋯ menu]
```
- `{>` logo (brand identity).
- Env badge: orange chip showing `vars.env` if set; hidden otherwise.
- Rule name: monospace, matched-rule name.
- Toggle-group: Rendered / Raw — orange active state, `⌘⇧J` keyboard hint on the Raw button.
- `⋯` menu (SVG three-dots icon) — opens dropdown with secondary actions:
  - `↗ Copy URL` (`⌘⇧C`)
  - `✎ Edit rule` (opens options with the matched rule's modal)
  - `✕ Skip this host` (adds host to `hostSkipList`, page reloads raw)

### Palette

- **Light:** background `#fef7ed` (orange-50), border `#fed7aa`, body text `#111827`, accent `#ea580c`.
- **Dark:** background `#1c1917` (stone-950), border `#292524`, body text `#fafafa`, accent `#ea580c`.
- Logo `{` brace flips `#111827` ↔ `#fafafa` across modes; logo `>` bracket stays `#ea580c` on both (works on both backgrounds).

### Theme detection

Reads `settings.themePreference` from storage via content-script message bridge (shadow-rooted Preact can't read storage directly in MV3 without a message). Subscribes to storage change events so a theme preference change from the options page takes effect on already-open top-strips without page reload.

### Shadow DOM isolation

`attachShadow({ mode: 'closed' })` on the injected host element. Styles declared inside the shadow root via a single `<style>` block (bundled by Vite). No leakage into or from the host page's CSS.

### Conflict detection slot (Phase 4 territory)

If the content script detects the page body was already mutated before our content script ran (heuristic: no parseable JSON in `body.innerText`, but a URL-rule match exists), the top-strip still renders in a degraded state showing:

> ⚠ *Another JSON viewer handled this page first — [disable it for this host](#)*

Phase 2 reserves the UI slot and the heuristic hook. Phase 4 implements the heuristic logic and the disable-for-host interaction.

## Testing strategy

### Unit (Vitest, Node)

- Expand existing ~65 tests.
- `engine/helpers.ts` — test `eq`, `date` (every format variant), `link` (URL-safe interpolation + percent-encoding).
- `engine/sanitize.ts` — unchanged, keep.
- `matcher/` — unchanged, keep.
- **NEW:** `engine/migrate.ts` — snapshot tests over a 10+-template corpus covering all v1 syntax → v2 syntax transitions, including `#else` branches and nested `#when`/`#each`.
- `storage/` migration — test v1 → v2 flow including failure recovery (single bad template rolls back the batch).

### Component (Vitest + @testing-library/preact)

- `ui/components/*` — each component tested in isolation.
- `options/rules/RuleCard.tsx`, `UrlTester.tsx`, `RuleEditModal.tsx`.
- `options/templates/TemplateEditor.tsx` (mock CodeMirror, test wrapper props).
- `popup/Popup.tsx`.
- `content/TopStrip.tsx` (test against a mount host with mock shadow root).

### E2E (Playwright, headed Chrome)

Extend existing 1 test:
- Render path (existing; unchanged behavior post-migration).
- Options CRUD — add / edit / delete rule, autosave toast appears and persists across reload.
- URL tester — paste URL, correct match highlighted, miss reasons correct.
- Popup — matched rule shown, skip toggle writes, Edit Rule jumps to options modal.
- Top-strip — toggle raw/rendered, menu actions, `⌘⇧J` keyboard.
- Migration — install with v1 storage fixture, verify v2 after update.

### Visual regression

Playwright screenshots committed to `test/e2e/__screenshots__/`. Surfaces:
- Options page: Rules tab (populated + empty), Templates tab, light + dark.
- Rule edit modal: empty + populated + validation-error states.
- Popup: matched + unmatched, light + dark.
- Top-strip: light + dark, with and without menu open.

CI fails on any diff. Baselines updated via `npx playwright test --update-snapshots`.

### Accessibility (axe-core inside Playwright)

- `expect(await axe.run(page)).toHaveNoViolations()` on options page load.
- Same for popup.
- Same for a fixture-rendered page with the top-strip injected.

### CI impact

Adds ~30–45 s to build+test. Matt authorized trading CI time for coverage.

## Build & pipeline changes

### Vite config (`vite.config.ts`)

- Add `@preact/preset-vite` plugin. ~5-line change.
- Per-entry bundle splits remain automatic via `@crxjs/vite-plugin`.

### New devDependencies (pinned minor versions)

- `preact` (runtime)
- `@preact/preset-vite` (build-time)
- `handlebars`
- `codemirror` + `@codemirror/state` + `@codemirror/view` + `@codemirror/language` + `@codemirror/autocomplete` + `@codemirror/commands` + `@codemirror/lang-json` + handlebars-grammar helper (`@codemirror/legacy-modes` or a targeted package)
- `@testing-library/preact`
- `@axe-core/playwright`

### Unchanged

- `tsc --noEmit` typecheck — Preact JSX types work out of the box.
- ESLint config — JSX rules auto-inherit via preset.
- Test harness (Vitest + Playwright configs).

## Rollout sequence

Each step is a separate feature branch with code-review gate. Each is independently verifiable.

1. **Foundation** — add deps; Vite JSX config; `src/ui/` shell (theme.ts, theme.css, stub component exports, useTheme hook). Zero user-visible changes. Verify: build + existing tests pass, no regression.

2. **Engine swap** — replace `src/engine/engine.ts` with Handlebars wrapper; register helpers; write `engine/migrate.ts` with snapshot tests; rewrite `src/starter/internal-user.html` in new syntax; wire background-script migration on install/update. Verify: E2E render still passes; migration tests green.

3. **Options page rewrite** — new `src/options/App.tsx` with Rules tab split view + URL tester, Templates tab with CodeMirror + cheatsheet, rule-edit modal overhaul, autosave + toast system, dark mode. Verify: component tests pass; visual regression baselines approved; axe-core clean.

4. **Popup rewrite** — new `src/popup/Popup.tsx` with status + skip + test-URL quick-jump. Verify: component tests + E2E popup spec.

5. **Top-strip rewrite** — new `src/content/TopStrip.tsx` with shadow DOM + keyboard commands. Verify: E2E top-strip spec + manual Chrome check.

6. **Code review + polish** — dispatch fresh reviewer agent against the whole Phase 2 diff vs. pre-Phase 2 main; address findings.

7. **Docs update** — README, CLAUDE.md, design/README.md, ROADMAP (mark Phase 2 done); commit.

Each PR is 300–800 LoC diff. Step 3 (options page) is the largest (~1500 LoC). Total Phase 2: estimated 3–4 focused days if nothing derails; realistically 5–6 with iteration.

## Non-goals (Phase 2)

- Extension-conflict detection logic — the UI slot exists; the detection heuristic wiring is Phase 4.
- Real-world bundled examples + GH Pages examples site — Phase 3.
- Export / import templates with scrub dialog — Phase 6.
- Form-based template editor / shared template registry / non-JSON content — Phase 7.
- Chrome Web Store listing resumption — remains paused until Phase 2 ships.

## Open questions / future work

- **Precompile templates at save-time** to drop Handlebars compile-time from content script (saves ~13 KB gzipped in content script). Deferred; architecture does not preclude.
- **Store sync-area nudge** — when storage quota crosses 80 % sync, suggest to user that their templates may soon migrate to `.local`. UI copy exists in the quota bar tooltip; full nudge dialog is out of scope here.
- **Keyboard shortcut customization** — `chrome.commands` allows users to rebind at `chrome://extensions/shortcuts`. Phase 2 documents the defaults; UX for discovering/changing them stays with Chrome's standard page.
