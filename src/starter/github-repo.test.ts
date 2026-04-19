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

  it('compacts numeric stats via num filter', () => {
    expect(html).toContain('235k');
    expect(html).toContain('48k');
    expect(html).toContain('6.7k');
    expect(html).toContain('825');
  });

  it('formats ISO dates via date filter', () => {
    expect(html).toContain('2013-05-24');
    expect(html).toContain('2026-04-15');
  });

  it('renders nested license and owner fields', () => {
    expect(html).toContain('MIT');
    expect(html).toContain('facebook avatar');
    expect(html).toContain('avatars.githubusercontent.com');
  });

  it('renders topic chips via {% for %}', () => {
    expect(html).toContain('>react</span>');
    expect(html).toContain('>javascript</span>');
    expect(html).toContain('>ui</span>');
  });

  it('shows the homepage link when present', () => {
    expect(html).toContain('https://react.dev');
  });

  it('hides the homepage block when absent (empty string)', () => {
    const noHome = render(template, { ...sampleJson, homepage: '' }, {});
    expect(noHome).not.toContain('class="gh__home"');
  });

  it('hides the license chip when license.spdx_id is absent', () => {
    const noLicense = render(template, { ...sampleJson, license: { name: '', spdx_id: '' } }, {});
    expect(noLicense).not.toContain('gh__chip--meta">⚖');
  });

  it('renders the Active chip with pulse when archived is false', () => {
    // Look for the rendered markup, not bare class names — the inline <style>
    // block mentions both --active and --archived in its rule definitions.
    expect(html).toContain('class="gh__chip gh__chip--active"');
    expect(html).toContain('gh__dot gh__dot--pulse');
    expect(html).not.toContain('class="gh__chip gh__chip--archived"');
  });

  it('renders the Archived chip when archived is true', () => {
    const archived = render(template, { ...sampleJson, archived: true }, {});
    expect(archived).toContain('class="gh__chip gh__chip--archived"');
    expect(archived).toContain('>Archived</span>');
    expect(archived).not.toContain('class="gh__chip gh__chip--active"');
  });

  it('renders a language chip with data-lang for color hooks', () => {
    expect(html).toContain('data-lang="JavaScript"');
    expect(html).toContain('class="gh__lang-dot"');
    expect(html).toContain('>JavaScript</span>');
  });

  it('hides topics section when topics is empty', () => {
    const noTopics = render(template, { ...sampleJson, topics: [] }, {});
    expect(noTopics).not.toContain('>Topics<');
  });

  it('builds canonical issue/pulls/releases/discussions URLs from full_name (URL-from-id demo)', () => {
    expect(html).toContain('href="https://github.com/facebook/react/issues"');
    expect(html).toContain('href="https://github.com/facebook/react/pulls"');
    expect(html).toContain('href="https://github.com/facebook/react/releases"');
    expect(html).toContain('href="https://github.com/facebook/react/discussions"');
  });
});
