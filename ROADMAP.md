# Present-JSON — Roadmap

## Phases

1. **Phase 1: Core render loop** — done 2026-04-17
   - MV3 scaffold, content script, service worker, options, popup
   - Engine + matcher (pure) with unit tests
   - One bundled starter template
   - One Playwright E2E smoke test

2. **Phase 1.5: Chrome Web Store publication** — paused 2026-04-17 pending Phase 2 polish (resume after Phase 2)

   *De-risk:*
   - ✅ Register Chrome Web Store developer account (done 2026-04-17)

   *Pre-publication hardening:*
   - ✅ Fix `//` regex escape hatch: require length > 2 so a bare `//` doesn't compile to match-all (done 2026-04-17, Phase 1 review #8)
   - ✅ Drop unused `scripting` permission from `vite.config.ts` manifest (done 2026-04-17)

   *Store assets:*
   - ✅ Real icons at 16/48/128 (done 2026-04-17 — SVG sources in `design/`, rasterized via `pnpm icons`, output to `public/`)
   - ✅ Privacy policy page hosted at a stable URL via GitHub Pages (done 2026-04-17 — `docs/privacy.md` → mattaltermatt.github.io/present-json/privacy/)
   - ⏸ Screenshots (1280×800) for options page, rendered view, popup — deferred until Phase 2 polish lands; screenshots of the polished UI will be more compelling

   *Listing + submission (deferred):*
   - Store listing copy: short description, detailed description, single-purpose statement, permission justifications
   - Public support contact: GitHub Issues as primary (support *website* → repo issues URL); personal email used only for the required Google contact field
   - Bump version for first public release (0.1.0 → 1.0.0 candidate)
   - Build + zip `dist/` submission artifact
   - Submit for review

3. **Phase 2: UX polish redesign** — in progress (spec locked 2026-04-18)

   Scope: options page + popup + rendered top-strip, designed as a cohesive system. Spec: [`docs/superpowers/specs/2026-04-18-phase2-ux-polish-design.md`](docs/superpowers/specs/2026-04-18-phase2-ux-polish-design.md).

   Tech swap: Preact 10 (UI) + Handlebars (template runtime) + CodeMirror 6 (template editor).

   Rolled out as 5 sequential plans; each produces working, independently-verifiable software:

   1. **Plan 1 — Foundation**: deps + Vite JSX + `src/ui/` shell (theme tokens, hooks, base components). No user-visible change. — done 2026-04-18
   2. **Plan 2 — Engine swap**: drop hand-rolled engine for Liquid (LiquidJS — interpreter, CSP-safe in MV3); migrator for existing templates; rewrite starters. — done 2026-04-18
   3. **Plan 3 — Options page**: split-view rules + URL tester, CodeMirror 6 template editor (hand-rolled Liquid mode + autocomplete), rule-edit modal overhaul with validation + KV editor, `Saved ✓` / Undo toasts, dark mode, keyboard shortcuts footer, per-template sample JSON persistence, `{>` logo theme-aware, storage-area promotion, axe-core WCAG 2.1 AA gate. — done 2026-04-18
   4. **Plan 4 — Popup**: restyled popup with match status, skip toggle, test-URL quick-jump. — pending
   5. **Plan 5 — Top-strip**: shadow-rooted injected banner, warm cream / warm near-black palette, ⋯ menu for secondaries, keyboard shortcuts. Code review + docs roll into the tail of this plan. — pending

   Behaviors delivered across the 5 plans:
   - Adopt `{>` palette (`#111827` + `#ea580c` + warm cream `#fef7ed`) as a proper design system; dark mode from day 1 via `prefers-color-scheme` + user override
   - Rule-edit modal overhaul: pattern examples, inline validation, KV variable editor, enabled-as-header-status
   - Rules split-view: card stack + URL tester; first-match-wins made visible; drag-to-reorder
   - Autosave with `Saved ✓` toast + 8 s Undo toast for destructive actions
   - Templates: CodeMirror 6 + Handlebars grammar + autocomplete; bigger rendered preview; pinned syntax cheatsheet; AI-hint comment header in starters
   - Keyboard shortcuts visibly documented; `⌘⇧J` raw/rendered toggle wired via `chrome.commands`

4. **Phase 3: Real-world example JSONs** — pending (HIGH priority; unblocks Phase 1.5 store screenshots)
   - Host static JSON fixtures at `mattaltermatt.github.io/present-json/examples/...` via Jekyll
   - Bundle 2–3 starter rules + templates targeting real public APIs (candidates: JSONPlaceholder, HTTPBin, GitHub API, PokéAPI, REST Countries)
   - "Try it now" affordance from the options page first-run empty state

5. **Phase 4: Extension-conflict handling** — pending (MEDIUM-HIGH; preserves the Phase 2 UX investment post-install)
   - Detect when the page body has already been modified by another JSON viewer (JSONView, JSON Formatter, etc.) before our content script runs
   - Show a clear popup warning + actionable guidance ("disable JSONView on this host" or "uninstall to avoid conflicts")
   - Do NOT try to programmatically take over — that's an arms race

