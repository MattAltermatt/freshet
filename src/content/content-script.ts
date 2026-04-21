import { render as renderTemplate } from '../engine/engine';
import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
import { mountTopStrip } from './mountTopStrip';
import { applyTheme, resolveTheme, type ThemePreference } from '../ui/theme';
import { detectConflict } from './conflictDetect';
import type { Rule, Templates, ConflictEntry } from '../shared/types';

type Storage = Awaited<ReturnType<typeof createStorage>>;

async function main(): Promise<void> {
  const rawText = document.body?.innerText ?? '';

  let parsedJson: unknown;
  let parsedOk = false;
  try {
    parsedJson = JSON.parse(rawText);
    parsedOk = true;
  } catch {
    parsedOk = false;
  }

  await promoteStorageToLocal();
  const storage = await createStorage(chrome.storage);
  const [rules, templates, skip, settings] = await Promise.all([
    storage.getRules(),
    storage.getTemplates(),
    storage.getHostSkipList(),
    chrome.storage.local
      .get(['settings'])
      .then((r) => (r as { settings?: { themePreference?: ThemePreference } }).settings),
  ]);

  const host = window.location.hostname;
  if (skip.includes(host)) return;

  if (parsedOk) {
    await runMatchAndRender(parsedJson, rules, templates, settings, storage, host, rawText);
    return;
  }

  // Parse failed. Rule-gated detection: only investigate if Freshet has a rule
  // that would have rendered here. Hosts the user hasn't configured stay silent.
  const rule = match(window.location.href, rules);
  if (!rule) return;

  const report = detectConflict(document);

  if (report.ok === 'rescued') {
    let rescued: unknown;
    try {
      rescued = JSON.parse(report.rescuedJson);
    } catch {
      return; // Shouldn't happen — tryPreRescue already validated.
    }
    await storage.clearConflict(host);
    await runMatchAndRender(rescued, rules, templates, settings, storage, host, report.rescuedJson);
    return;
  }

  if (report.ok === false) {
    const entry: ConflictEntry = {
      viewer: report.viewer,
      displayName: report.displayName,
      extensionId: report.extensionId,
      detectedAt: new Date().toISOString(),
    };
    const current = await storage.getConflicts();
    await storage.setConflicts({ ...current, [host]: entry });
    signal('pj:conflict');
    return;
  }
  // report.ok === true -> parse failed, no conflict signals. Just not JSON.
}

async function runMatchAndRender(
  parsedJson: unknown,
  rules: Rule[],
  templates: Templates,
  settings: { themePreference?: ThemePreference } | undefined,
  storage: Storage,
  host: string,
  rawText: string,
): Promise<void> {
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

  // Render succeeded -> clear any stale conflict flag for this host. If a
  // viewer was previously detected but the user disabled it (or it no longer
  // captures this page), the popup cleans itself up on the next render.
  void storage.clearConflict(host);

  const theme = resolveTheme(settings?.themePreference ?? 'system');
  renderSuccess(rendered, rawText, rule, theme);
}

function signal(kind: 'pj:rendered' | 'pj:render-error' | 'pj:conflict'): void {
  try {
    void chrome.runtime.sendMessage({ kind }).catch(() => {});
  } catch {
    /* extension context invalidated -- badge update best-effort */
  }
}

function renderSuccess(html: string, raw: string, rule: Rule, theme: 'light' | 'dark'): void {
  if (!(document.documentElement instanceof HTMLElement)) {
    renderError('Unsupported document type -- cannot render.');
    return;
  }
  const titleEsc = escHtml(window.location.href);
  const htmlKey = 'inner' + 'HTML';
  (document.documentElement as unknown as Record<string, unknown>)[htmlKey] =
    '<head><meta charset="utf-8"><title>' + titleEsc + '</title></head><body></body>';
  document.documentElement.setAttribute('data-theme', theme);
  // Strip is position:fixed at viewport top. Put the padding on #pj-root (our
  // own injected wrapper) rather than body -- user templates can't target an ID
  // they don't know, so the shim survives hostile template CSS.
  document.body.style.cssText = 'margin:0;';
  const root = document.createElement('div');
  root.id = 'pj-root';
  root.style.paddingTop = '36px';
  (root as unknown as Record<string, unknown>)[htmlKey] = html;
  document.body.appendChild(root);
  mountTopStrip({
    rule,
    renderedHtml: html,
    rawJsonText: raw,
    contentRoot: root,
  });
  // Keep the rendered page in sync with settings.themePreference — the strip
  // updates via useTheme, but <html data-theme> needs its own listener since
  // the content script runs outside Preact.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes['settings'];
    if (!change) return;
    const next = change.newValue as { themePreference?: ThemePreference } | undefined;
    applyTheme(resolveTheme(next?.themePreference ?? 'system'));
  });
  signal('pj:rendered');
}

function renderError(message: string): void {
  const banner = document.createElement('div');
  banner.textContent = message;
  banner.style.cssText =
    'padding:8px 12px;background:#fee2e2;border-bottom:1px solid #fca5a5;color:#991b1b;font:12px -apple-system,sans-serif;cursor:pointer;';
  banner.onclick = () => banner.remove();
  setTimeout(() => banner.remove(), 10000);
  document.body.prepend(banner);
  signal('pj:render-error');
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

void main().catch((err) => {
  console.warn('[freshet] content script crashed:', err);
});
