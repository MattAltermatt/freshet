const ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function htmlEscape(input: unknown): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[&<>"']/g, (c) => ENTITY_MAP[c]!);
}
