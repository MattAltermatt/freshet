import type { Rule, Templates, HostSkipList } from '../shared/types';

const K_RULES = 'rules';
const K_TEMPLATES = 'templates';
const K_SKIP = 'hostSkipList';

export interface Storage {
  getRules(): Promise<Rule[]>;
  setRules(rules: Rule[]): Promise<void>;
  getTemplates(): Promise<Templates>;
  setTemplates(templates: Templates): Promise<void>;
  getHostSkipList(): Promise<HostSkipList>;
  setHostSkipList(list: HostSkipList): Promise<void>;
}

export function createStorage(api: typeof chrome.storage): Storage {
  const area = api.sync;
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
  };
}
