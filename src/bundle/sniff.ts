import type { FreshetBundle } from './schema';

export interface SniffPattern {
  id: string;
  kind: 'key' | 'value';
  regex: RegExp;
}

export const SNIFF_PATTERNS: readonly SniffPattern[] = [
  { id: 'KEY_SECRETY',   kind: 'key',   regex: /token|secret|key|password|auth|bearer|api[_-]?key|credential/i },
  { id: 'BEARER_PREFIX', kind: 'value', regex: /^Bearer\s+\S+/ },
  { id: 'JWT',           kind: 'value', regex: /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/ },
  { id: 'OAUTH_GOOGLE',  kind: 'value', regex: /^ya29\./ },
];

export interface SniffHit {
  field: string;
  patternId: string;
  patternRegex: string;
  matchedText: string;
}

function patternString(re: RegExp): string {
  return re.toString();
}

function scanKey(key: string, field: string, out: SniffHit[]): void {
  for (const p of SNIFF_PATTERNS) {
    if (p.kind !== 'key') continue;
    if (p.regex.test(key)) {
      // matchedText is the full key name — the thing the user recognizes as
      // the flagged item. Showing only the regex sub-match (e.g. just "auth"
      // out of "auth_token") would obscure what triggered the flag.
      out.push({
        field,
        patternId: p.id,
        patternRegex: patternString(p.regex),
        matchedText: key,
      });
    }
  }
}

function scanValue(value: string, field: string, out: SniffHit[]): void {
  for (const p of SNIFF_PATTERNS) {
    if (p.kind !== 'value') continue;
    const m = value.match(p.regex);
    if (m) {
      out.push({
        field,
        patternId: p.id,
        patternRegex: patternString(p.regex),
        matchedText: m[0],
      });
    }
  }
}

function walkJson(node: unknown, path: string, out: SniffHit[]): void {
  if (typeof node === 'string') {
    scanValue(node, path, out);
    return;
  }
  if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) walkJson(v, `${path}[${i}]`, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const childPath = `${path}.${k}`;
      scanKey(k, childPath, out);
      walkJson(v, childPath, out);
    }
  }
}

export function sniff(bundle: FreshetBundle): SniffHit[] {
  const hits: SniffHit[] = [];
  for (const [i, r] of bundle.rules.entries()) {
    if (!r.variables) continue;
    for (const [k, v] of Object.entries(r.variables)) {
      const field = `rules[${i}].variables.${k}`;
      scanKey(k, field, hits);
      scanValue(v, field, hits);
    }
  }
  for (const [i, t] of bundle.templates.entries()) {
    if (!t.sampleJson) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(t.sampleJson);
    } catch {
      continue;
    }
    walkJson(parsed, `templates[${i}].sampleJson`, hits);
  }
  return hits;
}
