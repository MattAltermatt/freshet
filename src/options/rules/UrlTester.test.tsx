import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/preact';
import type { Rule } from '../../shared/types';
import { UrlTester } from './UrlTester';

function r(id: string, host: string, path = '/**', enabled = true): Rule {
  return { id, hostPattern: host, pathPattern: path, templateName: 't', variables: {}, enabled };
}

function typeUrl(url: string): void {
  const input = screen.getByPlaceholderText(/paste any url/i);
  fireEvent.input(input, { target: { value: url } });
}

describe('<UrlTester>', () => {
  it('marks the winning rule as match and a later matching rule as shadowed', () => {
    render(<UrlTester rules={[r('a', '*.api.com'), r('b', '*.api.com')]} />);
    typeUrl('https://foo.api.com/v2/users');
    const results = screen.getAllByRole('listitem');
    expect(within(results[0]!).getByText('matches')).toBeInTheDocument();
    expect(within(results[1]!).getByText(/shadowed/i)).toBeInTheDocument();
  });

  it("reports host miss when URL host doesn't match", () => {
    render(<UrlTester rules={[r('a', '127.0.0.1')]} />);
    typeUrl('https://api.example.com/');
    expect(screen.getByText(/host doesn't match/i)).toBeInTheDocument();
  });

  it('treats disabled rules as disabled, not miss', () => {
    render(<UrlTester rules={[r('a', '*.api.com', '/**', false)]} />);
    typeUrl('https://foo.api.com/');
    const results = screen.getAllByRole('listitem');
    expect(within(results[0]!).getByText(/^disabled$/i)).toBeInTheDocument();
  });

  it('idle with no URL input', () => {
    const { container } = render(<UrlTester rules={[r('a', '*.api.com')]} />);
    const states = Array.from(container.querySelectorAll('.pj-url-result'))
      .map((el) => (el as HTMLElement).dataset['state']);
    expect(states).toEqual(['idle']);
  });

  it('clicking a chip fills the URL input', () => {
    render(<UrlTester rules={[r('a', '127.0.0.1')]} />);
    fireEvent.click(screen.getByText(/127\.0\.0\.1:4391/));
    const input = screen.getByPlaceholderText(/paste any url/i) as HTMLInputElement;
    expect(input.value).toContain('127.0.0.1:4391');
  });

  it('clear button empties the input and hides itself', () => {
    render(<UrlTester rules={[r('a', '*.api.com')]} />);
    typeUrl('https://foo.api.com/');
    const clear = screen.getByLabelText(/clear url/i);
    fireEvent.click(clear);
    const input = screen.getByPlaceholderText(/paste any url/i) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByLabelText(/clear url/i)).toBeNull();
  });
});
