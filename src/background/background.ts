import { createStorage } from '../storage/storage';
import {
  estimateBytes,
  SYNC_SOFT_LIMIT,
  migrateSyncToLocal,
  migrateTemplatesToV2,
  migrateRulesEnabledToActive,
} from '../storage/migration';
import type { Rule } from '../shared/types';
import starterServiceHealth from '../starter/service-health.html?raw';
import starterIncidentDetail from '../starter/incident-detail.html?raw';
import starterGithubRepo from '../starter/github-repo.html?raw';
import starterPokemon from '../starter/pokemon.html?raw';
import starterCountry from '../starter/country.html?raw';
import sampleServiceHealth from '../starter/service-health.sample.json?raw';
import sampleIncidentDetail from '../starter/incident-detail.sample.json?raw';
import sampleGithubRepo from '../starter/github-repo.sample.json?raw';
import samplePokemon from '../starter/pokemon.sample.json?raw';
import sampleCountry from '../starter/country.sample.json?raw';
import { appearanceFor, type BadgeSignal } from './badge';

async function main(): Promise<void> {
  await maybeStorageAreaMigration();
  await maybeSchemaMigration();
  try {
    await migrateRulesEnabledToActive(chrome.storage);
  } catch (err) {
    console.warn('[freshet] rules enabled→active migration skipped:', err);
  }
  await seedStartersIfEmpty();
}

interface Starter {
  name: string;
  template: string;
  sample: string;
  rule: Omit<Rule, 'id' | 'isExample'>;
}

const STARTERS: Starter[] = [
  {
    name: 'service-health',
    template: starterServiceHealth,
    sample: sampleServiceHealth,
    rule: {
      hostPattern: 'mattaltermatt.github.io',
      pathPattern: '/freshet/examples/services/*',
      templateName: 'service-health',
      variables: { env: 'production' },
      active: true,
      exampleUrl: 'https://mattaltermatt.github.io/freshet/examples/services/payments.json',
    },
  },
  {
    name: 'incident-detail',
    template: starterIncidentDetail,
    sample: sampleIncidentDetail,
    rule: {
      hostPattern: 'mattaltermatt.github.io',
      pathPattern: '/freshet/examples/incidents/*',
      templateName: 'incident-detail',
      variables: {},
      active: true,
      exampleUrl: 'https://mattaltermatt.github.io/freshet/examples/incidents/INC-2026-001.json',
    },
  },
  {
    name: 'github-repo',
    template: starterGithubRepo,
    sample: sampleGithubRepo,
    rule: {
      hostPattern: 'api.github.com',
      pathPattern: '/repos/*/*',
      templateName: 'github-repo',
      variables: {},
      active: false,
      exampleUrl: 'https://api.github.com/repos/facebook/react',
    },
  },
  {
    name: 'pokemon',
    template: starterPokemon,
    sample: samplePokemon,
    rule: {
      hostPattern: 'pokeapi.co',
      pathPattern: '/api/v2/pokemon/*',
      templateName: 'pokemon',
      variables: {},
      active: false,
      exampleUrl: 'https://pokeapi.co/api/v2/pokemon/pikachu',
    },
  },
  {
    name: 'country',
    template: starterCountry,
    sample: sampleCountry,
    rule: {
      hostPattern: 'restcountries.com',
      pathPattern: '/v3.1/name/*',
      templateName: 'country',
      variables: {},
      active: false,
      exampleUrl: 'https://restcountries.com/v3.1/name/japan',
    },
  },
];

async function seedStartersIfEmpty(): Promise<void> {
  const storage = await createStorage(chrome.storage);
  const [templates, rules] = await Promise.all([
    storage.getTemplates(),
    storage.getRules(),
  ]);
  // Phase 3 added rule seeding — guard against the corruption case where
  // templates got cleared but the user's rules survived (manual nuke, partial
  // restore, etc.). Either side being non-empty means this isn't a fresh
  // install, so we leave existing user state alone.
  if (Object.keys(templates).length > 0 || rules.length > 0) return;
  // Combined starter bodies exceed the 8 KB per-item quota on chrome.storage.sync
  // once JSON-encoded. Commit this install to local up-front so the seed write
  // lands in an area without that limit.
  const sampleJsonByName: Record<string, string> = Object.fromEntries(
    STARTERS.map((s) => [s.name, s.sample]),
  );
  await chrome.storage.local.set({
    pj_storage_area: 'local',
    pj_sample_json: sampleJsonByName,
  });
  const localStorage = await createStorage(chrome.storage);
  await localStorage.setTemplates(
    Object.fromEntries(STARTERS.map((s) => [s.name, s.template])),
  );
  await localStorage.setRules(
    STARTERS.map((s, i) => ({
      ...s.rule,
      id: `starter-${s.name}-${i}`,
      isExample: true,
    })),
  );
  await localStorage.setSchemaVersion(2);
}

async function maybeStorageAreaMigration(): Promise<void> {
  try {
    const all = await chrome.storage.sync.get(['rules', 'templates', 'hostSkipList']);
    if (estimateBytes(all) > SYNC_SOFT_LIMIT) {
      await migrateSyncToLocal(chrome.storage);
    }
  } catch (err) {
    console.warn('[freshet] storage-area migration skipped:', err);
  }
}

async function maybeSchemaMigration(): Promise<void> {
  try {
    const storage = await createStorage(chrome.storage);
    const current = await storage.getSchemaVersion();
    if (current !== undefined) return;
    const result = await migrateTemplatesToV2(storage);
    if (!result.ok) {
      console.warn(
        '[freshet] template migration rolled back; failing template IDs:',
        result.failed,
      );
    }
  } catch (err) {
    console.warn('[freshet] schema migration skipped:', err);
  }
}

void main();

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-raw') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId === undefined) return;
    void chrome.tabs.sendMessage(tabId, { kind: 'pj:toggle-raw' }).catch(() => {});
  });
});

// URL each tab's badge was last painted for. Used to ignore a stale
// `status:'loading'` clear that races a fresh `pj:rendered` for the same URL
// (content script can finish before the SW processes the loading event).
const lastSignaledUrl = new Map<number, string>();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (typeof message !== 'object' || message === null) return;
  const kind = (message as { kind?: unknown }).kind;
  if (kind === 'pj:open-options') {
    const hash = (message as { hash?: unknown }).hash;
    const url =
      chrome.runtime.getURL('src/options/options.html') +
      (typeof hash === 'string' ? hash : '');
    void chrome.tabs.create({ url });
    return;
  }
  if (kind === 'pj:rendered' || kind === 'pj:render-error') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    const appearance = appearanceFor(kind as BadgeSignal);
    void chrome.action.setBadgeText({ tabId, text: appearance.text });
    void chrome.action.setBadgeBackgroundColor({ tabId, color: appearance.color });
    if (sender.tab?.url) lastSignaledUrl.set(tabId, sender.tab.url);
  }
});

// Clear the badge on navigation start so stale state from the previous URL
// doesn't leak forward — the content script re-fires pj:rendered if the new
// page also matches a rule, and stays silent otherwise.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  // If the navigation's target URL matches what the content script already
  // signaled, a pj:rendered has already overtaken this event — don't clobber
  // it. Otherwise the tab is genuinely navigating away; clear.
  if (changeInfo.url && changeInfo.url === lastSignaledUrl.get(tabId)) return;
  lastSignaledUrl.delete(tabId);
  void chrome.action.setBadgeText({ tabId, text: '' });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  lastSignaledUrl.delete(tabId);
});
