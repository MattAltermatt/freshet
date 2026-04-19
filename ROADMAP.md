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

**P2 quick wins.** Trailing `/**` in path patterns now matches the bare base path too — `/json/**` correctly matches `/json`, so the popup's *+ Add rule* suggestion for `https://httpbin.org/json` produces a rule that matches the URL that spawned it. Fix in `src/matcher/glob.ts`. Edit Rule modal header dropped the internal `· <id>` suffix; now shows `Edit rule · <name-or-host>`.

**Sharing reference docs.** `docs/sharing/index.md` (rendered at `mattaltermatt.github.io/freshet/sharing/`) covers the `.freshet.json` bundle format with a full example, the four secret-sniff patterns (key + value regexes), collision resolution (skip/overwrite/keepBoth + cascading renames for templates, id/name/pattern-overlap for rules), the "imported rules land inactive" posture, atomic-batch commit, the warn-don't-block security model, and the exhaustive list of storage keys + fields that are never shared (hostSkipList, settings, UI prefs, starter flags, conflict state). Linked from README Principles. Inline `Sharing docs ↗` link added to the first step of both Export and Import dialog footers.

**Storage-promotion E2E.** `test/e2e/storage-promotion.spec.ts` covers the sync→local promotion path on options boot — seed `chrome.storage.sync` with legacy data, open options, assert `promoteStorageToLocal` stamps the sentinel + surfaces the data in `.local` + renders on the rule card. Second test pins the no-op guard so sync-side clobber data can't leak into an already-promoted local area. Code comment on `SYNC_SOFT_LIMIT` documents Chrome's 8 KB per-item sync cap and why the strict 90 KB branch can't be exercised without bypassing Chrome's API.

**GSC verification.** `docs/googleb699e27e48b22e41.html` shipped and serves at `https://mattaltermatt.github.io/freshet/googleb699e27e48b22e41.html`; Matt verified the domain in Search Console on 2026-04-19. File stays in-repo indefinitely — GSC re-checks periodically and removing the file un-verifies. Post-launch: once v1.0.0 goes live on CWS, set the listing's **Official URL** field to `https://mattaltermatt.github.io/freshet/`.

**Sharing-docs layout fix.** `docs/sharing/index.md` inherited the jekyll-theme-minimal's 500px-floated content + fixed sidebar layout, which visibly overlapped the main content at narrow viewports. Applied the same `<style>` override pattern used at the top of `docs/try/index.md` — unfloat the wrapper, hide the decorative sidebar/footer, cap body at 960px for readability.

**Visual-regression baselines.** `test/e2e/visual-regression.spec.ts` captures pixel snapshots of two high-churn surfaces (Options page rules-tab and popup empty-state, both light-mode) rendered over deterministic seeded storage. Baselines committed at `test/e2e/visual-regression.spec.ts-snapshots/*-darwin.png`; regenerate intentionally with `pnpm test:e2e -- visual-regression --update-snapshots`. Tolerance set at 2% pixel-ratio in `playwright.config.ts` via `toHaveScreenshot` defaults. Scope is narrow on purpose — dark-mode + top-strip snapshots can follow once these prove stable.

### P1 — High value

**Small promo tile (440×280).** Generate once v1.0.0 is live — the only CWS listing asset Google uses on homepage/category/search tiles. Skipping it weakens browse-surface discoverability. Regenerate via the same `scripts/cws-screenshots.mjs` Chromium-composite approach.

### P2 — Polish & nice-to-haves

- **Non-JSON content support** — HTML / CSV / XML content-type routing.
- **Marquee promo image (1400×560)** — only surfaces if Google picks us for the homepage carousel. Skippable.

### P3 — Later, blocked on adoption signal

- **Shared template registry** (community templates). Revisit once Freshet has a user base large enough to produce non-trivial templates worth collecting; premature now.
