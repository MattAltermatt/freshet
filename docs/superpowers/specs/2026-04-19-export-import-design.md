# Export / import design — Freshet

**Status:** Design approved 2026-04-19.
**Supersedes:** the "Template export / import" paragraph in `ROADMAP.md` (P0).
**Feature branch:** will land as `feature/export-import` once the plan is written.

---

## Goal

Let a Freshet user share rules and templates with teammates via a single plain-JSON bundle file. Cover the common cases — "share this one template," "share my whole setup," "here's the QA set," — with warnings (never blocks) around sensitive content, and a clear review UI that never silently modifies the recipient's existing configuration.

Out of scope for v1: form-based UI, in-app marketplace / registry, multi-bundle batch import, selective-field merge within one template.

---

## Principles

This feature is the first place Freshet's ethos becomes user-facing, and the README gets a new `## Principles` section (landed on the same branch) that says so plainly:

- **Warn, don't block.** When Freshet detects something worth pointing out — a possible secret in a shared bundle, a naming collision, a sample payload that looks like it holds real tokens — it tells the user and steps out of the way. The user decides.
- **No hiding.** Every flag shows the exact pattern or condition that matched — literal regex, literal matched text. If we can't explain why we flagged something, we don't flag it.
- **Local-first, always.** Rules, templates, and sample JSON live in the user's `chrome.storage`. Nothing is sent to a server. There is no server.
- **Plain formats.** Bundles are plain JSON. No binary blobs, no base64 obfuscation, no custom encoding.
- **No telemetry.** No analytics, no error reporting, no phone-home.

These principles are load-bearing on design decisions throughout this spec; violating one should trigger a design re-look, not a workaround.

---

## Architecture

One new pure-core module (Node-testable, zero `chrome.*` calls, mirrors `src/engine/` and `src/matcher/`) plus three UI surfaces.

```
src/bundle/                         ← NEW pure core
  schema.ts                         ← Bundle TS type + validator
  serialize.ts                      ← Rules+templates+sampleJson → Bundle JSON
  parse.ts                          ← Bundle JSON → validated Bundle, or ParseError[]
  sniff.ts                          ← Key-name + value-shape secret scanner
  collide.ts                        ← Collision detection + auto-rename (-2, -3, …)
  migrate.ts                        ← Future-proofing: bundle schemaVersion 1 → N

src/shared/types.ts
  Rule.name?: string                ← NEW optional field
  Rule.id: string                   ← backfilled on first v1.1 run (crypto.randomUUID)

src/options/
  rules/RulesTab.tsx                ← no change to card UI (name renders if set)
  rules/RuleEditModal.tsx           ← add "Name" field (optional)
  ShortcutsFooter.tsx               ← add center slot: [⬇ Export] [⬆ Import]
  export/ExportDialog.tsx           ← picker → scrub → output
  export/ExportPicker.tsx           ← two-col checkboxes, filter box
  export/ExportScrub.tsx            ← per-row include/strip/preview, sniff warnings
  export/ExportOutput.tsx           ← download + copy-to-clipboard buttons
  import/ImportDialog.tsx           ← input → mode pick → review or append
  import/ImportInput.tsx            ← file picker + drop zone + paste textarea
  import/ImportReview.tsx           ← two-col checkboxes, collision resolution, sniff flags
  import/ImportAppendModal.tsx     ← "just append" warnings confirmation
  badges/NeedsAttention.tsx         ← persistent flag on imported items w/ sniff hits
```

Purity invariant (same greppable assertion as `src/engine`):

```bash
rg 'chrome\.' src/bundle
# must return nothing
```

---

## Bundle schema

Single JSON object. TypeScript shape:

```ts
interface FreshetBundle {
  bundleSchemaVersion: 1;                  // future-proof; unknown versions reject
  exportedAt: string;                      // ISO-8601 UTC
  exportedBy?: string;                     // optional freeform label
  appVersion: string;                      // Freshet version at export time
  templates: BundleTemplate[];
  rules: BundleRule[];
}

interface BundleTemplate {
  name: string;                            // same string used as storage key
  source: string;                          // Liquid template HTML
  sampleJson?: string;                     // optional; omitted if stripped in scrub
}

interface BundleRule {
  id: string;                              // stable UUID, preserved across export/import
  name?: string;                           // optional, human-readable
  hostPattern: string;
  pathPattern: string;
  templateName: string;                    // must reference template in THIS bundle
  variables?: Record<string, string>;      // absent if stripped in scrub
  active: boolean;                         // importer ALWAYS overrides to false
}
```

