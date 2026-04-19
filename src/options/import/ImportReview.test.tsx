import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { ImportReview } from './ImportReview';
import type { FreshetBundle } from '../../bundle/schema';

const bundle: FreshetBundle = {
  bundleSchemaVersion: 1,
  exportedAt: 'x',
  appVersion: '1',
  templates: [{ name: 'foo', source: 'x' }],
  rules: [],
};

describe('ImportReview', () => {
  it('surfaces a template collision row when the name already exists', () => {
    render(
      <ImportReview
        bundle={bundle}
        hits={[]}
        existingRules={[]}
        existingTemplates={{ foo: 'x' }}
        onBack={() => {}}
        onCommit={() => {}}
      />,
    );
    expect(screen.getByText(/Rename to foo-2/)).toBeTruthy();
  });
});
