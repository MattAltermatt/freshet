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

**Extension-conflict detection.** `src/content/conflictDetect.ts` pure core with `<pre>` rescue + 3 named-viewer fingerprints (JSONView, JSON Formatter, JSON Viewer Pro) + generic unknown-viewer fallback. Rule-gated detection — hosts without a Freshet rule stay silent. Popup surfaces a `ConflictSection` with targeted `chrome://extensions/?id=<id>` disable link, Skip-host + Dismiss actions, relative-time label. New badge signal `pj:conflict` paints ⚠ in accent-strong. Four cleanup paths (Dismiss / Skip / render-success / rescue-success). Spec: `docs/superpowers/specs/2026-04-19-conflict-detection-design.md`. Plan: `docs/superpowers/plans/2026-04-19-conflict-detection.md`.

**Template + rule export / import.** Unified `.freshet.json` bundle format, workspace-level picker → scrub → output flow with download + clipboard, import review with per-item collision resolution or "just append all" mode, literal-regex secret-sniff warnings on both sides (never hidden, never redacted), persistent "needs attention" badge on rule + template cards, atomic-batch commit with rollback. Principles section added to README. Spec: `docs/superpowers/specs/2026-04-19-export-import-design.md`. Plan: `docs/superpowers/plans/2026-04-19-export-import.md`.

### P0 — Next up

**Templates UX convergence with LiquidJS playground.** The [official playground](https://liquidjs.com/playground.html) is the canonical reference: template / JSON / rendered panels, shareable URL-encoded sessions. Converge our Templates tab on those proportions + share-via-URL. (Promoted from P1 on 2026-04-19 after conflict-detect shipped.)

### P1 — High value

**Small promo tile (440×280).** Generate once v1.0.0 is live — the only CWS listing asset Google uses on homepage/category/search tiles. Skipping it weakens browse-surface discoverability. Regenerate via the same `scripts/cws-screenshots.mjs` Chromium-composite approach.

### P2 — Polish & nice-to-haves

- **Auto-add-rule path pattern must match the origin URL.** Repro on 2026-04-19: clicked *+ Add rule for this host* from the popup on `https://httpbin.org/json`, accepted defaults. Got `hostPattern: httpbin.org` + `pathPattern: /json/**`. URL tester then reports *"path doesn't match"* for the very URL that spawned the rule — because `/json/**` requires at least one segment after `/json/`, and the bare `/json` has none. Fix: `src/shared/suggestPathPattern.ts` (or equivalent) should generate a pattern that includes the base (e.g. `/json{,/**}` or simply `/json` when the URL ends at a segment boundary), OR make `**` optionally match zero segments in `src/matcher/glob.ts`. Add a regression test against this exact URL.
- **Hide internal rule id in Edit Rule header.** The modal title currently reads `Edit rule · starter-service-health-0` — the `· <id>` suffix leaks an implementation-internal seed id that has no meaning to users. Change the header to use the rule's `name` when set, fall back to `hostPattern`, and drop the id tail entirely (or move it to a small debug-style tooltip).
- **Export/import documentation page** — a sharing-focused docs page (likely under `docs/sharing/` or `docs/try/`) covering: the `.freshet.json` format reference (schema + example), the full list of secret-sniff patterns and what each catches, collision/rename behavior (including keepBoth + cascading renames), the "warn don't block" security model, and what fields are never shared (starter flags, UI prefs). Linked from the README Principles section; optionally a tiny "docs ↗" link next to the Import/Export footer buttons.
- **Expanded test coverage** — visual-regression baselines via Playwright screenshots (`test/e2e/__screenshots__/`, CI-breaking); storage-quota overflow E2E covering the 90 KB sync → local fallback.
- **Form-based template editor** for non-coder users.
- **Shared template registry** (community templates).
- **Non-JSON content support** — HTML / CSV / XML content-type routing.
- **Marquee promo image (1400×560)** — only surfaces if Google picks us for the homepage carousel. Skippable.
- **Official URL via GSC verification** — verification file (`docs/googleb699e27e48b22e41.html`) shipped 2026-04-19; serves at `https://mattaltermatt.github.io/freshet/googleb699e27e48b22e41.html` once the Pages deploy completes. Matt to click **Verify** in Search Console afterwards, then once v1.0.0 goes live set the CWS listing's **Official URL** to `https://mattaltermatt.github.io/freshet/`.
