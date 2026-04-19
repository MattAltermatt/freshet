import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExportOutput } from './ExportOutput';

const bundle = {
  bundleSchemaVersion: 1 as const,
  exportedAt: '2026-04-19T00:00:00Z',
  appVersion: '1.0.0',
  templates: [],
  rules: [],
};

describe('ExportOutput', () => {
  beforeEach(() => {
    // jsdom doesn't implement URL.createObjectURL — stub before spying
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

  it('builds a downloadable blob with the bundle JSON', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    render(<ExportOutput bundle={bundle} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(createSpy).toHaveBeenCalled();
  });

  it('copies the JSON to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ExportOutput bundle={bundle} onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalled();
    const arg = writeText.mock.calls[0][0];
    expect(JSON.parse(arg).bundleSchemaVersion).toBe(1);
  });
});
