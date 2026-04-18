# Present-JSON — Roadmap

## Phases

1. **Phase 1: Core render loop** — done 2026-04-17
   - MV3 scaffold, content script, service worker, options, popup
   - Engine + matcher (pure) with unit tests
   - One bundled starter template
   - One Playwright E2E smoke test
2. **Phase 1.5: Chrome Web Store publication prep** — pending
   - Real icons at 16/48/128 (replace 1×1 transparent placeholders in `public/`); author SVG source of truth
   - Privacy policy page; host via GitHub Pages at a stable URL
   - Screenshots (1280×800) for options page, rendered view, popup
   - Store listing copy (short + detailed description, single-purpose statement, permission justifications)
   - Drop unused `scripting` permission from `vite.config.ts` manifest
   - Bump version for first public release (0.1.0 → 1.0.0 candidate)
   - Build + zip `dist/` submission artifact
   - One-time: register Chrome Web Store developer account ($5, 2FA); submit for review
3. **Phase 2: Sharing & polish** — pending
   - Export/import templates with scrub-before-share dialog
   - CodeMirror-lite template editor with helper autocomplete
   - "Test URL" live indicator in rule-edit modal
   - Additional bundled starter templates
   - Keyboard shortcut to toggle raw/rendered
   - Glob regex escape hatch: require length > 2 so bare `//` doesn't become match-all (Phase 1 review item #8, followup)
4. **Phase 3: Deferred / nice-to-haves** — pending
   - Form-based template editor
   - Shared template registry
   - Non-JSON content support

## Todos (Phase 2 backlog)

- [ ] Glob regex escape hatch: require length > 2 so bare `//` doesn't become match-all (Phase 1 review #8)
- [ ] Export/import templates with scrub-before-share dialog
- [ ] CodeMirror-lite template editor with helper autocomplete
- [ ] "Test URL" live indicator in rule-edit modal
- [ ] Additional bundled starter templates
- [ ] Keyboard shortcut to toggle raw/rendered
