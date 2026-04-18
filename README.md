# Present-JSON

> A Chrome extension that renders JSON API responses as readable, user-templated HTML — so the internal admin URL you keep squinting at becomes a proper dashboard.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Manifest V3](https://img.shields.io/badge/Chrome-MV3-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)
![Tests](https://img.shields.io/badge/tests-64%20unit%20%2B%201%20E2E-success.svg)

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

- 📝 **Declarative HTML templates** — no JavaScript, no eval; just `{{path.to.value}}`, `{{#when x "y"}}...{{/when}}`, `{{#each items}}...{{/each}}`, `{{date ts "yyyy-MM-dd HH:mm"}}`, `{{link "https://..."}}`.
- 🎯 **Per-URL rules** — glob patterns (`*.server.com`, `/api/**`) or raw regex (`/^\/v\d+$/`). First-match wins; ordered; reorderable.
- 🏷️ **Per-rule variables** — reference with `{{@env}}`, `{{@adminHost}}`. Makes templates portable across environments.
- 👀 **Live preview** in the options page with sample JSON.
- 🧯 **Safe by default** — every render pass strips `<script>`, inline event handlers, `<iframe>`, `<link>`, `<object>`, `<embed>`, and neutralizes `javascript:`/`data:`/`vbscript:` URLs.
- 🔀 **Raw-JSON toggle** + **copy URL** from the injected top strip.
- 🚫 **Per-host skip** via the popup — disable rendering on one host without deleting the rule.
- 📦 **No framework runtime** — hand-rolled engine + matcher (both Chrome-API-free and unit-tested in Node). Production bundle < 15 KB gzipped.

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

Templates are HTML. Placeholders resolve against the parsed JSON body (`this` is the JSON root inside an `#each`).

| Syntax | Meaning |
|---|---|
| `{{path.to.value}}` | Interpolate (HTML-escaped). |
| `{{{path.to.value}}}` | Interpolate raw (no escape). |
| `{{@varName}}` | Interpolate a rule-defined variable. |
| `{{#when x "literal"}}...{{/when}}` | Render block if `x` equals the literal. |
| `{{#when x "y"}}...{{#else}}...{{/when}}` | Two-way conditional. |
| `{{#each items}}...{{this.field}}...{{/each}}` | Iterate an array; `this` scopes to each element. |
| `{{date timestamp}}` | Default format: `Apr 17, 2026 4:09 PM`. |
| `{{date timestamp "yyyy-MM-dd HH:mm"}}` | Custom format. |
| `{{link "https://host/{{id}}"}}` | URL-safe interpolation (query values percent-encoded). |

Missing values render as the empty string. See `docs/superpowers/specs/2026-04-17-present-json-design.md` for the full spec.

## Permissions & privacy

This extension requests these permissions and nothing else:

| Permission | Why |
|---|---|
| `storage` | Persist your rules and templates via `chrome.storage.sync` (falls back to `.local` above 90 KB). |
| `tabs` | The popup reads the active tab's URL to show match status and host-skip state. |
| `scripting` | Reserved for future dynamic-registration paths; not currently used. |
| `<all_urls>` host permission | The content script is statically registered against all pages so it can check user-configured rules. |

**Privacy:** no network requests are made by the extension itself. No analytics, no telemetry, no external hosts contacted. All data lives in your `chrome.storage` (synced across your own Chrome signed-in devices, or local-only if you exceed the 90 KB sync budget). No data leaves your browser.

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
│   ├── engine.ts      # top-level render(); outermost-first block walker
│   ├── escape.ts      # HTML entity encoder
│   ├── helpers.ts     # {{date}} + {{link}}
│   ├── lookup.ts      # dotted-path + @variable + this.* lookup
│   └── sanitize.ts    # final-pass sanitizer
├── matcher/        # pure URL → rule matcher
│   ├── glob.ts        # glob → RegExp (** = .*, /.../ = raw regex)
│   └── matcher.ts     # first-match ordered evaluation
├── storage/        # chrome.storage facade + sync→local migration
├── shared/types.ts # Rule / Template / StorageShape
├── content/        # content script (JSON → HTML replacement)
├── background/     # MV3 service worker (migration + starter seed)
├── options/        # options page (Rules + Templates tabs)
├── popup/          # toolbar popup (match status + skip toggle)
└── starter/        # bundled starter templates (imported as ?raw)

test/
├── fixtures/       # input.json / template.html / expected.html snapshots
├── fixtures-server/# local HTTP JSON server for manual + E2E testing
└── e2e/            # Playwright spec (loads unpacked extension)

docs/superpowers/
├── specs/          # design spec
├── plans/          # per-phase implementation plans
└── reviews/        # code-review reports
```

## Testing

- **Unit** (Vitest): 64 tests covering the engine, matcher, storage facade, and a full fixture-snapshot render.
- **E2E** (Playwright, headed Chrome): one spec that launches Chromium with the unpacked extension, seeds a rule through the service worker, navigates to the fixture server, and asserts the rendered DOM.

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
