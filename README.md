# Present-JSON

> A Chrome extension that renders JSON API responses as readable, user-templated HTML — so the internal admin URL you keep squinting at becomes a proper dashboard.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Manifest V3](https://img.shields.io/badge/Chrome-MV3-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)
![Tests](https://img.shields.io/badge/tests-192%20unit%20%2B%2021%20E2E-success.svg)

Paste a JSON URL into Chrome, get a table instead of a `<pre>`. Works against any host you configure — internal tooling, public APIs, webhooks you're debugging. Templates are small HTML snippets with `{{placeholders}}`; rules map URL patterns to templates.

## Table of contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Template syntax](#template-syntax)
- [Permissions & privacy](#permissions--privacy)
- [Development](#development)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Features

- 📝 **Declarative Liquid templates** — no JavaScript, no eval; just `{{ path.to.value }}`, `{% if status == "ok" %}…{% endif %}`, `{% for item in items %}…{% endfor %}`, `{{ ts | date: "yyyy-MM-dd HH:mm" }}`, `{{ "https://host/{{id}}" | link }}`.
- 🎯 **Per-URL rules** — glob patterns (`*.server.com`, `/api/**`) or raw regex (`/^\/v\d+$/`). First-match wins; ordered; reorderable.
- 🏷️ **Per-rule variables** — reference with `{{ vars.env }}`, `{{ vars.adminHost }}`. Makes templates portable across environments.
- 🪄 **Split-view options page** — rule cards on the left, URL tester on the right. Paste a URL, see exactly which rule matches and why the others don't (shadowed / host-miss / path-miss).
- 💻 **CodeMirror 6 template editor** — Liquid syntax highlighting, autocomplete over your sample JSON's paths + rule variables + helper filters, live sandboxed preview.
- 🎨 **Dark mode from day 1** — auto-follows your OS or manually choose light/dark. Brand palette (warm cream / warm near-black) stays readable either way.
- 💾 **Autosave** — every edit persists immediately; `Saved ✓` toast confirms commits; 8-second Undo toast on destructive actions.
- 👀 **Live preview** per template with per-template sample JSON persistence.
- 🧯 **Safe by default** — two-stage security: LiquidJS auto-escapes every `{{ }}` output (explicit `| raw` required to bypass), then a sanitizer strips `<script>`, `<iframe>`, `<link>`, `<object>`, `<embed>`, inline event handlers (including the `<img/onerror=…>` bypass), and neutralizes `javascript:`/`data:`/`vbscript:` URLs. Preview iframe is sandboxed with no same-origin access.
- 🔀 **Shadow-DOM top strip** on matched pages — `{>` brand, env chip (when `vars.env` set), rule name, Rendered / Raw toggle-group (⌘⇧J keyboard shortcut), ⋯ menu with Copy URL, Edit rule (deep-links into the options page), and Skip this host.
- 🧭 **Preact popup** — match status for the current tab (rule chip + *Edit rule* deep-link), *+ Add rule for this host* one-click jump when nothing matches, test-URL quick-jump that hands off to the options URL tester, per-host skip toggle.
- ♿ **WCAG 2.1 AA on the popup too** — axe-core sweep covers light + dark.
- ⚡ **CSP-safe everywhere** — [LiquidJS](https://github.com/harttle/liquidjs) interpreter (no runtime codegen, no `unsafe-eval`); CodeMirror 6 is tree-shaken ESM with no eval path either.
- ♿ **WCAG 2.1 AA** — axe-core passes on the options page; AA-compliant contrast in both light and dark.

## Install

### From source (unpacked — current install method)

1. Clone the repo and build:
   ```bash
   git clone https://github.com/MattAltermatt/present-json.git
   cd present-json
   pnpm install
   pnpm build
   ```
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dist/` folder.
5. Pin the extension to your toolbar (puzzle-piece icon → pin).

### From the Chrome Web Store

Not yet listed. Planned for a future release.

## Quick start

1. **Open the options page**: right-click the toolbar icon → **Options**.
2. **Templates tab** — an `internal-user` template is seeded on first run. Paste sample JSON to see the live preview:
   ```json
   {"id":1234,"insertDate":"2026-04-17T23:09:30Z","status":"DOWN"}
   ```
3. **Rules tab** — **+ Add rule**, fill in:
   - Host pattern: `api.example.com`
   - Path pattern: `/internal/user/*`
   - Template: `internal-user`
   - Variables: `adminHost=admin.example.com`, `env=prod`
   - Enabled ✓
4. Click **Save** in the dialog, then **Save** in the toolbar (persists to `chrome.storage`).
5. Navigate to a matching URL. The JSON response is replaced with rendered HTML and a control strip (env badge, raw/rendered toggle, copy URL).

### Try it locally

The repo ships a tiny local JSON server for kicking the tires:

```bash
pnpm fixtures    # serves http://127.0.0.1:4391/internal/user/1234 and /42
```

Point a rule at `127.0.0.1` + `/internal/user/*` and visit the URLs above.

## Template syntax

Templates are [Liquid](https://shopify.github.io/liquid/). Placeholders resolve against the parsed JSON body.

| Syntax | Meaning |
|---|---|
| `{{ path.to.value }}` | Interpolate (HTML-escaped). |
| `{{ value \| raw }}` | Interpolate without HTML escape. |
| `{{ vars.varName }}` | Interpolate a rule-defined variable. |
| `{% if x == "literal" %}...{% endif %}` | Conditional (equality check). |
| `{% if x == "y" %}...{% else %}...{% endif %}` | Two-way conditional. |
| `{% if truthyField %}...{% endif %}` | Truthy check (booleans, non-empty strings, non-zero numbers, non-empty arrays). |
| `{% if field != blank %}...{% endif %}` | Present and non-empty check. |
| `{% for item in items %}...{{ item.field }}...{% endfor %}` | Iterate an array. |
| `{{ timestamp \| date }}` | Default format: `Apr 17, 2026 4:09 PM`. |
| `{{ timestamp \| date: "yyyy-MM-dd HH:mm" }}` | Custom date format. |
| `{{ "https://host/{{id}}" \| link }}` | URL-safe interpolation (query values percent-encoded). |
| `{{ value \| num }}` | Compact number format (234567 → 235k, 1.2M, 1.2B). |

All standard Liquid builtins also work: `{% unless %}`, `{% capture %}`, `{% comment %}`, etc. Missing values render as the empty string.

Existing templates written in the pre-Phase-2 hand-rolled syntax (`{{#when}}`, `{{@var}}`, `{{{raw}}}`, etc.) are **auto-migrated** to Liquid on first load after update.

## Permissions & privacy

This extension requests these permissions and nothing else:

| Permission | Why |
|---|---|
| `storage` | Persist your rules and templates via `chrome.storage.sync` (falls back to `.local` above 90 KB). |
| `tabs` | The popup reads the active tab's URL to show match status and host-skip state. |
| `<all_urls>` host permission | The content script is statically registered against all pages so it can check user-configured rules. |

**Privacy:** no network requests are made by the extension itself. No analytics, no telemetry, no external hosts contacted. All data lives in your `chrome.storage` (synced across your own Chrome signed-in devices, or local-only if you exceed the 90 KB sync budget). No data leaves your browser. Full policy: [mattaltermatt.github.io/present-json/privacy/](https://mattaltermatt.github.io/present-json/privacy/).

## Development

### Prerequisites

- Node.js 20+ (tested on 25.9)
- [Corepack](https://nodejs.org/api/corepack.html) (ships with Node) — `npm install -g corepack && corepack enable` if not already present. `pnpm` resolves to the version pinned in `package.json`'s `packageManager` field.

### Workflow

```bash
pnpm install        # install deps (corepack auto-resolves pnpm@10.33.0)
pnpm dev            # Vite + @crxjs HMR; writes to dist/ on save
pnpm build          # production bundle
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # Vitest unit tests (TZ=UTC)
pnpm test:e2e       # Playwright smoke test (requires pnpm build first)
pnpm fixtures       # local JSON fixture server (:4391)
```

Load `dist/` unpacked in Chrome as described above. With `pnpm dev` running, @crxjs will hot-reload the extension when source files change; you may need to click **Reload** on the extension card in `chrome://extensions` for service-worker changes.

## Project structure

```
src/
├── engine/         # pure template engine (zero chrome.* calls)
│   ├── engine.ts      # LiquidJS wrapper with outputEscape + post-render sanitize
│   ├── helpers.ts     # date / link / num / raw filter registrations
│   ├── lookup.ts      # dotted-path lookups (used by the link filter)
│   ├── migrate.ts     # v1 → v2 syntax rewriter (pre-Phase-2 templates)
│   └── sanitize.ts    # final-pass sanitizer
├── matcher/        # pure URL → rule matcher
│   ├── glob.ts        # glob → RegExp (** = .*, /.../ = raw regex) + validators
│   └── matcher.ts     # findMatchingRule + matchesHost + matchesPath
├── storage/        # chrome.storage facade + sync→local migration
├── shared/types.ts # Rule / Template / StorageShape
├── content/        # content script (JSON → HTML replacement)
├── background/     # MV3 service worker (migration + starter seed)
├── ui/             # shared Preact component library
│   ├── components/    # Button, Toggle, Toast, ToastHost, Menu, KVEditor, Cheatsheet, CodeMirrorBox
│   ├── hooks/         # useTheme, useToast, useStorage, useDebounce, useAutosave
│   ├── theme.css      # --pj-* design tokens (light + dark)
│   └── cmHighlight.ts # CodeMirror syntax style keyed to the tokens
├── options/        # Preact SPA: split-view Rules + CodeMirror Templates
│   ├── App.tsx / Header.tsx / ShortcutsFooter.tsx
│   ├── directives.ts  # URL-hash directive parser (#test-url, #new-rule:host, #edit-rule)
│   ├── rules/         # RulesTab, RuleStack, RuleCard, UrlTester, PatternField, RuleEditModal
│   └── templates/     # TemplatesTab, TemplatesToolbar, TemplateEditor, SampleJsonEditor, PreviewIframe, liquidMode, liquidCompletions
├── popup/          # Preact popup: match status, +Add rule CTA, test-URL quick-jump, skip toggle
└── starter/        # bundled starter templates (imported as ?raw)

test/
├── fixtures/       # input.json / template.html / expected.html snapshots
├── fixtures-server/# local HTTP JSON server for manual + E2E testing
└── e2e/            # Playwright specs: CSP smoke, CodeMirror CSP smoke, axe-core, CRUD, render

docs/superpowers/
├── specs/          # design specs (per phase)
├── plans/          # per-phase implementation plans
└── reviews/        # code-review reports

design/             # SVG source of truth for extension icons (16/48/128)
scripts/            # one-off dev scripts (e.g. rasterize-icons.mjs)
```

## Testing

- **Unit** (Vitest): 192 tests covering the engine, matcher, storage facade + migration, fixture-snapshot render, `src/ui/` primitives + hooks (including shadow-root-aware Menu outside-click), options-page components (RuleCard, UrlTester, Header, liquidCompletions, liquidMode StreamParser, directive parser), popup rendering, and the URL middle-truncation helper. Content-side adds `TopStrip` + `mountTopStrip` component tests.
- **E2E** (Playwright, headed Chrome): 21 specs — render smoke, LiquidJS CSP smoke, CodeMirror 6 CSP smoke, popup Preact CSP smoke, top-strip shadow-DOM CSP smoke, axe-core WCAG 2.1 AA on the options page, on the popup (light + dark), and on the top-strip (light + dark), options CRUD flows (add rule, delete + undo, URL-tester match/shadowed, template delete-guard, per-template sample JSON persistence), popup match chip, popup skip toggle persistence, popup → options directive handoff, top-strip rendered-on-matched-page + toggle-raw message + skip-host writes.

The cores (`engine/` + `matcher/`) are deliberately free of `chrome.*` calls — grep to verify. That discipline is what makes the test suite possible in Node.

## Contributing

Issues and PRs welcome at [github.com/MattAltermatt/present-json](https://github.com/MattAltermatt/present-json/issues).

Before opening a PR:

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` — all green.
2. New features get a test. Bug fixes get a regression test.
3. Keep engine + matcher pure. Chrome-specific code lives in `src/content`, `src/background`, `src/options`, `src/popup`.
4. One-line commit messages; no trailers.

## License

[MIT](./LICENSE) © 2026 Matt Altermatt
