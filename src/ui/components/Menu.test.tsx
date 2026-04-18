import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { Menu } from './Menu';

describe('<Menu>', () => {
  it('renders trigger and opens on click', () => {
    render(
      <Menu trigger={<button>⋯</button>} items={[{ label: 'Copy', onSelect: () => {} }]} />,
    );
    expect(screen.queryByText('Copy')).toBeNull();
    fireEvent.click(screen.getByText('⋯'));
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('invokes onSelect and closes', () => {
    const onSelect = vi.fn();
    render(<Menu trigger={<button>⋯</button>} items={[{ label: 'Copy', onSelect }]} />);
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByText('Copy'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByText('Copy')).toBeNull();
  });

  it('closes on Escape', () => {
    render(
      <Menu trigger={<button>⋯</button>} items={[{ label: 'Copy', onSelect: () => {} }]} />,
    );
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Copy')).toBeNull();
  });

  it('closes on outside click', () => {
    render(
      <div>
        <Menu trigger={<button>⋯</button>} items={[{ label: 'Copy', onSelect: () => {} }]} />
        <div>outside</div>
      </div>,
    );
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByText('outside'));
    expect(screen.queryByText('Copy')).toBeNull();
  });
});
