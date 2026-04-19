import type { Rule, Templates } from '../shared/types';
import type { FreshetBundle, BundleRule, BundleTemplate } from './schema';

export interface BuildBundleInput {
  selectedRuleIds: string[];
  selectedTemplateNames: string[];
  rules: Rule[];
  templates: Templates;
  sampleJson: Record<string, string>;
  appVersion: string;
  stripSampleJson: Set<string>;
  stripVariables: Set<string>;
  exportedAt: string;
  exportedBy?: string;
}

export function buildBundle(input: BuildBundleInput): FreshetBundle {
  const ruleById = new Map(input.rules.map((r) => [r.id, r]));
  const bundleRules: BundleRule[] = input.selectedRuleIds
    .map((id) => ruleById.get(id))
    .filter((r): r is Rule => r !== undefined)
    .map((r) => {
      const out: BundleRule = {
        id: r.id,
        hostPattern: r.hostPattern,
        pathPattern: r.pathPattern,
        templateName: r.templateName,
        active: r.active,
      };
      if (r.name) out.name = r.name;
      if (!input.stripVariables.has(r.id) && Object.keys(r.variables).length > 0) {
        out.variables = { ...r.variables };
      }
      return out;
    });

  const bundleTemplates: BundleTemplate[] = input.selectedTemplateNames
    .filter((n) => n in input.templates)
    .map((n) => {
      const out: BundleTemplate = { name: n, source: input.templates[n]! };
      const sample = input.sampleJson[n];
      if (sample !== undefined && !input.stripSampleJson.has(n)) {
        out.sampleJson = sample;
      }
      return out;
    });

  return {
    bundleSchemaVersion: 1,
    exportedAt: input.exportedAt,
    appVersion: input.appVersion,
    ...(input.exportedBy ? { exportedBy: input.exportedBy } : {}),
    templates: bundleTemplates,
    rules: bundleRules,
  };
}
