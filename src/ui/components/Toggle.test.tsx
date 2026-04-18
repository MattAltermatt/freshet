import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Toggle } from './Toggle';

describe('<Toggle>', () => {
  it('renders with given label', () => {
    const { getByLabelText } = render(<Toggle label="Enable X" checked={false} onChange={() => {}} />);
    expect(getByLabelText('Enable X')).toBeDefined();
  });

  it('reflects checked state via aria-checked', () => {
    const { getByRole } = render(<Toggle label="x" checked={true} onChange={() => {}} />);
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('calls onChange(true) when off → on', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Toggle label="x" checked={false} onChange={onChange} />);
    fireEvent.click(getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange(false) when on → off', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Toggle label="x" checked={true} onChange={onChange} />);
    fireEvent.click(getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
