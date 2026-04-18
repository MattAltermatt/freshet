# Present-JSON — Roadmap

## Shipped

- **Phase 1** (2026-04-17) — MV3 scaffold, pure engine + matcher cores, rule matching, bundled starter, E2E smoke.
- **Phase 2** (2026-04-18) — UX polish redesign across options + popup + top-strip. Preact 10, LiquidJS engine, CodeMirror 6 template editor, `{>` design system with dark mode from day 1, autosave + toasts, split-view Rules + URL tester, Preact popup with URL-hash directive handoff, shadow-DOM top-strip with `⌘⇧J`. Delivered as 5 sequential plans — see `docs/superpowers/plans/2026-04-18-phase2-plan{1..5}-*.md`.

Pre-publication hardening (regex escape guard, scripting-permission drop, 16/48/128 icons, privacy policy on GH Pages) landed alongside Phase 1/2. Chrome Web Store developer account registered.

---

## Now — Pre-release polish sweep

Editorial + QOL sweep before the Chrome Web Store submission. Aim: "as good as we can make it look." Ordered by impact within each group.

### Functional gaps

- **`liquidCompletions` after a filter argument** — cursor inside `{{ ts | date: "`<cursor>`"` returns no completions because the regex cascade falls through. Extend `inOutput` detection or add a dedicated `inFilterArg` case.
- **`walkJsonPaths` hint comment mismatch** — source comment says arrays appear as `items[]` but the implementation emits `items[0]`. Pick `[0]` (valid Liquid accessor), align docs.

### UX — rule + template flows

- **"+ Add rule for this host" captures the full URL** — popup + top-strip seed only `hostPattern` today; leave `pathPattern = /`. Extend the directive to `#new-rule=<encodeURIComponent(url)>` and pre-fill both patterns from `hostname` + `pathname` (reasonable default: first 1–2 path segments + `/**`).
- **Quick-attach-template when the rule's template doesn't exist** — inline "+ Create template '<name>'" row inside the dropdown, or adjacent button that seeds a blank template and returns focus to the rule modal. Kills the modal-close → Templates → New → rename → back-to-Rules dance.
- **URL tester polish** — quick-clear `×` inside the input, heading "Per-rule results" above the list, legend line under the input ("✅ match / — miss / ⚠ shadowed / ○ disabled").
- **Surface expected `vars.*` from a template into the rule editor** — static scan for `{{ vars.x }}` references, pre-populate rule's Variables panel with expected keys, flag missing/extra keys inline. Eliminates the "why isn't this rendering" mystery when a rule forgot a var.
- **Theme switcher in the top-strip ⋯ menu** — mirror the options-page theme control inside the strip's menu; subitems "Theme: system / light / dark" with a ✓ on the active one. Ensure the options-page switcher uses the same copy + grouping so the two surfaces read identically.

### Brand + polish

- **Brand audit across external surfaces** — one coherent pass:
  - **GH Pages site** (`mattaltermatt.github.io/present-json/`): rasterize `design/icon-128.svg` → `docs/logo.png`; set `logo:` in `docs/_config.yml`; add `docs/_includes/head.html` with `<link rel="icon">`, `<meta name="theme-color" content="#ea580c">`, Open Graph + Twitter card tags.
  - **README.md**: logo at the top, one-liner aligned with the manifest description.
  - **Options, popup, Templates-tab headers**: `{>` becomes a link to the GH Pages site (new tab via `chrome.tabs.create`). Top-strip `{>` stays decorative (no outbound link on arbitrary host pages).
  - **Alignment sweep**: manifest `description`, options + popup `<title>`, every visible instance of the `{>` motif — brace + bracket in the same order, orange always on the bracket.
