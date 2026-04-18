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

   1. **Plan 1 — Foundation**: deps + Vite JSX + `src/ui/` shell (theme tokens, hooks, base components). No user-visible change. — pending
   2. **Plan 2 — Engine swap**: drop hand-rolled engine for Handlebars; migrator for existing templates; rewrite starters. — pending
   3. **Plan 3 — Options page**: split-view rules + URL tester, CodeMirror template editor, rule-edit modal overhaul, autosave + toasts, dark mode. — pending
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
