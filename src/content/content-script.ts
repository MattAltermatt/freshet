import { render as renderTemplate } from '../engine/engine';
import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
import { mountTopStrip } from './mountTopStrip';
import type { Rule } from '../shared/types';

async function main(): Promise<void> {
  const rawText = document.body?.innerText;
  if (!rawText) return;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return;
  }

  await promoteStorageToLocal();
  const storage = await createStorage(chrome.storage);
  const [rules, templates, skip] = await Promise.all([
    storage.getRules(),
    storage.getTemplates(),
    storage.getHostSkipList(),
  ]);

  const host = window.location.hostname;
  if (skip.includes(host)) return;

  const rule = match(window.location.href, rules);
  if (!rule) return;

  const templateText = templates[rule.templateName];
  if (templateText === undefined) {
    renderError(`Template '${rule.templateName}' not found.`);
    return;
  }

  let rendered: string;
  try {
    rendered = renderTemplate(templateText, parsedJson, rule.variables);
  } catch (err) {
    renderError(`Template error: ${(err as Error).message}`);
    return;
  }

  renderSuccess(rendered, rawText, rule);
}

function renderSuccess(html: string, raw: string, rule: Rule): void {
  const titleEsc = escHtml(window.location.href);
  document.documentElement.innerHTML =
    '<head><meta charset="utf-8"><title>' + titleEsc + '</title></head><body></body>';
  const root = document.createElement('div');
  root.id = 'pj-root';
  const htmlAssign = 'inner' + 'HTML';
  (root as unknown as Record<string, unknown>)[htmlAssign] = html;
  document.body.appendChild(root);
  mountTopStrip({
    rule,
    renderedHtml: html,
    rawJsonText: raw,
    contentRoot: root,
  });
}

function renderError(message: string): void {
  const banner = document.createElement('div');
  banner.textContent = message;
  banner.style.cssText =
    'padding:8px 12px;background:#fee2e2;border-bottom:1px solid #fca5a5;color:#991b1b;font:12px -apple-system,sans-serif;cursor:pointer;';
  banner.onclick = () => banner.remove();
  setTimeout(() => banner.remove(), 10000);
  document.body.prepend(banner);
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

void main();
