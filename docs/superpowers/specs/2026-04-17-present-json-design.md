# Present-JSON — Design

- **Status:** draft (awaiting user review)
- **Date:** 2026-04-17
- **Repo:** `MattAltermatt/present-json`

## Summary

Present-JSON is a Chrome extension (Manifest V3) that intercepts direct
navigations to JSON responses and replaces the raw-text view with a
user-authored HTML rendering of the JSON. Renderings are defined in
**templates**: portable, code-free HTML+CSS files with a small safe helper
syntax for value binding, conditionals, iteration, formatting, and links.
Templates are bound to URLs via ordered **matcher rules** that supply
per-environment variables (for example, an `adminHost` value that differs in
QA vs prod). Templates are sharable between users; two people using the same
template see the same HTML.

## Problem

Internal tools frequently expose data as JSON endpoints. Viewing them today
means scanning a raw JSON blob, mentally decoding statuses ("is `DOWN` bad?"),
copying IDs, pasting them into admin URLs, and translating timestamps. This
friction compounds over a workday. Existing solutions either don't support
conditional presentation (pretty-printers), or require writing JavaScript
per-URL (Tampermonkey), or are non-portable (per-user browser settings).

## Non-goals

- Transforming responses that aren't direct navigations (in-page `fetch`/XHR).
- Executing user-supplied JavaScript. Templates are declarative only.
- Non-JSON content (CSV, XML, etc.). Explicitly deferred.
- Persisted editing of the remote data. This is view-only.
- A template marketplace. Phase 3 nice-to-have, not committed.

## Core concepts

| Concept | Definition |
|---|---|
| **Template** | A named HTML+CSS document with helper markup. Portable. |
| **Matcher rule** | Binds a URL pattern to a template and supplies per-rule variables. Ordered list; first match wins. |
| **Variables** | Per-rule key/value map (e.g., `{ adminHost: "qa-admin.server.com", env: "qa" }`). Referenced from templates. |
| **Portability** | Templates are the only sharable artifact. Matcher rules + variables live locally. Identical templates produce identical HTML given identical variables. |

## Architecture

Module boundary:

```
┌──────────────────────────────────────────────────────┐
│ content-script.ts  (Chrome glue — runs on all URLs)  │
│   • parse document body as JSON (early exit if not)  │
│   • load rules + templates from chrome.storage       │
│   • ask matcher for a rule                           │
│   • if match: run engine, replace document           │
│   • render "Show raw JSON" toggle and error banner   │
└──────────────────────────────────────────────────────┘
           │                        │
           ▼                        ▼
   ┌──────────────┐         ┌──────────────┐
   │ matcher.ts   │         │ engine.ts    │
   │ PURE         │         │ PURE         │
   │ (URL, rules) │         │ (tpl, json,  │
   │  → rule|null │         │  vars)       │
   │              │         │  → htmlStr   │
   └──────────────┘         └──────────────┘

┌──────────────────────────────────────────────────────┐
│ options.html + options.ts                            │
│   • Rules tab: ordered table, edit modal, reorder    │
│   • Templates tab: editor + live preview             │
│   • Import / export (templates only)                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ popup.html + popup.ts                                │
│   • current-tab match indicator                      │
│   • host-level enable/disable toggle                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ background.ts  (MV3 service worker)                  │
│   • storage migration (sync ↔ local)                 │
│   • toolbar icon badge state                         │
│   • dynamic content-script registration (injects     │
│     only on URLs that current rules cover, via       │
│     chrome.scripting.registerContentScripts)         │
└──────────────────────────────────────────────────────┘
```

**Pure cores.** `matcher.ts` and `engine.ts` never touch `chrome.*` APIs.
They accept plain inputs and return plain outputs, which makes them fully
testable in Node via Vitest and keeps ~90% of the real logic trivially
covered.

## Data model

Stored in `chrome.storage.sync` by default; the background worker migrates to
`chrome.storage.local` when the payload exceeds the sync quota (~100 KB total
per extension).

