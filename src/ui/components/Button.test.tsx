import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Button } from './Button';

describe('<Button>', () => {
  it('renders children', () => {
    const { getByRole } = render(<Button>Save</Button>);
    expect(getByRole('button').textContent).toBe('Save');
  });

  it('applies variant data attribute', () => {
    const { getByRole } = render(<Button variant="primary">Primary</Button>);
    expect(getByRole('button').getAttribute('data-variant')).toBe('primary');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    const { getByRole } = render(<Button disabled onClick={onClick}>Click</Button>);
    fireEvent.click(getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
