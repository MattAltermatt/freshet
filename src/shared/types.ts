export type Variables = Record<string, string>;

export interface Rule {
  id: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
  variables: Variables;
  enabled: boolean;
}

export type Templates = Record<string, string>;

export type HostSkipList = string[];

export interface StorageShape {
  rules: Rule[];
  templates: Templates;
  hostSkipList: HostSkipList;
}
