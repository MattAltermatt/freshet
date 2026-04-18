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
