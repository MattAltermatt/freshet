import { render } from '../engine/engine';
import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';

async function main(): Promise<void> {
  const rawText = document.body?.innerText;
  if (!rawText) return;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return;
  }

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
    rendered = render(templateText, parsedJson, rule.variables);
  } catch (err) {
    renderError(`Template error: ${(err as Error).message}`);
    return;
  }

  renderSuccess(rendered, rawText, rule.variables['env'], window.location.href);
}

function renderSuccess(html: string, raw: string, env: string | undefined, href: string): void {
  document.documentElement.innerHTML = `<head><meta charset="utf-8"><title>${escHtml(href)}</title></head><body></body>`;
  const strip = buildTopStrip(env, href, () => toggleRaw(html, raw));
  const root = document.createElement('div');
  root.id = 'pj-root';
  root.innerHTML = html;
  document.body.appendChild(strip);
  document.body.appendChild(root);
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

function buildTopStrip(env: string | undefined, href: string, onToggle: () => void): HTMLElement {
  const bar = document.createElement('div');
  bar.id = 'pj-topbar';
  bar.style.cssText =
    'display:flex;gap:12px;align-items:center;padding:6px 12px;border-bottom:1px solid #e5e7eb;background:#f9fafb;font:12px -apple-system,system-ui,sans-serif;color:#374151;';
  if (env) {
    const badge = document.createElement('span');
    badge.textContent = env.toUpperCase();
    badge.style.cssText =
      'background:#f59e0b;color:#111;padding:2px 8px;border-radius:3px;font-weight:600;letter-spacing:0.5px;';
    bar.appendChild(badge);
  }
  const rawBtn = document.createElement('a');
  rawBtn.href = '#';
  rawBtn.textContent = 'Show raw JSON';
  rawBtn.style.cssText = 'color:#2563eb;text-decoration:none;cursor:pointer;';
  let showingRaw = false;
  rawBtn.onclick = (e) => {
    e.preventDefault();
    showingRaw = !showingRaw;
    rawBtn.textContent = showingRaw ? 'Show rendered' : 'Show raw JSON';
    onToggle();
  };
  bar.appendChild(rawBtn);
  const copyBtn = document.createElement('a');
  copyBtn.href = '#';
  copyBtn.textContent = 'Copy URL';
  copyBtn.style.cssText = 'color:#2563eb;text-decoration:none;cursor:pointer;margin-left:auto;';
  copyBtn.onclick = (e) => {
    e.preventDefault();
    void navigator.clipboard.writeText(href);
  };
  bar.appendChild(copyBtn);
  return bar;
}

function toggleRaw(html: string, raw: string): void {
  const root = document.getElementById('pj-root');
  if (!root) return;
  if (root.getAttribute('data-mode') === 'raw') {
    root.innerHTML = html;
    root.removeAttribute('data-mode');
  } else {
    const pre = document.createElement('pre');
    pre.style.cssText =
      'margin:0;padding:12px;font:12px ui-monospace,Menlo,monospace;white-space:pre-wrap;';
    pre.textContent = JSON.stringify(JSON.parse(raw), null, 2);
    root.replaceChildren(pre);
    root.setAttribute('data-mode', 'raw');
  }
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

void main();