- **Friendlier starter templates** — inline HTML comments in bundled starters teaching the Liquid grammar we expose (`{% if %}` / `{% for %}`, filters, `vars.*`, sanitizer behavior). Doubles as docs for template authors and LLMs.
- **Bundled starter with variables** — a real-world example template that exercises `{{ vars.* }}` end-to-end so users discover the variable pipeline.
- **Collapsible template boxes in the Templates tab** — disclosure-arrow on editor, sample JSON, preview, cheatsheet. Persisted per-user in `settings` or a dedicated `pj_ui_collapse` storage key.
- **Code/editorial pass** — variable naming (`--pj-*`, `pj-*`, camelCase, storage keys), class-name consistency, dead code, duplicate tokens, stale comments, unused imports, one pass over every user-facing string for voice/tone.

---

## Next — Real-world example JSONs (Phase 3)

Unblocks the store screenshots *and* gives the pre-release polish sweep a real testbed.

- Host static JSON fixtures at `mattaltermatt.github.io/present-json/examples/...` via Jekyll.
- Bundle 2–3 starter rules + templates against public APIs. Candidates: JSONPlaceholder, HTTPBin, GitHub API, PokéAPI, REST Countries.
- First-run empty state gets a "Try it now" affordance that drops the bundled rules in.

---

## Deployment — Chrome Web Store submission

Paused 2026-04-17 pending Phase 2 polish. Resume after the pre-release sweep + Phase 3 screenshots are ready.

### Already in place
- Chrome Web Store developer account registered.
- Icons 16 / 48 / 128 rasterized in `public/`.
- Privacy policy hosted at `mattaltermatt.github.io/present-json/privacy/`.
- `<all_urls>` / `storage` / `tabs` permissions are the minimum set; `scripting` already dropped.

### Still to do (in order)

1. **Screenshots (1280×800)** — options page (Rules + Templates, light + dark), popup (matched + unmatched), rendered page with top-strip. Capture after Phase 3 lands so examples look real.
2. **Store listing copy** — short description (132 chars), detailed description, single-purpose statement, permission justifications (`storage` / `tabs` / `<all_urls>`).
3. **Public support contact** — GitHub Issues as the public support URL; personal email used only for the required Google contact field.
4. **Version bump** — `0.1.0` → `1.0.0` candidate in `vite.config.ts` manifest + `package.json`.
5. **Build + zip `dist/`** — submission artifact (`pnpm build` then `zip -r present-json-v1.0.0.zip dist`).
6. **Submit for review** — typical turnaround 1–5 business days; plan buffer for possible back-and-forth on permission justifications.

---

## Post-launch backlog

Ordered by expected impact.

### Extension-conflict handling

Preserves the Phase 2 UX investment post-install.

- Detect when another JSON viewer (JSONView, JSON Formatter, etc.) already mutated `document.body` before our content script ran. Heuristic hook + degraded UI branch already reserved in `src/content/conflictDetect.ts` and `TopStrip` — this phase fills in the detection logic.
- Show a clear in-popup warning with actionable guidance — "disable JSONView on this host" / "uninstall to avoid conflicts".
- Do NOT try to programmatically take over the page — arms-race we lose.

### Action-badge render state

- `chrome.action.setBadgeText` from background when a rule fires (success dot or `✓`); error badge (`!` red) when a rule matched but the template failed to compile / render. Signals render state without opening the popup. Error path overlaps with conflict detection — ship together.

### Expanded test coverage (ongoing)

- Visual-regression baselines via Playwright screenshots in `test/e2e/__screenshots__/`; failures break CI.
- Storage-quota overflow (90 KB sync → local migration) E2E covering the real fallback.

### Templates — UX convergence

- **Match the LiquidJS playground UX** — the [official playground](https://liquidjs.com/playground.html) is the canonical reference: template / JSON / rendered output panels, shareable URL-encoded sessions. Converge our Templates tab on those proportions + the share-via-URL idea. Link the playground from the syntax cheatsheet header.

### Template export / import

- Export / import templates with a scrub-before-share dialog so users control what gets included. Useful once multiple installs or team-sharing starts.

### Nice-to-haves

- Form-based template editor (for non-coder users).
- Shared template registry (community templates).
- Non-JSON content support (HTML / CSV / XML content-type routing).
