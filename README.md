<p align="center">
  <a href="https://mattaltermatt.github.io/freshet/">
    <img src="docs/assets/logo.png" alt="Freshet logo" width="128" height="128">
  </a>
</p>

# Freshet

> **Thaw any JSON URL into a more useful page.** A Chrome extension that pays you back time on every JSON URL you revisit. Write one small Liquid template per URL pattern; from then on, the response renders as a real dashboard — fields surfaced, statuses colored, IDs turned into clickable links to whatever they reference.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Manifest V3](https://img.shields.io/badge/Chrome-MV3-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)
![Tests](https://img.shields.io/badge/tests-295%20unit%20%2B%2021%20E2E-success.svg)

Paste a JSON URL into Chrome, get a table instead of a `<pre>`. Works against any host you configure — internal tooling, public APIs, webhooks you're debugging. Templates are small HTML snippets with `{{placeholders}}`; rules map URL patterns to templates.

**👉 [See live demos at mattaltermatt.github.io/freshet/try/](https://mattaltermatt.github.io/freshet/try/)** — five starter templates against real APIs (PokéAPI, REST Countries, GitHub) and self-hosted SRE-style examples (service health → incident detail).

## Table of contents

- [Features](#features)
- [Demos](#demos)
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

## Demos

Freshet ships with five starter rules + templates so a fresh install is never a blank slate. Two render against self-hosted JSON we control (active out of the box, won't surprise anyone) and three target popular public APIs (inactive by default — flip the toggle to try them on real responses):

| Starter | Endpoint | Default | Try it |
|---|---|---|---|
| **Service Health** | `mattaltermatt.github.io/freshet/examples/services/*` | active | [payments.json →](https://mattaltermatt.github.io/freshet/examples/services/payments.json) |
| **Incident Detail** | `mattaltermatt.github.io/freshet/examples/incidents/*` | active | [INC-2026-001 →](https://mattaltermatt.github.io/freshet/examples/incidents/INC-2026-001.json) |
| **GitHub Repo** | `api.github.com/repos/*/*` | inactive | [facebook/react →](https://api.github.com/repos/facebook/react) |
| **Pokémon** | `pokeapi.co/api/v2/pokemon/*` | inactive | [pikachu →](https://pokeapi.co/api/v2/pokemon/pikachu) |
| **Countries** | `restcountries.com/v3.1/name/*` | inactive | [japan →](https://restcountries.com/v3.1/name/japan) |

The full marketing page with raw-JSON-vs-rendered side-by-sides lives at [**mattaltermatt.github.io/freshet/try/**](https://mattaltermatt.github.io/freshet/try/).

Each starter rule carries an `Example ↗` pill on its rule card — click to open the canonical demo URL in a new tab.

## Install

### From source (unpacked — current install method)

1. Clone the repo and build:
   ```bash
   git clone https://github.com/MattAltermatt/freshet.git
   cd freshet
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

The fastest way is to click any "Try it live" link from the [Demos](#demos) section above — the two self-hosted starters render immediately. To author your own:

1. **Open the options page**: right-click the toolbar icon → **Options**.
2. **Templates tab** — five starter templates are seeded on first run (`service-health`, `incident-detail`, `github-repo`, `pokemon`, `country`). Pick any to study, or click **+ New** to start fresh.
3. **Rules tab** — **+ Add rule**, fill in:
   - Host pattern: `api.example.com`
   - Path pattern: `/internal/user/*`
   - Template: pick from the seeded list, or your own
   - Variables: `env=prod`, `adminHost=admin.example.com`, etc. — accessible as `{{ vars.env }}` in the template
   - Active ✓
4. Click **Save** in the dialog (autosaves to `chrome.storage`).
5. Navigate to a matching URL. The JSON response is replaced with rendered HTML and a top control strip (env chip, raw/rendered toggle, copy URL).

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

**Privacy:** no network requests are made by the extension itself. No analytics, no telemetry, no external hosts contacted. All data lives in your `chrome.storage` (synced across your own Chrome signed-in devices, or local-only if you exceed the 90 KB sync budget). No data leaves your browser. Full policy: [mattaltermatt.github.io/freshet/privacy/](https://mattaltermatt.github.io/freshet/privacy/).

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

- **Unit** (Vitest): 295 tests covering the engine (incl. array-root JSON exposed as `items`), matcher, storage facade + migration, fixture-snapshot render, all 5 starter templates (light + dark variants, URL-from-id link construction), `src/ui/` primitives + hooks (including shadow-root-aware Menu outside-click), options-page components (RuleCard with the Example pill, UrlTester, Header, liquidCompletions, liquidMode StreamParser, directive parser), popup rendering + the FirstRunBanner gating, and the URL middle-truncation helper. Content-side adds `TopStrip` + `mountTopStrip` component tests.
- **E2E** (Playwright, headed Chrome): 21 specs — render smoke, LiquidJS CSP smoke, CodeMirror 6 CSP smoke, popup Preact CSP smoke, top-strip shadow-DOM CSP smoke, axe-core WCAG 2.1 AA on the options page, on the popup (light + dark), and on the top-strip (light + dark), options CRUD flows (add rule, delete + undo, URL-tester match/shadowed, template delete-guard, per-template sample JSON persistence), popup match chip, popup skip toggle persistence, popup → options directive handoff, top-strip rendered-on-matched-page + toggle-raw message + skip-host writes.

The cores (`engine/` + `matcher/`) are deliberately free of `chrome.*` calls — grep to verify. That discipline is what makes the test suite possible in Node.

## Contributing

Issues and PRs welcome at [github.com/MattAltermatt/freshet](https://github.com/MattAltermatt/freshet/issues).

Before opening a PR:

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` — all green.
2. New features get a test. Bug fixes get a regression test.
3. Keep engine + matcher pure. Chrome-specific code lives in `src/content`, `src/background`, `src/options`, `src/popup`.
4. One-line commit messages; no trailers.

## License

[MIT](./LICENSE) © 2026 Matt Altermatt
