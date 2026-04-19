export interface BundleTemplate {
  name: string;
  source: string;
  sampleJson?: string;
}

export interface BundleRule {
  id: string;
  name?: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
  variables?: Record<string, string>;
  active: boolean;
}

export interface FreshetBundle {
  bundleSchemaVersion: 1;
  exportedAt: string;
  exportedBy?: string;
  appVersion: string;
  templates: BundleTemplate[];
  rules: BundleRule[];
}

export type ValidationResult =
  | { ok: true; bundle: FreshetBundle }
  | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

export function validateBundle(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['bundle must be a JSON object'] };
  }

  if (raw.bundleSchemaVersion !== 1) {
    errors.push(
      `bundleSchemaVersion must be 1 (got ${JSON.stringify(raw.bundleSchemaVersion)})`,
    );
  }
  if (!isString(raw.exportedAt)) errors.push('exportedAt must be a string');
  if (!isString(raw.appVersion)) errors.push('appVersion must be a string');
  if (raw.exportedBy !== undefined && !isString(raw.exportedBy)) {
    errors.push('exportedBy, if present, must be a string');
  }
  if (!Array.isArray(raw.templates)) errors.push('templates must be an array');
  if (!Array.isArray(raw.rules)) errors.push('rules must be an array');

  if (errors.length > 0) return { ok: false, errors };

  const templates: BundleTemplate[] = [];
  const seen = new Set<string>();
  for (const [i, t] of (raw.templates as unknown[]).entries()) {
    if (!isPlainObject(t)) {
      errors.push(`templates[${i}] must be an object`);
      continue;
    }
    if (!isString(t.name)) errors.push(`templates[${i}].name must be a string`);
    if (!isString(t.source)) errors.push(`templates[${i}].source must be a string`);
    if (t.sampleJson !== undefined && !isString(t.sampleJson)) {
      errors.push(`templates[${i}].sampleJson, if present, must be a string`);
    }
    if (isString(t.name) && seen.has(t.name)) {
      errors.push(`duplicate template name: ${t.name}`);
    }
    if (isString(t.name) && isString(t.source)) {
      seen.add(t.name);
      templates.push({
        name: t.name,
        source: t.source,
        ...(isString(t.sampleJson) ? { sampleJson: t.sampleJson } : {}),
      });
    }
  }

  const templateNames = new Set(templates.map((t) => t.name));
  const rules: BundleRule[] = [];
  for (const [i, r] of (raw.rules as unknown[]).entries()) {
    if (!isPlainObject(r)) {
      errors.push(`rules[${i}] must be an object`);
      continue;
    }
    if (!isString(r.id)) errors.push(`rules[${i}].id must be a string`);
    if (!isString(r.hostPattern)) errors.push(`rules[${i}].hostPattern must be a string`);
    if (!isString(r.pathPattern)) errors.push(`rules[${i}].pathPattern must be a string`);
    if (!isString(r.templateName)) errors.push(`rules[${i}].templateName must be a string`);
    if (!isBoolean(r.active)) errors.push(`rules[${i}].active must be a boolean`);
    if (r.name !== undefined && !isString(r.name)) {
      errors.push(`rules[${i}].name, if present, must be a string`);
    }
    if (r.variables !== undefined) {
      if (!isPlainObject(r.variables)) {
        errors.push(`rules[${i}].variables, if present, must be an object`);
      } else {
        for (const [k, v] of Object.entries(r.variables)) {
          if (!isString(v)) errors.push(`rules[${i}].variables.${k} must be a string`);
        }
      }
    }
    if (isString(r.templateName) && !templateNames.has(r.templateName)) {
      errors.push(
        `rules[${i}].templateName "${r.templateName}" does not match any template in the bundle`,
      );
    }
    if (
      isString(r.id) &&
      isString(r.hostPattern) &&
      isString(r.pathPattern) &&
      isString(r.templateName) &&
      isBoolean(r.active)
    ) {
      rules.push({
        id: r.id,
        hostPattern: r.hostPattern,
        pathPattern: r.pathPattern,
        templateName: r.templateName,
        active: r.active,
        ...(isString(r.name) ? { name: r.name } : {}),
        ...(isPlainObject(r.variables)
          ? { variables: r.variables as Record<string, string> }
          : {}),
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    bundle: {
      bundleSchemaVersion: 1,
      exportedAt: raw.exportedAt as string,
      appVersion: raw.appVersion as string,
      ...(isString(raw.exportedBy) ? { exportedBy: raw.exportedBy } : {}),
      templates,
      rules,
    },
  };
}
