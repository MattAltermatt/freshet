import '@testing-library/jest-dom/vitest';

// jsdom doesn't ship `matchMedia`. Stub a stable, never-matches MediaQueryList
// so components that probe for `prefers-color-scheme` (e.g. resolveTheme) don't
// throw in tests. Real browser code paths still get the real API.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
