import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportScrub } from './ExportScrub';

describe('ExportScrub', () => {
  it('shows sniff flag inline under the rule variables row', () => {
    const rules = [
      {
        id: 'r1',
        hostPattern: 'a',
        pathPattern: 'b',
        templateName: 't',
        variables: { auth_token: 'abc' },
        active: true,
      },
    ];
    render(
      <ExportScrub
        rules={rules}
        templateNames={['t']}
        sampleJson={{ t: '{}' }}
        stripSampleJson={new Set()}
        stripVariables={new Set()}
        onToggleStripSampleJson={() => {}}
        onToggleStripVariables={() => {}}
        onBack={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByText(/Matched/i)).toBeTruthy();
    expect(screen.getAllByText(/auth_token/).length).toBeGreaterThan(0);
  });

  it('fires onToggleStripVariables when the strip toggle is clicked', () => {
    const onToggle = vi.fn();
    const rules = [
      { id: 'r1', hostPattern: 'a', pathPattern: 'b', templateName: 't', variables: { env: 'qa' }, active: true },
    ];
    render(
      <ExportScrub
        rules={rules}
        templateNames={['t']}
        sampleJson={{}}
        stripSampleJson={new Set()}
        stripVariables={new Set()}
        onToggleStripSampleJson={() => {}}
        onToggleStripVariables={onToggle}
        onBack={() => {}}
        onNext={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText(/strip variables for r1/i));
    expect(onToggle).toHaveBeenCalledWith('r1');
  });
});
