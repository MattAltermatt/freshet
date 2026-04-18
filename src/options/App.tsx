import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { ToastHost, useStorage, useTheme, type ThemePreference } from '../ui';
import { Header } from './Header';

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
  const [tab, setTab] = useState<Tab>('rules');

  return (
    <div class="pj-app">
      <Header
        tab={tab}
        onTab={setTab}
        themePref={settings.themePreference}
        onThemePref={(p) => void writeSettings({ ...settings, themePreference: p })}
      />
      <main class="pj-main">
        {tab === 'rules' ? <RulesPlaceholder /> : <TemplatesPlaceholder />}
      </main>
      <ToastHost />
    </div>
  );
}

function RulesPlaceholder(): JSX.Element {
  return <p class="pj-placeholder">Rules tab — implementation lands in Task 15.</p>;
}

function TemplatesPlaceholder(): JSX.Element {
  return <p class="pj-placeholder">Templates tab — implementation lands in Task 21.</p>;
}
