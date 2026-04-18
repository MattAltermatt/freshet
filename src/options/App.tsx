import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { ToastHost, useTheme } from '../ui';

type Tab = 'rules' | 'templates';

export function App(): JSX.Element {
  useTheme({ preference: 'system' });
  const [tab, setTab] = useState<Tab>('rules');

  return (
    <div class="pj-app">
      <header class="pj-header">
        <div class="pj-brand">
          <span class="pj-logo" aria-hidden="true">{'{>'}</span>
          <h1>Present-JSON</h1>
        </div>
        <nav class="pj-tabs">
          <button
            class={`pj-tab${tab === 'rules' ? ' pj-tab--active' : ''}`}
            onClick={() => setTab('rules')}
          >
            Rules
          </button>
          <button
            class={`pj-tab${tab === 'templates' ? ' pj-tab--active' : ''}`}
            onClick={() => setTab('templates')}
          >
            Templates
          </button>
        </nav>
      </header>
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
