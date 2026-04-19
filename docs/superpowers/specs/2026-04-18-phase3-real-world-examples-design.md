# Phase 3 — Real-world example JSONs (Freshet)

## Context

Freshet is pre-Chrome-Web-Store. Phase 1 + 2 are shipped (manifest, engine, matcher, options/popup/top-strip rewrites, brand). The store submission is paused until we have **screenshot-worthy demo content** and a believable first-run "this works on real sites" story.

Today's seed (`background.ts → seedStartersIfEmpty`) drops two **templates** (`internal-user`, `github-repo`) and **zero rules**. The `internal-user` template is anemic (4 JSON fields, tutorial-grade) — fine for teaching Liquid, weak for marketing.

Phase 3 closes that gap by:
1. Bundling **2 self-hosted JSON demo pages** under `mattaltermatt.github.io/freshet/examples/...` — content we craft for visual impact + chain via Liquid `link`.
2. Bundling **3 disabled-by-default starter rules** for popular public APIs — establishes "this works in the wild" without surprising users.
3. Adding a **first-run "Try it now" affordance** so the install moment is "click → see something cool" not "stare at empty Rules tab."
4. Replacing the anemic `internal-user` starter — its slot becomes one of the new business-like demos.
5. Adding a **docs `/try/` marketing page** with side-by-side before/after for each demo. Linked from popup banner, README, and Web Store listing.

Headline screenshot story: **raw JSON clutter on the left, clean actionable page on the right** of the same URL.

## Decisions (✅ all approved)

- **Hybrid approach:** self-hosted demos for the headline + 3 real APIs for credibility.
- **Self-hosted demo domain:** Service Health / Incident Response. Two linked pages: `services/{name}.json` (current status, recent incidents) ⇄ `incidents/{id}.json` (timeline, severity, on-call).
- **Real-API starter rules (disabled by default):** PokéAPI, REST Countries, GitHub.
- **Replace** the anemic `internal-user` starter — its slot becomes `service-health`. Keep `github-repo` as-is (already polished).
- **First-run UX:** popup banner (dismiss-once) + Jekyll docs `/try/` page. No options-page banner.
- **Disabled-rule signaling:** persistent neutral grey "Starter" pill on the rule card (stays even after user enables — provenance info).
- **Docs `/try/` page:** side-by-side embeds — raw JSON on the left, screenshot of Freshet output on the right, "Try it live →" link below each.

## Architecture

### Bundled content (final)

| Template | Sample JSON (per-template, in editor) | Rule URL pattern | Default |
|---|---|---|---|
| `service-health` | crafted (payments service) | `mattaltermatt.github.io` / `/freshet/examples/services/*` | **Enabled** (own domain — no surprise) |
| `incident-detail` | crafted (INC-2026-001) | `mattaltermatt.github.io` / `/freshet/examples/incidents/*` | **Enabled** (own domain) |
| `github-repo` | (existing, keep) | `api.github.com` / `/repos/*/*` | **Disabled** |
| `pokemon` | bundled `pikachu.json` | `pokeapi.co` / `/api/v2/pokemon/*` | **Disabled** |
| `country` | bundled `japan.json` | `restcountries.com` / `/v3.1/name/*` | **Disabled** |

### Demo content shape

**`docs/examples/services/payments.json`** — fields: `name`, `slug`, `status` (`operational | degraded | down`), `uptime30d`, `lastIncident`, `oncall` (name + handle), `dependencies` (list), `recentIncidents` (list of `{id, title, severity, openedAt, resolvedAt|null, url}` where `url` points at `/freshet/examples/incidents/{id}.json`).

**`docs/examples/incidents/INC-2026-001.json`** — fields: `id`, `title`, `severity`, `status` (`investigating | identified | monitoring | resolved`), `openedAt`, `resolvedAt`, `service` (back-link `{name, slug, url}` pointing at the service JSON), `oncall`, `timeline` (array of `{at, author, message}` events), `relatedIncidents` (array linking back to other incident JSONs — even if we only ship one).

These chain via the `link` filter so clicking from one rendered page navigates to the other rendered page.

### Schema change: `Rule.isStarter`