### Invariants enforced by `parse.ts`

1. `bundleSchemaVersion === 1` — unknown versions reject with a clear error. No silent upgrade.
2. Every `rule.templateName` must appear in `templates[].name`. Dangling refs reject with the offending rule quoted.
3. `rules[]` order preserved on import (appended to end of user's existing rule list).
4. Unknown top-level keys are dropped silently *only* for forward-compat safety. Known-but-malformed fields fail parse.
5. `sampleJson` is never re-serialized by the importer on the write path. It is carried as an opaque string and written back verbatim to `chrome.storage.local[pj_sample_json][templateName]`. Any malformed sample JSON the sender had stays malformed on the recipient side. (The sniff scanner reads/parses sample JSON to locate flags, but it never transforms the stored value — sniff output is a list of hits, not a mutation.)

### Not in the bundle

- Starter flags (`isExample`, `exampleUrl`) — reserved for bundled starters seeded on install. A user-exported starter becomes a regular rule on the recipient side.
- UI prefs (`pj_ui_collapse`, `pj_ui_split_ratio`, `settings.themePreference`) — per-install workstation state.
- `hostSkipList`, `pj_first_run_dismissed` — per-install.

### Example

```json
{
  "bundleSchemaVersion": 1,
  "exportedAt": "2026-04-19T16:23:00Z",
  "exportedBy": "Matt's QA setup",
  "appVersion": "1.0.0",
  "templates": [
    {
      "name": "pd-incident",
      "source": "<div>{{ incident.title }}</div>",
      "sampleJson": "{\"incident\":{\"title\":\"db down\"}}"
    }
  ],
  "rules": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "[qa] PagerDuty incidents",
      "hostPattern": "api.pagerduty.com",
      "pathPattern": "/incidents/**",
      "templateName": "pd-incident",
      "variables": { "env": "qa" },
      "active": true
    }
  ]
}
```

### File naming

`freshet-export-YYYY-MM-DD.freshet.json` by default. The `.freshet.json` dual extension keeps JSON-everywhere compatibility (teammates without Freshet can eyeball the bundle) while giving the importer a pattern to recognize.

---

## Export UX flow

Triggered by **⬇ Export** in the center of `ShortcutsFooter`. Three steps.

### Step 1 — Picker

Two-column modal: Rules (top) and Templates (bottom), with a filter box. Checkboxes on every row.

- Filter is substring/prefix match on rule name + host pattern + template name. Typing `[qa]` supports the prefix workflow.
- Checking a rule **auto-selects** the template it references (grayed-lock badge — "auto-pulled by rule 'X'"). Unchecking the rule releases it. Guarantees every exported rule has its template.
- "Select all" toggle, live count of selected items including auto-pulls.
- "Next: Review" advances. "Cancel" writes nothing.

### Step 2 — Scrub

Per-row review of every exportable sensitive field. Each row gets an include / strip / preview control.

- **Rule `variables`:** `☑ include` by default. Hover to preview keys + values.
- **Template `sampleJson`:** `☑ include` by default (per design decision — teammate-sharing usually wants real payloads). Preview opens a read-only panel.
- **Sniff flags** render inline under the relevant row, with literal regex + matched text quoted:
  > 🚩 Matched `/token|secret|key|password|auth|bearer|api[_-]?key|credential/i` on `sampleJson.incident.api_token`. Value: `"sk_live_abc123…"`
- Top banner: *"Once shared, assume this can't be un-shared."*
- "Next: Output." "Back" returns to picker.

### Step 3 — Output

```
Bundle contains: N rules, M templates, K sample JSONs.
X secret-sniff flags unresolved (listed below).

⬇ freshet-export-2026-04-19.freshet.json  (3.4 KB)

[ Download ]   [ Copy JSON to clipboard ]

🚩 Still flagged:
  pd-incident → sampleJson.api_token (matched /token|…/i)
```

- **Download** — `Blob` + object URL + anchor click.
- **Copy JSON to clipboard** — `navigator.clipboard.writeText`. Serves the Slack/paste workflow.
- Unresolved flags re-listed as last-chance reminder. Not a block; user can still proceed.
- "Done" closes.

### Behaviors

- Cancelling at any step writes nothing.
- No export history, no autosaved drafts — dialog is fresh each open.
- All rules already have `id` set by the time export runs (backfilled once at v1.1 install, see Architecture).

---

## Import UX flow

Triggered by **⬆ Import** in `ShortcutsFooter`. Input → mode pick → review-or-append.

### Step 1 — Input

Blurb at top explicitly names all three input methods (per "make it clear these exist" directive):

> You can import a Freshet bundle three ways:
> - Drag a `.freshet.json` file onto this window
> - Click "Choose file…" to pick one from disk
> - Paste bundle JSON directly into the box below

All three inputs feed the same parser in `src/bundle/parse.ts`. Parse + validate on "Next." Errors render inline ("Invalid JSON at line 4: unexpected token" / "Rule 'X' references template 'Y' which is not in this bundle") — user stays on Step 1 to fix.

### Step 2 — Mode pick

```
Bundle from: Matt's QA setup (exported 2026-04-19)
Contains: N rules, M templates.

⚠ Secret-sniff found K flag(s).
⚠ T template(s) collide with existing names.

🚩 Flags:
  pd-incident → sampleJson.api_token  (Matched /token|…/i)

[ Review & pick ]    [ Just append all ]
```

- Review → Step 3a.
- Just append → Step 3b.

### Step 3a — Review (piecemeal mode)

Rules panel on top, Templates below (matches options tab order). Filter box + "select matching" at top.

- Each item: include/exclude checkbox + collision resolution radio + sniff flags.
- Collision resolution options:
  - **Rename** to `name-2` (default). Cascades: incoming rules referencing the renamed template auto-update to the new name, shown inline as `→ template: pd-incident → pd-incident-2 (renamed during import)`.
  - **Replace existing.** Shows a confirm-checkbox on the same row. Prevents muscle-memory misclicks. No "replace all" bulk button.
  - **Skip.**
- Hovering a row reveals a side-panel preview (template source, rule patterns).
- Footer: *"Imported rules start INACTIVE — toggle on per rule after import."*
- "Import" commits. "Back" returns to mode pick.

### Step 3b — Just append

```
This will add N rules + M templates without a review.

Defaults used:
  • Collisions auto-renamed (no replacements)
  • Rules added INACTIVE
  • Flagged items get a persistent "⚠ needs attention" badge
    until you dismiss it

🚩 Flags that will carry over as badges:
  pd-incident → sampleJson.api_token (Matched /token|…/i)

[ Back ]  [ Append all ]
```

- Same literal flag wording as Review mode.
- "Append all" commits immediately; closes dialog; toast summarizes.

### Post-import

- Imported rules sit at the **bottom** of the rules array, `active: false`.
- Any rule or template with a sniff flag (from either mode) gets a persistent `⚠ needs attention` badge until the user dismisses it.
- Badge state stored under `pj_import_flags` (see Conflict handling).

---

## Conflict handling

### Identity

| Entity | Identity key | Why |
|---|---|---|
| Template | `name` | Templates are referenced by name from rules. Name is identity. |
| Rule | `id` (UUID) | Rules are user-reorderable, rename-able, pattern-tweakable. Stable UUID is the only reliable identity. `name` is just display. |

### Collision detection

On import, after parse, `collide.ts` returns:

1. **Template collision** — `bundle.templates[].name === existing.templates[].name`.
2. **Rule collision by id** — `bundle.rules[].id === existing.rules[].id`. Indicates round-trip; user likely updating their own.
3. **Rule collision by name** — same `name`, different `id`. Two rules can legitimately share a name; surface as soft notice.
4. **Rule pattern overlap** — same `hostPattern` + `pathPattern`, different `id`. Info row; append-to-end already keeps existing rule winning first-match-wins.

### Default resolution

| Scenario | Default | User can override to |
|---|---|---|
| Template name collision | **Rename** to `name-2` (`-3`, etc. as needed) | Replace (confirm-checkbox) / Skip |
| Rule id collision | **Replace** (confirm-checkbox pre-checked) | Skip / Keep both (force new id) |
| Rule name collision only | **Include both** | Rename / Skip |
| Rule pattern overlap | **Include both (appended)** | Skip |

### Cascading template renames

If the user renames template `pd-incident` → `pd-incident-2` during review, incoming rules referencing the old name auto-rewrite in the bundle preview. Existing user rules are untouched.

### Write order & atomicity

1. Templates written first (so rules can reference them).
2. `pj_sample_json` updates (verbatim, per schema invariant 5).
3. Rules appended to existing `rules` array, bundle order preserved among themselves.
4. Flags written to `pj_import_flags`.

If any storage write fails (quota, transient chrome.storage error), the whole import rolls back — no partial state. Same batch-atomic pattern as `engine/migrate.ts`.

### `pj_import_flags` storage

```ts
interface ImportFlagEntry {
  source: 'import' | 'append';
  importedAt: string;                 // ISO-8601 UTC
  flags: Array<{
    field: string;                    // e.g. 'sampleJson.api_token'
    pattern: string;                  // literal regex string
    matchedText: string;              // exact matched substring, unredacted
  }>;
}

type PJImportFlags = Record<string /* ruleId | templateName */, ImportFlagEntry>;
```

- Keyed by rule `id` or template `name`.
- `NeedsAttention` badge reads this key.
- Cleared explicitly (user clicks "Dismiss" on the badge). No auto-clear on edit.

---

## Secret-sniff

Pure module at `src/bundle/sniff.ts`. One export, one constant, greppable. Adding a pattern = 1-line code change + test.

### Patterns

```ts
const SNIFF_PATTERNS = [
  // Key-name
  { id: 'KEY_SECRETY',   kind: 'key',   regex: /token|secret|key|password|auth|bearer|api[_-]?key|credential/i },
  // Value-shape
  { id: 'BEARER_PREFIX', kind: 'value', regex: /^Bearer\s+\S+/ },
  { id: 'JWT',           kind: 'value', regex: /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/ },
  { id: 'OAUTH_GOOGLE',  kind: 'value', regex: /^ya29\./ },
] as const;
```

### Scanned fields

| Field | Scan |
|---|---|
| `rule.variables` | Keys (vs `KEY_SECRETY`) + values (vs all `value` patterns) |
| `template.sampleJson` | Parsed recursively; object keys vs key patterns, string leaves vs value patterns. Silent parse-fail = skip scan |
| `rule.hostPattern`, `rule.pathPattern` | **Not scanned** — match patterns, not payload data |
| `template.source` | **Not scanned** — Liquid templates reference variables, don't contain them |
| `rule.name`, `template.name` | **Not scanned** — user-authored display strings |

### Output

```ts
interface SniffHit {
  field: string;        // dotted JSON path, e.g. 'sampleJson.incident.api_token'
  patternId: string;    // 'KEY_SECRETY' | 'BEARER_PREFIX' | ...
  patternRegex: string; // stringified regex
  matchedText: string;  // unredacted
}

function sniff(bundle: FreshetBundle): SniffHit[];
```

### UI surfaces

All surfaces show the same fields in the same wording — no variation, no summarization.

- **Export scrub (per row)** — inline flag under the field being scrubbed.
- **Import review (per row)** — inline under the item being reviewed.
- **Import "just append" modal** — all flags listed verbatim above the confirm button.
- **Post-import `⚠ needs attention` badge** — card-level indicator; click opens a panel with the flag list.

### What sniff does NOT do

- Doesn't block import/export. Flags, user decides.
- Doesn't redact. The sender already had the value.
- Doesn't remember flags across exports — fresh export rescans. Stored flags only exist post-import for the badge.
- Doesn't use entropy or ML. Literal regex only.

---

## Testing plan

### Unit tests (Vitest, Node) — `src/bundle/*.test.ts`

**`schema.test.ts`**
- Valid minimum bundle parses.
- Rejects `bundleSchemaVersion !== 1` with clear error.
- Rejects dangling `rule.templateName`.
- Rejects duplicate template names within one bundle.
- Unknown top-level keys dropped silently.
- `sampleJson` round-trips as opaque string.

**`serialize.test.ts`**
- Exports all rules + templates + sample JSON by default.
- `strip: ['sampleJson', 'variables']` options omit those fields.
- Preserves rule order and rule `id`s.
- Backfills missing `id`s with fresh UUIDs.
- Omits `isExample` / `exampleUrl` / UI prefs / `hostSkipList`.

**`parse.test.ts`**
- Happy path: valid bundle → typed structure.
- Malformed JSON → structured error with position.
- Invalid schema → list of field-specific errors (not just first).
- `sampleJson` stays as raw string; never re-parsed.

**`sniff.test.ts`**
- Key-name hits (`variables.auth_token`).
- Value-shape hits (Bearer, JWT, OAuth Google).
- No false-positives on `title`, `id`, `slug`, etc.
- Dotted-path output for nested sampleJson.
- Literal regex string + matched substring in output.
- Malformed sampleJson string → skipped scan, no throw.

**`collide.test.ts`**
- Template name collision → rename to `-2`; `-3` if `-2` exists.
- Rule id collision → replace default.
- Rule pattern overlap → include-both default.
- Cascading rename rewrites bundle rule template refs.
- Atomic commit: simulated write failure mid-import leaves storage untouched.

### Component tests (Vitest + jsdom)

- `ExportPicker` — filter + "select matching" + auto-pull of referenced templates.
- `ExportScrub` — per-row toggles; sniff flags render with literal pattern.
- `ExportOutput` — download triggers `Blob` URL; clipboard button writes JSON.
- `ImportInput` — three input methods each feed the parser; parse errors inline.
- `ImportReview` — collision radio group; replace requires confirm-checkbox.
- `ImportAppendModal` — flags verbatim; commit dispatches correct payload.
- `NeedsAttention` badge — renders when `pj_import_flags[id]` exists; clears on dismiss.

### E2E tests (Playwright, headed Chrome) — `test/e2e/export-import.spec.ts`

Real `chrome.storage` round-trip. Seed fixtures via `worker.evaluate(...)`.

- **Round-trip integrity** — seed 3 rules + 3 templates + sample JSON; export; clear; import; verify storage equals seed (ids + order preserved, `active: false`).
- **Append mode** — import same bundle twice; second renames to `-2`; `pj_import_flags` contains both imports.
- **Scrub strips sampleJson** — exported bundle omits it; import leaves `pj_sample_json` untouched.
- **File picker path** — `<input type="file">` → review UI.
- **Paste path** — textarea → review UI.
- **Malformed input** — invalid JSON → Step 1 error; no state change.
- **Persistent badge** — append-mode import with sniff hit → reload → badge still present.

### A11y

- New dialogs go through axe-core (existing pattern).
- Keyboard nav: every checkbox/radio/button reachable and operable.

### Docs / ship dependencies (same branch)

- **`README.md`** — new `## Principles` section + export/import mention + `.freshet.json` format note.
- **`CLAUDE.md`** — new Gotchas entries: bundle `schemaVersion` rejection behavior, `sampleJson` no-re-parse invariant, `pj_import_flags` key.
- **`ROADMAP.md`** — P0 "Template export/import" marked done (with date).
- **`docs/try/`** — no change (export/import is config, not a starter).

---

## Open questions / out-of-scope for v1

- **Multi-select for export picker** — current design uses two-column checkboxes which already supports it; if usability testing shows friction, revisit.
- **Bundle signing / author identity verification** — not in v1. `exportedBy` is a freeform label, not a signature. If future teammate-sharing use cases need trust guarantees, a separate design.
- **Sharing via URL fragment** — e.g. copy a URL that deep-links into import with a compressed bundle. Out of scope; paste-JSON covers the main use case.
- **Selective field merge within a template** — e.g. "keep my sampleJson but take their source." Out of scope; user can resolve via rename-then-manual-merge.
- **Import history / undo** — not in v1. Atomic commit is the safety net; if users ask for undo, revisit.
