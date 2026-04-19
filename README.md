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
![Tests](https://img.shields.io/badge/tests-302%20unit%20%2B%2021%20E2E-success.svg)

Paste a JSON URL into Chrome, get a table instead of a `<pre>`. Works against any host you configure — internal tooling, public APIs, webhooks you're debugging. Templates are small HTML snippets with `{{placeholders}}`; rules map URL patterns to templates.

**👉 [See live demos at mattaltermatt.github.io/freshet/try/](https://mattaltermatt.github.io/freshet/try/)** — five starter templates against real APIs (PokéAPI, REST Countries, GitHub) and self-hosted SRE-style examples (service health → incident detail).

## Table of contents

- [Features](#features)
- [Principles](#principles)
- [Demos](#demos)
- [Install](#install)
- [Quick start](#quick-start)
- [Template syntax](#template-syntax)
- [Permissions & privacy](#permissions--privacy)
- [For contributors](#for-contributors)
- [License](#license)

## Features

- 📝 **Liquid templates, per URL** — `{{ path.to.value }}`, `{% if status == "ok" %}…{% endif %}`, `{% for item in items %}…{% endfor %}`, plus helpers for dates, links, and compact numbers.
- 🎯 **Flexible URL matching** — glob patterns (`*.server.com`, `/api/**`) or raw regex (`/^\/v\d+$/`). First-match wins; rules are ordered and reorderable. Per-rule variables (`{{ vars.env }}`) keep templates portable across environments.
- 💻 **Proper authoring tools** — split-view options page with a URL tester that tells you exactly which rule matches (or why the others don't). CodeMirror 6 editor with Liquid highlighting, autocomplete over your sample JSON, and a live sandboxed preview.
- 🔀 **Controls on every matched page** — a minimal top strip with env chip, Rendered / Raw toggle (⌘⇧J), Copy URL, Edit rule, and Skip this host. Isolated in a shadow DOM so it can't collide with the page.
- 🧯 **Safe + private by default** — auto-escaped output (explicit `| raw` to bypass), a sanitizer that strips `<script>` / `<iframe>` / inline handlers / `javascript:` URLs, sandboxed previews, and zero network calls from the extension itself. All data stays in your `chrome.storage`.
- 🎨 **Dark mode, WCAG 2.1 AA** — auto-follows your OS or choose manually. Both themes pass axe-core sweeps on options, popup, and the top strip.
- 📦 **Export / import** — share rules and templates with teammates as a single `.freshet.json` bundle. Imports are always reviewed; imported rules start disabled; secrets in shared payloads are flagged, never hidden.

## Principles

Freshet makes a few deliberate choices about how it treats you and your data:

- **Warn, don't block.** When Freshet detects something worth pointing out (a possible secret in a shared bundle, a naming collision, a sample payload that looks like it holds real tokens) it tells you and steps out of the way. You decide.
- **No hiding.** Every flag shows the exact pattern or condition that matched — literal regex, literal matched text. If we can't explain why we flagged something, we don't flag it.
- **Local-first, always.** Rules, templates, and sample JSON live in your browser's `chrome.storage`. Nothing is sent to a server. There is no server.
- **Plain formats.** Bundles are plain JSON you can open, diff, and audit in any text editor. No binary blobs, no base64 obfuscation, no custom encoding.
- **No telemetry.** No analytics, no error reporting, no phone-home.

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

### Chrome Web Store

**v1.0.0 submitted 2026-04-19** — currently in compliance review. Listing link will replace this line once it's live.

### From source (unpacked)

Until the Web Store listing is live, load the latest build unpacked:

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

## For contributors

Issues and PRs welcome at [github.com/MattAltermatt/freshet](https://github.com/MattAltermatt/freshet/issues).

**Setup** — Node.js 20+ and [Corepack](https://nodejs.org/api/corepack.html) (ships with Node, enable once with `corepack enable`). `pnpm` auto-resolves from the `packageManager` field.

```bash
pnpm install        # install deps
pnpm dev            # Vite + @crxjs HMR; writes to dist/ on save
pnpm build          # production bundle
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # Vitest unit tests (TZ=UTC)
pnpm test:e2e       # Playwright (requires pnpm build first)
pnpm fixtures       # local JSON fixture server at :4391
```

Load `dist/` unpacked to try your build. With `pnpm dev` running, @crxjs hot-reloads on save (service-worker changes may still need a manual **Reload** on the extension card).

**Before opening a PR** — run the full pipeline green: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`. New features get a test; bug fixes get a regression test. Keep `src/engine/` and `src/matcher/` free of `chrome.*` calls — that purity is what makes the 300-plus unit tests possible in Node.

**Architecture deep-dive** lives in [`CLAUDE.md`](./CLAUDE.md) (directory layout, storage schema, security model, and known gotchas). [`ROADMAP.md`](./ROADMAP.md) tracks what's next.

## License

[MIT](./LICENSE) © 2026 Matt Altermatt
