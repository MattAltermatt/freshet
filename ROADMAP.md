# Freshet — Roadmap

## Shipped

- **Phase 1** (2026-04-17) — MV3 scaffold, pure engine + matcher cores, rule matching, bundled starter, E2E smoke.
- **Phase 2** (2026-04-18) — UX polish redesign across options + popup + top-strip. Preact 10, LiquidJS engine, CodeMirror 6 template editor, `{>` design system with dark mode from day 1, autosave + toasts, split-view Rules + URL tester, Preact popup with URL-hash directive handoff, shadow-DOM top-strip with `⌘⇧J`. Delivered as 5 sequential plans — see `docs/superpowers/plans/2026-04-18-phase2-plan{1..5}-*.md`.
- **Templates tab layout polish** (2026-04-18) — disclosure collapse/expand per panel (`pj_ui_collapse`), two-column layout with Preview isolated from the left column, draggable Template/Sample split (`pj_ui_split_ratio`), LiquidJS playground deep-links including "Open with current values", Cheatsheet replaced with an external Liquid reference link.
- **Brand audit** (2026-04-18) — rasterized `docs/assets/logo.png` + `og-image.png`, Jekyll `head-custom.html` with favicon + theme-color + Open Graph + Twitter cards, GH banner links in the options Shortcuts footer.
- **Rename to Freshet** (2026-04-18) — renamed the extension from "Present-JSON" to "Freshet" across manifest, UI strings, docs, starter comments, GH Pages site, OG wordmark, and the GitHub repository (`present-json` → `freshet`). Internal `pj-*` CSS classes and `pj_*` storage keys intentionally retained (internal, no user-visible cost).
- **Editorial pass** (2026-04-18) — tightened toast copy (skip-host toast, deduplicated `· Undo` / `✓` now that the action button + green border carry the signal); added semantic CSS tokens `--pj-accent-overlay` (translucent orange hover) + `--pj-danger-text` (WCAG-AA-on-light red text), used in both `theme.css` and `topStrip.css`; styled `ToastHost` (fixed top-right under the header, variants per type, slide-in animation) so save/undo confirmations no longer rendered as bare text near the macOS dock.

Pre-publication hardening (regex escape guard, scripting-permission drop, 16/48/128 icons, privacy policy on GH Pages) landed alongside Phase 1/2. Chrome Web Store developer account registered.

---

## Now — Phase 3 (Real-world example JSONs) — wrapping up

Spec: `docs/superpowers/specs/2026-04-18-phase3-real-world-examples-design.md`. Branch: `feature/phase3-real-world-examples`.

**Shipped on the branch:**
- ✅ `Rule.isExample` + `Rule.exampleUrl` schema; clickable `Example ↗` pill on rule cards (commit `b2a52b3`, refined in `ce5a8d5`).
- ✅ Self-hosted demo JSONs at `docs/examples/services/payments.json` + `docs/examples/incidents/INC-2026-001.json`, cross-linked by ID (commits `384257b` + `c910c57`).
- ✅ `service-health` + `incident-detail` Liquid templates — SRE-style cards with status pills, kind-coded timeline rail, env chip from `vars.env`, light + dark variants (commits `773ebf4`, `c910c57`, `04e03c4`).
- ✅ Engine: array-root JSON exposed as `items` so REST Countries-style top-level arrays have a stable handle (commit `4653e69`).
- ✅ `pokemon` + `country` real-API templates with light + dark + per-type colors / language colors / flag emojis / native names (commit `93806ab`).
- ✅ `github-repo` template refresh — language chip with colored dot, pulse on Active, URL-from-id Issues/PRs/Releases footer, light + dark (commit `f04edd5`).
- ✅ Content-script + PreviewIframe write `data-theme` so demo templates honor the user's Freshet theme on real pages AND in the editor preview (commit `04e03c4`).
- ✅ URL-from-ID convention: starter JSONs carry only IDs / slugs / handles; templates build canonical URLs in-template (commit `c910c57`).
- ✅ First-run popup banner — dismiss-once via `pj_first_run_dismissed`, auto-hides once user creates their own rule, opens docs `/try/` page (commit `5d19ec7`).
- ✅ Docs `/try/` marketing page at `docs/try/index.md` — 5 demo blocks with raw JSON + try-live links + how-to-activate for inactive starters (commit `4e29b54`).

**Remaining before FF-merge:**
- README + ROADMAP + CLAUDE.md updates (this commit).
- Code-review pass (fresh reviewer agent).
- Capture 5 screenshots @ 1280×800 to `docs/assets/try/*.png` and replace the placeholders on `/try/` — deferred from 3.6 to keep momentum, tracked as a follow-up. Screenshots double as Web Store listing assets.
- Final manual approval gate (Matt eyeball reload + click-through), then FF-merge.

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
