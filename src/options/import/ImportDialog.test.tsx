import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { ImportDialog } from './ImportDialog';

describe('ImportDialog', () => {
  it('opens on input step', () => {
    render(
      <ImportDialog
        existingRules={[]}
        existingTemplates={{}}
        onCommit={async () => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /import a bundle/i })).toBeTruthy();
  });
});
