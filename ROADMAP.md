# Freshet — Roadmap

## Now — Chrome Web Store submission

Phases 1–3 shipped (MV3 scaffold + pure cores, UX polish across options/popup/top-strip, real-world starter examples + `/try/` marketing page). The extension is feature-complete for v1.

Submission punch list, in order:

1. **Screenshots (1280×800)** — options page (Rules + Templates, light + dark), popup (matched + unmatched), rendered page with top-strip. Capture against real bundled starters so they match the live experience.
2. **Store listing copy** — short description (≤132 chars), detailed description, single-purpose statement, permission justifications for `<all_urls>`, `storage`, `tabs`.
3. **Public support contact** — GitHub Issues as the public support URL.
4. **Version bump** — `0.1.0` → `1.0.0` in `vite.config.ts` manifest + `package.json`.
5. **Build + zip `dist/`** — `pnpm build && zip -r freshet-v1.0.0.zip dist`.
6. **Submit for review** — typical turnaround 1–5 business days.

Pre-publication hardening already in place: minimal-permission set (`scripting` already dropped), regex escape guard on the matcher, 16/48/128 icons in `public/`, privacy policy at `mattaltermatt.github.io/freshet/privacy/`, Web Store developer account registered.

---

## Post-launch backlog

Ordered by expected impact.

### Extension-conflict handling

Detect when another JSON viewer (JSONView, JSON Formatter, etc.) already mutated `document.body` before our content script ran. Hook + degraded UI branch already reserved in `src/content/conflictDetect.ts` and `TopStrip` — this phase fills in the detection logic. Show a clear in-popup warning ("disable JSONView on this host"). Do **not** try to programmatically take over the page.

### Expanded test coverage

- Visual-regression baselines via Playwright screenshots in `test/e2e/__screenshots__/`; failures break CI.
- Storage-quota overflow E2E (90 KB sync → local migration) covering the real fallback.

### Templates UX convergence with LiquidJS playground

The [official playground](https://liquidjs.com/playground.html) is the canonical reference: template / JSON / rendered output panels, shareable URL-encoded sessions. Converge our Templates tab on those proportions + the share-via-URL idea.

### Template export / import

Export / import templates (with their per-template sample JSON) as a single bundle. Include a scrub-before-share dialog with an explicit leakage warning — sample JSON often holds real response payloads (tokens, emails, internal IDs). Useful once multiple installs or team-sharing starts.

### Nice-to-haves

- Form-based template editor (for non-coder users).
- Shared template registry (community templates).
- Non-JSON content support (HTML / CSV / XML content-type routing).