```jsonc
// key: "rules" — ordered list, first match wins
[
  {
    "id": "rule-01",
    "hostPattern": "qa-*.server.com",
    "pathPattern": "/internal/user/*",
    "templateName": "internal-user",
    "variables": { "adminHost": "qa-admin.server.com", "env": "qa" },
    "enabled": true
  },
  {
    "id": "rule-02",
    "hostPattern": "*.server.com",
    "pathPattern": "/internal/user/*",
    "templateName": "internal-user",
    "variables": { "adminHost": "admin.server.com", "env": "prod" },
    "enabled": true
  }
]

// key: "templates" — name → template text
{
  "internal-user": "<div class=\"row\">…</div><style>…</style>"
}

// key: "hostSkipList" — hosts the user has toggled off via the popup
[ "staging-example.server.com" ]
```

**Separation rationale.** A template is referenced by name so one template
can back many rules with different variables (the canonical QA/prod pair).
Rules and variables are considered site-specific and are never included in
template exports.

## Template engine

### Syntax

All markup is HTML+CSS. The engine recognizes a small fixed grammar of
helpers delimited by `{{…}}`.

| Helper | Example | Semantics |
|---|---|---|
| Value | `{{id}}`, `{{activity.currentStatus}}` | Dotted path lookup in the JSON. Missing path → empty string. HTML-escaped by default. |
| Variable | `{{@adminHost}}`, `{{@env}}` | `@`-prefix looks up a rule variable. |
| When / else | `{{#when status "UP"}}…{{#else}}…{{/when}}` | Equality against a quoted string literal. No expressions. |
| Each | `{{#each items}}{{this.name}}{{/each}}` | Iterate an array. `{{this}}` is the current item. Dotted paths on `this` supported. |
| Date | `{{date insertDate}}` or `{{date insertDate "yyyy-MM-dd"}}` | Parse ISO-8601; render in user's local timezone. Default format `MMM d, yyyy h:mm a`. |
| Link | `{{link "https://{{@adminHost}}/user/{{id}}"}}` | Interpolates into a URL. Query values are `encodeURIComponent`-escaped. |
| Raw | `{{{trustedHtml}}}` | Skips HTML-escaping. Documented as dangerous; used rarely. |

### Safety rules

- `<script>` tags are stripped from templates before injection.
- Inline event handlers (`onclick`, `onerror`, etc.) are stripped.
- External resource loads (`<iframe>`, `<script src>`, `<link rel="import">`)
  are stripped.
- Helper arguments accept only identifiers, dotted paths, and string
  literals. No expressions.
- `{{{raw}}}` still strips script tags and event handlers; it only skips
  entity escaping.
- The rendered HTML is isolated inside a single `#pj-root` div. Template
  `<style>` is moved into that div so styles do not leak to Chrome chrome
  (the "Show raw JSON" toggle) or vice versa.

### Missing values

A missing JSON path renders as the empty string. Users wanting `—` or `N/A`
write it explicitly:

```
{{#when status ""}}<span>—</span>{{#else}}{{status}}{{/when}}
```

### Implementation

Hand-rolled parser (~200–400 LoC target), not a dependency on Handlebars/Mustache.
Reasons:

- Explicit allowed surface; no prototype-pollution escape hatches.
- No helper-registration side channel.
- Smaller bundle.
- Easier to sandbox for safety against shared-template abuse.

## Matching

### Grammar

- **Glob (default).** `*` matches one path segment (or any host component).
  `**` matches any sequence of characters. Query strings are stripped before
  matching.
- **Regex (escape hatch).** If the pattern is wrapped in `/…/`, it is
  evaluated as a JavaScript regex against the full raw value.

### Rule evaluation

1. Strip query string from URL.
2. Attempt `JSON.parse` on the page body. If it fails, exit silently — the
   response isn't JSON. (No Content-Type header inspection is needed in
   Phase 1; the parse check is sufficient. If later hardening wants
   header-based gating, the service worker can observe
   `webRequest.onHeadersReceived`.)
3. Walk rules in order; return the first with `enabled: true` whose host and
   path patterns both match.
4. If none match, the extension does nothing and Chrome's native raw view
   remains on screen.

## Rendering lifecycle

1. User navigates to `https://qa-example.server.com/internal/user/1234?r=40`.
2. Server returns JSON; Chrome renders it as raw `<pre>` text.
3. Content script fires at `document_idle`. Reads `document.body.innerText`.
4. `JSON.parse` attempt. Failure ⇒ exit silently.
5. Storage read for rules + templates (single batched call).
6. `matcher.match(url, rules)` returns a rule or `null`.
7. Null ⇒ exit silently.
8. `engine.render(templateText, json, rule.variables)` returns an HTML string.
9. Content script replaces `document.documentElement.innerHTML` with:
   - A fixed top strip: env badge (if `rule.variables.env` is set),
     "Show raw JSON" link, "Copy URL" button, "Open in options" icon.
   - A container `<div id="pj-root">{rendered}</div>`.
