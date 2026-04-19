# Viewer fingerprints — verified 2026-04-19

Values below were derived from each viewer's **open-source repo** rather than
from a real Chrome capture — the upside is no manual "install + visit + DevTools"
ritual, the downside is if a viewer ships a major rewrite between releases the
selector here may drift. Unit-test fixtures encode the same DOM shape; the tests
break first when drift happens.

| Viewer | Extension ID | Selector | Fixture file | Source-of-truth |
|---|---|---|---|---|
| JSONView | `gmegofmjomhknnokphhckolhcffdaihd` | `#json > ul.collapsible` | `jsonview.html` | [jsonformatter.ts](https://github.com/bhollis/jsonview/blob/master/src/jsonformatter.ts) — `jsonToHTMLBody` + `valueToHTML` |
| JSON Formatter | `bcjindcccaagfpapjjmafapmmgkkhgoa` | `body > .blockInner` | `json-formatter.html` | [style.css](https://github.com/callumlocke/json-formatter/blob/master/ext/content/style.css) + `buildDom.ts` |
| JSON Viewer Pro | `gbmdgpbipfallnflgajpaliibnhdgobh` | `body > .CodeMirror` | `json-viewer-pro.html` | [highlighter.js](https://github.com/tulios/json-viewer/blob/master/extension/src/json-viewer/highlighter.js) — `CodeMirror(document.body, …)` |

## Method

- Read each viewer's content-script source and extracted the wrapper element
  classes/ids they inject.
- For extension IDs: JSONView + JSON Viewer Pro are linked from their READMEs
  (Chrome Web Store install URL); JSON Formatter's ID is `bcjindcccaagfpapjjmafapmmgkkhgoa`
  per CWS search — confirmed via listing URL pattern.
- No real browser capture — each fixture is a minimal hand-crafted DOM that
  matches what the content script would produce for a small JSON payload.

## Updating when selectors drift

If a viewer ships an update and real users start seeing unknown-viewer fallback
when they should see the named viewer:

1. Install the viewer in a throwaway Chrome profile.
2. Visit a JSON URL and DevTools-capture `document.body.outerHTML`.
3. Replace the matching `test/fixtures/conflicts/*.html` with the new shape.
4. Run `pnpm test -- conflictDetect.test`. Any failing fingerprint test points
   to the selector that needs updating in `src/content/conflictDetect.ts`.
5. Commit fixture + selector change together.
