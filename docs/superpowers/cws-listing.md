# Chrome Web Store listing — submission copy

Paste-ready copy for each field of the CWS developer dashboard submission form. Revise here first, paste into the form second.

---

## Name

```
Freshet
```

---

## Summary / short description

The CWS form auto-populates this from `manifest.json → description`. Current manifest value (✅ matches tagline):

```
Thaw any JSON URL into a more useful page. Per-URL Liquid templates turn raw API responses into proper dashboards.
```

(114 / 132 char budget.)

---

## Detailed description

```
Freshet turns any JSON URL into a rendered page. Write one small Liquid template per URL pattern, and from then on, responses from that endpoint render as a real dashboard — fields surfaced, statuses chipped, IDs turned into clickable links to whatever they reference. Same URL, proper UI.

Built for people who live in internal tooling, debug webhooks, or hit API endpoints directly in a browser tab. If you've ever squinted at a wall of <pre>-formatted JSON trying to find the one field you cared about, this is for you.


★ WHAT YOU GET ────────────────────────────

• Per-URL rules with glob patterns (*.server.com/api/**) or raw regex — first-match-wins, reorderable.

• Liquid templates — {{ path.to.value }}, conditionals, loops, and helpers for dates, links, and compact numbers. No JavaScript in templates. No eval.

• A URL tester in the options page that tells you exactly which rule matches (or why the others don't — host-miss, path-miss, shadowed).

• A real template editor — CodeMirror 6 with Liquid syntax highlighting, autocomplete over your sample JSON's paths, and a live sandboxed preview.

• A top strip on every matched page — env chip, Rendered / Raw toggle (⌘⇧J), Copy URL, Edit rule, Skip this host. Isolated in a shadow DOM so it can't collide with the page.

• Five bundled starter templates — service health, incident detail, GitHub repos, Pokémon, and country data. Try them out of the box at mattaltermatt.github.io/freshet/try/

• Dark mode from day one, and WCAG 2.1 AA on every surface.


★ SAFE BY DEFAULT ─────────────────────────

All Liquid output is auto-escaped. A second-pass sanitizer strips <script>, <iframe>, inline event handlers, and javascript: / data: / vbscript: URLs. Template previews render in a sandboxed iframe with no same-origin access. Freshet makes no network requests of its own — it only reads JSON that Chrome has already fetched for you.


★ PRIVATE BY DEFAULT ──────────────────────

Your rules and templates live in your own chrome.storage — synced across your signed-in Chrome devices, or local-only if your config exceeds the 90 KB sync budget. No telemetry. No analytics. No external hosts contacted. Full privacy policy: mattaltermatt.github.io/freshet/privacy/


Open source — github.com/MattAltermatt/freshet
```

(~2,600 chars — well under the 16,000 limit.)

---

## Category

```
Developer Tools
```

---

## Language

```
English
```

---

## Single-purpose description

```
Freshet's single purpose is to render JSON responses from user-configured URLs as HTML, using user-authored Liquid templates, with visible controls on every matched page to toggle between the rendered and raw views.
```

---

## Permission justifications

### `storage`

```
Persists the user's rules, Liquid templates, per-template sample JSON, per-host skip toggles, and UI preferences. Synced via chrome.storage.sync by default so configuration follows the user across their signed-in Chrome devices; falls back to chrome.storage.local if the config exceeds the sync quota. This is user configuration only — no third-party data is stored.
```

### `tabs`

```
The popup reads the active tab's URL to display which Freshet rule (if any) currently matches it, to surface the "Edit rule" deep-link for that matched rule, and to honor the per-host skip toggle. No other tab data is read.
```

### Host permission — `<all_urls>`

```
The content script must run on any page the user configures a rule for. Because the user is free to configure rules against any host (internal tooling, any public API, any webhook URL), Freshet cannot know the user's target hosts in advance. The content script checks the user's configured rules on every page load and only renders if a rule matches; on non-matching pages, it exits immediately without modifying the page.
```

---

## Public contact email

```
altermatt@gmail.com
```

---

## Support URL

```
https://github.com/MattAltermatt/freshet/issues
```

---

## Privacy practices (disclosures)

All "No" except one:

| Question | Answer |
|---|---|
| Collects personally identifiable information | No |
| Collects health information | No |
| Collects financial information | No |
| Collects authentication information | No |
| Collects personal communications | No |
| Collects location data | No |
| Collects web history | No |
| Collects user activity | No |
| Collects website content | **Yes (locally only — never transmitted)** — Freshet reads the JSON body of pages the user has configured a rule for, in order to render it. This data is never stored beyond the page render, never transmitted off the device, and never shared with any third party. |

### Certifications (all three required)

☑ I do not sell or transfer user data to third parties, outside of the approved use cases.
☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.
