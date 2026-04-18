# Present-JSON — Roadmap

## Phases

1. **Phase 1: Core render loop** — done 2026-04-17
   - MV3 scaffold, content script, service worker, options, popup
   - Engine + matcher (pure) with unit tests
   - One bundled starter template
   - One Playwright E2E smoke test
2. **Phase 2: Sharing & polish** — pending
   - Export/import templates with scrub-before-share dialog
   - CodeMirror-lite template editor with helper autocomplete
   - "Test URL" live indicator in rule-edit modal
   - Additional bundled starter templates
   - Keyboard shortcut to toggle raw/rendered
   - Glob regex escape hatch: require length > 2 so bare `//` doesn't become match-all (Phase 1 review item #8, followup)
3. **Phase 3: Deferred / nice-to-haves** — pending
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
