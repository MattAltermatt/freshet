# Freshet — Roadmap

## Shipped

- **Phase 1** (2026-04-17) — MV3 scaffold, pure engine + matcher cores, rule matching, bundled starter, E2E smoke.
- **Phase 2** (2026-04-18) — UX polish redesign across options + popup + top-strip. Preact 10, LiquidJS engine, CodeMirror 6 template editor, `{>` design system with dark mode from day 1, autosave + toasts, split-view Rules + URL tester, Preact popup with URL-hash directive handoff, shadow-DOM top-strip with `⌘⇧J`. Delivered as 5 sequential plans — see `docs/superpowers/plans/2026-04-18-phase2-plan{1..5}-*.md`.
- **Templates tab layout polish** (2026-04-18) — disclosure collapse/expand per panel (`pj_ui_collapse`), two-column layout with Preview isolated from the left column, draggable Template/Sample split (`pj_ui_split_ratio`), LiquidJS playground deep-links including "Open with current values", Cheatsheet replaced with an external Liquid reference link.
- **Brand audit** (2026-04-18) — rasterized `docs/assets/logo.png` + `og-image.png`, Jekyll `head-custom.html` with favicon + theme-color + Open Graph + Twitter cards, GH banner links in the options Shortcuts footer.
- **Rename to Freshet** (2026-04-18) — renamed the extension from "Present-JSON" to "Freshet" across manifest, UI strings, docs, starter comments, GH Pages site, OG wordmark, and the GitHub repository (`present-json` → `freshet`). Internal `pj-*` CSS classes and `pj_*` storage keys intentionally retained (internal, no user-visible cost).

Pre-publication hardening (regex escape guard, scripting-permission drop, 16/48/128 icons, privacy policy on GH Pages) landed alongside Phase 1/2. Chrome Web Store developer account registered.

---

## Now — Pre-release polish sweep

Editorial + QOL sweep before the Chrome Web Store submission. Aim: "as good as we can make it look." Ordered by impact within each group.

### Remaining polish

- **Code/editorial pass** — variable naming (`--pj-*`, `pj-*`, camelCase, storage keys), class-name consistency, dead code, duplicate tokens, stale comments, unused imports, one pass over every user-facing string for voice/tone.

---

## Next — Real-world example JSONs (Phase 3)

Unblocks the store screenshots *and* gives the pre-release polish sweep a real testbed.

- Host static JSON fixtures at `mattaltermatt.github.io/freshet/examples/...` via Jekyll.
- Bundle 2–3 starter rules + templates against public APIs. Candidates: JSONPlaceholder, HTTPBin, GitHub API, PokéAPI, REST Countries.
- **Bundled starter rules ship disabled by default.** Templates are seeded so the user can preview/edit them, but the matching rules start with `enabled: false` so a fresh install never surprises anyone by rewriting pages they didn't opt into. The Rules tab should visibly signal "enable me to try" on a disabled starter rule.
- First-run empty state gets a "Try it now" affordance that drops the bundled rules in and optionally flips them on.

---

## Deployment — Chrome Web Store submission

Paused 2026-04-17 pending Phase 2 polish. Resume after the pre-release sweep + Phase 3 screenshots are ready.

### Already in place
- Chrome Web Store developer account registered.
- Icons 16 / 48 / 128 rasterized in `public/`.
- Privacy policy hosted at `mattaltermatt.github.io/freshet/privacy/`.
- `<all_urls>` / `storage` / `tabs` permissions are the minimum set; `scripting` already dropped.

### Still to do (in order)

1. **Screenshots (1280×800)** — options page (Rules + Templates, light + dark), popup (matched + unmatched), rendered page with top-strip. Capture after Phase 3 lands so examples look real.
2. **Store listing copy** — short description (132 chars), detailed description, single-purpose statement, permission justifications (`storage` / `tabs` / `<all_urls>`).
3. **Public support contact** — GitHub Issues as the public support URL; personal email used only for the required Google contact field.
4. **Version bump** — `0.1.0` → `1.0.0` candidate in `vite.config.ts` manifest + `package.json`.
5. **Build + zip `dist/`** — submission artifact (`pnpm build` then `zip -r freshet-v1.0.0.zip dist`).
6. **Submit for review** — typical turnaround 1–5 business days; plan buffer for possible back-and-forth on permission justifications.

---

## Post-launch backlog

Ordered by expected impact.

### Extension-conflict handling

Preserves the Phase 2 UX investment post-install.

- Detect when another JSON viewer (JSONView, JSON Formatter, etc.) already mutated `document.body` before our content script ran. Heuristic hook + degraded UI branch already reserved in `src/content/conflictDetect.ts` and `TopStrip` — this phase fills in the detection logic.
- Show a clear in-popup warning with actionable guidance — "disable JSONView on this host" / "uninstall to avoid conflicts".
- Do NOT try to programmatically take over the page — arms-race we lose.

### Expanded test coverage (ongoing)

- Visual-regression baselines via Playwright screenshots in `test/e2e/__screenshots__/`; failures break CI.
- Storage-quota overflow (90 KB sync → local migration) E2E covering the real fallback.

### Templates — UX convergence

- **Match the LiquidJS playground UX** — the [official playground](https://liquidjs.com/playground.html) is the canonical reference: template / JSON / rendered output panels, shareable URL-encoded sessions. Converge our Templates tab on those proportions + the share-via-URL idea. Link the playground from the syntax cheatsheet header.

### Template export / import

- Export / import templates (with their per-template sample JSON) as a single bundle. Include a scrub-before-share dialog with an explicit leakage warning — sample JSON often holds real response payloads (tokens, emails, internal IDs). Let users preview and redact before download. Useful once multiple installs or team-sharing starts.

### Nice-to-haves

- Form-based template editor (for non-coder users).
- Shared template registry (community templates).
- Non-JSON content support (HTML / CSV / XML content-type routing).
