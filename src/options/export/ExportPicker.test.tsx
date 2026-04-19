import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportPicker } from './ExportPicker';

const rules = [
  { id: 'r1', name: '[qa] one', hostPattern: 'a', pathPattern: 'x', templateName: 't1', variables: {}, active: true },
  { id: 'r2', name: '[prod] two', hostPattern: 'b', pathPattern: 'y', templateName: 't1', variables: {}, active: true },
  { id: 'r3', name: 'three', hostPattern: 'c', pathPattern: 'z', templateName: 't2', variables: {}, active: true },
];

describe('ExportPicker', () => {
  it('auto-pulls the template referenced by a selected rule', () => {
    const onNext = vi.fn();
    render(
      <ExportPicker rules={rules} templates={['t1', 't2']} onCancel={() => {}} onNext={onNext} />,
    );
    fireEvent.click(screen.getByLabelText(/\[qa\] one/));
    fireEvent.click(screen.getByRole('button', { name: /next: scrub/i }));
    expect(onNext).toHaveBeenCalledWith(['r1'], ['t1']);
  });

  it('filters rule list by substring match', () => {
    render(
      <ExportPicker rules={rules} templates={['t1', 't2']} onCancel={() => {}} onNext={() => {}} />,
    );
    fireEvent.input(screen.getByPlaceholderText(/filter/i), { target: { value: '[qa]' } });
    expect(screen.queryByLabelText(/\[prod\] two/)).toBeNull();
    expect(screen.getByLabelText(/\[qa\] one/)).toBeTruthy();
  });
});
