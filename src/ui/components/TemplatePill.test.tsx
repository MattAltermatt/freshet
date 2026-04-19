import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { TemplatePill } from './TemplatePill';

describe('TemplatePill', () => {
  it('renders the name wrapped in brand brackets', () => {
    render(<TemplatePill name="github-repo" />);
    expect(screen.getByText('github-repo')).toBeTruthy();
    expect(screen.getByTitle(/Template: github-repo/)).toBeTruthy();
  });

  it('renders as a button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<TemplatePill name="x" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders as a span when onClick is not provided', () => {
    render(<TemplatePill name="x" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
