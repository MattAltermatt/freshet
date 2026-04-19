export type Variables = Record<string, string>;

export interface Rule {
  id: string;
  /** Optional human-readable label. Display falls back to hostPattern if unset. */
  name?: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
  variables: Variables;
  active: boolean;
  /** True if this rule was bundled by the install seed; informational only. */
  isExample?: boolean;
  /** Canonical demo URL for an example rule — opened when the user clicks the Example pill. */
  exampleUrl?: string;
}

export type Templates = Record<string, string>;

export type HostSkipList = string[];

export interface StorageShape {
  schemaVersion?: number;
  rules: Rule[];
  templates: Templates;
  hostSkipList: HostSkipList;
}
