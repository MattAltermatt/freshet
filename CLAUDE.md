# Freshet

**Tagline:** *Thaw any JSON URL into a more useful page.* (short: *JSON in. Page out.*)

Chrome MV3 extension. Per-URL rules + Liquid templates render API responses into proper pages — fields surfaced, statuses colored, IDs turned into clickable links. Previously "Present-JSON"; renamed 2026-04-18.

## Commands

```bash
pnpm install        # first time (corepack materializes pnpm@10.33.0 from packageManager field)
pnpm dev            # Vite + @crxjs HMR → dist/
pnpm build          # production bundle → dist/
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint (no-error-on-unmatched-pattern so empty src/ works)
pnpm test           # vitest run (TZ=UTC prefix)
pnpm test:e2e       # playwright — needs pnpm build first
pnpm fixtures       # local JSON server at http://127.0.0.1:4391 for manual smoke test
pnpm icons          # rasterize design/icon-{16,48,128}.svg → public/icon-{16,48,128}.png
```

## Architecture

Two pure cores (Node-tested, zero `chrome.*` calls):

```bash
# Purity invariant — must return nothing.
rg 'chrome\.' src/engine src/matcher
```


- `src/engine/` — template → HTML: `engine.ts` (thin LiquidJS wrapper; `outputEscape` auto-escapes non-raw output; sanitizer runs post-render), `helpers.ts` (`registerFilters` for `date`/`link`/`num`/`raw`), `lookup.ts` (dotted paths + `@var`, used by the `link` filter's inner-token substitution), `migrate.ts` (v1 → v2 syntax rewriter), `sanitize.ts` (final security pass)
- `src/matcher/` — URL → rule: `glob.ts` (`**` = `.*`, `/.../` escape hatch), `matcher.ts`

Chrome glue (imports the cores):
- `src/content/content-script.ts` — parse JSON from `body.innerText`, match, render, replace `documentElement` HTML; hands off to `mountTopStrip` for the shadow-DOM strip. Sets `#pj-root` `padding-top: 36px` so rendered content clears the fixed-position strip.
- `src/content/mountTopStrip.tsx` — creates an `<div id="pj-topstrip-host">` prepended to `document.body`, attaches a shadow root (`mode: 'open'`), injects `topStrip.css?inline` into a `<style>`, renders `<TopStrip />` into the shadow.
- `src/content/TopStrip.tsx` — Preact strip: `{>` brand, env chip (when `rule.variables.env` set), rule name, Rendered/Raw toggle-group, ⋯ menu (Copy URL / Edit rule / Skip this host), transient toasts for Copy + Skip, theme reactivity via `useTheme({ root: shadowHost })`, message listener for `pj:toggle-raw`. Deep-imports `Menu`, `useStorage`, `useTheme` from `src/ui/*` (not the barrel, per the popup gotcha).
- `src/content/conflictDetect.ts` — Phase 2 stub; Phase 4 fills in the "another viewer handled this page first" heuristic.
- `src/background/background.ts` — migration + starter seed on install; relays `chrome.commands.onCommand('toggle-raw')` → active tab (`pj:toggle-raw` message); relays `pj:open-options` messages from the content script to `chrome.tabs.create` (content scripts can't call `chrome.tabs.create` directly in MV3).
- `src/ui/` — shared Preact component library: `Button`, `Toggle`, `Toast`, `ToastHost`, `Menu`, `KVEditor`, `Cheatsheet`, `CodeMirrorBox` + hooks `useTheme`, `useToast`, `useStorage`, `useDebounce`, `useAutosave` + `theme.css` design tokens (`--pj-*`) + `cmHighlight.ts` (CodeMirror syntax style driven by the same tokens)
- `src/options/` — Preact SPA (`App.tsx`, `Header.tsx`, `ShortcutsFooter.tsx`, `directives.ts`); `rules/` has `RulesTab`, `RuleStack`, `RuleCard`, `UrlTester`, `PatternField`, `RuleEditModal`; `templates/` has `TemplatesTab`, `TemplatesToolbar`, `TemplateEditor` (CodeMirror 6 + Liquid grammar + autocomplete), `SampleJsonEditor`, `PreviewIframe`, `liquidMode.ts` (hand-rolled CM6 StreamParser), `liquidCompletions.ts`
- `src/popup/` — Preact SPA (`popup.tsx`, `App.tsx`, `FirstRunBanner.tsx`, `popup.css`). Owns boot + active-tab read; reads `rules` / `hostSkipList` / `settings` via `useStorage`; runs `promoteStorageToLocal()` on boot (same as options). Hands off to the options page via URL-hash directives (`#test-url=…`, `#new-rule:host=…`, `#edit-rule=…`). Popup writes only `hostSkipList` + `pj_first_run_dismissed`; rules + templates are read-only here. `FirstRunBanner` renders only when not dismissed AND user has no non-example rule.
- `src/starter/` — bundled starter HTML + sample JSON (`?raw` imports). 5 starters seed on fresh install (Phase 3): `service-health`, `incident-detail`, `github-repo`, `pokemon`, `country`. Templates are dark-AND-light-themed via `[data-theme="dark"]` selectors; content-script writes the `data-theme` attribute. URL-from-id is the convention — JSONs carry only IDs/slugs/handles, templates construct canonical URLs via Liquid string interpolation in `href` attrs.
- `src/storage/` — facade over `chrome.storage`; `createStorage` is async and picks `.sync` or `.local` by reading a `pj_storage_area` sentinel from `.local` (migration writes it at 90KB). `promoteStorageToLocal()` runs at boot on both options and popup to converge any legacy sync-area data into local, so the Preact `useStorage` hook (which talks to `.local` only) has authoritative data.

Content script is declared **statically** in the manifest (`content_scripts: [{ matches: ['<all_urls>'] }]`) — dynamic `chrome.scripting.registerContentScripts` doesn't work because @crxjs rewrites source paths at build time.

## Gotchas

- **Reload the extension after every build.** `pnpm build` writes to `dist/` but Chrome caches the loaded extension. Go to `chrome://extensions/`, find Freshet, click the circular reload arrow. Service worker + content script + options / popup all refresh. Any "my change isn't showing up" is almost always this.
- **Security hook blocks DOM-injection patterns** in Write/Edit tool params. When creating or modifying a file that contains `el.inner` + `HTML = ...`, use a Bash heredoc (`cat > path << 'EOF'`) instead — the hook inspects tool params, not file state.
- **TZ=UTC** is prefixed on the `test` and `test:watch` scripts so `formatDate` custom formats match fixture expectations on any machine.
- **Template engine is LiquidJS** (Phase 2 Plan 2, 2026-04-18). Runtime interpreter — no codegen, no runtime JS-eval. This matters for MV3: the extension CSP disallows `'unsafe-eval'`, which blocks Handlebars-style compile-to-function engines (a Handlebars attempt hit this blocker). The `test/e2e/csp-smoke.spec.ts` test guards against CSP regressions on the render path.
- **Two-stage security**: LiquidJS `outputEscape` auto-escapes every `{{ }}` output unless the `raw` filter marks it safe (via `__pjRaw` marker on a `String` wrapper). Then `sanitize()` runs as the final pass on the full output. Covers: `<script>`, `<iframe>`, `<link>`, `<object>`, `<embed>`, `on*` handlers (quoted and unquoted), `javascript:`/`data:`/`vbscript:` URLs. Never bypass the sanitizer.
- **Schema v2** (set via `storage.setSchemaVersion(2)`) marks templates as Liquid-syntax. Absence triggers an auto-migrator (`engine/migrate.ts`) on first run after update. Migration is batch-atomic — any single parse-failure rolls back the entire batch and keeps v1 sources for manual fix.
- **CodeMirror 6 runs under MV3 CSP** — verified by `test/e2e/cm-csp-smoke.spec.ts`. If you add a CM extension / plugin, check it doesn't pull in a transitive dep that uses runtime codegen.
- **Popup → options directives** use URL-hash fragments parsed by `src/options/directives.ts` (`#test-url=…`, `#new-rule:host=…`, `#edit-rule=…`). `chrome.runtime.openOptionsPage()` cannot accept a fragment, so the popup uses `chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') + hash })`. The options page clears the hash after applying so reload starts clean. `RulesTab`'s effect depends on `[directive, rules]` so an `edit-rule` directive that races an empty rules array re-fires once storage loads.
- **Popup must deep-import from `src/ui/`**, not the `../ui` barrel. The barrel re-exports `CodeMirrorBox` + `pjHighlightStyle` which drag CodeMirror into any bundle importing the barrel; deep-importing `Toggle` / `useStorage` individually keeps popup at ~6 KB gzipped instead of ~95 KB.
- **Liquid `StreamParser` must advance on every token pass** — a lone `{` that isn't `{{`, `{%`, or `{#` (e.g. inside a `<style>{ }</style>` block) must be consumed as plain text, otherwise CodeMirror throws "Stream parser failed to advance stream". Guarded in `liquidMode.ts` and regression-tested in `liquidMode.test.ts`.
- **`--pj-accent-strong` vs `--pj-accent`** — the brand orange `#ea580c` is not WCAG AA-contrast-compliant on our light-wash background, so anywhere small text sits on a wash or a solid-orange button uses `--pj-accent-strong` (`#c2410c` in both themes). Reserve `--pj-accent` for large-area surfaces (icons, borders, hover-flash backgrounds).
- **Top-strip styling lives inside the shadow root.** `src/content/topStrip.css` redeclares the subset of `--pj-*` tokens it needs on `:host` / `:host([data-theme="dark"])` because CSS custom properties don't cross the shadow boundary. If a new token is needed by the strip, add it to both `src/ui/theme.css` (source of truth for options/popup) *and* `src/content/topStrip.css`.
- **`Menu` outside-click listener detects `ShadowRoot` via `getRootNode()`** and listens on the root rather than `document` when nested. Events in shadow trees are re-targeted to the host, so the document-level handler can't distinguish clicks inside the menu from clicks elsewhere. Shadow-root usage regression-tested in `src/ui/components/Menu.test.tsx`.
- **`useTheme` captures `matchMedia` once in a `useRef`.** `window.matchMedia(...)` returns a fresh `MediaQueryList` on every call, so caching it stabilizes the `useEffect` deps and avoids re-running `applyTheme` on every parent re-render. Matters for strip consumers that re-render frequently (toasts, mode toggles, storage writes).
- **`⌘⇧J` is wired via `chrome.commands`** declared in `vite.config.ts`; the background SW forwards `chrome.commands.onCommand('toggle-raw')` → `chrome.tabs.sendMessage(tabId, { kind: 'pj:toggle-raw' })`. `TopStrip` listens via `chrome.runtime.onMessage`. User rebinding stays with Chrome's native `chrome://extensions/shortcuts`.
- **Content scripts cannot call `chrome.tabs.create` in MV3.** The top-strip's "Edit rule" action sends a `pj:open-options` message to the background SW, which opens the URL. Same pattern any future top-strip action that needs `chrome.tabs.*` should follow.
- **Demo-template theming via `data-theme` on `<html>`.** Starter templates carry both light (default) and dark (`[data-theme="dark"]` selector) CSS. The content-script reads `settings.themePreference`, calls `resolveTheme()` from `src/ui/theme.ts`, and writes `data-theme="light"|"dark"` to `document.documentElement` after replacing innerHTML. The `PreviewIframe` does the same trick by wrapping its srcdoc as `<html data-theme="...">` so the in-editor preview matches the user's Freshet setting. New starter templates should follow suit.
- **Engine treats array-root JSON specially.** When `render(template, json, vars)` is called with `Array.isArray(json) === true` (e.g. REST Countries returns `[{...}]`), the engine exposes the array as `items` instead of spreading numeric keys. Templates start with `{% assign c = items[0] %}` for predictable handles. Object roots continue to spread directly. Tests in `src/engine/engine.test.ts` cover the array-root paths — preserve those if touching the engine.
- **`docs/try/` is a ship dependency.** The marketing page at `docs/try/index.md` (rendered at `mattaltermatt.github.io/freshet/try/`) shows a raw-JSON-vs-rendered "before / after" for each starter, with "Try it live" links to the canonical demo URL. Anytime a starter changes (template structure, sample JSON shape, rule pattern, the `STARTERS` array in `src/background/background.ts`, or the user-facing pill text), update `/try/` in the same branch. Otherwise the page lies about what Freshet does and the popup first-run banner sends users to a stale page.
## Storage keys (`chrome.storage.local`)

| Key | Type | Purpose |
|---|---|---|
| `rules` | `Rule[]` | Ordered rule list; first-match-wins. |
| `templates` | `Record<string, string>` | Template name → HTML source. |
| `hostSkipList` | `string[]` | Per-host skip — rendering disabled. |
| `settings` | `{ themePreference }` | `'system' \| 'light' \| 'dark'`. |
| `schemaVersion` | `number` | `2` once v1→Liquid migration has run. |
| `pj_sample_json` | `Record<string, string>` | Per-template sample JSON for the editor preview. |
| `pj_migrated_v2` | `string[]` | Template names that need the migration banner. |
| `pj_ui_collapse` | `{ editor, sample, preview }` | Collapsed/expanded state of the three Templates-tab panels. |
| `pj_ui_split_ratio` | `number` | 0–1 flex-grow share for the Template panel in the left-column split. |
| `pj_storage_area` | `'local'` | Sentinel: once set, `useStorage` and facade both read `.local`. |
| `pj_first_run_dismissed` | `boolean` | Sticky flag — once `true`, the popup welcome banner never reappears. |

## `Rule` schema

`Rule` (`src/shared/types.ts`) carries the user-set fields (`hostPattern`, `pathPattern`, `templateName`, `variables`, `active`) plus two optional starter-only fields. The `active` field was renamed from `enabled` (2026-04-18); a one-time migration in `background.ts → migrateRulesEnabledToActive` converts old rules on next install/update.

| Field | Type | Set by | Purpose |
|---|---|---|---|
| `isExample` | `boolean?` | seeder | Marks the rule as bundled with Freshet → renders the grey "Example ↗" pill on the rule card. Persists across activate/deactivate so users always see the provenance. |
| `exampleUrl` | `string?` | seeder | Canonical demo URL the Example pill links to (opens in new tab). Defined per starter in `STARTERS` in `src/background/background.ts`. |

User-created rules don't set either field; they fall through the `RuleCard` pill check and render without the pill.

## Testing philosophy

- **Unit tests (Vitest, Node)** cover `src/engine/`, `src/matcher/`, `src/storage/` (pure facade), `src/ui/`, and every Preact component. No `chrome.*` mocks — if a test needs `chrome.*`, it belongs in E2E.
- **E2E (Playwright, headed Chrome)** covers any path that touches `chrome.tabs`, `chrome.storage`, `chrome.action`, service worker, or content-script injection. Seed storage via the service worker's `worker.evaluate(...)` rather than UI clicks when possible — faster and less flaky.
- **axe-core** runs inside Playwright for WCAG 2.1 AA (options + popup, light + dark). New surfaces get an a11y spec.

## Docs

- `docs/superpowers/specs/2026-04-17-present-json-design.md` — Phase 1 spec
- `docs/superpowers/specs/2026-04-18-phase2-ux-polish-design.md` — Phase 2 spec
- `docs/superpowers/plans/2026-04-17-present-json-phase1.md` — Phase 1 plan (shipped)
- `docs/superpowers/plans/2026-04-18-phase2-plan1-foundation.md` — Phase 2 Plan 1 (shipped)
- `docs/superpowers/plans/2026-04-18-phase2-plan2-engine-swap.md` — Phase 2 Plan 2 (Liquid engine, shipped)
- `docs/superpowers/plans/2026-04-18-phase2-plan3-options.md` — Phase 2 Plan 3 (options rewrite, shipped)
- `docs/superpowers/plans/2026-04-18-phase2-plan4-popup.md` — Phase 2 Plan 4 (popup rewrite, shipped)
- `docs/superpowers/plans/2026-04-18-phase2-plan5-topstrip.md` — Phase 2 Plan 5 (top-strip rewrite, shipped)
- `docs/superpowers/reviews/2026-04-17-phase1-review.md` — Phase 1 reviewer notes
- `ROADMAP.md` — phases + backlog
