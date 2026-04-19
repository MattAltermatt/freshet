import { describe, it, expect } from 'vitest';
import { render } from '../engine/engine';
import fs from 'node:fs';
import path from 'node:path';

process.env.TZ = 'UTC';

const templatePath = path.resolve(__dirname, './incident-detail.html');
const samplePath = path.resolve(__dirname, './incident-detail.sample.json');
const template = fs.readFileSync(templatePath, 'utf8');
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

describe('incident-detail starter template', () => {
  const html = render(template, sample, {});

  it('renders the incident ID and title', () => {
    expect(html).toContain('INC-2026-001');
    expect(html).toContain('Elevated 5xx on /charge');
  });

  it('renders breadcrumb back to the service JSON', () => {
    expect(html).toContain('href="https://mattaltermatt.github.io/freshet/examples/services/payments.json"');
  });

  it('renders severity + status chips with the right classes', () => {
    expect(html).toContain('inc__chip--sev-2');
    expect(html).toContain('inc__chip--status-monitoring');
  });

  it('renders the impact + summary cards', () => {
    expect(html).toContain('Redis rate-limiter cluster CPU climbed past 92%');
    expect(html).toContain('0.4% of /charge requests returning 503');
  });

  it('iterates the timeline with kind-specific classes', () => {
    expect(html).toContain('inc__event--alert');
    expect(html).toContain('inc__event--ack');
    expect(html).toContain('inc__event--update');
    expect(html).toContain('inc__event--deploy');
    expect(html).toContain('alertmanager');
    expect(html).toContain('deploybot');
  });

  it('formats event times to HH:mm', () => {
    expect(html).toContain('14:22');
    expect(html).toContain('14:51');
  });

  it('hides the resolved chip when resolvedAt is null', () => {
    expect(html).not.toContain('resolved Apr');
    expect(html).not.toContain('resolved 04');
  });

  it('shows resolved chip when resolvedAt is set', () => {
    const resolved = render(template, { ...sample, resolvedAt: '2026-04-18T15:21:00Z' }, {});
    expect(resolved).toContain('resolved Apr 18, 2026');
  });

  it('renders related incidents section when present', () => {
    expect(html).toContain('Related incidents');
    expect(html).toContain('INC-2026-000');
  });

  it('hides related incidents section when empty', () => {
    const noRelated = render(template, { ...sample, relatedIncidents: [] }, {});
    expect(noRelated).not.toContain('Related incidents');
  });
});
