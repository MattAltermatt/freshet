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

  it('closes on outside click when mounted inside a shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    const outside = document.createElement('div');
    outside.textContent = 'outside-shadow';
    shadow.appendChild(outside);

    render(
      <Menu trigger={<button>open</button>} items={[{ label: 'Copy', onSelect: () => {} }]} />,
      { container: mount },
    );
    const triggerButton = mount.querySelector('button') as HTMLButtonElement;
    fireEvent.click(triggerButton);
    expect(mount.querySelector('.pj-menu-list')).not.toBeNull();

    // Click a sibling inside the shadow — should bubble to the shadow root listener and close.
    fireEvent.click(outside);
    expect(mount.querySelector('.pj-menu-list')).toBeNull();

    // Plain-document Menu path is unaffected — verified by the existing "closes on outside click" test.
  });
});
