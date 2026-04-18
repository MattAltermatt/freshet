import { createStorage } from '../storage/storage';
import type { Rule, Templates } from '../shared/types';
import { render } from '../engine/engine';

let storage!: Awaited<ReturnType<typeof createStorage>>;

let rulesCache: Rule[] = [];
let templatesCache: Templates = {};
let currentTemplateName: string | null = null;

async function boot(): Promise<void> {
  storage = await createStorage(chrome.storage);
  setupTabs();
  setupRulesToolbar();
  setupTemplatesToolbar();
  await renderRulesTab();
  await renderTemplatesTab();
}

function setupTabs(): void {
  const rulesBtn = byId<HTMLButtonElement>('tab-rules');
  const tmplBtn = byId<HTMLButtonElement>('tab-templates');
  const rulesView = byId<HTMLElement>('view-rules');
  const tmplView = byId<HTMLElement>('view-templates');
  const activate = (which: 'rules' | 'templates') => {
    rulesBtn.classList.toggle('active', which === 'rules');
    tmplBtn.classList.toggle('active', which === 'templates');
    rulesView.hidden = which !== 'rules';
    tmplView.hidden = which !== 'templates';
  };
  rulesBtn.addEventListener('click', () => activate('rules'));
  tmplBtn.addEventListener('click', () => activate('templates'));
}

function setupRulesToolbar(): void {
  byId<HTMLButtonElement>('rules-add').addEventListener('click', () => openRuleDialog(null));
  byId<HTMLButtonElement>('rules-save').addEventListener('click', async () => {
    await storage.setRules(rulesCache);
    setStatus('rules-status', 'Saved.');
  });
}

async function renderRulesTab(): Promise<void> {
  rulesCache = await storage.getRules();
  templatesCache = await storage.getTemplates();
  renderRulesTable();
}

function renderRulesTable(): void {
  const tbody = byId<HTMLTableSectionElement>('rules-body');
  tbody.replaceChildren();
  rulesCache.forEach((r, i) => tbody.appendChild(renderRuleRow(r, i)));
}

