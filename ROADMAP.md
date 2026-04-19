# Freshet — Roadmap

## Now — Awaiting Chrome Web Store review

v1.0.0 submitted on 2026-04-19. CWS flagged `<all_urls>` for in-depth review; realistic turnaround 1–4 weeks.

- **Don't upload another zip until v1.0.0 is resolved** — a new upload restarts the clock. Stack further work locally for v1.1.0.
- **Don't edit listing fields during review** (description, screenshots, promo tiles, permission justifications). All listing changes wait until the version is live.
- If bounced: read the reviewer note, fix surgically, bump to v1.0.1 in `vite.config.ts` + `package.json`, rebuild + re-zip, resubmit.
- If approved: replace the *"Submission in progress"* line in `README.md` with the live CWS URL and announce.

Artifacts: `freshet-v1.0.0.zip` (gitignored; rebuild with `pnpm build && zip -r freshet-v1.0.0.zip dist`) · `docs/assets/cws-screenshots/*.png` · `docs/superpowers/cws-listing.md`.

---

## Post-launch backlog

### ✅ Shipped (2026-04-19)

**Template + rule export / import.** Unified `.freshet.json` bundle format, workspace-level picker → scrub → output flow with download + clipboard, import review with per-item collision resolution or "just append all" mode, literal-regex secret-sniff warnings on both sides (never hidden, never redacted), persistent "needs attention" badge on rule + template cards, atomic-batch commit with rollback. Principles section added to README. Spec: `docs/superpowers/specs/2026-04-19-export-import-design.md`. Plan: `docs/superpowers/plans/2026-04-19-export-import.md`.

### P0 — Next up

**Extension-conflict detection.** Detect when another JSON viewer (JSONView, JSON Formatter, etc.) already mutated `document.body` before our content script ran. Hook + degraded UI branch already reserved in `src/content/conflictDetect.ts` and `TopStrip`; this phase fills in the detection. Show an in-popup warning; do not try to programmatically take over.

### P1 — High value

**Templates UX convergence with LiquidJS playground.** The [official playground](https://liquidjs.com/playground.html) is the canonical reference: template / JSON / rendered panels, shareable URL-encoded sessions. Converge our Templates tab on those proportions + share-via-URL.

**Small promo tile (440×280).** Generate once v1.0.0 is live — the only CWS listing asset Google uses on homepage/category/search tiles. Skipping it weakens browse-surface discoverability. Regenerate via the same `scripts/cws-screenshots.mjs` Chromium-composite approach.

### P2 — Polish & nice-to-haves

- **Expanded test coverage** — visual-regression baselines via Playwright screenshots (`test/e2e/__screenshots__/`, CI-breaking); storage-quota overflow E2E covering the 90 KB sync → local fallback.
- **Form-based template editor** for non-coder users.
- **Shared template registry** (community templates).
- **Non-JSON content support** — HTML / CSV / XML content-type routing.
- **Marquee promo image (1400×560)** — only surfaces if Google picks us for the homepage carousel. Skippable.
- **Official URL via GSC verification** — verify `mattaltermatt.github.io/freshet/` in Search Console so the CWS listing can show an Official URL (add `google-site-verification` meta via `docs/_config.yml`).
