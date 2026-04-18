/**
 * Phase 2 stub — Phase 4 fills in the real heuristic
 * (e.g. another JSON viewer already mutated document.body before our content
 * script ran). For now we always return ok=true; the UI branch in TopStrip
 * is kept so Phase 4 only flips this implementation.
 */
export interface ConflictReport {
  ok: boolean;
  reason?: string;
}

export function detectConflict(): ConflictReport {
  return { ok: true };
}
