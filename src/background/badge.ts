export type BadgeSignal = 'pj:rendered' | 'pj:render-error' | 'pj:conflict';

export interface BadgeAppearance {
  text: string;
  color: string;
}

// Green / red picked to read clearly on both light and dark system themes.
// Kept outside theme.css because badges don't inherit page CSS.
const SUCCESS_COLOR = '#16a34a';
const ERROR_COLOR = '#dc2626';
// --pj-accent-strong — warm/attentional, not error-red. Signals "Freshet
// chose not to act here," not "something broke."
const CONFLICT_COLOR = '#c2410c';

/**
 * Pure lookup from message kind to the badge appearance the background SW
 * should paint. Kept side-effect-free so tests don't need a chrome.action stub.
 */
export function appearanceFor(signal: BadgeSignal): BadgeAppearance {
  if (signal === 'pj:rendered') return { text: '✓', color: SUCCESS_COLOR };
  if (signal === 'pj:conflict') return { text: '⚠', color: CONFLICT_COLOR };
  return { text: '!', color: ERROR_COLOR };
}
