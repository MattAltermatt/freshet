# Top-strip actions: rule link, Copy JSON, flattened menu

**Date:** 2026-04-20
**Issues:** [#3](https://github.com/MattAltermatt/freshet/issues/3), [#4](https://github.com/MattAltermatt/freshet/issues/4)
**Scope:** UI/UX change to the rendered-page top strip. No schema changes, no migration.

## Problem

Today's top strip has all secondary actions buried in a `⋯` overflow menu:

- Copy URL
- Edit rule
- Theme (Auto / Light / Dark)
- Skip this host

Two user asks:

- **#3** Add a "Copy raw JSON" action on the strip. Users who land on a Freshet-rendered page and want the unrendered JSON have no one-click way to get it.
- **#4** Surface the actions currently hidden behind `⋯`. The overflow is invisible until clicked and makes discovery poor.

There's also a missing identity cue: the strip shows only the *template* name, not the *rule* name. Users running multiple rules on the same host can't tell which rule matched without opening Options.

## Goals

1. Surface every useful action on the strip; remove the `⋯` menu.
2. Add Copy JSON as a first-class action.
3. Add a visible, clickable "which rule matched" link that deep-links to the rule editor.
4. Preserve today's styling language, dark-theme parity, shadow-DOM isolation, and narrow-viewport behavior.
5. Keep all existing keyboard shortcuts (`⌘⇧J` for raw toggle) working.

## Non-goals

- Issue #1 (badge-on-direct-nav) — separate investigation.
- Renaming `Rule.name` UX or adding it to the edit flow — already exists.
- Adding "why this rule matched" debug UI — YAGNI; can be a follow-up if users ask.
- Copy rendered HTML, popout-to-tab, or re-render actions — YAGNI.

## Design

### Final layout

```
{>  [env]  <rule-link> ↗  ·  <template-link> ↗      [Rendered | Raw ⌘⇧J]  [⧉ Copy URL]  [{} Copy JSON]  [◐ Auto ▾]
└──────────── left cluster (identity) ──────────┘  └────────── right cluster (actions, margin-left: auto) ──────────┘
```

### Left cluster — identity

Rendered left-to-right with 12 px gap between items:

1. **Logo** `{>` — unchanged mono-font brand mark.
2. **Env chip** — unchanged, conditional on `rule.variables.env`.
3. **Rule link** *(new)* — button styled like the existing template link. Display text:
   ```ts
   rule.name || rule.hostPattern || '(unnamed rule)'
   ```
   This is the same fallback `src/options/rules/RuleIdentity.tsx` uses for rule cards. Click → sends `pj:open-options` to the background worker with `directiveHash.editRule(rule.id)`, which opens the Options page with the Edit-rule modal pre-filled.
4. **Separator** — middle-dot `·` in muted foreground color.
5. **Template link** — unchanged text (`rule.templateName`). Click → `directiveHash.editTemplate(rule.templateName)`. CSS changes from #2's fix (`flex: 0 1 auto`) remain; this is purely a positional neighbor adjustment.

Both link buttons carry a trailing `↗` arrow and ellipsis-truncate their text when the strip narrows (`min-width: 0; overflow: hidden; text-overflow: ellipsis`).

### Right cluster — actions

Wrapped in a flex sub-container with `margin-left: auto` so the cluster pins to the right edge regardless of left-cluster width. Items inside the cluster use 6 px gap.

1. **Rendered / Raw toggle** — unchanged segmented button; `⌘⇧J` continues to toggle.
2. **Copy URL** — outlined button, icon `⧉` + label "Copy URL". Reuses the current `copyUrl()` handler: writes `window.location.href` to the clipboard and fires the existing transient toast.
3. **Copy JSON** *(new)* — outlined button, icon `{}` + label "Copy JSON". Writes `rawJsonText` verbatim to the clipboard (not pretty-printed — Raw mode already shows the pretty version, and users wanting the original bytes should get the original). Fires a transient toast using the same `useToast`-style helper the Copy URL path uses.
4. **Theme dropdown** — outlined button restyled to mirror the Options-page Header theme control: current-state icon (`◐` Auto / `☀` Light / `☾` Dark), current-state label, and a chevron. Click opens the existing `Menu` with the three theme items (no code change to the items themselves); state writes continue to go through `useStorage<'settings', …>`.

Label wording: **"Copy JSON"** rather than "Copy raw" — "raw" is ambiguous (raw HTML? raw bytes?). "JSON" is unambiguous and pairs naturally with the existing Rendered/Raw toggle.

### Removed

- **`⋯` overflow menu and `pj-menu-trigger-btn`** — no longer needed.
- **Skip this host** — removed from the strip. The popup already offers this via `hostSkipList`, and keeping it strip-surfaced was a discoverability hack that's now moot.

### Narrow-viewport behavior

When the strip can't fit everything on one row:

- `.pj-topstrip` gets `flex-wrap: wrap`.
- Left-cluster links truncate with ellipsis before the strip wraps. Because rule-link text (`rule.name` or `hostPattern`) is typically longer than template-name, it shrinks first by the order of `flex-shrink` weights.
- Once both links are fully truncated, the strip wraps to a second row rather than hide any right-cluster action.

This preserves the ship-only constraint in the feedback memory *"UI should be open and readable — add labels/icons proactively"* — nothing ever hides into tooltips.

### Theming

Everything continues to live inside the shadow root. The new button styles redeclare the same `--pj-*` tokens already mirrored in `src/content/topStrip.css` (source of truth: `src/ui/theme.css`). No new tokens required.

Dark theme: the right-cluster buttons use `--pj-bg-elevated` backgrounds and `--pj-border` borders, same as today's `pj-menu-trigger-btn`; the theme-dropdown menu inherits from the existing `Menu` component.

## Components touched

| File | Change |
|---|---|
| `src/content/TopStrip.tsx` | Add rule-link button; add Copy JSON button; replace `⋯ + menuItems` with inline Copy URL + Copy JSON + Theme dropdown; drop Skip-host + env/theme menu-item builders |
| `src/content/topStrip.css` | Add styles for rule-link, button group (`.pj-btn`), theme dropdown wrapper; remove `.pj-menu-trigger-btn`-specific rules that are no longer referenced; add `flex-wrap: wrap` fallback |
| `src/content/TopStrip.test.tsx` | Update assertions: rule-link text fallback (name vs hostPattern), rule-link click dispatches `pj:open-options` with `editRule` hash, Copy URL still works, Copy JSON copies raw text, theme button renders current-state label, shadow-root outside-click still behaves for theme menu |
| `src/ui/components/Menu.tsx` | **No change.** Theme dropdown reuses it as-is. |
| `src/content/mountTopStrip.tsx` | **No change.** |
| `src/background/background.ts` | **No change.** `pj:open-options` routing already handles `editRule` hash. |
| `src/shared/types.ts` | **No change.** `Rule.name` already optional. |

## Data flow

Unchanged from today's strip — the design is purely additive/reorganizing on the presentation layer. Brief recap of the paths:

- Rule-link click → `chrome.runtime.sendMessage({ kind: 'pj:open-options', hash: '#edit-rule=<id>' })` → background SW calls `chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') + hash })` → `src/options/directives.ts` parses the hash in `App.tsx`.
- Copy JSON click → `navigator.clipboard.writeText(rawJsonText)` → local `setToast(...)` + 1.6 s timeout.
- Theme item click → `writeSettings({ themePreference: pref })` via `useStorage`; `useTheme` re-applies `data-theme` on the shadow host.

## Testing

### Unit (`src/content/TopStrip.test.tsx`)

New / updated specs:

- **Rule link renders name when present** — rule with `name: 'Prod incidents'` renders "Prod incidents" text + `↗` arrow.
- **Rule link falls back to hostPattern** — rule with `name: undefined` and `hostPattern: 'api.github.com'` renders "api.github.com".
- **Rule link falls back to placeholder** — rule with no name and empty hostPattern renders "(unnamed rule)".
- **Rule link click dispatches editRule directive** — click fires `chrome.runtime.sendMessage` with `kind: 'pj:open-options'` and `hash` matching `directiveHash.editRule(rule.id)`.
- **Copy JSON writes raw text** — click calls `navigator.clipboard.writeText(rawJsonText)` with the exact string passed in (not pretty-printed).
- **Theme button shows current state** — with `settings.themePreference = 'dark'`, button label reads "Dark" and the leading icon is the moon glyph.
- **Theme button opens menu with three items** — click surfaces a `Menu` containing Auto / Light / Dark.
- **No `⋯` trigger rendered** — `queryByTestId('pj-menu-trigger')` returns `null`.

### E2E (Playwright)

Existing specs that touch the strip and need updates:

- **`test/e2e/topstrip.spec.ts`** — currently asserts `pj-menu-trigger` exists, clicks the trigger to open the menu, and iterates `.pj-menu-item` nodes. Rewrite to: assert rule-link + template-link + Copy URL + Copy JSON + theme-dropdown buttons render; click the theme dropdown to assert the 3-item menu appears; click Copy JSON and verify clipboard content.
- **`test/e2e/a11y-topstrip.spec.ts`** — axe-core accessibility spec. Expected to pass unchanged as long as new buttons carry labels + `aria-label`s where needed; re-verify during implementation.
- **`test/e2e/visual-regression.spec.ts`** — baselines in `visual-regression.spec.ts-snapshots/` will need re-capturing after the layout change. This is expected, not a regression.
- **`test/e2e/render.spec.ts`** and **`test/e2e/topstrip-csp-smoke.spec.ts`** — grep hits likely incidental; verify during implementation and update if they depend on the old menu structure.

No new Playwright spec required. CSP smoke (`csp-smoke.spec.ts`, `cm-csp-smoke.spec.ts`, `topstrip-csp-smoke.spec.ts`) continues to guard the render path.

### Visual verification (Chrome, required before FF-merge)

Per the feedback memory *"Verify UI in Chrome, not just via tests"*:

- Load `dist/` after `pnpm build`, reload the extension, visit a seeded demo URL (e.g. `mattaltermatt.github.io/freshet/examples/incidents/INC-2026-000.json`).
- Confirm: rule-link shows correct text, `↗` arrow present, hover state matches the template link.
- Copy URL + Copy JSON: click each, check clipboard, check toast.
- Theme dropdown: click, pick each of Auto/Light/Dark, confirm the button label + icon updates and the page theme follows.
- Dark theme: repeat on a dark-themed starter.
- Narrow viewport: shrink the window until wrapping triggers; confirm no action is hidden.

## Open questions (resolved)

- **Separator between rule and template links** → middle-dot `·`.
- **Button label for Copy raw** → "Copy JSON".
- **Skip this host** → removed from strip.
- **Rule display text** → reuse `rule.name || rule.hostPattern` fallback from `RuleIdentity`.

## Risks

- **Strip width growth.** We're adding one link (rule) + one button (Copy JSON) + widening the theme button. The narrow-viewport wrap rule catches overflow, but there's a middle zone (~500–700 px) where the strip gets visually dense. Visual verification step guards this.
- **CSS token drift.** Adding a new button style inside the shadow root means any new `--pj-*` token must be declared in both `topStrip.css` and `theme.css`. This spec doesn't introduce new tokens, but the implementation should double-check during the theme-dropdown restyle.
- **Copy JSON semantics.** We're copying `rawJsonText` verbatim — if the page had comments or trailing whitespace, they come through. That's intentional (the user asked for *raw*), but worth noting in the toast or keeping in mind if a future user-report says "copied JSON has weird whitespace."

## Out of scope

- Adding `Rule.name` to the Edit-rule modal — already present.
- Per-rule color cues on the strip — not requested.
- Recording/exporting a canonical URL for the rule link — not requested.
- Issue #1 badge-on-direct-nav — separate ticket.
