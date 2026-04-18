# Phase 1 code review — 2026-04-17

Reviewer: `feature-dev:code-reviewer` agent (fresh, no implementation bias).

## Findings addressed in this branch

| # | Severity | File:line | Fixed in |
|---|---|---|---|
| 1 | blocker | `src/matcher/glob.ts:17` | `**` now compiles to `.*` (zero-or-more) instead of `.+`. Test added: `glob.test.ts` "** matches empty sequences". |
| 2 | fix-before-ship | `src/engine/sanitize.ts` | Unquoted `on*` handlers now stripped; `data:` and `vbscript:` URLs neutralized in `href`/`src`. Tests added: `sanitize.test.ts` "removes unquoted inline event handlers", "neutralizes data: URLs in href/src". |
| 4 | fix-before-ship | `src/options/options.ts` | Rules + Templates toolbar listeners moved from per-render `renderRulesTab`/`renderTemplatesTab` to one-time `setupRulesToolbar`/`setupTemplatesToolbar` called from `boot()`. No more listener accumulation on reorder. |
| 7 | fix-before-ship | `src/storage/storage.ts` | `createStorage` is now `async` and reads a `pj_storage_area` sentinel from `chrome.storage.local` to decide which area to read from. `migrateSyncToLocal` writes the sentinel. All callers (content-script, background, options, popup) updated to await. Test added: `storage.test.ts` "reads from local area when sentinel is set". |
| 8 | followup | `src/matcher/glob.ts:33` | Not fixed this phase. Added to `ROADMAP.md` Phase 2: bare `//` regex escape hatch should require length > 2. |

## Cleared (reviewer explicitly verified)

- Pure-core discipline: no `chrome.*` in `src/engine/` or `src/matcher/`.
- Type safety: no `any` leaks, no `@ts-ignore` / `@ts-expect-error` suppressions.
- Shared `g`-flag regex state: `OPEN_WHEN_G`/`OPEN_EACH_G` `.lastIndex` reset on every caller entry; recursive `render → renderBlocks` is safe.

## Withdrawn by reviewer on second look

- (#3) Options preview iframe — `srcdoc` receives already-sanitized HTML, no double-application needed.
- (#5) Templates-tab listener duplication — tab switch toggles `.hidden` only, doesn't re-invoke `renderTemplatesTab()`.
- (#6) `findElseAtDepth0` regex state pollution — cleared after tracing `.lastIndex` resets.
