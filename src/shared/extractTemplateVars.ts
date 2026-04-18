const VARS_REF = /\bvars\.([a-zA-Z_][\w]*)/g;

/**
 * Static scan for `vars.X` references in a Liquid template body. Returns the
 * unique var names sorted alphabetically.
 *
 * Known limitation: only dot-access is detected. Bracket access
 * (`vars['foo']`) and references inside string literals may be missed or
 * falsely detected. Accurate enough to guide the rule-editor's Variables UI
 * without building a full parser.
 */
export function extractTemplateVars(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(VARS_REF)) {
    out.add(m[1]!);
  }
  return [...out].sort();
}
