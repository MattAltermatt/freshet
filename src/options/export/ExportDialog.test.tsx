import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportDialog } from './ExportDialog';

describe('ExportDialog', () => {
  const base = {
    rules: [
      {
        id: 'r1',
        name: 'only rule',
        hostPattern: 'a',
        pathPattern: 'b',
        templateName: 't1',
        variables: {},
        active: true,
      },
    ],
    templates: { t1: 'x' },
    sampleJson: {},
    appVersion: '1.0.0',
    onClose: (): void => {},
  };

  it('opens on picker step and advances on Next', () => {
    render(<ExportDialog {...base} />);
    expect(screen.getByRole('heading', { name: /pick/i })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/only rule/));
    fireEvent.click(screen.getByRole('button', { name: /next: scrub/i }));
    expect(screen.getByRole('heading', { name: /scrub/i })).toBeTruthy();
    // Output merged into scrub → Download button lives here.
    expect(screen.getByRole('button', { name: /download/i })).toBeTruthy();
  });
});
