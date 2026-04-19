# Extension-conflict detection design — Freshet

**Status:** Design approved 2026-04-19.
**Supersedes:** the "Extension-conflict detection" paragraph in `ROADMAP.md` (P0).
**Feature branch:** `feature/conflict-detect`.

---

## Goal

When another JSON viewer (JSONView, JSON Formatter, JSON Viewer Pro, or a similar extension) has already mutated the page DOM before Freshet's content script runs, Freshet should stop silently failing and instead: (a) passively signal a warning on the extension badge, and (b) surface a clear, actionable warning in the popup with a one-click path to disable the conflicting viewer.

Freshet does not attempt to wrest control of the page from the other viewer. The "warn, don't block" principle from the README applies: tell the user what we detected, give them a way out, step aside.

Out of scope for v1: active takeover via `chrome.scripting.executeScript`, a long list of fingerprinted viewers, automatic viewer-disable. All listed as future considerations.

---

## Principles applied

- **Warn, don't block** — we surface a warning, we do not fight the other viewer.
- **No hiding** — the popup names the viewer when we can identify it and links to its specific settings; when we can't, we say so ("Another JSON viewer") rather than pretending we know more.
- **Rule-gated detection** — we only warn on hosts where a Freshet rule actually matches. Hosts the user has not configured stay completely silent.
- **Local-first** — the conflict map lives in `chrome.storage.local[pj_conflicts]`. No telemetry; no list of "sites where we had conflicts" leaves the user's machine.

---

## Architecture

One new pure-core module (`src/content/conflictDetect.ts` — rewrites the existing stub), plus targeted modifications to the content script, background SW, storage facade, badge, and popup.

```
src/content/
  conflictDetect.ts                ← REWRITE the Phase-2 stub; pure, takes Document
  conflictDetect.test.ts           ← NEW: jsdom fixtures per branch

src/content/content-script.ts      ← MODIFY: branch on detectConflict() result after parse-fail

src/shared/types.ts                ← ADD: KnownViewer, ConflictReport, ConflictEntry, ConflictMap

src/background/
  background.ts                    ← MODIFY: relay pj:conflict message
  badge.ts                         ← ADD: pj:conflict signal + warning-orange appearance
  badge.test.ts                    ← ADD: appearance assertion

src/storage/storage.ts             ← ADD: getConflicts, setConflicts, clearConflict(host)
src/storage/storage.test.ts        ← ADD: round-trip + clear assertions

src/popup/
  App.tsx                          ← MODIFY: read pj_conflicts; render ConflictSection when present, hide matched-rule row in that case
  ConflictSection.tsx              ← NEW: warning panel + action buttons
  ConflictSection.test.tsx         ← NEW: component tests
  popup.css                        ← ADD: styles for the conflict section
```

**Purity invariant** (same greppable assertion as `src/engine`, `src/matcher`, `src/bundle`):

```bash
rg 'chrome\.' src/content/conflictDetect.ts
# must return nothing
```

---

## `conflictDetect.ts` — pure core

```typescript
export type KnownViewer = 'jsonview' | 'json-formatter' | 'json-viewer-pro';

export interface ViewerFingerprint {
  id: KnownViewer;
  displayName: string;
  extensionId: string;
  matches(doc: Document): boolean;
}

export type ConflictReport =
  | { ok: true }
  | { ok: 'rescued'; rescuedJson: string }
  | {
      ok: false;
      viewer: KnownViewer;
      displayName: string;
      extensionId: string;
    }
  | {
      ok: false;
      viewer: 'unknown';
      displayName: 'Another JSON viewer';
      extensionId: null;
    };

export function detectConflict(doc: Document): ConflictReport;
```

### Detection order (first match wins)

1. **`<pre>` rescue.** If the first `<pre>` descendant of `document.body` has a `textContent.trim()` that starts with `{` or `[` and parses via `JSON.parse` without throwing, return `{ ok: 'rescued', rescuedJson }`. Covers Chrome's built-in viewer and light-touch extensions that only wrap.
2. **Named viewer fingerprints.** Iterate the `FINGERPRINTS` constant. First `matches(doc) === true` → return `{ ok: false, viewer, displayName, extensionId }`.
3. **Generic unknown-viewer fallback.** Parse failed AND body has no `<pre>` child AND body contains an element whose class name matches `/json/i` or has a `data-json-*` attribute → return `{ ok: false, viewer: 'unknown', ... }`.
4. **Otherwise** → `{ ok: true }` (not JSON, no conflict to flag).

### FINGERPRINTS (values verified at implementation time)

```typescript
const FINGERPRINTS: readonly ViewerFingerprint[] = [
  {
    id: 'jsonview',
    displayName: 'JSONView',
    extensionId: '<verified-at-impl>',
    matches: (doc) => doc.querySelector('.jsonview') !== null,
  },
  {
    id: 'json-formatter',
    displayName: 'JSON Formatter',
    extensionId: '<verified-at-impl>',
    matches: (doc) => doc.querySelector('<selector-verified-at-impl>') !== null,
  },
  {
    id: 'json-viewer-pro',
    displayName: 'JSON Viewer Pro',
    extensionId: '<verified-at-impl>',
    matches: (doc) => doc.querySelector('<selector-verified-at-impl>') !== null,
  },
];
```

