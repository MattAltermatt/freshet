# Present-JSON — Roadmap

## Phases

1. **Phase 1: Core render loop** — in progress
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

## Todos (current phase)

- [ ] Project scaffold (Task 1)
- [ ] Shared types (Task 2)
- [ ] Glob compiler (Task 3)
- [ ] URL matcher (Task 4)
- [ ] Engine: lookup + escape (Task 5)
- [ ] Engine: value/variable/raw render (Task 6)
- [ ] Engine: conditionals (Task 7)
- [ ] Engine: iteration (Task 8)
- [ ] Engine: date helper (Task 9)
- [ ] Engine: link helper (Task 10)
- [ ] Engine: sanitize (Task 11)
- [ ] Engine: fixture snapshot (Task 12)
- [ ] Storage facade (Task 13)
- [ ] Storage migration (Task 14)
- [ ] Content script (Task 15)
- [ ] Service worker (Task 16)
- [ ] Options: Rules tab (Task 17)
- [ ] Options: Templates tab (Task 18)
- [ ] Popup (Task 19)
- [ ] Starter template bundling (Task 20)
- [ ] Playwright E2E (Task 21)
- [ ] Code review pass (Task 22)
- [ ] Final verification & ship (Task 23)
