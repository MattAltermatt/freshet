import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { KVEditor } from './KVEditor';

function Harness({ initial = { env: 'prod' } as Record<string, string> }): JSX.Element {
  const [v, setV] = useState<Record<string, string>>(initial);
  return (
    <div>
      <KVEditor value={v} onChange={setV} />
      <pre data-testid="state">{JSON.stringify(v)}</pre>
    </div>
  );
}

describe('<KVEditor>', () => {
  it('renders existing pairs', () => {
    render(<Harness />);
    expect(screen.getByDisplayValue('env')).toBeInTheDocument();
    expect(screen.getByDisplayValue('prod')).toBeInTheDocument();
  });

  it('adds a new blank pair on + click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('+ Add variable'));
    const keys = screen.getAllByPlaceholderText('key');
    expect(keys).toHaveLength(2);
  });

  it('removes pair on × click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('remove env'));
    expect(screen.queryByDisplayValue('env')).toBeNull();
  });

  it('shows duplicate-key error when two keys collide', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('+ Add variable'));
    const keys = screen.getAllByPlaceholderText('key') as HTMLInputElement[];
    fireEvent.input(keys[1]!, { target: { value: 'env' } });
    expect(screen.getAllByText(/duplicate key/i)).toHaveLength(2);
  });

  it('propagates edits through onChange', () => {
    render(<Harness initial={{ a: '1' }} />);
    const valueInput = screen.getByDisplayValue('1');
    fireEvent.input(valueInput, { target: { value: '2' } });
    expect(screen.getByTestId('state').textContent).toBe('{"a":"2"}');
  });
});
