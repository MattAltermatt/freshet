import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ConflictSection } from './ConflictSection';

const knownEntry = {
  viewer: 'jsonview' as const,
  displayName: 'JSONView',
  extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
  detectedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
};

const unknownEntry = {
  viewer: 'unknown' as const,
  displayName: 'Another JSON viewer',
  extensionId: null,
  detectedAt: new Date().toISOString(),
};

describe('ConflictSection', () => {
  it('shows displayName and targeted disable link for a known viewer', () => {
    render(
      <ConflictSection
        host="api.github.com"
        entry={knownEntry}
        onDismiss={() => {}}
        onSkipHost={() => {}}
      />,
    );
    expect(screen.getByText(/JSONView is formatting/)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Open JSONView settings/i });
    expect(link.getAttribute('href')).toBe(
      'chrome://extensions/?id=gmegofmjomhknnokphhckolhcffdaihd',
    );
  });

  it('shows generic copy + hint for an unknown viewer', () => {
    render(
      <ConflictSection
        host="api.x.com"
        entry={unknownEntry}
        onDismiss={() => {}}
        onSkipHost={() => {}}
      />,
    );
    expect(screen.getByText(/Another JSON viewer is formatting/i)).toBeTruthy();
    expect(screen.getByText(/Look for an extension/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Open Chrome extensions/i });
    expect(link.getAttribute('href')).toBe('chrome://extensions/');
  });

  it('fires onDismiss and onSkipHost', () => {
    const onDismiss = vi.fn();
    const onSkipHost = vi.fn();
    render(
      <ConflictSection
        host="x"
        entry={knownEntry}
        onDismiss={onDismiss}
        onSkipHost={onSkipHost}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Skip this host/i }));
    expect(onDismiss).toHaveBeenCalled();
    expect(onSkipHost).toHaveBeenCalled();
  });

  it('renders a relative-time label', () => {
    render(
      <ConflictSection
        host="x"
        entry={knownEntry}
        onDismiss={() => {}}
        onSkipHost={() => {}}
      />,
    );
    expect(screen.getByText(/min ago/i)).toBeTruthy();
  });
});
