/**
 * Derive a usable template name from a host — lowercase, alnum/dash only.
 * Empty or entirely-punctuation hosts fall back to "new-template".
 */
export function suggestTemplateName(host: string): string {
  const slug = host
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'new-template';
}

/**
 * Given a base name and a set of taken names, return the base if available or
 * `base-2`, `base-3`, … otherwise. Accepts either the templates record or any
 * object keyed by taken name.
 */
export function uniqueTemplateName(base: string, taken: Record<string, unknown>): string {
  if (taken[base] === undefined) return base;
  let n = 2;
  while (taken[`${base}-${n}`] !== undefined) n++;
  return `${base}-${n}`;
}
