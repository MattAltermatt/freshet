import type { Rule, Templates } from '../../shared/types';
import type { ImportPlan } from './ImportDialog';
import { nextAvailableName } from '../../bundle/collide';
import type { ImportFlagMap, ImportFlagEntry } from '../../storage/storage';
import { sniff } from '../../bundle/sniff';

export interface ApplyImportInput {
  plan: ImportPlan;
  existingRules: Rule[];
  existingTemplates: Templates;
  existingSample: Record<string, string>;
  now: string;
}

export interface ApplyImportResult {
  rules: Rule[];
  templates: Templates;
  sample: Record<string, string>;
  flagsDelta: ImportFlagMap;
}

export function applyImport(input: ApplyImportInput): ApplyImportResult {
  const existingTmplNames = new Set(Object.keys(input.existingTemplates));
  const rename = new Map<string, string>(input.plan.templateRenameMap);

  // Append mode auto-renames on any collision.
  if (input.plan.mode === 'append') {
    for (const t of input.plan.bundle.templates) {
      if (existingTmplNames.has(t.name) && !rename.has(t.name)) {
        rename.set(
          t.name,
          nextAvailableName(t.name, new Set([...existingTmplNames, ...rename.values()])),
        );
      }
    }
  }

  // Build new template map.
  const mergedTemplates: Templates = { ...input.existingTemplates };
  const mergedSample: Record<string, string> = { ...input.existingSample };
  for (const t of input.plan.bundle.templates) {
    if (input.plan.skipTemplateNames.has(t.name)) continue;
    const res = input.plan.templateCollisionResolution.get(t.name);
    if (res === 'skip') continue;
    const targetName = rename.get(t.name) ?? t.name;
    mergedTemplates[targetName] = t.source;
    if (t.sampleJson !== undefined) {
      mergedSample[targetName] = t.sampleJson;
    }
  }

  // Build new rules list.
  const mergedRules: Rule[] = [...input.existingRules];
  for (const br of input.plan.bundle.rules) {
    if (input.plan.skipRuleIds.has(br.id)) continue;
    const ruleRes = input.plan.ruleCollisionResolution.get(br.id);
    if (ruleRes === 'skip') continue;

    const resolvedTemplateName = rename.get(br.templateName) ?? br.templateName;
    const appended: Rule = {
      id: ruleRes === 'keepBoth' ? `${br.id}-imported` : br.id,
      hostPattern: br.hostPattern,
      pathPattern: br.pathPattern,
      templateName: resolvedTemplateName,
      variables: br.variables ?? {},
      active: false,
      ...(br.name ? { name: br.name } : {}),
    };

    if (ruleRes === 'replace') {
      const idx = mergedRules.findIndex((r) => r.id === br.id);
      if (idx >= 0) mergedRules[idx] = appended;
      else mergedRules.push(appended);
    } else {
      mergedRules.push(appended);
    }
  }

  // Flags — group sniff hits by the rule id or template name they apply to.
  const hits = sniff(input.plan.bundle);
  const flagsDelta: ImportFlagMap = {};
  for (const h of hits) {
    const m = h.field.match(/^rules\[(\d+)\]/);
    if (m) {
      const ruleIdx = Number(m[1]);
      const br = input.plan.bundle.rules[ruleIdx];
      if (!br || input.plan.skipRuleIds.has(br.id)) continue;
      // Key must match the id the rule is actually written under — keepBoth
      // rewrites the id to `${br.id}-imported`, so the flag entry must follow.
      // Otherwise NeedsAttention looks up the wrong key and the flag orphans.
      const ruleRes = input.plan.ruleCollisionResolution.get(br.id);
      const key = ruleRes === 'keepBoth' ? `${br.id}-imported` : br.id;
      const entry: ImportFlagEntry = flagsDelta[key] ?? {
        source: input.plan.mode,
        importedAt: input.now,
        flags: [],
      };
      entry.flags.push({
        field: h.field,
        pattern: h.patternRegex,
        matchedText: h.matchedText,
      });
      flagsDelta[key] = entry;
      continue;
    }
    const mt = h.field.match(/^templates\[(\d+)\]/);
    if (mt) {
      const tmplIdx = Number(mt[1]);
      const bt = input.plan.bundle.templates[tmplIdx];
      if (!bt || input.plan.skipTemplateNames.has(bt.name)) continue;
      const resolved = rename.get(bt.name) ?? bt.name;
      const entry: ImportFlagEntry = flagsDelta[resolved] ?? {
        source: input.plan.mode,
        importedAt: input.now,
        flags: [],
      };
      entry.flags.push({
        field: h.field,
        pattern: h.patternRegex,
        matchedText: h.matchedText,
      });
      flagsDelta[resolved] = entry;
    }
  }

  return {
    rules: mergedRules,
    templates: mergedTemplates,
    sample: mergedSample,
    flagsDelta,
  };
}

export interface CommitImportCtx {
  rules: Rule[];
  templates: Templates;
  sampleJson: Record<string, string>;
  setRules: (r: Rule[]) => Promise<void> | void;
  setTemplates: (t: Templates) => Promise<void> | void;
  setSampleJson: (s: Record<string, string>) => Promise<void> | void;
  existingFlags: ImportFlagMap;
  setImportFlags: (f: ImportFlagMap) => Promise<void> | void;
}

export async function commitImport(
  plan: ImportPlan,
  ctx: CommitImportCtx,
): Promise<void> {
  const result = applyImport({
    plan,
    existingRules: ctx.rules,
    existingTemplates: ctx.templates,
    existingSample: ctx.sampleJson,
    now: new Date().toISOString(),
  });
  // Atomic-ish: snapshot every key we plan to touch, then write in order.
  // On any failure, restore all four snapshots before throwing. Matches the
  // batch-atomic pattern in `src/storage/migration.ts`.
  const snapTemplates = { ...ctx.templates };
  const snapSample = { ...ctx.sampleJson };
  const snapRules = [...ctx.rules];
  const snapFlags = { ...ctx.existingFlags };
  try {
    await ctx.setTemplates(result.templates);
    await ctx.setSampleJson(result.sample);
    await ctx.setRules(result.rules);
    await ctx.setImportFlags({ ...ctx.existingFlags, ...result.flagsDelta });
  } catch (err) {
    // Roll back in reverse order; ignore rollback failures (best-effort).
    await Promise.allSettled([
      ctx.setImportFlags(snapFlags),
      ctx.setRules(snapRules),
      ctx.setSampleJson(snapSample),
      ctx.setTemplates(snapTemplates),
    ]);
    throw err;
  }
}
