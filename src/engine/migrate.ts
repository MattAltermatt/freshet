const LINK_HELPER = /\{\{link\s+"([^"]*)"\s*\}\}/g;
const DATE_HELPER_WITH_FMT = /\{\{date\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}/g;
const DATE_HELPER_NO_FMT = /\{\{date\s+(@?[\w.]+)\s*\}\}/g;
const NUM_HELPER = /\{\{num\s+(@?[\w.]+)\s*\}\}/g;
const TRIPLE_BRACE = /\{\{\{([\w.]+)\}\}\}/g;
const EACH_BLOCK = /\{\{#each\s+(@?[\w.]+)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;
const WHEN_WITH_ELSE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/when\}\}/g;
const WHEN_NO_ELSE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{\/when\}\}/g;
const AT_VAR_IN_TAG = /\{\{@(\w+)\}\}/g;
const AT_IDENT_INLINE = /@(\w+)/g;

function rewriteEachBody(body: string): string {
  const innerRewritten = body.replace(EACH_BLOCK, (_m, path: string, inner: string) =>
    `{% for item in ${path} %}${rewriteEachBody(inner)}{% endfor %}`,
  );
  return innerRewritten
    // Padded forms first (the canonical v2 output shape)
    .replace(/\{\{\s*this\.([\w.]+)\s*\}\}/g, '{{ item.$1 }}')
    .replace(/\{\{\s*this\s*\}\}/g, '{{ item }}')
    // Bare identifiers inside v1 block tags (e.g. `{{#when this.on "y"}}`)
    .replace(/\bthis\.([\w.]+)/g, 'item.$1')
    .replace(/\bthis\b/g, 'item');
}

export function migrateTemplate(v1: string): string {
  let out = v1;
  out = out.replace(LINK_HELPER, (_m, tmpl: string) => `{{ "${tmpl}" | link }}`);
  out = out.replace(DATE_HELPER_WITH_FMT, (_m, p: string, f: string) => `{{ ${p} | date: "${f}" }}`);
  out = out.replace(DATE_HELPER_NO_FMT, (_m, p: string) => `{{ ${p} | date }}`);
  out = out.replace(NUM_HELPER, (_m, p: string) => `{{ ${p} | num }}`);
  out = out.replace(TRIPLE_BRACE, (_m, p: string) => `{{ ${p} | raw }}`);
  out = out.replace(EACH_BLOCK, (_m, p: string, body: string) =>
    `{% for item in ${p} %}${rewriteEachBody(body)}{% endfor %}`,
  );
  out = out.replace(WHEN_WITH_ELSE, (_m, l: string, r: string, t: string, e: string) =>
    `{% if ${l} == "${r}" %}${t}{% else %}${e}{% endif %}`,
  );
  out = out.replace(WHEN_NO_ELSE, (_m, l: string, r: string, b: string) =>
    `{% if ${l} == "${r}" %}${b}{% endif %}`,
  );
  out = out.replace(AT_VAR_IN_TAG, (_m, name: string) => `{{ vars.${name} }}`);
  out = out.replace(AT_IDENT_INLINE, (_m, name: string) => `vars.${name}`);
  return out;
}