10. "Show raw JSON" swaps `#pj-root` with a `<pre>` of the pretty-printed JSON,
    and back. No re-fetch.

## Options UI

### Rules tab

An ordered table. Reorder via drag handle or ▲▼ arrows. Each row: host
pattern, path pattern, template name, variables summary, enabled toggle,
edit, delete.

Edit modal fields:

- Host pattern (glob or `/regex/`)
- Path pattern (glob or `/regex/`)
- Template (dropdown from Templates tab)
- Variables (key/value rows, add/remove)
- Enabled toggle
- "Test URL" field: live indicator shows whether a pasted URL would match
  this rule and which variables resolve.

### Templates tab

Two columns. Left: template name list with New, Rename, Duplicate, Delete,
Export, Import buttons. Right: CodeMirror-lite editor with HTML syntax
highlighting and a secondary "Preview" pane that runs the template against a
JSON sample the user pastes. The preview uses the same engine as the content
script to avoid divergence.

### Popup (toolbar icon)

- Current URL + matched rule name (or "No rule matches").
- "Skip on this host" toggle (temporarily suppresses rendering for the current host without editing any rule; stored in a separate blocklist).
- Open-in-options button.

## Import / export + scrub-before-share

**Export** writes a single `.json` file containing only `{ name, template }`.
Matcher rules and variables are never exported. Before download, Options
shows a blocking dialog:

> **Review before sharing.** Your template may contain internal hostnames,
> example IDs, customer names, or other non-public details. Open the preview
> below and review it now before sending to someone else.
>
> [Preview template] [Download] [Cancel]

The preview is the raw template text (not the rendered output) so the user
can scan for literal strings they don't intend to share.

**Import** accepts the same format, validates it parses with the engine,
warns on name collision with "Overwrite / Rename / Cancel" options.

## Error handling

Never break the page. Fail soft and show the raw JSON.

| Condition | Behavior |
|---|---|
| Page isn't JSON | No-op. Raw view stays. |
| No rule matches | No-op. |
| Rule matches but template missing | Show raw JSON + red banner: *"Template 'X' not found. Click to open in Options."* |
| Template fails to parse | Show raw JSON + red banner with error message. |
| Template references missing field | Render as empty string. Not an error. |
| `chrome.storage` read fails | Show raw JSON + red banner. Log error in service-worker console. |

All red banners dismiss on click and are auto-hidden after 10 seconds. They
never block the raw JSON view.

## Testing

### Unit (Vitest, Node)

- `engine`:
  - Every helper has positive and negative tests.
  - Missing-path behavior.
  - Script/handler stripping.
  - Nested helpers (`{{link "…/{{id}}"}}`).
  - Per-template snapshot tests against fixture JSON → stable HTML.
- `matcher`:
  - Glob semantics (`*` vs `**`, trailing-slash tolerance).
  - Regex escape hatch.
  - Ordering (first match wins).
  - Content-Type gating.
- Storage layer: import/export round-trip; sync→local migration threshold.

### End-to-end (Playwright)

One smoke test. Launches chromium with the built extension preloaded,
navigates to a local fixture JSON URL, asserts:

- The rendered HTML appears (matches a known selector).
- "Show raw JSON" toggles back to a `<pre>` of the source JSON.

### Fixtures

`test/fixtures/` contains paired `example.json` + `template.html` +
`expected.html` files. Serves as both test data and user-facing examples
for Phase 1's starter template and for the Phase 3 example gallery.

## Tech stack

- **TypeScript** (strict).
- **Vite** + `@crxjs/vite-plugin` for MV3 HMR.
- **No UI framework.** Options and popup are small enough that plain
  HTML + TypeScript beats React on bundle size and build complexity.
- **Vitest** for unit tests.
- **Playwright** for the one E2E test.
- **pnpm** (fast, disk-light; fall back to npm if the user prefers).
- **ESLint + Prettier** with `tsc --noEmit` in CI.

## Phased delivery

### Phase 1 — Core render loop

