import { describe, it, expect } from 'vitest';
import { render } from '../engine/engine';
import fs from 'node:fs';
import path from 'node:path';

process.env.TZ = 'UTC';

const templatePath = path.resolve(__dirname, './github-repo.html');

const sampleJson = {
  full_name: 'facebook/react',
  description: 'The library for web and native user interfaces.',
  html_url: 'https://github.com/facebook/react',
  homepage: 'https://react.dev',
  stargazers_count: 234567,
  forks_count: 47890,
  subscribers_count: 6700,
  open_issues_count: 825,
  language: 'JavaScript',
  license: { name: 'MIT License', spdx_id: 'MIT' },
  default_branch: 'main',
  created_at: '2013-05-24T16:15:54Z',
  pushed_at: '2026-04-15T23:00:00Z',
  topics: ['react', 'javascript', 'frontend', 'library', 'ui'],
  owner: {
    login: 'facebook',
    avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4',
  },
  archived: false,
};

describe('github-repo starter template', () => {
  const template = fs.readFileSync(templatePath, 'utf8');
  const html = render(template, sampleJson, {});

  it('renders the repo name and description', () => {
    expect(html).toContain('facebook/react');
    expect(html).toContain('The library for web and native user interfaces.');
  });

  it('compacts numeric stats via {{num}}', () => {
    expect(html).toContain('235k');
    expect(html).toContain('48k');
    expect(html).toContain('6.7k');
    expect(html).toContain('825');
  });

  it('formats ISO dates via {{date}}', () => {
    expect(html).toContain('2013-05-24');
    expect(html).toContain('2026-04-15');
  });

  it('renders nested license and owner fields', () => {
    expect(html).toContain('MIT License');
    expect(html).toContain('facebook avatar');
    expect(html).toContain('avatars.githubusercontent.com');
  });

  it('iterates topics via {{#each}}', () => {
    expect(html).toContain('>react<');
    expect(html).toContain('>javascript<');
    expect(html).toContain('>ui<');
  });

  it('shows the homepage link when present', () => {
    expect(html).toContain('https://react.dev');
  });

  it('hides the homepage block when absent (empty string)', () => {
    const noHome = render(template, { ...sampleJson, homepage: '' }, {});
    expect(noHome).not.toContain('<p class="pj-gh__home"');
  });

  it('hides the license row when license.name is absent', () => {
    const noLicense = render(template, { ...sampleJson, license: { name: '', spdx_id: '' } }, {});
    expect(noLicense).not.toContain('<dt>License</dt>');
  });

  it('renders the Active status pill when archived is false', () => {
    expect(html).toContain('pj-gh__status--active" role="status"');
    expect(html).toContain('>Active</div>');
    expect(html).not.toContain('pj-gh__status--archived" role="status"');
  });

  it('renders the Archived status pill when archived is true', () => {
    const archived = render(template, { ...sampleJson, archived: true }, {});
    expect(archived).toContain('pj-gh__status--archived" role="status"');
    expect(archived).toContain('Archived — read-only');
    expect(archived).not.toContain('pj-gh__status--active" role="status"');
  });
});
