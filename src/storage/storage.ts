import type { Rule, Templates, HostSkipList, ConflictMap } from '../shared/types';

const K_RULES = 'rules';
const K_TEMPLATES = 'templates';
const K_SKIP = 'hostSkipList';
const K_AREA = 'pj_storage_area';
const K_SCHEMA = 'schemaVersion';
const K_MIGRATED = 'pj_migrated_v2';
const K_SAMPLE = 'pj_sample_json';
const K_FLAGS = 'pj_import_flags';
const K_CONFLICTS = 'pj_conflicts';

export type SampleJsonMap = Record<string, string>;

export interface ImportFlag {
  field: string;
  pattern: string;
  matchedText: string;
}

export interface ImportFlagEntry {
  source: 'import' | 'append';
  importedAt: string;
  flags: ImportFlag[];
}

export type ImportFlagMap = Record<string, ImportFlagEntry>;

export interface Storage {
  getRules(): Promise<Rule[]>;
  setRules(rules: Rule[]): Promise<void>;
  getTemplates(): Promise<Templates>;
  setTemplates(templates: Templates): Promise<void>;
  getHostSkipList(): Promise<HostSkipList>;
  setHostSkipList(list: HostSkipList): Promise<void>;
  getSchemaVersion(): Promise<number | undefined>;
  setSchemaVersion(version: number): Promise<void>;
  setMigratedList(names: string[]): Promise<void>;
  getSampleJsonMap(): Promise<SampleJsonMap>;
  setSampleJsonMap(map: SampleJsonMap): Promise<void>;
  getImportFlags(): Promise<ImportFlagMap>;
  setImportFlags(map: ImportFlagMap): Promise<void>;
  getConflicts(): Promise<ConflictMap>;
  setConflicts(map: ConflictMap): Promise<void>;
  clearConflict(host: string): Promise<void>;
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
    setMigratedList: (names) => area.set({ [K_MIGRATED]: names }),
    getSampleJsonMap: () => getOne<SampleJsonMap>(K_SAMPLE, {}),
    setSampleJsonMap: (map) => area.set({ [K_SAMPLE]: map }),
    getImportFlags: () => getOne<ImportFlagMap>(K_FLAGS, {}),
    setImportFlags: (map) => area.set({ [K_FLAGS]: map }),
    getConflicts: () => getOne<ConflictMap>(K_CONFLICTS, {}),
    setConflicts: (map) => area.set({ [K_CONFLICTS]: map }),
    clearConflict: async (host) => {
      const current = await getOne<ConflictMap>(K_CONFLICTS, {});
      if (!(host in current)) return;
      const next = { ...current };
      delete next[host];
      await area.set({ [K_CONFLICTS]: next });
    },
  };
}
