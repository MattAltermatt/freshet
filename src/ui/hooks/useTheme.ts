import { useEffect, useState } from 'preact/hooks';
import { applyTheme, resolveTheme, type Theme, type ThemePreference } from '../theme';

interface UseThemeOptions {
  preference: ThemePreference;
  onPreferenceChange?: (next: ThemePreference) => void;
  root?: HTMLElement;
}

interface UseThemeResult {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

/**
 * Reactive theme hook. Given a preference ('system' | 'light' | 'dark'), resolves the effective
 * theme, writes data-theme onto the root, and re-resolves on prefers-color-scheme changes.
 */
export function useTheme(options: UseThemeOptions): UseThemeResult {
  const { preference, onPreferenceChange, root } = options;
  const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(preference, mql ?? { matches: false }));

  useEffect(() => {
    const next = resolveTheme(preference, mql ?? { matches: false });
    setTheme(next);
    applyTheme(next, root);
  }, [preference, mql, root]);

  useEffect(() => {
    if (!mql || preference !== 'system') return;
    const handler = (event: MediaQueryListEvent) => {
      const next: Theme = event.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next, root);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mql, preference, root]);

  return {
    theme,
    preference,
    setPreference: (next) => onPreferenceChange?.(next),
  };
}
