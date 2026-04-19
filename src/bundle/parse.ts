import { validateBundle, type ValidationResult } from './schema';

export function parseBundle(rawText: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return { ok: false, errors: [`JSON parse error: ${(err as Error).message}`] };
  }
  return validateBundle(parsed);
}
