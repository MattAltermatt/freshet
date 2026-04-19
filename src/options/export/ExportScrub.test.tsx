import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportScrub } from './ExportScrub';
import type { FreshetBundle } from '../../bundle/schema';

const mkBundle = (rules: FreshetBundle['rules'], templates: FreshetBundle['templates']): FreshetBundle => ({
  bundleSchemaVersion: 1,
  exportedAt: '2026-04-19T00:00:00Z',
  appVersion: '1.0.0',
  templates,
  rules,
});

describe('ExportScrub', () => {
  beforeEach(() => {
    if (!URL.createObjectURL) {
      (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob://x';
    }
    if (!URL.revokeObjectURL) {
      (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('groups repeated matches into a single flag row with a count', () => {
    const sampleJson = JSON.stringify({
      timeline: [
        { author: 'a' },
        { author: 'b' },
        { author: 'c' },
      ],
    });
    const rules = [
      { id: 'r1', hostPattern: 'a', pathPattern: 'b', templateName: 't', variables: {}, active: true },
    ];
    const bundle = mkBundle(
      [{ id: 'r1', hostPattern: 'a', pathPattern: 'b', templateName: 't', active: true }],
      [{ name: 't', source: 'x', sampleJson }],
    );
    render(
      <ExportScrub
        rules={rules}
        templateNames={['t']}
        sampleJson={{ t: sampleJson }}
        stripSampleJson={new Set()}
        stripVariables={new Set()}
        onToggleStripSampleJson={() => {}}
        onToggleStripVariables={() => {}}
        bundle={bundle}
        onBack={() => {}}
        onDone={() => {}}
      />,
    );
    // Single row with ×3 count rather than 3 repeated rows.
    expect(screen.getByText('×3')).toBeTruthy();
  });

  it('fires onToggleStripVariables when the strip toggle is clicked', () => {
    const onToggle = vi.fn();
    const rules = [
      { id: 'r1', hostPattern: 'a', pathPattern: 'b', templateName: 't', variables: { env: 'qa' }, active: true },
    ];
    const bundle = mkBundle(
      [{ id: 'r1', hostPattern: 'a', pathPattern: 'b', templateName: 't', variables: { env: 'qa' }, active: true }],
      [{ name: 't', source: 'x' }],
    );
    render(
      <ExportScrub
        rules={rules}
        templateNames={['t']}
        sampleJson={{}}
        stripSampleJson={new Set()}
        stripVariables={new Set()}
        onToggleStripSampleJson={() => {}}
        onToggleStripVariables={onToggle}
        bundle={bundle}
        onBack={() => {}}
        onDone={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText(/strip variables for r1/i));
    expect(onToggle).toHaveBeenCalledWith('r1');
  });

  it('download button generates a blob with the bundle JSON', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const bundle = mkBundle([], []);
    render(
      <ExportScrub
        rules={[]}
        templateNames={[]}
        sampleJson={{}}
        stripSampleJson={new Set()}
        stripVariables={new Set()}
        onToggleStripSampleJson={() => {}}
        onToggleStripVariables={() => {}}
        bundle={bundle}
        onBack={() => {}}
        onDone={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(createSpy).toHaveBeenCalled();
  });
});
