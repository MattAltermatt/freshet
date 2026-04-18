# Present-JSON — Roadmap

## Phases

1. **Phase 1: Core render loop** — done 2026-04-17
   - MV3 scaffold, content script, service worker, options, popup
   - Engine + matcher (pure) with unit tests
   - One bundled starter template
   - One Playwright E2E smoke test

2. **Phase 1.5: Chrome Web Store publication** — in progress

   *De-risk (do first, in parallel with local prep):*
   - Register Chrome Web Store developer account ($5, 2FA + ID verification — can take days)

   *Pre-publication hardening:*
   - Fix `//` regex escape hatch: require length > 2 so a bare `//` doesn't compile to match-all (Phase 1 review #8)
   - Drop unused `scripting` permission from `vite.config.ts` manifest

   *Store assets:*
   - Real icons at 16/48/128 (replace 1×1 transparent placeholders in `public/`); SVG source of truth committed
   - Screenshots (1280×800) for options page, rendered view, popup
   - Privacy policy page hosted at a stable URL via GitHub Pages

   *Listing + submission:*
   - Store listing copy: short description, detailed description, single-purpose statement, permission justifications
   - Public support contact: GitHub Issues as primary (support *website* → repo issues URL); personal email used only for the required Google contact field
   - Bump version for first public release (0.1.0 → 1.0.0 candidate)
   - Build + zip `dist/` submission artifact
   - Submit for review

3. **Phase 2: Sharing & polish** — pending
   - Export/import templates with scrub-before-share dialog
   - CodeMirror-lite template editor with helper autocomplete
   - "Test URL" live indicator in rule-edit modal
   - Additional bundled starter templates
   - Keyboard shortcut to toggle raw/rendered

4. **Phase 3: Deferred / nice-to-haves** — pending
   - Form-based template editor
   - Shared template registry
   - Non-JSON content support
