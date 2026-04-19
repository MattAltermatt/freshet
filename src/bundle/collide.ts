import type { FreshetBundle } from './schema';
import type { Rule, Templates } from '../shared/types';

export interface TemplateCollision {
  name: string;
  proposedRename: string;
}

export interface RuleIdCollision {
  id: string;
}

export interface RulePatternOverlap {
  bundleRuleId: string;
  existingRuleId: string;
  hostPattern: string;
  pathPattern: string;
}

export interface RuleNameCollision {
  name: string;
  bundleRuleId: string;
  existingRuleId: string;
}

export interface CollisionReport {
  templateCollisions: TemplateCollision[];
  ruleIdCollisions: RuleIdCollision[];
  ruleNameCollisions: RuleNameCollision[];
  rulePatternOverlaps: RulePatternOverlap[];
}

export function nextAvailableName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function detectCollisions(
  bundle: FreshetBundle,
  existingRules: Rule[],
  existingTemplates: Templates,
): CollisionReport {
  const existingTemplateNames = new Set(Object.keys(existingTemplates));
  const templateCollisions: TemplateCollision[] = bundle.templates
    .filter((t) => existingTemplateNames.has(t.name))
    .map((t) => ({
      name: t.name,
      proposedRename: nextAvailableName(
        t.name,
        new Set([...existingTemplateNames, ...bundle.templates.map((bt) => bt.name)]),
      ),
    }));

  const existingIds = new Map(existingRules.map((r) => [r.id, r]));
  const ruleIdCollisions: RuleIdCollision[] = bundle.rules
    .filter((r) => existingIds.has(r.id))
    .map((r) => ({ id: r.id }));

  const existingNames = new Map(
    existingRules.filter((r) => r.name).map((r) => [r.name!, r]),
  );
  const ruleNameCollisions: RuleNameCollision[] = bundle.rules
    .filter((r) => r.name && existingNames.has(r.name) && !existingIds.has(r.id))
    .map((r) => ({
      name: r.name!,
      bundleRuleId: r.id,
      existingRuleId: existingNames.get(r.name!)!.id,
    }));

  const rulePatternOverlaps: RulePatternOverlap[] = [];
  for (const br of bundle.rules) {
    if (existingIds.has(br.id)) continue;
    const overlap = existingRules.find(
      (er) => er.hostPattern === br.hostPattern && er.pathPattern === br.pathPattern,
    );
    if (overlap) {
      rulePatternOverlaps.push({
        bundleRuleId: br.id,
        existingRuleId: overlap.id,
        hostPattern: br.hostPattern,
        pathPattern: br.pathPattern,
      });
    }
  }

  return { templateCollisions, ruleIdCollisions, ruleNameCollisions, rulePatternOverlaps };
}
