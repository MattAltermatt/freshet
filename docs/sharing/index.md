---
title: Sharing Freshet rules and templates
description: The .freshet.json bundle format, secret-sniff patterns, collision resolution, and what's never shared.
permalink: /sharing/
---

# Sharing rules and templates

Freshet exports and imports rules + templates as a single plain-JSON file with the extension `.freshet.json`. Everything is human-readable — you can open a bundle in any editor, diff it, and audit it before importing. This page is the reference.

- [Bundle format](#bundle-format)
- [Secret-sniff patterns](#secret-sniff-patterns)
- [Collision resolution](#collision-resolution)
- [Warn, don't block](#warn-dont-block)
- [What's never shared](#whats-never-shared)

## Bundle format

A bundle is a single JSON object with `bundleSchemaVersion: 1`. Any other value is rejected at the parse step — no loose compatibility shims.

### Top-level fields

| Field | Type | Required | Purpose |
|---|---|---|---|
| `bundleSchemaVersion` | `number` (literal `1`) | ✅ | Schema version. Must be `1`. |
| `exportedAt` | `string` (ISO-8601) | ✅ | Timestamp the bundle was produced. |
| `exportedBy` | `string` | optional | Free-form origin label (e.g. app name). |
| `appVersion` | `string` | ✅ | Freshet version that produced the bundle. |
| `templates` | `BundleTemplate[]` | ✅ | Templates included in the bundle (may be empty). |
| `rules` | `BundleRule[]` | ✅ | Rules included in the bundle (may be empty). |

### `BundleTemplate`

| Field | Type | Required | Purpose |
|---|---|---|---|
| `name` | `string` | ✅ | Template name. Must be unique within the bundle. |
| `source` | `string` | ✅ | Liquid template source (HTML + `{{ }}` / `{% %}`). |
| `sampleJson` | `string` | optional | Per-template sample JSON shown in the editor preview. |

### `BundleRule`

| Field | Type | Required | Purpose |
|---|---|---|---|
| `id` | `string` | ✅ | Stable rule identifier. |
| `name` | `string` | optional | Human-readable label shown on the rule card. |
| `hostPattern` | `string` | ✅ | Glob or `/regex/` matched against the URL host. |
| `pathPattern` | `string` | ✅ | Glob or `/regex/` matched against the URL pathname. |
| `templateName` | `string` | ✅ | Must match a `templates[].name` in the same bundle. |
| `variables` | `Record<string, string>` | optional | Per-rule template variables. |
| `active` | `boolean` | ✅ | Whether the rule is on. |

### Example

```json
{
  "bundleSchemaVersion": 1,
  "exportedAt": "2026-04-19T20:45:00.000Z",
  "exportedBy": "Freshet",
  "appVersion": "1.0.0",
  "templates": [
    {
      "name": "service-health",
      "source": "<h1>{{ service.name }} — {{ service.status }}</h1>",
      "sampleJson": "{\"service\":{\"name\":\"payments\",\"status\":\"ok\"}}"
    }
  ],
  "rules": [
    {
      "id": "rule-service-health",
      "name": "Service health",
      "hostPattern": "status.example.com",
      "pathPattern": "/api/services/**",
      "templateName": "service-health",
      "variables": { "env": "prod" },
      "active": true
    }
  ]
}
```

## Secret-sniff patterns

Every bundle is scanned on both ends — at export (so you know what you're about to send) and at import (so you know what you're about to accept). Hits are surfaced with the literal pattern that matched and the literal matched text. Nothing is auto-redacted; you decide.

Scanned fields:

- **Rule variables** — keys and values on each `rules[].variables`.
- **Template `sampleJson`** — parsed as JSON; keys at every level and string values.

| Pattern ID | Kind | Regex | What it catches |
|---|---|---|---|
| `KEY_SECRETY` | key | `/token\|secret\|key\|password\|auth\|bearer\|api[_-]?key\|credential/i` | Field/variable names that look like they hold credentials. |
| `BEARER_PREFIX` | value | `/^Bearer\s+\S+/` | OAuth/HTTP bearer tokens. |
| `JWT` | value | `/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/` | Three-part JWTs (base64url header + payload + signature). |
| `OAUTH_GOOGLE` | value | `/^ya29\./` | Google OAuth access tokens. |

The patterns themselves live in [`src/bundle/sniff.ts`](https://github.com/MattAltermatt/freshet/blob/main/src/bundle/sniff.ts). If you hit a false positive or want more coverage, open an issue — detection should be easy to reason about, not a guessing game.

## Collision resolution

On import, Freshet compares the incoming bundle against your current rules and templates and classifies each item:

### Template collisions

Two templates with the same `name`. Resolution options:

- **Skip** — keep your existing template; drop the incoming one. Any incoming rule that pointed at it gets re-pointed to your existing template with the same name.
- **Overwrite** — replace your template's `source` and `sampleJson` with the incoming ones.
- **Keep both** — accept the incoming template under a renamed key. The importer picks the first available `name-2`, `name-3`, etc. Any incoming rule that referenced the original name is rewritten to the new name so the reference stays valid. This is a *cascading rename* — one template rename can trigger rule rewrites downstream.

### Rule collisions

Rules collide in three different ways:

- **Same `id`** — you already have a rule with this id. Options: **skip**, **overwrite**, or **keep both** (the incoming rule is renamed to `<id>-imported`).
- **Same `name`** — a rule with the same human-readable label already exists. Options: **skip** or **keep both** (incoming rule gets a suffixed name so both are distinguishable on the cards).
- **Same `hostPattern` + `pathPattern` (pattern overlap)** — two rules that would match the same URL. Options: **skip** or **keep both** — the importer does not disable either; you can re-order them afterwards (first-match wins).

### "Just append all"

If you don't want to review each item, the importer offers a one-click **append** path that:

- Accepts all non-colliding items.
- Auto-renames colliding templates and rule-ids on the "keep both" pattern.
- Leaves pattern overlaps untouched — both rules land, in order.

### Imported rules are inactive by default

Every rule that lands via import is written with `active: false`, regardless of the `active` value in the bundle. You flip the toggle on the rule card once you have reviewed it. The bundle still serializes the original `active` state — exports are faithful; imports are cautious.

### Atomic commit

The full import is committed in one transaction across four storage keys (`templates`, `pj_sample_json`, `rules`, `pj_import_flags`). Any failure rolls back to the pre-import snapshot — partial imports never land.

## Warn, don't block

Freshet's security posture for sharing is deliberate:

- **Scans are informational, not gatekeeping.** A bundle with a JWT in a sample payload still imports; you just see the hit and decide whether to trim it first.
- **Nothing is auto-redacted.** If a value looks like a secret, we show you the exact matched text. You would not trust "we removed something for you" — neither would we.
- **Matches are spelled out.** Every flag in the UI shows the literal regex and the literal matched substring. No black-box "looks suspicious."
- **Badges persist.** An imported rule that raised a flag keeps a small ⚠ badge on its card until you explicitly dismiss it — editing the rule does not silently clear the flag.

## What's never shared

The bundle format contains **only** the fields listed under [Bundle format](#bundle-format). These storage keys and fields are intentionally kept out:

- **`hostSkipList`** — your per-host skip toggles. Skips are a personal workflow preference, not a portable rule.
- **`settings`** — theme preference and any other UI settings.
- **`pj_ui_collapse`, `pj_ui_split_ratio`** — per-device layout state for the Templates tab.
- **`pj_first_run_dismissed`** — the welcome-banner flag.
- **`pj_storage_area`, `schemaVersion`, `pj_migrated_v2`** — internal storage sentinels and migration bookkeeping.
- **`pj_conflicts`** — per-host records of detected conflicting JSON viewers. These are snapshots of your local environment.
- **`pj_import_flags`** — "needs attention" badges are seeded on import, not exported.
- **Starter-only rule fields** — `isExample` and `exampleUrl` are set by the installer for the five bundled demo rules. Exports strip both so re-imports don't masquerade as starters.

If you want to share UI preferences or skip lists, do it out-of-band. Bundles are for rules and templates.