Goal: a working extension Matt can load unpacked and use himself.

- MV3 scaffold: manifest, content script, background worker, options,
  popup.
- `engine.ts` with all helpers from the syntax table and all safety rules.
- `matcher.ts` with globs, regex escape hatch, query-string stripping,
  content-type gating.
- `chrome.storage.sync` with background-worker-managed `.local` fallback.
- Options page: Rules table + Templates editor + live preview.
- Popup with current-match indicator.
- One bundled starter template demonstrating the example-input case
  (internal-user style).
- Unit tests covering the entire pure core.
- One Playwright E2E smoke test.

### Phase 2 — Sharing & polish

- Export/import templates with the scrub-before-share dialog.
- Template editor enhancements (helper autocomplete).
- "Test URL" field in the rule edit modal.
- Additional bundled starter templates.
- Keyboard shortcut to toggle raw/rendered (provisionally `r`).

### Phase 3 — Deferred / nice-to-haves (not committed)

- Form-based template editor for non-HTML users.
- Shared template registry / marketplace.
- Non-JSON content support (CSV, XML).

## Open items

These are intentionally resolved during implementation, not up front:

- Exact glob grammar edge cases (trailing `/`, case sensitivity of host
  matching, escaping literal `*`).
- Sync→local migration byte threshold (likely 90 KB, with a warning at 80 KB).
- Precise format of the export `.json` file (versioned wrapper vs. bare
  object) — chosen once before Phase 2 starts.

## Appendix A — Template DSL quick reference

```
{{path.to.field}}        value from JSON (escaped)
{{@varName}}             rule variable
{{{trustedHtml}}}        raw (still safe-stripped for scripts/handlers)

{{#when x "VALUE"}}…{{#else}}…{{/when}}
{{#each items}}{{this.name}}{{/each}}

{{date isoString}}
{{date isoString "yyyy-MM-dd HH:mm"}}
{{link "https://{{@adminHost}}/user/{{id}}"}}
```

## Appendix B — Example end-to-end

### Rule (in extension config)

```json
{
  "id": "rule-01",
  "hostPattern": "qa-*.server.com",
  "pathPattern": "/internal/user/*",
  "templateName": "internal-user",
  "variables": {
    "adminHost": "qa-admin.server.com",
    "env": "qa"
  },
  "enabled": true
}
```

### Template (`internal-user`)

```html
<div class="row">
  <span class="label">ID</span>
  <a href="https://{{@adminHost}}/user/{{id}}">{{id}}</a>
</div>
<div class="row">
  <span class="label">Insert Date</span>
  <span>{{date insertDate}}</span>
</div>
<div class="row">
  <span class="label">Status</span>
  {{#when status "UP"}}<span class="badge-up">UP</span>{{/when}}
  {{#when status "DOWN"}}<span class="badge-down">DOWN</span>{{/when}}
</div>
<div class="row">
  <span class="label">Config</span>
  <a href="https://{{@adminHost}}/product/api/v1/{{theValueICareAbout}}">
    {{theValueICareAbout}}
  </a>
</div>
<style>
  .row { display: flex; gap: 12px; padding: 6px 12px; }
  .label { color: #666; font-size: 11px; text-transform: uppercase; }
  .badge-up   { background: #10b981; color: #fff; padding: 2px 8px; border-radius: 3px; }
  .badge-down { background: #ef4444; color: #fff; padding: 2px 8px; border-radius: 3px; }
</style>
```

### Input JSON

```json
{
  "id": 1234,
  "insertDate": "2026-04-17T23:09:30+0000",
  "status": "DOWN",
  "internalId1": 7777,
  "internalId2": 8888,
  "theValueICareAbout": 9999
}
```

### Rendered output (structure)

Top strip (extension-owned): `[QA]` badge · "Show raw JSON" · "Copy URL".

Body (template-owned):
- ID → `1234` linked to `https://qa-admin.server.com/user/1234`
- Insert Date → rendered in the viewer's local timezone (e.g., `Apr 17, 2026 7:09 PM` for a US/Eastern viewer)
- Status → red `DOWN` badge
- Config → `9999` linked to `https://qa-admin.server.com/product/api/v1/9999`

### What the recipient of this template sees

If another user imports only the `internal-user` template (not the rule)
and binds it to their own URL pattern with their own variables, they will
see an identical layout with their values. Portable by construction.
