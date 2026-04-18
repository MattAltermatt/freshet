const FORBIDDEN_TAGS = ['script', 'iframe', 'link', 'object', 'embed'];

export function sanitize(html: string): string {
  let out = html;
  for (const tag of FORBIDDEN_TAGS) {
    const pairedRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfRe = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    out = out.replace(pairedRe, '').replace(selfRe, '');
  }
  out = out.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');
  out = out.replace(/\b(href|src)\s*=\s*"\s*(?:javascript|data|vbscript):[^"]*"/gi, '$1="about:blank"');
  out = out.replace(/\b(href|src)\s*=\s*'\s*(?:javascript|data|vbscript):[^']*'/gi, '$1="about:blank"');
  return out;
}
