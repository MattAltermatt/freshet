export type Variables = Record<string, string>;

export interface Rule {
  id: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
  variables: Variables;
  enabled: boolean;
  /** True if this rule was bundled by the install seed; informational only. */
  isStarter?: boolean;
}

export type Templates = Record<string, string>;

export type HostSkipList = string[];

export interface StorageShape {
  schemaVersion?: number;
  rules: Rule[];
  templates: Templates;
  hostSkipList: HostSkipList;
}
