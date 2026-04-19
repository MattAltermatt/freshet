import { describe, it, expect } from 'vitest';
import { render } from '../engine/engine';
import fs from 'node:fs';
import path from 'node:path';

process.env.TZ = 'UTC';

const templatePath = path.resolve(__dirname, './service-health.html');
const samplePath = path.resolve(__dirname, './service-health.sample.json');
const template = fs.readFileSync(templatePath, 'utf8');
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

describe('service-health starter template', () => {
  const html = render(template, sample, { env: 'production' });

  it('renders the env chip from rule vars', () => {
    expect(html).toContain('data-env="production"');
    expect(html).toContain('>production</span>');
  });

  it('renders the service name in the header', () => {
    expect(html).toContain('>Payments</h1>');
  });

  it('renders the degraded status pill with the correct class', () => {
    expect(html).toContain('sh__status--degraded');
    expect(html).toContain('Degraded performance');
  });

  it('formats uptime with the % unit', () => {
    expect(html).toContain('99.92');
    expect(html).toContain('%</span>');
  });

  it('iterates dependencies and applies per-status classes', () => {
    expect(html).toContain('sh__dep--operational');
    expect(html).toContain('sh__dep--degraded');
    expect(html).toContain('Postgres (primary)');
    expect(html).toContain('Redis (rate-limit)');
  });

  it('renders recent incidents as anchor links to incident JSONs', () => {
    expect(html).toContain('href="https://mattaltermatt.github.io/freshet/examples/incidents/INC-2026-001.json"');
    expect(html).toContain('Elevated 5xx on /charge');
  });

  it('shows "● Open" for unresolved incidents and "Resolved …" for resolved', () => {
    expect(html).toContain('● Open');
    expect(html).toContain('Resolved 04/11');
  });

  it('falls back to "live" when vars.env is unset', () => {
    const noEnv = render(template, sample, {});
    expect(noEnv).toContain('>live</span>');
  });

  it('renders all bottom links (runbook, dashboard, repo)', () => {
    expect(html).toContain('href="https://runbooks.example.com/payments"');
    expect(html).toContain('href="https://grafana.example.com/d/payments-overview"');
    expect(html).toContain('href="https://github.com/example/payments-service"');
  });
});
