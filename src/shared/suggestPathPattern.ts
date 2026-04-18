/**
 * Given a URL pathname, propose a glob pattern suitable for a new rule.
 * Root pathnames stay as `/`. Deeper pathnames collapse to the first one or
 * two segments plus `/**` so the rule catches sibling pages users are likely
 * to visit next, not just the exact page they're on.
 */
export function suggestPathPattern(pathname: string): string {
  const segments = pathname.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return '/';
  const head = segments.slice(0, 2).join('/');
  return `/${head}/**`;
}
