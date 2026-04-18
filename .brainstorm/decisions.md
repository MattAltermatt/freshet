# Present-JSON — Brainstorm Decisions (working notes)

Rolling record of decisions and deferred items from the brainstorming session.
Will fold into the formal spec + ROADMAP.md when brainstorming closes.

## Decided

- **Product shape:** purpose-built Chrome extension (MV3). Not a Tampermonkey userscript.
- **Interception model:** A — direct-navigation renderer. Content script on matching URLs reads the JSON from the page body, renders HTML in place. No network-response rewriting. No swappable abstraction — do A only.
- **Template is the HTML.** Templates are HTML + CSS + a safe helper syntax (Mustache/Handlebars-ish):
  `{{field.path}}`, `{{#when x "v"}}…{{/when}}`, `{{#each arr}}…{{/each}}`,
  `{{date x}}`, `{{link x "url-template"}}`. No arbitrary JS inside templates
  (safety + portability requirement).
- **Portability:** a template is a single text file. Shared templates render identically on
  a recipient's machine provided variables (adminHost, env, …) resolve there.
- **Variables are per-binding, not baked into templates.** Template references
  `{{adminHost}}`, `{{env}}`, etc.; the extension's matcher config supplies them.

## Roadmap reminders (to include when writing ROADMAP.md)

- **Scrub-before-share prompt.** When exporting/sharing a template, surface a
  visible reminder on screen to review the template for internal URLs, hostnames,
  customer names, example IDs, or other leakage before sending it to someone else.
  This is a UX requirement, not just documentation.

## Open / to decide

- Matcher rule shape (host pattern + path pattern + template + variables, ordered, first match wins).
- Host/path matching syntax (glob recommended; regex as escape hatch).
- QA vs prod flagging — recommendation: free-form per-rule variables, no hardcoded env flag.
- Testing strategy (unit for engine; E2E for extension).
- Storage + import/export format.
- Default starter templates shipped with the extension.
