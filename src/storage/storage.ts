import type { Rule, Templates, HostSkipList } from '../shared/types';

const K_RULES = 'rules';
const K_TEMPLATES = 'templates';
const K_SKIP = 'hostSkipList';
const K_AREA = 'pj_storage_area';
const K_SCHEMA = 'schemaVersion';

export interface Storage {
  getRules(): Promise<Rule[]>;
  setRules(rules: Rule[]): Promise<void>;
  getTemplates(): Promise<Templates>;
  setTemplates(templates: Templates): Promise<void>;
  getHostSkipList(): Promise<HostSkipList>;
  setHostSkipList(list: HostSkipList): Promise<void>;
  getSchemaVersion(): Promise<number | undefined>;
  setSchemaVersion(version: number): Promise<void>;
}

export async function createStorage(api: typeof chrome.storage): Promise<Storage> {
  const sentinel = await api.local.get([K_AREA]);
  const area = (sentinel as Record<string, unknown>)[K_AREA] === 'local' ? api.local : api.sync;
  const getOne = async <T>(key: string, fallback: T): Promise<T> => {
    const result = await area.get([key]);
    return (result[key] as T | undefined) ?? fallback;
  };
  return {
    getRules: () => getOne<Rule[]>(K_RULES, []),
    setRules: (rules) => area.set({ [K_RULES]: rules }),
    getTemplates: () => getOne<Templates>(K_TEMPLATES, {}),
    setTemplates: (templates) => area.set({ [K_TEMPLATES]: templates }),
    getHostSkipList: () => getOne<HostSkipList>(K_SKIP, []),
    setHostSkipList: (list) => area.set({ [K_SKIP]: list }),
    getSchemaVersion: async () => {
      const result = await area.get([K_SCHEMA]);
      const v = result[K_SCHEMA];
      return typeof v === 'number' ? v : undefined;
    },
    setSchemaVersion: (version) => area.set({ [K_SCHEMA]: version }),
  };
}
