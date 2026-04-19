import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ImportInput } from './ImportInput';

const validJSON = JSON.stringify({
  bundleSchemaVersion: 1,
  exportedAt: '2026-04-19',
  appVersion: '1.0.0',
  templates: [{ name: 't', source: 'x' }],
  rules: [],
});

describe('ImportInput', () => {
  it('parses the pasted JSON and fires onParsed', () => {
    const onParsed = vi.fn();
    render(<ImportInput onCancel={() => {}} onParsed={onParsed} />);
    const ta = screen.getByPlaceholderText(/paste/i) as HTMLTextAreaElement;
    fireEvent.input(ta, { target: { value: validJSON } });
    fireEvent.click(screen.getByRole('button', { name: /next: review/i }));
    expect(onParsed).toHaveBeenCalled();
  });

  it('renders parse errors inline without calling onParsed', () => {
    const onParsed = vi.fn();
    render(<ImportInput onCancel={() => {}} onParsed={onParsed} />);
    const ta = screen.getByPlaceholderText(/paste/i) as HTMLTextAreaElement;
    fireEvent.input(ta, { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: /next: review/i }));
    expect(onParsed).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('surfaces all three input methods (drop zone, file button, paste label)', () => {
    render(<ImportInput onCancel={() => {}} onParsed={() => {}} />);
    expect(screen.getByText(/drop a/i)).toBeTruthy();
    expect(screen.getAllByText(/choose file/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/or paste bundle json/i)).toBeTruthy();
  });
});