Exact selectors + extension IDs are confirmed during the plan's first task by loading each extension into a Playwright Chrome instance, capturing the post-mutation HTML, and reading the ID from `chrome.management` or the extension's CWS listing. The design commits to the shape; the values are implementation details.

### Purity

Zero `chrome.*` references. `detectConflict` accepts a `Document` parameter — the content script passes `document`, tests pass `new JSDOM(html).window.document`. No global access.

---

## Content-script integration

Replaces the current silent-bail-on-parse-fail behavior with a rule-gated branching flow.

```typescript
async function main(): Promise<void> {
  const rawText = document.body?.innerText;
  const parsed = tryParse(rawText);

  const { rules, templates, skip, settings } = await loadConfig();
  const host = window.location.hostname;
  if (skip.includes(host)) return;

  if (parsed.ok) {
    return renderMatched(parsed.json, rules, templates, settings);
  }

  // Rule-gated: only do conflict detection when Freshet would have rendered.
  const rule = match(window.location.href, rules);
  if (!rule) return;

  const report = detectConflict(document);

  if (report.ok === 'rescued') {
    const json = JSON.parse(report.rescuedJson);
    await clearConflictForHost(host);
    return renderMatched(json, rule, templates, settings);
  }

  if (report.ok === false) {
    await writeConflictForHost(host, {
      viewer: report.viewer,
      displayName: report.displayName,
      extensionId: report.extensionId,
      detectedAt: new Date().toISOString(),
    });
    signal('pj:conflict');
    return;
  }

  // report.ok === true → parse failed but no conflict signals; just not JSON.
}
```

### Invariants

1. **Rule-gated detection.** No rule → no detection run, no storage write, no badge signal.
2. **Rescue clears.** A successful `<pre>` rescue always calls `clearConflictForHost(host)` before rendering. If the user previously saw a warning and the viewer got disabled (or now leaves `<pre>` alone), the next visit cleans itself up.
3. **Successful render also clears.** The existing success path adds one line: `void clearConflictForHost(host)` right before the existing `signal('pj:rendered')` call. Any render success on a host removes that host's conflict entry.
4. **No DOM injection on conflict.** Content script never mounts the top-strip, never injects a banner, never touches `document.body` when `detectConflict` returns `ok: false`. The other viewer owns the page.
5. **Badge cleared on navigation.** The existing `chrome.tabs.onUpdated` handler in `background.ts` clears the badge on URL change; no new code for conflict-badge teardown.

---

## Storage + badge

### New storage key

`chrome.storage.local[pj_conflicts]`

```typescript
export interface ConflictEntry {
  viewer: KnownViewer | 'unknown';
  displayName: string;
  extensionId: string | null;
  detectedAt: string;     // ISO-8601
}
export type ConflictMap = Record<string /* hostname */, ConflictEntry>;
```

### Facade additions (`src/storage/storage.ts`)

```typescript
interface Storage {
  // ...existing...
  getConflicts(): Promise<ConflictMap>;
  setConflicts(map: ConflictMap): Promise<void>;
  clearConflict(host: string): Promise<void>;
}
```

### Cleanup paths

| Trigger | Caller | Effect |
|---|---|---|
| User clicks "Dismiss" in popup | `ConflictSection.tsx` | Remove entry for that host |
| User clicks "Skip this host" in popup | `ConflictSection.tsx` | Add host to `hostSkipList` AND remove the conflict entry |
| Content script renders successfully on that host | `content-script.ts` | Remove entry (viewer must have been disabled) |
| Content script rescues via `<pre>` on that host | `content-script.ts` | Remove entry (same reasoning) |

### Badge signal

```typescript
// src/background/badge.ts
export type BadgeSignal = 'pj:rendered' | 'pj:render-error' | 'pj:conflict';

export function appearanceFor(sig: BadgeSignal): { text: string; color: string } {
  switch (sig) {
    case 'pj:rendered':      return { text: '✓', color: '#16a34a' };
    case 'pj:render-error':  return { text: '!', color: '#dc2626' };
    case 'pj:conflict':      return { text: '⚠', color: '#c2410c' };
  }
}
```

`background.ts` adds one case to its existing `onMessage` switch for `pj:conflict`. The existing `chrome.tabs.onUpdated` clears the badge on navigation — no new teardown logic.

---

## Popup UX

### When to render the conflict section

`App.tsx` loads `pj_conflicts` via `useStorage('pj_conflicts', {})`. When `pj_conflicts[tab.host]` has an entry, it renders `<ConflictSection entry={...} host={tab.host} />` **in place of** the matched-rule row. Rationale: the rule isn't being applied; showing it alongside "can't render" would confuse more than inform.

### Component

```typescript
export interface ConflictSectionProps {
  host: string;
  entry: ConflictEntry;
  onDismiss: () => void;
  onSkipHost: () => void;
}
```

### Layout

