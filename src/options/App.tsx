import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
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

type Tab = 'rules' | 'templates';

interface Settings {
  themePreference: ThemePreference;
}

const DEFAULT_SETTINGS: Settings = { themePreference: 'system' };

export function App(): JSX.Element {
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
  const [templates] = useStorage<'templates', Templates>('templates', {});
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('rules');

  const handleDelete = (index: number, rule: Rule): void => {
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
    void rule; // included in the API surface in case a caller wants richer toast copy later
  };

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
            onDelete={handleDelete}
          />
        ) : (
          <TemplatesPlaceholder />
        )}
      </main>
      <ToastHost />
    </div>
  );
}

function TemplatesPlaceholder(): JSX.Element {
  return <p class="pj-placeholder">Templates tab — implementation lands in Task 21.</p>;
}
