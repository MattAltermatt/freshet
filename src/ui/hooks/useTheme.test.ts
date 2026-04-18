import { describe, it, expect } from 'vitest';
import { resolveTheme, applyTheme } from '../theme';

describe('resolveTheme', () => {
  it('returns light when preference is light regardless of matcher', () => {
    expect(resolveTheme('light', { matches: true })).toBe('light');
    expect(resolveTheme('light', { matches: false })).toBe('light');
  });

  it('returns dark when preference is dark regardless of matcher', () => {
    expect(resolveTheme('dark', { matches: true })).toBe('dark');
    expect(resolveTheme('dark', { matches: false })).toBe('dark');
  });

  it('returns matcher result when preference is system', () => {
    expect(resolveTheme('system', { matches: true })).toBe('dark');
    expect(resolveTheme('system', { matches: false })).toBe('light');
  });
});

describe('applyTheme', () => {
  it('sets data-theme attribute on the provided root', () => {
    const root = document.createElement('div');
    applyTheme('dark', root);
    expect(root.getAttribute('data-theme')).toBe('dark');
    applyTheme('light', root);
    expect(root.getAttribute('data-theme')).toBe('light');
  });
});
