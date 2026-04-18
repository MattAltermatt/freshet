const LINK_HELPER = /\{\{link\s+"([^"]*)"\s*\}\}/g;
const DATE_HELPER_WITH_FMT = /\{\{date\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}/g;
const DATE_HELPER_NO_FMT = /\{\{date\s+(@?[\w.]+)\s*\}\}/g;
const NUM_HELPER = /\{\{num\s+(@?[\w.]+)\s*\}\}/g;
const TRIPLE_BRACE = /\{\{\{([\w.]+)\}\}\}/g;
const EACH_OPEN = /\{\{#each\s+(@?[\w.]+)\s*\}\}/g;
const EACH_CLOSE = '{{/each}}';
const WHEN_WITH_ELSE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/when\}\}/g;
const WHEN_NO_ELSE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}([\s\S]*?)\{\{\/when\}\}/g;
const AT_VAR_IN_TAG = /\{\{@(\w+)\}\}/g;
const LIQUID_TAG = /\{%([^%]*)%\}/g;

function rewriteThisToItem(body: string): string {
  return body
    .replace(/\{\{\s*this\.([\w.]+)\s*\}\}/g, '{{ item.$1 }}')
    .replace(/\{\{\s*this\s*\}\}/g, '{{ item }}')
    .replace(/\bthis\.([\w.]+)/g, 'item.$1')
    .replace(/\bthis\b/g, 'item');
}

function migrateEachBlocks(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    EACH_OPEN.lastIndex = i;
    const m = EACH_OPEN.exec(s);
    if (!m) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, m.index);
    const path = m[1]!;
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let j = bodyStart;
    let closeIdx = -1;
    while (j < s.length) {
      EACH_OPEN.lastIndex = j;
      const nextOpen = EACH_OPEN.exec(s);
      const nextClose = s.indexOf(EACH_CLOSE, j);
      if (nextClose === -1) break;
      if (nextOpen && nextOpen.index < nextClose) {
        depth += 1;
        j = nextOpen.index + nextOpen[0].length;
      } else {
        depth -= 1;
        if (depth === 0) {
          closeIdx = nextClose;
          break;
        }
        j = nextClose + EACH_CLOSE.length;
      }
    }
    if (closeIdx === -1) {
      out += s.slice(m.index);
      break;
    }
    const innerBody = s.slice(bodyStart, closeIdx);
    const migratedInner = rewriteThisToItem(migrateEachBlocks(innerBody));
    out += `{% for item in ${path} %}${migratedInner}{% endfor %}`;
    i = closeIdx + EACH_CLOSE.length;
  }
  return out;
}

export function migrateTemplate(v1: string): string {
  let out = v1;
  out = out.replace(LINK_HELPER, (_m, tmpl: string) => `{{ "${tmpl}" | link }}`);
  out = out.replace(DATE_HELPER_WITH_FMT, (_m, p: string, f: string) => `{{ ${p} | date: "${f}" }}`);
  out = out.replace(DATE_HELPER_NO_FMT, (_m, p: string) => `{{ ${p} | date }}`);
  out = out.replace(NUM_HELPER, (_m, p: string) => `{{ ${p} | num }}`);
  out = out.replace(TRIPLE_BRACE, (_m, p: string) => `{{ ${p} | raw }}`);
  out = migrateEachBlocks(out);
  out = out.replace(WHEN_WITH_ELSE, (_m, l: string, r: string, t: string, e: string) =>
    `{% if ${l} == "${r}" %}${t}{% else %}${e}{% endif %}`,
  );
  out = out.replace(WHEN_NO_ELSE, (_m, l: string, r: string, b: string) =>
    `{% if ${l} == "${r}" %}${b}{% endif %}`,
  );
  out = out.replace(AT_VAR_IN_TAG, (_m, name: string) => `{{ vars.${name} }}`);
  out = out.replace(LIQUID_TAG, (_m, inner: string) =>
    `{%${inner.replace(/@(\w+)/g, 'vars.$1')}%}`,
  );
  return out;
}
