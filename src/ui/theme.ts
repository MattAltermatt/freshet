export type Theme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Resolve a preference into the actual theme by consulting matchMedia when preference is 'system'. */
export function resolveTheme(
  preference: ThemePreference,
  matcher: Pick<MediaQueryList, 'matches'> = window.matchMedia('(prefers-color-scheme: dark)'),
): Theme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return matcher.matches ? 'dark' : 'light';
}

/** Apply the resolved theme to the DOM by setting data-theme on the root element. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', theme);
}