Add optional field to the `Rule` type (`src/shared/types.ts`):

```ts
interface Rule {
  // …existing fields…
  /** True if this rule was bundled by the install seed; informational only. */
  isStarter?: boolean;
}
```

Optional → no storage migration needed. `RuleCard` renders a "Starter" pill when truthy. Persists across enable/disable.

### Seeder change

`src/background/background.ts → seedStartersIfEmpty` extends to also seed rules. The "fresh install" check today is `Object.keys(templates).length > 0` — keep this. On first run:

1. Seed all 5 templates (existing 2 templates change: drop `internal-user`, add `service-health` + `incident-detail` + `pokemon` + `country`).
2. Seed all 5 rules with the URL patterns above. `service-health` + `incident-detail` rules `enabled: true`; the other 3 `enabled: false`. All 5 carry `isStarter: true`.
3. Seed per-template sample JSON for the 3 real-API templates so the editor preview works without an external fetch.

### First-run popup banner

- New component: `src/popup/FirstRunBanner.tsx`. Renders a single dismissable card: brand glyph + 2 lines of copy ("Welcome to Freshet — try it on a sample page.") + a primary "Try the demos →" link that opens `https://mattaltermatt.github.io/freshet/try/` in a new tab + a small `×` dismiss.
- Storage key: `pj_first_run_dismissed: boolean` in `chrome.storage.local`. Default `false`. Set to `true` on dismiss or on the first time the user clicks the link. Once `true`, the banner never renders again.
- Visibility gate: render only when `pj_first_run_dismissed` is falsy AND there are no non-starter rules (so it doesn't keep nagging power users who hand-built a config).
- Placement: at the top of the popup, above the URL/match section.

### Docs `/try/` page

- `docs/try/index.md` — Jekyll page. Single hero ("See what Freshet does") + 5 demo blocks.
- Each demo block: 2-column layout (mobile-stacks). **Left:** `<pre>` of pretty-printed raw JSON (truncated to ~25 lines for the API ones with a "see full response" expandable). **Right:** static `<img>` screenshot of the Freshet-rendered output. **Below:** "Try it live →" link.
  - For self-hosted demos (Service Health, Incident): the link opens the JSON URL directly — Freshet renders it on landing.
  - For real-API demos (GitHub, Pokémon, Countries): the link expands a "How to enable" instruction with 3 numbered steps + a sample URL the user clicks last.
- Screenshots: capture from a real Freshet render against each fixture, save to `docs/assets/try/{template-name}.png`. Resolution 1280×800 (Web Store screenshot dimension — reuse for store listing).
- Linked from: README "Demo" section (also new), popup banner, future Web Store listing copy.

### Files to create

**Self-hosted demo JSONs (Jekyll):**
- `docs/examples/services/payments.json`
- `docs/examples/incidents/INC-2026-001.json`

**Docs marketing page:**
- `docs/try/index.md`
- `docs/assets/try/service-health.png`
- `docs/assets/try/incident-detail.png`
- `docs/assets/try/github-repo.png`
- `docs/assets/try/pokemon.png`
- `docs/assets/try/country.png`

**Starter templates + samples (replace internal-user, add 3):**
- `src/starter/service-health.html` + `.sample.json` + `.test.ts`
- `src/starter/incident-detail.html` + `.sample.json` + `.test.ts`
- `src/starter/pokemon.html` + `.sample.json` + `.test.ts`
- `src/starter/country.html` + `.sample.json` + `.test.ts`

**Popup banner:**
- `src/popup/FirstRunBanner.tsx` + `.test.tsx`

### Files to modify

- `src/background/background.ts` — extend `seedStartersIfEmpty` to seed rules with `isStarter: true` and the new template set; remove `internal-user` references.
- `src/shared/types.ts` — add optional `isStarter?: boolean` to `Rule`.
- `src/options/rules/RuleCard.tsx` — render "Starter" pill when `rule.isStarter`.
- `src/options/options.css` — `.pj-starter-pill` style (neutral grey, sits next to template pill).
- `src/popup/App.tsx` — render `<FirstRunBanner />` above existing sections, gated on storage flag + non-starter rule count.
- `src/popup/popup.css` — banner styles.
- `README.md` — new "Demo" section linking to `/try/`; refresh feature list if the starter set is referenced.
- `ROADMAP.md` — mark Phase 3 shipped on completion.
- `CLAUDE.md` — document new starter set, `isStarter` field, `pj_first_run_dismissed` storage key.
- (Delete) `src/starter/internal-user.html`, `.sample.json`, `.test.ts`.

### Storage keys (new)

| Key | Type | Purpose |
|---|---|---|
| `pj_first_run_dismissed` | `boolean` | Suppresses the popup first-run banner once dismissed or once the user clicks through. |

## Build sequence (rough phases for the implementation plan)

1. **Schema + seeder** (smallest unit): `Rule.isStarter`, `RuleCard` pill, extend seeder with the new template + rule list. Existing templates (`internal-user`) get deleted last to avoid orphaning storage on hot-reload.
2. **Self-hosted demo JSONs**: write `payments.json` + `INC-2026-001.json` (no code changes — pure content).
3. **`service-health` + `incident-detail` templates**: design Liquid + CSS to make these screenshot-worthy. Iterate against the bundled fixtures using the Templates tab.
4. **Real-API templates**: `pokemon` + `country` + (existing) `github-repo`. Design against bundled per-template sample JSON; verify against live API once with at least one URL each.
5. **First-run popup banner**: storage flag, component, gating.
6. **Docs `/try/` page**: Jekyll markdown + 5 demo blocks. Capture screenshots from actual renders.
7. **README + ROADMAP + CLAUDE.md** update.
8. **Code review pass** (per Matt's workflow rule — fresh reviewer agent, no implementation bias).
9. **Verification + manual approval gate** before FF-merge.

## Verification (end-to-end)

1. Fresh install (uninstall → reinstall): Templates tab shows 5 starter templates; Rules tab shows 5 starter rules each with a "Starter" pill, Service Health + Incident Detail enabled, the other 3 disabled and greyed.
2. Open the popup → first-run banner visible. Click "Try the demos →" → docs `/try/` page opens in a new tab; banner disappears on subsequent popup opens. Storage shows `pj_first_run_dismissed: true`.
3. From `/try/`, click the Service Health "Try it live →" link → `services/payments.json` opens → Freshet renders it as a styled service-health card → click an incident link in the rendered card → `incidents/INC-2026-001.json` opens and renders too.
4. Visit `https://api.github.com/repos/facebook/react` → page renders raw JSON (rule is disabled). In Rules tab, toggle the github-repo rule on → reload → renders as github-repo card. Toggle off → reload → raw JSON again.
5. Same flow for `https://pokeapi.co/api/v2/pokemon/pikachu` and `https://restcountries.com/v3.1/name/japan`.
6. Create a hand-rolled rule (no `isStarter`). Open the popup → first-run banner does NOT show (gate already trips on non-starter rule count, and dismissed flag is sticky anyway).
7. `pnpm test` (per-starter sanitize/render fixture tests + FirstRunBanner unit test pass; current 242 → ~250+).
8. `pnpm typecheck`, `pnpm lint`, `pnpm build` clean.
9. `pnpm test:e2e` — at least one Playwright spec covering: fresh-install seeding produces 5 rules with correct enabled state and `isStarter` flag; toggling a disabled starter on/off persists.
10. Manual eyeball pass with reload (per `feedback_rebuild_before_claiming_live.md`): rebuild after each commit, reload extension, verify the change is actually loaded before declaring done.

## Critical files for the implementer to read first

- `src/background/background.ts` (lines 8–40) — current seed shape
- `src/starter/github-repo.html` + `.sample.json` — quality bar for the new templates
- `src/options/rules/RuleCard.tsx` — where the Starter pill plugs in
- `src/popup/App.tsx` — where the FirstRunBanner mounts
- `docs/_config.yml` — Jekyll baseurl is `/freshet`, so all internal links use `{{ site.baseurl }}/...`
- `CLAUDE.md` "Storage keys" table — pattern to follow for the new `pj_first_run_dismissed` row
