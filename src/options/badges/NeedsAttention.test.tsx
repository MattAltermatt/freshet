import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { NeedsAttention } from './NeedsAttention';

describe('NeedsAttention', () => {
  const entry = {
    source: 'append' as const,
    importedAt: '2026-04-19T00:00:00Z',
    flags: [{ field: 'variables.auth', pattern: '/token/i', matchedText: 'abc' }],
  };

  it('renders the literal pattern + field + matched text when expanded', () => {
    render(<NeedsAttention entry={entry} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /needs attention/i }));
    expect(screen.getByText(/\/token\/i/)).toBeTruthy();
    expect(screen.getByText(/variables\.auth/)).toBeTruthy();
    expect(screen.getByText(/abc/)).toBeTruthy();
  });

  it('fires onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<NeedsAttention entry={entry} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /needs attention/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
