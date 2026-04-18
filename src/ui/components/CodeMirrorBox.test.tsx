import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { CodeMirrorBox } from './CodeMirrorBox';

describe('<CodeMirrorBox>', () => {
  it('mounts and exposes initial value', () => {
    const { container } = render(<CodeMirrorBox value="hello" onChange={() => {}} />);
    expect(container.querySelector('.cm-editor')).toBeTruthy();
    expect(container.querySelector('.cm-content')?.textContent).toContain('hello');
  });

  it('updates internal doc when value prop changes', () => {
    const { container, rerender } = render(
      <CodeMirrorBox value="a" onChange={() => {}} />,
    );
    rerender(<CodeMirrorBox value="b" onChange={() => {}} />);
    expect(container.querySelector('.cm-content')?.textContent).toContain('b');
  });

  it('does not call onChange when prop changes (only user typing)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CodeMirrorBox value="x" onChange={onChange} />);
    onChange.mockClear();
    rerender(<CodeMirrorBox value="y" onChange={onChange} />);
    // Prop-driven update should not fire onChange.
    expect(onChange).not.toHaveBeenCalled();
  });
});