6. **Phase 5: Expanded test coverage** — pending (MEDIUM; ongoing, rides alongside other phases)
   - Popup behavior E2E (currently zero coverage)
   - Options page CRUD E2E (currently zero coverage)
   - Visual regression via Playwright screenshots, checked into repo
   - Accessibility audit via `axe-core` in Playwright
   - Storage quota overflow (90 KB sync → local migration) E2E

7. **Phase 6: Export/import templates** — pending (LOW; nice-to-have, post-store-launch)
   - Export/import templates with a scrub-before-share dialog that lets user control what's included

8. **Phase 7: Deferred / nice-to-haves** — pending
   - Form-based template editor
   - Shared template registry
   - Non-JSON content support
   - **QOL: "Create rule from current page"** — one-click action from the popup (and/or context menu) that pre-populates a new rule with the current tab's URL as the pattern, then jumps into the options page's rule-edit modal. Eliminates the manual copy-paste dance. Candidate to graduate into Phase 2 Plan 4 (popup) if it fits; otherwise standalone.
   - **QOL: "Page is being rendered" indicator** — when the current tab is actively rendered by a rule, make it obvious in the extension surface itself (not just via the rendered page content). Likely mechanism: Chrome action badge (colored dot or short text like ✓) set from the background/content script when a rule fires, cleared otherwise. Candidate to graduate into Phase 2 Plan 4 (popup) alongside the other popup work.
   - **QOL: Friendlier starter templates** — include inline HTML comments in bundled starters that teach the Liquid syntax we expose (basic interpolation, `{% if %}` / `{% for %}`, `date` / `link` / `num` / `raw` filters, `vars.*` namespace, blank-check idiom, final sanitizer behavior). Makes starters double as documentation for template authors, including LLMs asked to generate new templates. Candidate to graduate into Phase 3 (real-world examples).
   - **QOL: Remember & optional sample JSON in the Templates editor** — persist the sample JSON per template so live-preview keeps working across sessions without re-pasting. Make the sample field optional: a template with no saved sample just shows a blank preview (or a last-seen-live sample from a matched rule, TBD). Candidate to graduate into Phase 2 Plan 3 (options-page rewrite) where the template editor is being redone.
   - **Pre-release polish sweep (gate to Chrome Web Store resume)** — before re-submitting to the Chrome Web Store, do a full editorial pass: variable naming (all `--pj-*`, `pj-*`, camelCase identifiers, storage keys), class-name consistency, dead code, duplicate CSS tokens, stale comments, unused imports, and a once-over on every user-facing string for voice/tone. Aim is "as good as we can make it look" — shippable, not just working. Keep this item until the sweep + submission land together. Subitems queued here:
     - **Focus trap inside modals** — `RuleEditModal` + `TemplatesToolbar` delete-confirm capture Escape but don't cycle Tab within the dialog. WCAG 2.1.2 / ARIA dialog expectation. Add a roving-focus handler or pull in a tiny focus-trap lib (~1 KB).
     - **liquidCompletions after a filter argument** — cursor inside `{{ ts | date: "`<cursor>`"` returns no completions because the regex cascade falls through. Either extend `inOutput` detection or add a dedicated `inFilterArg` case.
     - **walkJsonPaths hint comment mismatch** — the source comment says arrays appear as `items[]` but the implementation emits `items[0]` for sub-paths. Pick one convention (likely `[0]` since it's a valid Liquid accessor) and align docs.
   - **QOL: Match the LiquidJS playground UX** — the official [LiquidJS playground](https://liquidjs.com/playground.html#PHVsPgp7JS0gZm9yIHBlcnNvbiBpbiBwZW9wbGUgJX0KICA8bGk+CiAgICA8YSBocmVmPSJ7e3BlcnNvbiB8IHByZXBlbmQ6ICJodHRwczovL2V4YW1wbGUuY29tLyJ9fSI+CiAgICAgIHt7IHBlcnNvbiB8IGNhcGl0YWxpemUgfX0KICAgIDwvYT4KICA8L2xpPgp7JS0gZW5kZm9yJX0KPC91bD4K,ewogICJwZW9wbGUiOiBbCiAgICAiYWxpY2UiLAogICAgImJvYiIsCiAgICAiY2Fyb2wiCiAgXQp9Cg==) is the reference UX for a Liquid editor — template on the left, JSON context in a second pane, rendered output on the right, URL-encodes the whole session for shareable links. Our Templates tab should converge on that layout and ergonomics (panel proportions, live-render debounce, share-via-URL). Also link to the playground from the Templates tab header or the syntax cheatsheet — it's the best external reference for Liquid syntax beyond what we ship. Candidate to graduate into a follow-up pass on Plan 3.
   - **QOL: Surface expected `vars.*` from a template into the rule editor** — when a template references `{{ vars.someName }}`, detect those names (static scan of the Liquid AST or regex) and reflect them back when a rule is being connected to that template. Concretely: (a) the rule-edit modal's Variables panel pre-populates with the template's expected keys (placeholder values, not required), (b) keys the template references but the rule hasn't set are flagged inline ("expected: `adminHost`"), (c) extra keys set on the rule that the template doesn't reference get a dim "unused" tag. Eliminates the "why isn't this rendering" mystery when a rule forgot a var. Candidate to graduate into Phase 2 Plan 3 follow-up or Phase 6 (export/import) where cross-referencing also matters.
