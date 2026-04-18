import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { Cheatsheet } from './Cheatsheet';

describe('<Cheatsheet>', () => {
  it('collapses by default and expands on click', () => {
    render(<Cheatsheet />);
    expect(screen.queryByText(/interpolation/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /cheatsheet/i }));
    expect(screen.getByText(/interpolation/i)).toBeInTheDocument();
  });

  it('renders Liquid snippets when open', () => {
    render(<Cheatsheet defaultOpen />);
    expect(screen.getByText(/\{\{ path\.to\.value \}\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{% if status == "ok" %\}/)).toBeInTheDocument();
    expect(screen.getByText(/\{% for item in items %\}/)).toBeInTheDocument();
    expect(screen.getByText(/\| date:/)).toBeInTheDocument();
  });

  it('toggles aria-expanded', () => {
    render(<Cheatsheet />);
    const btn = screen.getByRole('button', { name: /cheatsheet/i });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });
});
