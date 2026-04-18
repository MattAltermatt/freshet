import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  ToastHost,
  useStorage,
  useTheme,
  useToast,
  type ThemePreference,
} from '../ui';
import type { Rule, Templates } from '../shared/types';
import { Header } from './Header';
import { RulesTab } from './rules/RulesTab';
import { TemplatesTab } from './templates/TemplatesTab';
import { ShortcutsFooter } from './ShortcutsFooter';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';

type Tab = 'rules' | 'templates';

interface Settings {
  themePreference: ThemePreference;
}

const DEFAULT_SETTINGS: Settings = { themePreference: 'system' };

export function App(): JSX.Element {
  // Converge any legacy `.sync`-area data to `.local` before the rest of the
  // app reads via useStorage. Idempotent after the first run.
  const [promoted, setPromoted] = useState(false);
  useEffect(() => {
    void promoteStorageToLocal().finally(() => setPromoted(true));
  }, []);

  const [settings, writeSettings] = useStorage<'settings', Settings>(
    'settings',
    DEFAULT_SETTINGS,
  );
  useTheme({
    preference: settings.themePreference,
    onPreferenceChange: (next) =>
      void writeSettings({ ...settings, themePreference: next }),
  });

  const [rules, writeRules] = useStorage<'rules', Rule[]>('rules', []);
  const [templates, writeTemplates] = useStorage<'templates', Templates>(
    'templates',
    {},
  );
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('rules');

  const handleRuleDelete = (index: number): void => {
    const snapshot = [...rules];
    void writeRules(rules.filter((_, i) => i !== index));
    toast.push({
      variant: 'info',
      message: `Deleted rule ${index + 1} · Undo`,
      ttlMs: 8000,
      action: {
        label: 'Undo',
        onClick: () => void writeRules(snapshot),
      },
    });
  };

  const handleDisableRules = (ruleIds: string[]): void => {
    const idSet = new Set(ruleIds);
    const snapshot = [...rules];
    const next = rules.map((r) => (idSet.has(r.id) ? { ...r, enabled: false } : r));
    void writeRules(next);
    toast.push({
      variant: 'info',
      message: `Disabled ${ruleIds.length} rule${ruleIds.length === 1 ? '' : 's'} · Undo`,
      ttlMs: 8000,
      action: {
        label: 'Undo',
        onClick: () => void writeRules(snapshot),
      },
    });
  };

  if (!promoted) {
    return (
      <div class="pj-app pj-app--booting">
        <p class="pj-placeholder">Loading…</p>
      </div>
    );
  }

  return (
    <div class="pj-app">
      <Header
        tab={tab}
        onTab={setTab}
        themePref={settings.themePreference}
        onThemePref={(p) => void writeSettings({ ...settings, themePreference: p })}
      />
      <main class="pj-main">
        {tab === 'rules' ? (
          <RulesTab
            rules={rules}
            templates={templates}
            onChange={(next) => void writeRules(next)}
            onDelete={(index) => handleRuleDelete(index)}
          />
        ) : (
          <TemplatesTab
            templates={templates}
            onTemplatesChange={(next) => void writeTemplates(next)}
            rules={rules}
            onDisableRules={handleDisableRules}
          />
        )}
      </main>
      <ShortcutsFooter />
      <ToastHost />
    </div>
  );
}
