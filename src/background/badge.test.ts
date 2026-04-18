import { describe, it, expect } from 'vitest';
import { appearanceFor } from './badge';

describe('appearanceFor', () => {
  it('renders a green checkmark for successful template rendering', () => {
    expect(appearanceFor('pj:rendered')).toEqual({ text: '✓', color: '#16a34a' });
  });

  it('renders a red bang for template render errors', () => {
    expect(appearanceFor('pj:render-error')).toEqual({ text: '!', color: '#dc2626' });
  });
});