function renderRuleRow(rule: Rule, index: number): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><button data-act="up">▲</button><button data-act="down">▼</button></td>
    <td>${escHtml(rule.hostPattern)}</td>
    <td>${escHtml(rule.pathPattern)}</td>
    <td>${escHtml(rule.templateName)}</td>
    <td>${escHtml(Object.entries(rule.variables).map(([k,v]) => `${k}=${v}`).join(', '))}</td>
    <td><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-act="toggle"/></td>
    <td><button data-act="edit">✎</button><button data-act="delete">✕</button></td>
  `;
  tr.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const act = target.dataset['act'];
    if (act === 'up' && index > 0) {
      [rulesCache[index - 1], rulesCache[index]] = [rulesCache[index]!, rulesCache[index - 1]!];
      renderRulesTable();
    } else if (act === 'down' && index < rulesCache.length - 1) {
      [rulesCache[index + 1], rulesCache[index]] = [rulesCache[index]!, rulesCache[index + 1]!];
      renderRulesTable();
    } else if (act === 'delete') {
      rulesCache.splice(index, 1);
      renderRulesTable();
    } else if (act === 'edit') {
      openRuleDialog(index);
    } else if (act === 'toggle') {
      rulesCache[index]!.enabled = (target as HTMLInputElement).checked;
    }
  });
  return tr;
}

function openRuleDialog(index: number | null): void {
  const dlg = byId<HTMLDialogElement>('rule-dialog');
  const form = dlg.querySelector('form')!;
  const tmplSelect = form.elements.namedItem('templateName') as HTMLSelectElement;
  tmplSelect.innerHTML = Object.keys(templatesCache)
    .map((n) => `<option value="${escAttr(n)}">${escHtml(n)}</option>`).join('');

  const current: Rule = index !== null
    ? structuredClone(rulesCache[index]!)
    : {
        id: `rule-${Date.now()}`,
        hostPattern: '',
        pathPattern: '',
        templateName: Object.keys(templatesCache)[0] ?? '',
        variables: {},
        enabled: true,
      };

  (form.elements.namedItem('hostPattern') as HTMLInputElement).value = current.hostPattern;
  (form.elements.namedItem('pathPattern') as HTMLInputElement).value = current.pathPattern;
  tmplSelect.value = current.templateName;
  (form.elements.namedItem('enabled') as HTMLInputElement).checked = current.enabled;

  const varsBox = byId<HTMLDivElement>('rule-vars');
  const renderVars = (vars: Record<string, string>) => {
    varsBox.innerHTML = '';
    for (const [k, v] of Object.entries(vars)) {
      const row = document.createElement('div');
      row.innerHTML = `<input data-key value="${escAttr(k)}"/> = <input data-val value="${escAttr(v)}"/> <button type="button">✕</button>`;
      row.querySelector('button')!.addEventListener('click', () => { delete vars[k]; renderVars(vars); });
      row.querySelector<HTMLInputElement>('[data-key]')!.addEventListener('change', (e) => {
        const newK = (e.target as HTMLInputElement).value;
        if (newK && newK !== k) { vars[newK] = vars[k]!; delete vars[k]; renderVars(vars); }
      });
      row.querySelector<HTMLInputElement>('[data-val]')!.addEventListener('change', (e) => {
        vars[k] = (e.target as HTMLInputElement).value;
      });
      varsBox.appendChild(row);
    }
  };
  renderVars(current.variables);
  byId<HTMLButtonElement>('rule-var-add').onclick = () => {
    current.variables[''] = '';
    renderVars(current.variables);
  };

  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    current.hostPattern = (form.elements.namedItem('hostPattern') as HTMLInputElement).value;
    current.pathPattern = (form.elements.namedItem('pathPattern') as HTMLInputElement).value;
    current.templateName = tmplSelect.value;
    current.enabled = (form.elements.namedItem('enabled') as HTMLInputElement).checked;
    if (index !== null) rulesCache[index] = current;
    else rulesCache.push(current);
    renderRulesTable();
  }, { once: true });

  dlg.showModal();
}

function setupTemplatesToolbar(): void {
  byId<HTMLButtonElement>('tmpl-new').addEventListener('click', onNew);
  byId<HTMLButtonElement>('tmpl-rename').addEventListener('click', onRename);
  byId<HTMLButtonElement>('tmpl-duplicate').addEventListener('click', onDuplicate);
  byId<HTMLButtonElement>('tmpl-delete').addEventListener('click', onDelete);
  byId<HTMLButtonElement>('tmpl-save').addEventListener('click', onSave);
  byId<HTMLSelectElement>('tmpl-list').addEventListener('change', (e) => {
    loadTemplate((e.target as HTMLSelectElement).value);
  });
  byId<HTMLTextAreaElement>('tmpl-editor').addEventListener('input', schedulePreview);
  byId<HTMLTextAreaElement>('tmpl-preview-json').addEventListener('input', schedulePreview);
}

async function renderTemplatesTab(): Promise<void> {
  templatesCache = await storage.getTemplates();
  refreshTemplateList();
  const names = Object.keys(templatesCache);
  if (names.length > 0) loadTemplate(names[0]!);
}

function refreshTemplateList(): void {
  const list = byId<HTMLSelectElement>('tmpl-list');
  const names = Object.keys(templatesCache);
  list.innerHTML = names.map((n) => `<option value="${escAttr(n)}">${escHtml(n)}</option>`).join('');
  if (currentTemplateName && names.includes(currentTemplateName)) list.value = currentTemplateName;
}

function loadTemplate(name: string): void {
  currentTemplateName = name;
  byId<HTMLTextAreaElement>('tmpl-editor').value = templatesCache[name] ?? '';
  schedulePreview();
}

async function onNew(): Promise<void> {
  const name = window.prompt('New template name');
  if (!name) return;
  if (templatesCache[name] !== undefined) { window.alert('Name already exists'); return; }
  templatesCache[name] = '<!-- new template -->';
  currentTemplateName = name;
  refreshTemplateList();
  loadTemplate(name);
}

function onRename(): void {
  if (!currentTemplateName) return;
  const next = window.prompt('Rename to', currentTemplateName);
  if (!next || next === currentTemplateName) return;
  if (templatesCache[next] !== undefined) { window.alert('Name already exists'); return; }
  templatesCache[next] = templatesCache[currentTemplateName]!;
  delete templatesCache[currentTemplateName];
  currentTemplateName = next;
  refreshTemplateList();
}

function onDuplicate(): void {
  if (!currentTemplateName) return;
  const next = `${currentTemplateName}-copy`;
  templatesCache[next] = templatesCache[currentTemplateName]!;
  currentTemplateName = next;
  refreshTemplateList();
  loadTemplate(next);
}

function onDelete(): void {
  if (!currentTemplateName) return;
  if (!window.confirm(`Delete template "${currentTemplateName}"?`)) return;
  delete templatesCache[currentTemplateName];
  currentTemplateName = null;
  refreshTemplateList();
  byId<HTMLTextAreaElement>('tmpl-editor').value = '';
  schedulePreview();
}

async function onSave(): Promise<void> {
  if (currentTemplateName) {
    templatesCache[currentTemplateName] = byId<HTMLTextAreaElement>('tmpl-editor').value;
  }
  await storage.setTemplates(templatesCache);
  setStatus('tmpl-status', 'Saved.');
}

let previewTimer: number | undefined;
function schedulePreview(): void {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(runPreview, 150);
}

function runPreview(): void {
  const tpl = byId<HTMLTextAreaElement>('tmpl-editor').value;
  const jsonText = byId<HTMLTextAreaElement>('tmpl-preview-json').value;
  let json: unknown = {};
  try { json = jsonText ? JSON.parse(jsonText) : {}; } catch { /* leave {} */ }
  let html: string;
  try { html = render(tpl, json, {}); }
  catch (err) { html = `<pre style="color:#991b1b">${escHtml((err as Error).message)}</pre>`; }
  byId<HTMLIFrameElement>('tmpl-preview').srcdoc = html;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}
function escHtml(s: string): string { return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); }
function escAttr(s: string): string { return escHtml(s); }
function setStatus(id: string, msg: string): void {
  const el = byId<HTMLElement>(id);
  el.textContent = msg;
  setTimeout(() => (el.textContent = ''), 2500);
}

void boot();