```
⚠ Another viewer is active
──────────────────────────────────
JSONView is formatting this page.
Freshet can't render over it.

[ Open JSONView settings → ]

[ Skip this host ]   [ Dismiss ]

Detected 2 min ago
```

### Conditional copy

- **Known viewer** (fingerprint matched):
  - Headline: *"{displayName} is formatting this page. Freshet can't render over it."*
  - Primary action: *"Open {displayName} settings →"* → `chrome://extensions/?id=<extensionId>`
- **Unknown viewer** (generic fallback):
  - Headline: *"Another JSON viewer is formatting this page. Freshet can't render over it."*
  - Primary action: *"Open Chrome extensions →"* → `chrome://extensions/`
  - Hint line: *"Look for an extension that formats JSON."*

### Actions

- **Primary disable link** — opens a new tab at the relevant `chrome://extensions/...` URL. Uses `chrome.tabs.create` from the popup (popup has the permission).
- **Skip this host** — appends host to `hostSkipList` + calls `clearConflict(host)`. Popup closes; next visit to this host Freshet exits silently before detection.
- **Dismiss** — calls `clearConflict(host)` only. Freshet keeps trying on future visits; re-fires warning on re-detection.
- **Detected {relative}** — small disclosure label: "just now" / "2 min ago" / "3 days ago" from `detectedAt`. Lets users distinguish stale flags from fresh ones.

---

## Testing plan

### Unit tests (Vitest, Node via jsdom) — `src/content/conflictDetect.test.ts`

One fixture per branch of the detection order:

- Clean page → `{ ok: true }`.
- Chrome native `<pre>` → `{ ok: 'rescued', rescuedJson: '…' }`.
- `<pre>` with malformed JSON → falls through, doesn't throw.
- JSONView fingerprint → `{ ok: false, viewer: 'jsonview', … }`.
- JSON Formatter fingerprint → similar.
- JSON Viewer Pro fingerprint → similar.
- Unknown viewer fallback → `{ ok: false, viewer: 'unknown', … }`.
- Detection order (`<pre>` beats fingerprint when both present).
- Purity check — test file imports + exercises `detectConflict(doc)` without any `chrome.*` polyfill.

### Component tests (Vitest + jsdom)

- `ConflictSection.test.tsx` — known-viewer and unknown-viewer rendering paths; asserts link hrefs + button callbacks.
- `App.test.tsx` extension — when `pj_conflicts[host]` is set, matched-rule row is hidden and ConflictSection is shown.

### Storage facade tests

- `getConflicts` default → `{}`.
- `setConflicts` + `getConflicts` round-trip.
- `clearConflict(host)` removes only the keyed entry; preserves others.

### Badge test

- `appearanceFor('pj:conflict')` returns `{ text: '⚠', color: '#c2410c' }`.

### E2E (Playwright, headed Chrome) — `test/e2e/conflict-detect.spec.ts`

1. **Popup rendering path.** Seed `chrome.storage.local.pj_conflicts` via the background SW, open the popup on a tab whose host matches the seeded entry. Assert the ConflictSection renders with the correct displayName + extension-id link + that the matched-rule row is hidden. Click "Skip this host" → `hostSkipList` contains the host + `pj_conflicts` no longer has the key.
2. **Dismiss path.** Same seeding, open popup, click "Dismiss" → `pj_conflicts` is empty; `hostSkipList` unchanged.
3. **Content-script detection on a fixture page.** Ship a test-only HTML at `public/__conflict-fixture.html` (gitignored or included with a `__` prefix) with a pre-baked JSONView class signature on body; seed a Freshet rule that matches the fixture URL; navigate; assert storage gets written with `viewer: 'jsonview'` and the badge shows `⚠`.

### A11y — append one scenario to `test/e2e/a11y-popup.spec.ts`

Popup with a conflict entry seeded → zero serious/critical axe-core violations.

### Docs (in-branch)

- **CLAUDE.md** — new Gotcha: "Conflict detection is rule-gated — if no rule matches the URL, `detectConflict` never runs and no warning appears." + storage key row for `pj_conflicts`.
- **README** — one Features bullet: *"Graceful handling of conflicting JSON viewers — Freshet warns in the popup with a one-click disable link, never fights for the page."*
- **ROADMAP** — P0 "Extension-conflict detection" marked shipped 2026-04-19; next P0 promoted.

---

## Out-of-scope for v1 / future considerations

- **Active takeover via `chrome.scripting.executeScript`.** Would let Freshet override the other viewer. Violates the "warn don't block" principle; not planned.
- **Broader fingerprint coverage.** V1 ships 3 named viewers + a generic fallback. Real-world conflict reports in issues would drive additions.
- **Automatic viewer-disable.** Could technically prompt the user to disable the viewer via the Chrome management API (requires the `management` permission). Would require a fresh CWS justification; skipped for v1.
- **"Discovery mode" setting (Q6 option C).** `settings.warnOnAnyConflict: boolean` to extend detection to all hosts (not just rule-matched). Not needed for v1; add if requested.
- **Per-host temporary mute.** "Don't warn me about this host for 24h" as distinct from Dismiss. Adds complexity; skip until requested.
