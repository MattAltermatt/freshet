import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import type { Rule } from '../../shared/types';
import { RuleCard } from './RuleCard';

const rule: Rule = {
  id: 'r1',
  hostPattern: 'api.example.com',
  pathPattern: '/users/**',
  templateName: 'user-details',
  variables: { env: 'prod', region: 'us' },
  enabled: true,
};

function renderCard(overrides: Partial<Parameters<typeof RuleCard>[0]> = {}) {
  return render(
    <RuleCard
      rule={rule}
      index={0}
      total={3}
      onToggle={() => {}}
      onEdit={() => {}}
      onMoveUp={() => {}}
      onMoveDown={() => {}}
      onDelete={() => {}}
      {...overrides}
    />,
  );
}

describe('<RuleCard>', () => {
  it('shows order badge, pattern, template chip, var count', () => {
    renderCard();
    expect(screen.getByLabelText('Rule 1')).toBeInTheDocument();
    expect(screen.getByText(/api\.example\.com/)).toBeInTheDocument();
    expect(screen.getByText('user-details')).toBeInTheDocument();
    expect(screen.getByText('2 vars')).toBeInTheDocument();
  });

  it('disables ▲ on first row, ▼ on last row', () => {
    const { rerender } = renderCard();
    expect(screen.getByLabelText('move up')).toBeDisabled();
    rerender(
      <RuleCard
        rule={rule}
        index={2}
        total={3}
        onToggle={() => {}}
        onEdit={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByLabelText('move down')).toBeDisabled();
  });

  it('fires onEdit only when clicking the body (not the controls)', () => {
    const onEdit = vi.fn();
    renderCard({ onEdit });
    fireEvent.click(screen.getByText('user-details'));
    expect(onEdit).toHaveBeenCalledOnce();
    onEdit.mockClear();
    fireEvent.click(screen.getByLabelText('move up'));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('renders a disabled-state class when rule.enabled=false', () => {
    const { container } = renderCard({ rule: { ...rule, enabled: false } });
    expect(container.querySelector('.pj-rule-card--disabled')).toBeTruthy();
  });

  it('renders an Example pill when rule.isExample=true', () => {
    renderCard({ rule: { ...rule, isExample: true } });
    expect(screen.getByText('Example')).toBeInTheDocument();
  });

  it('does not render an Example pill on user-created rules', () => {
    renderCard();
    expect(screen.queryByText('Example')).not.toBeInTheDocument();
  });

  it('renders the Example pill as a link when exampleUrl is set', () => {
    renderCard({
      rule: { ...rule, isExample: true, exampleUrl: 'https://api.example.com/users/1' },
    });
    const link = screen.getByText('Example').closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'https://api.example.com/users/1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the Example pill as a non-link span when exampleUrl is missing', () => {
    renderCard({ rule: { ...rule, isExample: true } });
    expect(screen.getByText('Example').closest('a')).toBeNull();
  });
});
