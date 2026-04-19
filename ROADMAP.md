# Freshet — Roadmap

## Now — Awaiting Chrome Web Store review

Freshet **v1.0.0 was submitted to the Chrome Web Store on 2026-04-19** (commit `738b383` on `main`; artifact `freshet-v1.0.0.zip`, 196 KB; 5 listing screenshots at `docs/assets/cws-screenshots/`). CWS flagged the `<all_urls>` host permission for in-depth review; realistic turnaround is 1–4 weeks.

While we wait:

- **Don't upload another zip until v1.0.0 is resolved** — a new upload replaces the in-review version and restarts the clock. Any further improvements stack locally for v1.1.0.
- The "Item review completed" CWS notification is enabled, so `altermatt@gmail.com` gets the outcome email.
- If bounced: read the reviewer note, address surgically, re-upload as v1.0.1 (bump via `vite.config.ts` + `package.json`, rebuild, re-zip).
- If approved: replace the *"Submission in progress"* line in `README.md` with the live Chrome Web Store URL and announce.

Submission artifacts of record:

- `freshet-v1.0.0.zip` — uploaded to CWS (gitignored; regenerate with `pnpm build && zip -r freshet-v1.0.0.zip dist`)
- `docs/assets/cws-screenshots/*.png` — 5 shots, regenerate with `node scripts/cws-screenshots.mjs`
- `docs/superpowers/cws-listing.md` — store listing copy of record (description, permission justifications, privacy disclosures)

---

## Post-launch backlog

Ordered by expected impact. Fair game to work on during review (so long as no new CWS upload happens).

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
- Small promo tile (440×280) for the CWS carousel + marquee promo (1400×560) for featured placements.
- Google Search Console verification of `mattaltermatt.github.io/freshet/` so the CWS listing can list an Official URL (currently left blank).
