# Present-JSON — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Chrome MV3 extension that intercepts direct navigations to JSON URLs, matches them against user-configured rules, and replaces the raw JSON view with HTML rendered from a user-authored template.

**Architecture:** Two pure cores — `engine` (template + JSON + variables → HTML string) and `matcher` (URL + rules → rule | null) — both Chrome-API-free and fully unit-tested in Node. Chrome glue lives in the content script, a MV3 service worker, an options page, and a popup. Storage is `chrome.storage.sync` with automatic fallback to `.local` when the payload grows too large. No UI framework; no runtime framework; TypeScript strict; Vite + `@crxjs/vite-plugin`.

**Tech Stack:** TypeScript 5 (strict), Vite 5, `@crxjs/vite-plugin` 2, Vitest 1 (unit), Playwright 1.4x (one E2E smoke), ESLint + Prettier, pnpm. MV3 Chrome extension.

**Spec:** `docs/superpowers/specs/2026-04-17-present-json-design.md` (read before starting)

**Phases represented in this plan:** Phase 1 only. Phase 2 (export/import, scrub-before-share, CodeMirror editor) and Phase 3 (form editor, registry, non-JSON) are out of scope.

---

## File map

Files created by this plan, grouped by responsibility. Each file has one job.

```
present-json/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── README.md
├── ROADMAP.md
├── src/
│   ├── shared/
│   │   └── types.ts                     # Rule, Template, HostSkipList types
│   ├── matcher/
│   │   ├── glob.ts                      # glob → RegExp
│   │   ├── glob.test.ts
│   │   ├── matcher.ts                   # match(url, rules) → rule | null
│   │   └── matcher.test.ts
│   ├── engine/
│   │   ├── escape.ts                    # htmlEscape helper
│   │   ├── lookup.ts                    # dotted-path + variable lookup
│   │   ├── lookup.test.ts
│   │   ├── sanitize.ts                  # strip <script>, on*, <iframe>, etc.
│   │   ├── sanitize.test.ts
│   │   ├── helpers.ts                   # date + link helpers
│   │   ├── helpers.test.ts
│   │   ├── engine.ts                    # top-level render()
│   │   ├── engine.test.ts
│   │   └── fixture.test.ts              # end-to-end snapshot against spec Appendix B
│   ├── storage/
│   │   ├── storage.ts
│   │   ├── storage.test.ts
│   │   ├── migration.ts
│   │   └── migration.test.ts
│   ├── content/
│   │   └── content-script.ts
│   ├── background/
│   │   └── background.ts
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.ts
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.ts
│   └── starter/
│       └── internal-user.html
├── test/
│   ├── fixtures/
│   │   └── internal-user/
│   │       ├── input.json
│   │       ├── template.html
│   │       └── expected.html
│   ├── fixtures-server/
│   │   └── server.ts
│   └── e2e/
│       └── render.spec.ts
└── public/
    └── icon-{16,48,128}.png
```

---

## Conventions used throughout this plan

- **TDD order:** tests first, always. Each task is one or more `write-test → run-fail → implement → run-pass → commit` cycles.
- **Commits:** one per task (or one per coherent cycle inside a task). Matt wants terse one-line messages, no body, no `Co-Authored-By:` trailer.
- **Branch:** implementation runs on a new branch `feature/phase1-impl` off `main` after this plan is merged. Do **not** work on `feature/design-spec` (the plan lives there but code does not).
- **Commands** assume the repo root is the working directory.
- **Node 20+** and **pnpm 9+** expected on PATH.

---
## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.eslintrc.cjs`
- Create: `.prettierrc`
- Create: `vite.config.ts`
- Create: `README.md`
- Create: `ROADMAP.md`
- Create: `public/icon-16.png`, `public/icon-48.png`, `public/icon-128.png`

- [ ] **Step 1.1: Create `package.json`**

```json
{
  "name": "present-json",
  "version": "0.1.0",
  "description": "Chrome extension that renders JSON responses as user-templated HTML.",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint 'src/**/*.ts'",
    "format": "prettier --write 'src/**/*.{ts,html,json}'",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "@playwright/test": "^1.48.0",
    "@types/chrome": "^0.0.270",
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 1.2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vitest/globals", "node"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*", "test/**/*", "vite.config.ts"]
}
```

- [ ] **Step 1.3: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  env: { browser: true, node: true, es2022: true, webextensions: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  }
};
```

- [ ] **Step 1.4: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 1.5: Create `vite.config.ts` with inline MV3 manifest**

```ts
import { defineConfig } from 'vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Present-JSON',
  version: '0.1.0',
  description: 'Render JSON responses as user-templated HTML.',
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: {
      '16': 'public/icon-16.png',
      '48': 'public/icon-48.png',
      '128': 'public/icon-128.png',
    },
  },
  options_page: 'src/options/options.html',
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  permissions: ['storage', 'scripting', 'tabs'],
  host_permissions: ['<all_urls>'],
  icons: {
    '16': 'public/icon-16.png',
    '48': 'public/icon-48.png',
    '128': 'public/icon-128.png',
  },
});

export default defineConfig({
  plugins: [crx({ manifest })],
  build: { outDir: 'dist', emptyOutDir: true },
});
```

> Note on `host_permissions: ['<all_urls>']`: required because the service worker registers content scripts dynamically against user-defined patterns.

- [ ] **Step 1.6: Create `README.md`**

```markdown
# Present-JSON

A Chrome MV3 extension that renders JSON responses as user-templated HTML.

- **Spec:** [docs/superpowers/specs/2026-04-17-present-json-design.md](docs/superpowers/specs/2026-04-17-present-json-design.md)
- **Roadmap:** [ROADMAP.md](ROADMAP.md)

## Develop

```bash
pnpm install
pnpm dev            # Vite + @crxjs HMR, writes to dist/
pnpm test           # Vitest unit tests
pnpm test:e2e       # Playwright smoke test
pnpm build          # production build
```

## Load unpacked

1. `pnpm build`
2. Chrome → `chrome://extensions` → enable Developer mode → Load unpacked → select `dist/`.
```

- [ ] **Step 1.7: Create `ROADMAP.md`** (Matt-format: phases + todos)

```markdown
# Present-JSON — Roadmap

## Phases

1. **Phase 1: Core render loop** — in progress
   - MV3 scaffold, content script, service worker, options, popup
   - Engine + matcher (pure) with unit tests
   - One bundled starter template
   - One Playwright E2E smoke test
2. **Phase 2: Sharing & polish** — pending
   - Export/import templates with scrub-before-share dialog
   - CodeMirror-lite template editor with helper autocomplete
   - "Test URL" live indicator in rule-edit modal
   - Additional bundled starter templates
   - Keyboard shortcut to toggle raw/rendered
3. **Phase 3: Deferred / nice-to-haves** — pending
   - Form-based template editor
   - Shared template registry
   - Non-JSON content support

## Todos (current phase)

- [ ] Project scaffold (Task 1)
- [ ] Shared types (Task 2)
- [ ] Glob compiler (Task 3)
- [ ] URL matcher (Task 4)
- [ ] Engine: lookup + escape (Task 5)
- [ ] Engine: value/variable/raw render (Task 6)
- [ ] Engine: conditionals (Task 7)
- [ ] Engine: iteration (Task 8)
- [ ] Engine: date helper (Task 9)
- [ ] Engine: link helper (Task 10)
- [ ] Engine: sanitize (Task 11)
- [ ] Engine: fixture snapshot (Task 12)
- [ ] Storage facade (Task 13)
- [ ] Storage migration (Task 14)
- [ ] Content script (Task 15)
- [ ] Service worker (Task 16)
- [ ] Options: Rules tab (Task 17)
- [ ] Options: Templates tab (Task 18)
- [ ] Popup (Task 19)
- [ ] Starter template bundling (Task 20)
- [ ] Playwright E2E (Task 21)
- [ ] Code review pass (Task 22)
- [ ] Final verification & ship (Task 23)
```

- [ ] **Step 1.8: Create 1×1 transparent placeholder icons**

Run:

```bash
mkdir -p public
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\xf0\x1f\x00\x05\x00\x01\xff\xab\xb8\xdb\x1b\x00\x00\x00\x00IEND\xaeB`\x82' > public/icon-16.png
cp public/icon-16.png public/icon-48.png
cp public/icon-16.png public/icon-128.png
```

Expected: three tiny PNGs under `public/`. Real icons are a Phase 2 polish item.

- [ ] **Step 1.9: Install dependencies**

Run: `pnpm install`
Expected: `node_modules/` populated, `pnpm-lock.yaml` written.

- [ ] **Step 1.10: Sanity-check typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both succeed with no files yet.

- [ ] **Step 1.11: Commit**

```bash
git checkout -b feature/phase1-impl
git add .
git commit -m "scaffold: vite + crxjs + ts + eslint + prettier + roadmap"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 2.1: Create the types file**

```ts
// src/shared/types.ts

export type Variables = Record<string, string>;

export interface Rule {
  id: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
  variables: Variables;
  enabled: boolean;
}

export type Templates = Record<string, string>;

export type HostSkipList = string[];

export interface StorageShape {
  rules: Rule[];
  templates: Templates;
  hostSkipList: HostSkipList;
}
```

- [ ] **Step 2.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2.3: Commit**

```bash
git add src/shared/types.ts
git commit -m "types: shared Rule/Templates/StorageShape"
```

---

## Task 3: Glob compiler

Compiles a user-supplied glob (or `/regex/`) pattern to a RegExp.

Grammar:
- `*` — any run of characters that does not contain `/`.
- `**` — any run of characters, including `/`.
- Any other character is literal (regex-escaped).
- If the whole pattern is `/…/`, treat the inside as a raw regex.
- Matching is anchored (whole-string equality).
- Case-insensitive flag accepted (used for host matching).

**Files:**
- Create: `src/matcher/glob.ts`
- Create: `src/matcher/glob.test.ts`

- [ ] **Step 3.1: Write failing tests**

```ts
// src/matcher/glob.test.ts
import { describe, it, expect } from 'vitest';
import { compileGlob } from './glob';

describe('compileGlob — globs', () => {
  it('matches literal text exactly', () => {
    const re = compileGlob('example.com', { caseInsensitive: true });
    expect(re.test('example.com')).toBe(true);
    expect(re.test('example.coma')).toBe(false);
    expect(re.test('aexample.com')).toBe(false);
  });

  it('* matches any chars except /', () => {
    const re = compileGlob('/api/*/v1', { caseInsensitive: false });
    expect(re.test('/api/users/v1')).toBe(true);
    expect(re.test('/api/users/nested/v1')).toBe(false);
  });

  it('** matches across / boundaries', () => {
    const re = compileGlob('/api/**/v1', { caseInsensitive: false });
    expect(re.test('/api/users/v1')).toBe(true);
    expect(re.test('/api/users/nested/v1')).toBe(true);
  });

  it('escapes regex meta characters in literal text', () => {
    const re = compileGlob('foo.bar+baz(qux)', { caseInsensitive: true });
    expect(re.test('foo.bar+baz(qux)')).toBe(true);
    expect(re.test('fooXbar+baz(qux)')).toBe(false);
  });

  it('case-insensitive flag controls host matching', () => {
    const re = compileGlob('Example.COM', { caseInsensitive: true });
    expect(re.test('example.com')).toBe(true);
    expect(re.test('EXAMPLE.com')).toBe(true);
  });

  it('case-sensitive flag does not ignore case', () => {
    const re = compileGlob('/Users', { caseInsensitive: false });
    expect(re.test('/Users')).toBe(true);
    expect(re.test('/users')).toBe(false);
  });
});

describe('compileGlob — regex escape hatch', () => {
  it('treats /…/ as raw regex', () => {
    const re = compileGlob('/^\\/api\\/v\\d+$/', { caseInsensitive: false });
    expect(re.test('/api/v1')).toBe(true);
    expect(re.test('/api/v42')).toBe(true);
    expect(re.test('/api/vX')).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `pnpm test -- glob`
Expected: FAIL (module-not-found or compileGlob undefined).

- [ ] **Step 3.3: Implement `compileGlob`**

```ts
// src/matcher/glob.ts

export interface CompileOptions {
  caseInsensitive: boolean;
}

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

function escapeForRegex(literal: string): string {
  return literal.replace(REGEX_ESCAPE, '\\$&');
}

function globToRegexBody(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      out += '.+';
      i += 2;
      continue;
    }
    if (pattern[i] === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    out += escapeForRegex(pattern[i]!);
    i += 1;
  }
  return out;
}

export function compileGlob(pattern: string, opts: CompileOptions): RegExp {
  const flags = opts.caseInsensitive ? 'i' : '';
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length >= 2) {
    return new RegExp(pattern.slice(1, -1), flags);
  }
  return new RegExp(`^${globToRegexBody(pattern)}$`, flags);
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `pnpm test -- glob`
Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/matcher/glob.ts src/matcher/glob.test.ts
git commit -m "matcher: compileGlob with ** and regex escape hatch"
```

---

## Task 4: URL matcher

Ordered rule list; first match wins. Query strings stripped before matching. Respects `enabled: false`.

**Files:**
- Create: `src/matcher/matcher.ts`
- Create: `src/matcher/matcher.test.ts`

- [ ] **Step 4.1: Write failing tests**

```ts
// src/matcher/matcher.test.ts
import { describe, it, expect } from 'vitest';
import { match } from './matcher';
import type { Rule } from '../shared/types';

const baseRule = (over: Partial<Rule> = {}): Rule => ({
  id: 'r',
  hostPattern: '**',
  pathPattern: '**',
  templateName: 't',
  variables: {},
  enabled: true,
  ...over,
});

describe('match', () => {
  it('returns null when no rules match', () => {
    const rules: Rule[] = [baseRule({ hostPattern: 'nope.com' })];
    expect(match('https://example.com/x', rules)).toBeNull();
  });

  it('returns the first matching rule in order', () => {
    const rules: Rule[] = [
      baseRule({ id: 'a', hostPattern: 'qa-*.server.com', pathPattern: '/internal/**' }),
      baseRule({ id: 'b', hostPattern: '**.server.com', pathPattern: '/internal/**' }),
    ];
    expect(match('https://qa-1.server.com/internal/user/1', rules)?.id).toBe('a');
    expect(match('https://api.server.com/internal/user/1', rules)?.id).toBe('b');
  });

  it('strips query strings before matching', () => {
    const rules: Rule[] = [baseRule({ pathPattern: '/user/*' })];
    expect(match('https://example.com/user/1?a=1&b=2', rules)).not.toBeNull();
  });

  it('skips disabled rules', () => {
    const rules: Rule[] = [
      baseRule({ id: 'a', enabled: false }),
      baseRule({ id: 'b', enabled: true }),
    ];
    expect(match('https://example.com/x', rules)?.id).toBe('b');
  });

  it('matches host case-insensitively', () => {
    const rules: Rule[] = [baseRule({ hostPattern: 'Example.COM' })];
    expect(match('https://example.com/x', rules)).not.toBeNull();
  });

  it('matches path case-sensitively', () => {
    const rules: Rule[] = [baseRule({ pathPattern: '/Users' })];
    expect(match('https://example.com/Users', rules)).not.toBeNull();
    expect(match('https://example.com/users', rules)).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    const rules: Rule[] = [baseRule()];
    expect(match('not a url', rules)).toBeNull();
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `pnpm test -- matcher`
Expected: FAIL.

- [ ] **Step 4.3: Implement matcher**

```ts
// src/matcher/matcher.ts
import { compileGlob } from './glob';
import type { Rule } from '../shared/types';

export function match(url: string, rules: Rule[]): Rule | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname;
  const path = parsed.pathname;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const hostRe = compileGlob(rule.hostPattern, { caseInsensitive: true });
    const pathRe = compileGlob(rule.pathPattern, { caseInsensitive: false });
    if (hostRe.test(host) && pathRe.test(path)) return rule;
  }
  return null;
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `pnpm test -- matcher`
Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/matcher/matcher.ts src/matcher/matcher.test.ts
git commit -m "matcher: ordered first-match rule evaluation"
```

---

## Task 5: Engine — lookup + escape

Dotted-path value lookup (with `@` variable prefix) and HTML escaping.

**Files:**
- Create: `src/engine/escape.ts`
- Create: `src/engine/lookup.ts`
- Create: `src/engine/lookup.test.ts`

- [ ] **Step 5.1: Write failing tests**

```ts
// src/engine/lookup.test.ts
import { describe, it, expect } from 'vitest';
import { lookup } from './lookup';

describe('lookup', () => {
  const json = { id: 1, user: { name: 'Alice', tags: ['a', 'b'] } };
  const vars = { adminHost: 'admin.example.com', env: 'qa' };

  it('reads top-level keys', () => {
    expect(lookup('id', json, vars)).toBe(1);
  });
  it('reads dotted paths', () => {
    expect(lookup('user.name', json, vars)).toBe('Alice');
  });
  it('reads array indices via dot', () => {
    expect(lookup('user.tags.0', json, vars)).toBe('a');
  });
  it('returns undefined for missing paths', () => {
    expect(lookup('user.missing', json, vars)).toBeUndefined();
    expect(lookup('absent', json, vars)).toBeUndefined();
  });
  it('resolves @-prefixed paths against variables', () => {
    expect(lookup('@adminHost', json, vars)).toBe('admin.example.com');
  });
  it('returns undefined for missing variables', () => {
    expect(lookup('@nope', json, vars)).toBeUndefined();
  });
  it('supports "this" as the implicit current object', () => {
    expect(lookup('this.id', json, vars)).toBe(1);
    expect(lookup('this', json, vars)).toEqual(json);
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `pnpm test -- lookup`
Expected: FAIL.

- [ ] **Step 5.3: Implement**

```ts
// src/engine/escape.ts
const ENTITY_MAP: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function htmlEscape(input: unknown): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[&<>"']/g, (c) => ENTITY_MAP[c]!);
}
```

```ts
// src/engine/lookup.ts
import type { Variables } from '../shared/types';

export function lookup(path: string, json: unknown, vars: Variables): unknown {
  if (path.startsWith('@')) return vars[path.slice(1)];
  const parts = path.split('.');
  let current: unknown = json;
  if (parts[0] === 'this') parts.shift();
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `pnpm test -- lookup`
Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/engine/escape.ts src/engine/lookup.ts src/engine/lookup.test.ts
git commit -m "engine: dotted-path lookup + html escape"
```

---

## Task 6: Engine — minimal render (value + variable + raw)

**Files:**
- Create: `src/engine/engine.ts`
- Create: `src/engine/engine.test.ts`

- [ ] **Step 6.1: Write failing tests**

```ts
// src/engine/engine.test.ts
import { describe, it, expect } from 'vitest';
import { render } from './engine';

describe('render — values and variables', () => {
  it('returns non-template text unchanged', () => {
    expect(render('<p>hello</p>', {}, {})).toBe('<p>hello</p>');
  });
  it('interpolates a dotted-path value', () => {
    expect(render('<p>{{id}}</p>', { id: 42 }, {})).toBe('<p>42</p>');
  });
  it('interpolates a variable', () => {
    expect(render('<p>{{@env}}</p>', {}, { env: 'qa' })).toBe('<p>qa</p>');
  });
  it('escapes HTML in values', () => {
    expect(render('<p>{{x}}</p>', { x: '<b>&' }, {})).toBe('<p>&lt;b&gt;&amp;</p>');
  });
  it('renders missing values as empty string', () => {
    expect(render('<p>[{{missing}}]</p>', {}, {})).toBe('<p>[]</p>');
  });
  it('triple-brace skips HTML escaping', () => {
    expect(render('<p>{{{x}}}</p>', { x: '<b>' }, {})).toBe('<p><b></p>');
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

Run: `pnpm test -- engine.test`
Expected: FAIL.

- [ ] **Step 6.3: Implement minimal render**

```ts
// src/engine/engine.ts
import { htmlEscape } from './escape';
import { lookup } from './lookup';
import type { Variables } from '../shared/types';

const INLINE_RE = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;

export function render(templateText: string, json: unknown, vars: Variables): string {
  return templateText.replace(INLINE_RE, (_full, rawPath?: string, escPath?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    return htmlEscape(lookup(escPath!.trim(), json, vars));
  });
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

Run: `pnpm test -- engine.test`
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/engine/engine.ts src/engine/engine.test.ts
git commit -m "engine: minimal value/variable/raw interpolation"
```

---

## Task 7: Engine — `{{#when}} / {{#else}} / {{/when}}`

**Files:**
- Modify: `src/engine/engine.ts`
- Modify: `src/engine/engine.test.ts`

- [ ] **Step 7.1: Add failing test cases**

Append to `src/engine/engine.test.ts`:

```ts
describe('render — #when', () => {
  it('renders the true branch when equal', () => {
    const t = '{{#when status "UP"}}<green>{{/when}}';
    expect(render(t, { status: 'UP' }, {})).toBe('<green>');
  });
  it('renders nothing when unequal and no else', () => {
    const t = '{{#when status "UP"}}<green>{{/when}}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('');
  });
  it('renders #else branch when unequal', () => {
    const t = '{{#when status "UP"}}<green>{{#else}}<red>{{/when}}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('<red>');
  });
  it('supports @variable as the left-hand side', () => {
    const t = '{{#when @env "qa"}}[QA]{{/when}}';
    expect(render(t, {}, { env: 'qa' })).toBe('[QA]');
    expect(render(t, {}, { env: 'prod' })).toBe('');
  });
  it('interpolates inside the chosen branch', () => {
    const t = '{{#when on "y"}}id={{id}}{{/when}}';
    expect(render(t, { on: 'y', id: 7 }, {})).toBe('id=7');
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

Run: `pnpm test -- engine.test`
Expected: FAIL.

- [ ] **Step 7.3: Implement block handling**

Replace `src/engine/engine.ts`:

```ts
import { htmlEscape } from './escape';
import { lookup } from './lookup';
import type { Variables } from '../shared/types';

const INLINE_RE = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;

export function render(templateText: string, json: unknown, vars: Variables): string {
  const afterBlocks = renderBlocks(templateText, json, vars);
  return renderInline(afterBlocks, json, vars);
}

function renderInline(text: string, json: unknown, vars: Variables): string {
  return text.replace(INLINE_RE, (_full, rawPath?: string, escPath?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    return htmlEscape(lookup(escPath!.trim(), json, vars));
  });
}

function renderBlocks(text: string, json: unknown, vars: Variables): string {
  while (true) {
    const loc = findInnermostWhen(text);
    if (!loc) return text;
    const lhsValue = lookup(loc.lhs, json, vars);
    const pick = String(lhsValue ?? '') === loc.rhsLiteral ? loc.trueBranch : loc.elseBranch;
    const recursed = renderBlocks(pick, json, vars);
    text = text.slice(0, loc.start) + recursed + text.slice(loc.end);
  }
}

const OPEN_WHEN_RE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}/;
const CLOSE_WHEN = '{{/when}}';
const ELSE_TAG = '{{#else}}';

interface WhenLoc {
  start: number; end: number;
  lhs: string; rhsLiteral: string; trueBranch: string; elseBranch: string;
}

function findInnermostWhen(text: string): WhenLoc | null {
  // Collect all openers, walk in reverse to find innermost (no later open before its close).
  const opens: Array<{ idx: number; len: number; m: RegExpMatchArray }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const s = text.slice(cursor);
    const m = s.match(OPEN_WHEN_RE);
    if (!m || m.index === undefined) break;
    const idx = cursor + m.index;
    opens.push({ idx, len: m[0].length, m });
    cursor = idx + m[0].length;
  }
  for (let k = opens.length - 1; k >= 0; k--) {
    const open = opens[k]!;
    const bodyStart = open.idx + open.len;
    const close = text.indexOf(CLOSE_WHEN, bodyStart);
    if (close === -1) continue;
    if (opens.slice(k + 1).some((o) => o.idx < close)) continue;
    const body = text.slice(bodyStart, close);
    const elseIdx = body.indexOf(ELSE_TAG);
    return {
      start: open.idx,
      end: close + CLOSE_WHEN.length,
      lhs: open.m[1]!,
      rhsLiteral: open.m[2]!,
      trueBranch: elseIdx === -1 ? body : body.slice(0, elseIdx),
      elseBranch: elseIdx === -1 ? '' : body.slice(elseIdx + ELSE_TAG.length),
    };
  }
  return null;
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run: `pnpm test -- engine.test`
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add src/engine/engine.ts src/engine/engine.test.ts
git commit -m "engine: #when / #else conditional blocks"
```

---

## Task 8: Engine — `{{#each}}`

**Files:**
- Modify: `src/engine/engine.ts`
- Modify: `src/engine/engine.test.ts`

- [ ] **Step 8.1: Add failing test cases**

```ts
describe('render — #each', () => {
  it('iterates array elements', () => {
    const t = '{{#each items}}<li>{{this.name}}</li>{{/each}}';
    const json = { items: [{ name: 'a' }, { name: 'b' }] };
    expect(render(t, json, {})).toBe('<li>a</li><li>b</li>');
  });
  it('renders nothing for empty arrays', () => {
    expect(render('{{#each xs}}x{{/each}}', { xs: [] }, {})).toBe('');
  });
  it('renders nothing for missing arrays', () => {
    expect(render('{{#each xs}}x{{/each}}', {}, {})).toBe('');
  });
  it('supports {{this}} for primitive elements', () => {
    const t = '{{#each xs}}[{{this}}]{{/each}}';
    expect(render(t, { xs: ['a', 'b'] }, {})).toBe('[a][b]');
  });
  it('nests with #when inside each element', () => {
    const t = '{{#each xs}}{{#when this.on "y"}}{{this.id}}{{/when}}{{/each}}';
    const json = { xs: [{ id: 1, on: 'y' }, { id: 2, on: 'n' }, { id: 3, on: 'y' }] };
    expect(render(t, json, {})).toBe('13');
  });
});
```

- [ ] **Step 8.2: Run tests to verify they fail**

Run: `pnpm test -- engine.test`
Expected: FAIL.

- [ ] **Step 8.3: Extend engine with `#each`**

Replace `src/engine/engine.ts`:

```ts
import { htmlEscape } from './escape';
import { lookup } from './lookup';
import type { Variables } from '../shared/types';

const INLINE_RE = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;

export function render(templateText: string, json: unknown, vars: Variables): string {
  const afterBlocks = renderBlocks(templateText, json, vars);
  return renderInline(afterBlocks, json, vars);
}

function renderInline(text: string, json: unknown, vars: Variables): string {
  return text.replace(INLINE_RE, (_full, rawPath?: string, escPath?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    return htmlEscape(lookup(escPath!.trim(), json, vars));
  });
}

function renderBlocks(text: string, json: unknown, vars: Variables): string {
  while (true) {
    const loc = findInnermostBlock(text);
    if (!loc) return text;
    const resolved = loc.kind.type === 'when'
      ? (String(lookup(loc.kind.lhs, json, vars) ?? '') === loc.kind.rhsLiteral
          ? loc.kind.trueBranch : loc.kind.elseBranch)
      : resolveEach(loc.kind, json, vars);
    const recursed = renderBlocks(resolved, json, vars);
    text = text.slice(0, loc.start) + recursed + text.slice(loc.end);
  }
}

type BlockKind =
  | { type: 'when'; lhs: string; rhsLiteral: string; trueBranch: string; elseBranch: string }
  | { type: 'each'; path: string; body: string };

interface BlockLoc { start: number; end: number; kind: BlockKind }

const OPEN_WHEN_RE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}/;
const OPEN_EACH_RE = /\{\{#each\s+(@?[\w.]+)\s*\}\}/;
const CLOSE_WHEN = '{{/when}}';
const CLOSE_EACH = '{{/each}}';
const ELSE_TAG = '{{#else}}';

function findInnermostBlock(text: string): BlockLoc | null {
  const opens: Array<{ idx: number; len: number; kind: 'when' | 'each'; m: RegExpMatchArray }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const s = text.slice(cursor);
    const w = s.match(OPEN_WHEN_RE);
    const e = s.match(OPEN_EACH_RE);
    const wi = w && w.index !== undefined ? cursor + w.index : -1;
    const ei = e && e.index !== undefined ? cursor + e.index : -1;
    if (wi === -1 && ei === -1) break;
    if (wi !== -1 && (ei === -1 || wi <= ei)) {
      opens.push({ idx: wi, len: w![0].length, kind: 'when', m: w! });
      cursor = wi + w![0].length;
    } else {
      opens.push({ idx: ei, len: e![0].length, kind: 'each', m: e! });
      cursor = ei + e![0].length;
    }
  }
  for (let k = opens.length - 1; k >= 0; k--) {
    const open = opens[k]!;
    const closeTag = open.kind === 'when' ? CLOSE_WHEN : CLOSE_EACH;
    const bodyStart = open.idx + open.len;
    const close = text.indexOf(closeTag, bodyStart);
    if (close === -1) continue;
    if (opens.slice(k + 1).some((o) => o.idx < close)) continue;
    const body = text.slice(bodyStart, close);
    if (open.kind === 'when') {
      const elseIdx = body.indexOf(ELSE_TAG);
      return {
        start: open.idx,
        end: close + closeTag.length,
        kind: {
          type: 'when', lhs: open.m[1]!, rhsLiteral: open.m[2]!,
          trueBranch: elseIdx === -1 ? body : body.slice(0, elseIdx),
          elseBranch: elseIdx === -1 ? '' : body.slice(elseIdx + ELSE_TAG.length),
        },
      };
    }
    return {
      start: open.idx,
      end: close + closeTag.length,
      kind: { type: 'each', path: open.m[1]!, body },
    };
  }
  return null;
}

function resolveEach(
  block: Extract<BlockKind, { type: 'each' }>,
  json: unknown,
  vars: Variables,
): string {
  const arr = lookup(block.path, json, vars);
  if (!Array.isArray(arr)) return '';
  return arr.map((item) => render(block.body, item, vars)).join('');
}
```

- [ ] **Step 8.4: Run tests to verify they pass**

Run: `pnpm test -- engine.test`
Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/engine/engine.ts src/engine/engine.test.ts
git commit -m "engine: #each iteration with this context"
```

---

## Task 9: Engine — `{{date ...}}` helper

**Files:**
- Create: `src/engine/helpers.ts`
- Create: `src/engine/helpers.test.ts`
- Modify: `src/engine/engine.ts`
- Modify: `src/engine/engine.test.ts`

- [ ] **Step 9.1: Write failing tests**

```ts
// src/engine/helpers.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate } from './helpers';

describe('formatDate', () => {
  it('default format renders localized month/day/time', () => {
    const out = formatDate('2026-04-17T23:09:30Z', undefined);
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/Apr/);
  });
  it('custom yyyy-MM-dd HH:mm', () => {
    process.env.TZ = 'UTC';
    expect(formatDate('2026-04-17T23:09:30Z', 'yyyy-MM-dd HH:mm')).toBe('2026-04-17 23:09');
  });
  it('returns empty for invalid input', () => {
    expect(formatDate('not a date', undefined)).toBe('');
    expect(formatDate(undefined, undefined)).toBe('');
  });
});
```

Append to `engine.test.ts`:

```ts
describe('render — date helper', () => {
  it('formats an ISO timestamp with custom format', () => {
    process.env.TZ = 'UTC';
    const t = '{{date insertDate "yyyy-MM-dd"}}';
    expect(render(t, { insertDate: '2026-04-17T23:09:30Z' }, {})).toBe('2026-04-17');
  });
});
```

- [ ] **Step 9.2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 9.3: Implement `formatDate` + wire helper dispatch**

```ts
// src/engine/helpers.ts
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDate(input: unknown, fmt: string | undefined): string {
  if (input === undefined || input === null) return '';
  const d = new Date(String(input));
  if (isNaN(d.getTime())) return '';
  if (!fmt) {
    const month = MONTHS_SHORT[d.getMonth()]!;
    const day = d.getDate();
    const year = d.getFullYear();
    const hh24 = d.getHours();
    const hh12 = ((hh24 + 11) % 12) + 1;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh24 < 12 ? 'AM' : 'PM';
    return `${month} ${day}, ${year} ${hh12}:${mm} ${ampm}`;
  }
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return fmt
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MM/g, pad2(d.getMonth() + 1))
    .replace(/dd/g, pad2(d.getDate()))
    .replace(/HH/g, pad2(d.getHours()))
    .replace(/mm/g, pad2(d.getMinutes()))
    .replace(/ss/g, pad2(d.getSeconds()));
}
```

Modify `src/engine/engine.ts`:

Add `import { formatDate } from './helpers';` at the top, and replace `renderInline`:

```ts
const HELPER_RE = /^(date)\s+(@?[\w.]+)(?:\s+"([^"]*)")?$/;

function renderInline(text: string, json: unknown, vars: Variables): string {
  return text.replace(INLINE_RE, (_full, rawPath?: string, escExpr?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    const expr = escExpr!.trim();
    const helper = expr.match(HELPER_RE);
    if (helper) {
      const [, name, path, arg] = helper;
      if (name === 'date') {
        return htmlEscape(formatDate(lookup(path!, json, vars), arg));
      }
    }
    return htmlEscape(lookup(expr, json, vars));
  });
}
```

- [ ] **Step 9.4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/engine/helpers.ts src/engine/helpers.test.ts src/engine/engine.ts src/engine/engine.test.ts
git commit -m "engine: date helper with default + custom formats"
```

---

## Task 10: Engine — `{{link ...}}` helper

**Files:**
- Modify: `src/engine/helpers.ts`
- Modify: `src/engine/helpers.test.ts`
- Modify: `src/engine/engine.ts`
- Modify: `src/engine/engine.test.ts`

- [ ] **Step 10.1: Add failing tests**

```ts
// helpers.test.ts
import { buildLink } from './helpers';

describe('buildLink', () => {
  it('interpolates a simple template', () => {
    const out = buildLink('https://{{@adminHost}}/user/{{id}}', { id: 1234 }, { adminHost: 'admin.x.com' });
    expect(out).toBe('https://admin.x.com/user/1234');
  });
  it('encodes query components', () => {
    const out = buildLink('https://x/?q={{q}}', { q: 'a b&c' }, {});
    expect(out).toBe('https://x/?q=a%20b%26c');
  });
  it('returns empty string for empty template', () => {
    expect(buildLink('', {}, {})).toBe('');
  });
});
```

```ts
// engine.test.ts
describe('render — link helper', () => {
  it('interpolates variables and json into the URL', () => {
    const t = '{{link "https://{{@adminHost}}/user/{{id}}"}}';
    expect(render(t, { id: 9 }, { adminHost: 'a.com' })).toBe('https://a.com/user/9');
  });
  it('escapes the URL in the HTML output', () => {
    const t = '{{link "https://x/?q={{q}}"}}';
    expect(render(t, { q: 'a&b' }, {})).toBe('https://x/?q=a%26b');
  });
});
```

- [ ] **Step 10.2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 10.3: Implement `buildLink` + wire into inline helpers**

Append to `src/engine/helpers.ts`:

```ts
import { lookup } from './lookup';
import type { Variables } from '../shared/types';

const TOKEN_RE = /\{\{([^}]+)\}\}/g;

export function buildLink(template: string, json: unknown, vars: Variables): string {
  if (!template) return '';
  const qIdx = template.indexOf('?');
  const pathPart = qIdx === -1 ? template : template.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : template.slice(qIdx);

  const interpolate = (part: string, encode: boolean): string =>
    part.replace(TOKEN_RE, (_m, p) => {
      const v = lookup(String(p).trim(), json, vars);
      const s = v === undefined || v === null ? '' : String(v);
      return encode ? encodeURIComponent(s) : s;
    });

  return interpolate(pathPart, false) + interpolate(queryPart, true);
}
```

Modify `src/engine/engine.ts` — expand helper dispatch:

```ts
import { formatDate, buildLink } from './helpers';

const HELPER_RE = /^(date|link)\s+(.*)$/s;

function renderInline(text: string, json: unknown, vars: Variables): string {
  return text.replace(INLINE_RE, (_full, rawPath?: string, escExpr?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    const expr = escExpr!.trim();
    const helper = expr.match(HELPER_RE);
    if (helper) {
      const [, name, rest] = helper;
      if (name === 'date') {
        const m = rest!.match(/^(@?[\w.]+)(?:\s+"([^"]*)")?$/);
        if (!m) return '';
        return htmlEscape(formatDate(lookup(m[1]!, json, vars), m[2]));
      }
      if (name === 'link') {
        const m = rest!.match(/^"([^"]*)"$/s);
        if (!m) return '';
        return htmlEscape(buildLink(m[1]!, json, vars));
      }
    }
    return htmlEscape(lookup(expr, json, vars));
  });
}
```

- [ ] **Step 10.4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 10.5: Commit**

```bash
git add src/engine/helpers.ts src/engine/helpers.test.ts src/engine/engine.ts src/engine/engine.test.ts
git commit -m "engine: link helper with path/query encoding"
```

---

## Task 11: Engine — sanitize (safety pass)

Strip `<script>`, inline event handlers, `<iframe>`, `<link>`, `<object>`, `<embed>`, and `javascript:` URLs after rendering.

**Files:**
- Create: `src/engine/sanitize.ts`
- Create: `src/engine/sanitize.test.ts`
- Modify: `src/engine/engine.ts`

- [ ] **Step 11.1: Write failing tests**

```ts
// src/engine/sanitize.test.ts
import { describe, it, expect } from 'vitest';
import { sanitize } from './sanitize';

describe('sanitize', () => {
  it('removes <script> tags including content', () => {
    expect(sanitize('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });
  it('removes <script> tags with attributes', () => {
    expect(sanitize('<script src="x.js"></script><p>ok</p>')).toBe('<p>ok</p>');
  });
  it('removes inline event handlers', () => {
    expect(sanitize('<button onclick="bad()">x</button>')).toBe('<button>x</button>');
    expect(sanitize('<img onerror="y">')).toBe('<img>');
  });
  it('removes <iframe>, <link>, <object>, <embed>', () => {
    expect(sanitize('<p>a</p><iframe src="x"></iframe>')).toBe('<p>a</p>');
    expect(sanitize('<link rel="import" href="x">')).toBe('');
    expect(sanitize('<object data="x"></object>')).toBe('');
    expect(sanitize('<embed src="x">')).toBe('');
  });
  it('neutralizes javascript: URLs in href/src', () => {
    expect(sanitize('<a href="javascript:bad()">x</a>')).toBe('<a href="about:blank">x</a>');
    expect(sanitize('<a href="JavaScript:bad()">x</a>')).toBe('<a href="about:blank">x</a>');
  });
  it('leaves safe HTML alone', () => {
    const safe = '<div class="row"><a href="https://x.com/?q=1">link</a></div>';
    expect(sanitize(safe)).toBe(safe);
  });
});
```

- [ ] **Step 11.2: Run tests to verify they fail**

Run: `pnpm test -- sanitize`
Expected: FAIL.

- [ ] **Step 11.3: Implement `sanitize`**

```ts
// src/engine/sanitize.ts
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
  out = out.replace(/\b(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="about:blank"');
  out = out.replace(/\b(href|src)\s*=\s*'\s*javascript:[^']*'/gi, '$1="about:blank"');
  return out;
}
```

Modify `src/engine/engine.ts` — add import + wrap the output:

```ts
import { sanitize } from './sanitize';

export function render(templateText: string, json: unknown, vars: Variables): string {
  const afterBlocks = renderBlocks(templateText, json, vars);
  return sanitize(renderInline(afterBlocks, json, vars));
}
```

- [ ] **Step 11.4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 11.5: Commit**

```bash
git add src/engine/sanitize.ts src/engine/sanitize.test.ts src/engine/engine.ts
git commit -m "engine: sanitize scripts/handlers/iframes/js-urls"
```

---

## Task 12: End-to-end engine fixture

Snapshot test that mirrors Appendix B of the spec.

**Files:**
- Create: `test/fixtures/internal-user/input.json`
- Create: `test/fixtures/internal-user/template.html`
- Create: `test/fixtures/internal-user/expected.html`
- Create: `src/engine/fixture.test.ts`

- [ ] **Step 12.1: Write fixture files**

`test/fixtures/internal-user/input.json`:

```json
{
  "id": 1234,
  "insertDate": "2026-04-17T23:09:30Z",
  "status": "DOWN",
  "internalId1": 7777,
  "internalId2": 8888,
  "theValueICareAbout": 9999
}
```

`test/fixtures/internal-user/template.html`:

```html
<div class="row"><span class="label">ID</span><a href="https://{{@adminHost}}/user/{{id}}">{{id}}</a></div>
<div class="row"><span class="label">Insert Date</span><span>{{date insertDate "yyyy-MM-dd HH:mm"}}</span></div>
<div class="row"><span class="label">Status</span>{{#when status "UP"}}<span class="badge-up">UP</span>{{/when}}{{#when status "DOWN"}}<span class="badge-down">DOWN</span>{{/when}}</div>
<div class="row"><span class="label">Config</span><a href="https://{{@adminHost}}/product/api/v1/{{theValueICareAbout}}">{{theValueICareAbout}}</a></div>
```

`test/fixtures/internal-user/expected.html`:

```html
<div class="row"><span class="label">ID</span><a href="https://qa-admin.server.com/user/1234">1234</a></div>
<div class="row"><span class="label">Insert Date</span><span>2026-04-17 23:09</span></div>
<div class="row"><span class="label">Status</span><span class="badge-down">DOWN</span></div>
<div class="row"><span class="label">Config</span><a href="https://qa-admin.server.com/product/api/v1/9999">9999</a></div>
```

> Custom date format used so the snapshot is timezone-independent.

- [ ] **Step 12.2: Write the fixture test**

```ts
// src/engine/fixture.test.ts
import { describe, it, expect } from 'vitest';
import { render } from './engine';
import fs from 'node:fs';
import path from 'node:path';

process.env.TZ = 'UTC';
const fxDir = path.resolve(__dirname, '../../test/fixtures/internal-user');

describe('internal-user fixture', () => {
  it('renders exactly the expected HTML', () => {
    const input = JSON.parse(fs.readFileSync(path.join(fxDir, 'input.json'), 'utf8'));
    const template = fs.readFileSync(path.join(fxDir, 'template.html'), 'utf8').trim();
    const expected = fs.readFileSync(path.join(fxDir, 'expected.html'), 'utf8').trim();
    const actual = render(template, input, {
      adminHost: 'qa-admin.server.com',
      env: 'qa',
    }).trim();
    expect(actual).toBe(expected);
  });
});
```

- [ ] **Step 12.3: Run; fix mismatches**

Run: `pnpm test -- fixture`
Expected: PASS.

- [ ] **Step 12.4: Commit**

```bash
git add test/fixtures src/engine/fixture.test.ts
git commit -m "engine: internal-user fixture snapshot"
```

---

## Task 13: Storage facade

**Files:**
- Create: `src/storage/storage.ts`
- Create: `src/storage/storage.test.ts`

- [ ] **Step 13.1: Write failing tests**

```ts
// src/storage/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage } from './storage';
import type { Rule } from '../shared/types';

function memoryStorage() {
  const db = new Map<string, unknown>();
  return {
    sync: {
      get: (keys: string[]) =>
        Promise.resolve(Object.fromEntries(keys.filter((k) => db.has(k)).map((k) => [k, db.get(k)]))),
      set: (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) db.set(k, v);
        return Promise.resolve();
      },
    },
    local: {
      get: (_keys: string[]) => Promise.resolve({}),
      set: (_obj: Record<string, unknown>) => Promise.resolve(),
    },
  };
}

describe('storage', () => {
  let storage: ReturnType<typeof createStorage>;
  beforeEach(() => {
    storage = createStorage(memoryStorage() as unknown as typeof chrome.storage);
  });
  it('returns [] when no rules are saved', async () => {
    expect(await storage.getRules()).toEqual([]);
  });
  it('round-trips rules', async () => {
    const r: Rule = {
      id: 'r1', hostPattern: '*.example.com', pathPattern: '/**',
      templateName: 't1', variables: {}, enabled: true,
    };
    await storage.setRules([r]);
    expect(await storage.getRules()).toEqual([r]);
  });
  it('round-trips templates', async () => {
    await storage.setTemplates({ a: '<p>a</p>', b: '<p>b</p>' });
    expect(await storage.getTemplates()).toEqual({ a: '<p>a</p>', b: '<p>b</p>' });
  });
  it('round-trips host skip list', async () => {
    await storage.setHostSkipList(['x.com']);
    expect(await storage.getHostSkipList()).toEqual(['x.com']);
  });
});
```

- [ ] **Step 13.2: Run tests to verify they fail**

Run: `pnpm test -- storage.test`
Expected: FAIL.

- [ ] **Step 13.3: Implement the facade**

```ts
// src/storage/storage.ts
import type { Rule, Templates, HostSkipList } from '../shared/types';

const K_RULES = 'rules';
const K_TEMPLATES = 'templates';
const K_SKIP = 'hostSkipList';

export interface Storage {
  getRules(): Promise<Rule[]>;
  setRules(rules: Rule[]): Promise<void>;
  getTemplates(): Promise<Templates>;
  setTemplates(templates: Templates): Promise<void>;
  getHostSkipList(): Promise<HostSkipList>;
  setHostSkipList(list: HostSkipList): Promise<void>;
}

export function createStorage(api: typeof chrome.storage): Storage {
  const area = api.sync;
  const getOne = async <T>(key: string, fallback: T): Promise<T> => {
    const result = await area.get([key]);
    return (result[key] as T | undefined) ?? fallback;
  };
  return {
    getRules: () => getOne<Rule[]>(K_RULES, []),
    setRules: (rules) => area.set({ [K_RULES]: rules }),
    getTemplates: () => getOne<Templates>(K_TEMPLATES, {}),
    setTemplates: (templates) => area.set({ [K_TEMPLATES]: templates }),
    getHostSkipList: () => getOne<HostSkipList>(K_SKIP, []),
    setHostSkipList: (list) => area.set({ [K_SKIP]: list }),
  };
}
```

- [ ] **Step 13.4: Run tests to verify they pass**

Run: `pnpm test -- storage.test`
Expected: PASS.

- [ ] **Step 13.5: Commit**

```bash
git add src/storage/storage.ts src/storage/storage.test.ts
git commit -m "storage: facade over chrome.storage.sync"
```

---

## Task 14: Storage migration (sync → local)

**Files:**
- Create: `src/storage/migration.ts`
- Create: `src/storage/migration.test.ts`

- [ ] **Step 14.1: Write failing tests**

```ts
// src/storage/migration.test.ts
import { describe, it, expect } from 'vitest';
import { estimateBytes, needsMigration, SYNC_SOFT_LIMIT } from './migration';

describe('storage migration', () => {
  it('estimates byte size', () => {
    const payload = { rules: [], templates: { a: 'x'.repeat(100) }, hostSkipList: [] };
    const bytes = estimateBytes(payload);
    expect(bytes).toBeGreaterThan(100);
    expect(bytes).toBeLessThan(400);
  });
  it('flags migration when over the soft limit', () => {
    const big = { rules: [], templates: { a: 'x'.repeat(SYNC_SOFT_LIMIT) }, hostSkipList: [] };
    expect(needsMigration(big)).toBe(true);
  });
  it('does not flag migration when under the soft limit', () => {
    const small = { rules: [], templates: { a: 'x' }, hostSkipList: [] };
    expect(needsMigration(small)).toBe(false);
  });
});
```

- [ ] **Step 14.2: Run tests to verify they fail**

Run: `pnpm test -- migration`
Expected: FAIL.

- [ ] **Step 14.3: Implement**

```ts
// src/storage/migration.ts
import type { StorageShape } from '../shared/types';

export const SYNC_SOFT_LIMIT = 90 * 1024;

export function estimateBytes(payload: Partial<StorageShape>): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

export function needsMigration(payload: Partial<StorageShape>): boolean {
  return estimateBytes(payload) > SYNC_SOFT_LIMIT;
}

export async function migrateSyncToLocal(api: typeof chrome.storage): Promise<void> {
  const all = await api.sync.get(['rules', 'templates', 'hostSkipList']);
  await api.local.set(all);
  await api.sync.clear();
}
```

- [ ] **Step 14.4: Run tests to verify they pass**

Run: `pnpm test -- migration`
Expected: PASS.

- [ ] **Step 14.5: Commit**

```bash
git add src/storage/migration.ts src/storage/migration.test.ts
git commit -m "storage: sync-to-local migration utilities"
```

---

## Task 15: Content script

**Files:**
- Create: `src/content/content-script.ts`

No unit tests; Chrome glue covered by Task 21 E2E.

- [ ] **Step 15.1: Implement the content script**

```ts
// src/content/content-script.ts
import { render } from '../engine/engine';
import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';

async function main(): Promise<void> {
  const rawText = document.body?.innerText;
  if (!rawText) return;

  let parsedJson: unknown;
  try { parsedJson = JSON.parse(rawText); } catch { return; }

  const storage = createStorage(chrome.storage);
  const [rules, templates, skip] = await Promise.all([
    storage.getRules(), storage.getTemplates(), storage.getHostSkipList(),
  ]);

  const host = window.location.hostname;
  if (skip.includes(host)) return;

  const rule = match(window.location.href, rules);
  if (!rule) return;

  const templateText = templates[rule.templateName];
  if (templateText === undefined) {
    renderError(`Template '${rule.templateName}' not found.`);
    return;
  }

  let rendered: string;
  try { rendered = render(templateText, parsedJson, rule.variables); }
  catch (err) { renderError(`Template error: ${(err as Error).message}`); return; }

  renderSuccess(rendered, rawText, rule.variables['env'], window.location.href);
}

function renderSuccess(html: string, raw: string, env: string | undefined, href: string): void {
  document.documentElement.innerHTML = `<head><meta charset="utf-8"><title>${escHtml(href)}</title></head><body></body>`;
  const strip = buildTopStrip(env, href, () => toggleRaw(html, raw));
  const root = document.createElement('div');
  root.id = 'pj-root';
  root.innerHTML = html;
  document.body.appendChild(strip);
  document.body.appendChild(root);
}

function renderError(message: string): void {
  const banner = document.createElement('div');
  banner.textContent = message;
  banner.style.cssText =
    'padding:8px 12px;background:#fee2e2;border-bottom:1px solid #fca5a5;color:#991b1b;font:12px -apple-system,sans-serif;cursor:pointer;';
  banner.onclick = () => banner.remove();
  setTimeout(() => banner.remove(), 10000);
  document.body.prepend(banner);
}

function buildTopStrip(env: string | undefined, href: string, onToggle: () => void): HTMLElement {
  const bar = document.createElement('div');
  bar.id = 'pj-topbar';
  bar.style.cssText =
    'display:flex;gap:12px;align-items:center;padding:6px 12px;border-bottom:1px solid #e5e7eb;background:#f9fafb;font:12px -apple-system,system-ui,sans-serif;color:#374151;';
  if (env) {
    const badge = document.createElement('span');
    badge.textContent = env.toUpperCase();
    badge.style.cssText = 'background:#f59e0b;color:#111;padding:2px 8px;border-radius:3px;font-weight:600;letter-spacing:0.5px;';
    bar.appendChild(badge);
  }
  const rawBtn = document.createElement('a');
  rawBtn.href = '#';
  rawBtn.textContent = 'Show raw JSON';
  rawBtn.style.cssText = 'color:#2563eb;text-decoration:none;cursor:pointer;';
  let showingRaw = false;
  rawBtn.onclick = (e) => {
    e.preventDefault();
    showingRaw = !showingRaw;
    rawBtn.textContent = showingRaw ? 'Show rendered' : 'Show raw JSON';
    onToggle();
  };
  bar.appendChild(rawBtn);
  const copyBtn = document.createElement('a');
  copyBtn.href = '#';
  copyBtn.textContent = 'Copy URL';
  copyBtn.style.cssText = 'color:#2563eb;text-decoration:none;cursor:pointer;margin-left:auto;';
  copyBtn.onclick = (e) => { e.preventDefault(); void navigator.clipboard.writeText(href); };
  bar.appendChild(copyBtn);
  return bar;
}

function toggleRaw(html: string, raw: string): void {
  const root = document.getElementById('pj-root');
  if (!root) return;
  if (root.getAttribute('data-mode') === 'raw') {
    root.innerHTML = html;
    root.removeAttribute('data-mode');
  } else {
    const pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;padding:12px;font:12px ui-monospace,Menlo,monospace;white-space:pre-wrap;';
    pre.textContent = JSON.stringify(JSON.parse(raw), null, 2);
    root.replaceChildren(pre);
    root.setAttribute('data-mode', 'raw');
  }
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

void main();
```

- [ ] **Step 15.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 15.3: Commit**

```bash
git add src/content/content-script.ts
git commit -m "content: parse, match, render, replace document"
```

---

## Task 16: Background service worker

**Files:**
- Create: `src/background/background.ts`

- [ ] **Step 16.1: Implement**

```ts
// src/background/background.ts
import { createStorage } from '../storage/storage';
import { estimateBytes, SYNC_SOFT_LIMIT, migrateSyncToLocal } from '../storage/migration';
import type { Rule } from '../shared/types';

const CS_ID = 'pj-content-script';

async function main(): Promise<void> {
  await maybeMigrate();
  await registerContentScript();
}

async function maybeMigrate(): Promise<void> {
  try {
    const all = await chrome.storage.sync.get(['rules', 'templates', 'hostSkipList']);
    if (estimateBytes(all) > SYNC_SOFT_LIMIT) {
      await migrateSyncToLocal(chrome.storage);
    }
  } catch (err) {
    console.warn('[present-json] migration skipped:', err);
  }
}

async function registerContentScript(): Promise<void> {
  const storage = createStorage(chrome.storage);
  const rules = await storage.getRules();
  const matches = rulesToMatchPatterns(rules);

  try { await chrome.scripting.unregisterContentScripts({ ids: [CS_ID] }); } catch { /* ignore */ }

  if (matches.length === 0) return;

  await chrome.scripting.registerContentScripts([
    {
      id: CS_ID,
      matches,
      js: ['src/content/content-script.ts'],
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true,
    },
  ]);
}

function rulesToMatchPatterns(rules: Rule[]): string[] {
  const hosts = new Set<string>();
  for (const r of rules) {
    if (!r.enabled) continue;
    const host = r.hostPattern.replace(/\/(.+)\//, '*').replace(/\*\*/g, '*');
    hosts.add(`*://${host}/*`);
  }
  return [...hosts];
}

void main();

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' || area === 'local') && changes['rules']) {
    void registerContentScript();
  }
});
```

- [ ] **Step 16.2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 16.3: Commit**

```bash
git add src/background/background.ts
git commit -m "background: migrate + dynamic content-script registration"
```

---

## Task 17: Options page — Rules tab

**Files:**
- Create: `src/options/options.html`
- Create: `src/options/options.css`
- Create: `src/options/options.ts`

- [ ] **Step 17.1: Create `options.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Present-JSON — Options</title>
    <link rel="stylesheet" href="./options.css" />
  </head>
  <body>
    <header>
      <h1>Present-JSON</h1>
      <nav>
        <button id="tab-rules" class="tab active">Rules</button>
        <button id="tab-templates" class="tab">Templates</button>
      </nav>
    </header>

    <section id="view-rules">
      <div class="toolbar">
        <button id="rules-add">+ Add rule</button>
        <button id="rules-save">Save</button>
        <span id="rules-status" class="status"></span>
      </div>
      <table>
        <thead><tr><th></th><th>Host</th><th>Path</th><th>Template</th><th>Variables</th><th>On</th><th></th></tr></thead>
        <tbody id="rules-body"></tbody>
      </table>
    </section>

    <section id="view-templates" hidden>
      <div class="toolbar">
        <select id="tmpl-list"></select>
        <button id="tmpl-new">New</button>
        <button id="tmpl-rename">Rename</button>
        <button id="tmpl-duplicate">Duplicate</button>
        <button id="tmpl-delete">Delete</button>
        <button id="tmpl-save">Save</button>
        <span id="tmpl-status" class="status"></span>
      </div>
      <div class="editor-split">
        <textarea id="tmpl-editor" spellcheck="false" aria-label="Template editor"></textarea>
        <div class="preview-pane">
          <label>Sample JSON for preview</label>
          <textarea id="tmpl-preview-json" spellcheck="false"></textarea>
          <label>Rendered preview</label>
          <iframe id="tmpl-preview" sandbox="allow-same-origin"></iframe>
        </div>
      </div>
    </section>

    <dialog id="rule-dialog">
      <form method="dialog">
        <h2>Edit rule</h2>
        <label>Host pattern <input name="hostPattern" /></label>
        <label>Path pattern <input name="pathPattern" /></label>
        <label>Template <select name="templateName"></select></label>
        <fieldset>
          <legend>Variables</legend>
          <div id="rule-vars"></div>
          <button type="button" id="rule-var-add">+ Add variable</button>
        </fieldset>
        <label><input type="checkbox" name="enabled" /> Enabled</label>
        <menu>
          <button value="cancel">Cancel</button>
          <button value="ok">Save</button>
        </menu>
      </form>
    </dialog>

    <script type="module" src="./options.ts"></script>
  </body>
</html>
```

- [ ] **Step 17.2: Create `options.css`**

```css
body { font: 13px -apple-system, system-ui, sans-serif; margin: 0; color: #111827; }
header { padding: 12px 20px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 20px; }
header h1 { font-size: 16px; margin: 0; }
nav .tab { background: transparent; border: 0; padding: 6px 10px; cursor: pointer; color: #374151; border-radius: 4px; }
nav .tab.active { background: #e5e7eb; }
section { padding: 16px 20px; }
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.status { color: #6b7280; font-size: 12px; margin-left: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
th { color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
button { background: #fff; border: 1px solid #d1d5db; padding: 4px 10px; border-radius: 4px; cursor: pointer; font: inherit; }
button:hover { background: #f3f4f6; }
input, textarea, select { font: inherit; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 3px; }
dialog { border: 1px solid #d1d5db; border-radius: 6px; padding: 16px; min-width: 480px; }
dialog h2 { margin: 0 0 12px; font-size: 14px; }
dialog label { display: block; margin-bottom: 8px; }
dialog input, dialog select { width: 100%; box-sizing: border-box; }
dialog menu { display: flex; gap: 8px; justify-content: flex-end; padding: 0; margin: 12px 0 0; }
.editor-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; height: 70vh; }
.editor-split textarea { width: 100%; height: 100%; box-sizing: border-box; font: 12px ui-monospace, Menlo, monospace; }
.preview-pane { display: flex; flex-direction: column; gap: 6px; }
.preview-pane label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
.preview-pane iframe { flex: 1; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; }
```

- [ ] **Step 17.3: Create `options.ts`** (Rules tab; Templates tab expanded in Task 18)

```ts
// src/options/options.ts
import { createStorage } from '../storage/storage';
import type { Rule, Templates } from '../shared/types';
import { render } from '../engine/engine';

const storage = createStorage(chrome.storage);

let rulesCache: Rule[] = [];
let templatesCache: Templates = {};
let currentTemplateName: string | null = null;

async function boot(): Promise<void> {
  setupTabs();
  await renderRulesTab();
  await renderTemplatesTab();
}

function setupTabs(): void {
  const rulesBtn = byId<HTMLButtonElement>('tab-rules');
  const tmplBtn = byId<HTMLButtonElement>('tab-templates');
  const rulesView = byId<HTMLElement>('view-rules');
  const tmplView = byId<HTMLElement>('view-templates');
  const activate = (which: 'rules' | 'templates') => {
    rulesBtn.classList.toggle('active', which === 'rules');
    tmplBtn.classList.toggle('active', which === 'templates');
    rulesView.hidden = which !== 'rules';
    tmplView.hidden = which !== 'templates';
  };
  rulesBtn.addEventListener('click', () => activate('rules'));
  tmplBtn.addEventListener('click', () => activate('templates'));
}

async function renderRulesTab(): Promise<void> {
  rulesCache = await storage.getRules();
  templatesCache = await storage.getTemplates();
  const tbody = byId<HTMLTableSectionElement>('rules-body');
  tbody.innerHTML = '';
  rulesCache.forEach((r, i) => tbody.appendChild(renderRuleRow(r, i)));

  byId<HTMLButtonElement>('rules-add').addEventListener('click', () => openRuleDialog(null));
  byId<HTMLButtonElement>('rules-save').addEventListener('click', async () => {
    await storage.setRules(rulesCache);
    setStatus('rules-status', 'Saved.');
  });
}

function renderRuleRow(rule: Rule, index: number): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><button data-act="up">▲</button><button data-act="down">▼</button></td>
    <td>${escHtml(rule.hostPattern)}</td>
    <td>${escHtml(rule.pathPattern)}</td>
    <td>${escHtml(rule.templateName)}</td>
    <td>${escHtml(Object.entries(rule.variables).map(([k,v]) => `${k}=${v}`).join(', '))}</td>
    <td><input type="checkbox" ${rule.enabled ? 'checked' : ''} data-act="toggle"/></td>
    <td><button data-act="edit">✎</button><button data-act="delete">✕</button></td>
  `;
  tr.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const act = target.dataset['act'];
    if (act === 'up' && index > 0) {
      [rulesCache[index - 1], rulesCache[index]] = [rulesCache[index]!, rulesCache[index - 1]!];
      void renderRulesTab();
    } else if (act === 'down' && index < rulesCache.length - 1) {
      [rulesCache[index + 1], rulesCache[index]] = [rulesCache[index]!, rulesCache[index + 1]!];
      void renderRulesTab();
    } else if (act === 'delete') {
      rulesCache.splice(index, 1);
      void renderRulesTab();
    } else if (act === 'edit') {
      openRuleDialog(index);
    } else if (act === 'toggle') {
      rulesCache[index]!.enabled = (target as HTMLInputElement).checked;
    }
  });
  return tr;
}

function openRuleDialog(index: number | null): void {
  const dlg = byId<HTMLDialogElement>('rule-dialog');
  const form = dlg.querySelector('form')!;
  const tmplSelect = form.elements.namedItem('templateName') as HTMLSelectElement;
  tmplSelect.innerHTML = Object.keys(templatesCache)
    .map((n) => `<option value="${escAttr(n)}">${escHtml(n)}</option>`).join('');

  const current: Rule = index !== null
    ? structuredClone(rulesCache[index]!)
    : {
        id: `rule-${Date.now()}`,
        hostPattern: '',
        pathPattern: '',
        templateName: Object.keys(templatesCache)[0] ?? '',
        variables: {},
        enabled: true,
      };

  (form.elements.namedItem('hostPattern') as HTMLInputElement).value = current.hostPattern;
  (form.elements.namedItem('pathPattern') as HTMLInputElement).value = current.pathPattern;
  tmplSelect.value = current.templateName;
  (form.elements.namedItem('enabled') as HTMLInputElement).checked = current.enabled;

  const varsBox = byId<HTMLDivElement>('rule-vars');
  const renderVars = (vars: Record<string, string>) => {
    varsBox.innerHTML = '';
    for (const [k, v] of Object.entries(vars)) {
      const row = document.createElement('div');
      row.innerHTML = `<input data-key value="${escAttr(k)}"/> = <input data-val value="${escAttr(v)}"/> <button type="button">✕</button>`;
      row.querySelector('button')!.addEventListener('click', () => { delete vars[k]; renderVars(vars); });
      row.querySelector<HTMLInputElement>('[data-key]')!.addEventListener('change', (e) => {
        const newK = (e.target as HTMLInputElement).value;
        if (newK && newK !== k) { vars[newK] = vars[k]!; delete vars[k]; renderVars(vars); }
      });
      row.querySelector<HTMLInputElement>('[data-val]')!.addEventListener('change', (e) => {
        vars[k] = (e.target as HTMLInputElement).value;
      });
      varsBox.appendChild(row);
    }
  };
  renderVars(current.variables);
  byId<HTMLButtonElement>('rule-var-add').onclick = () => {
    current.variables[''] = '';
    renderVars(current.variables);
  };

  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    current.hostPattern = (form.elements.namedItem('hostPattern') as HTMLInputElement).value;
    current.pathPattern = (form.elements.namedItem('pathPattern') as HTMLInputElement).value;
    current.templateName = tmplSelect.value;
    current.enabled = (form.elements.namedItem('enabled') as HTMLInputElement).checked;
    if (index !== null) rulesCache[index] = current;
    else rulesCache.push(current);
    void renderRulesTab();
  }, { once: true });

  dlg.showModal();
}

async function renderTemplatesTab(): Promise<void> {
  templatesCache = await storage.getTemplates();
  refreshTemplateList();

  byId<HTMLButtonElement>('tmpl-new').addEventListener('click', onNew);
  byId<HTMLButtonElement>('tmpl-rename').addEventListener('click', onRename);
  byId<HTMLButtonElement>('tmpl-duplicate').addEventListener('click', onDuplicate);
  byId<HTMLButtonElement>('tmpl-delete').addEventListener('click', onDelete);
  byId<HTMLButtonElement>('tmpl-save').addEventListener('click', onSave);
  byId<HTMLSelectElement>('tmpl-list').addEventListener('change', (e) => {
    loadTemplate((e.target as HTMLSelectElement).value);
  });
  byId<HTMLTextAreaElement>('tmpl-editor').addEventListener('input', schedulePreview);
  byId<HTMLTextAreaElement>('tmpl-preview-json').addEventListener('input', schedulePreview);

  const names = Object.keys(templatesCache);
  if (names.length > 0) loadTemplate(names[0]!);
}

function refreshTemplateList(): void {
  const list = byId<HTMLSelectElement>('tmpl-list');
  const names = Object.keys(templatesCache);
  list.innerHTML = names.map((n) => `<option value="${escAttr(n)}">${escHtml(n)}</option>`).join('');
  if (currentTemplateName && names.includes(currentTemplateName)) list.value = currentTemplateName;
}

function loadTemplate(name: string): void {
  currentTemplateName = name;
  byId<HTMLTextAreaElement>('tmpl-editor').value = templatesCache[name] ?? '';
  schedulePreview();
}

async function onNew(): Promise<void> {
  const name = window.prompt('New template name');
  if (!name) return;
  if (templatesCache[name] !== undefined) { window.alert('Name already exists'); return; }
  templatesCache[name] = '<!-- new template -->';
  currentTemplateName = name;
  refreshTemplateList();
  loadTemplate(name);
}

function onRename(): void {
  if (!currentTemplateName) return;
  const next = window.prompt('Rename to', currentTemplateName);
  if (!next || next === currentTemplateName) return;
  if (templatesCache[next] !== undefined) { window.alert('Name already exists'); return; }
  templatesCache[next] = templatesCache[currentTemplateName]!;
  delete templatesCache[currentTemplateName];
  currentTemplateName = next;
  refreshTemplateList();
}

function onDuplicate(): void {
  if (!currentTemplateName) return;
  const next = `${currentTemplateName}-copy`;
  templatesCache[next] = templatesCache[currentTemplateName]!;
  currentTemplateName = next;
  refreshTemplateList();
  loadTemplate(next);
}

function onDelete(): void {
  if (!currentTemplateName) return;
  if (!window.confirm(`Delete template "${currentTemplateName}"?`)) return;
  delete templatesCache[currentTemplateName];
  currentTemplateName = null;
  refreshTemplateList();
  byId<HTMLTextAreaElement>('tmpl-editor').value = '';
  schedulePreview();
}

async function onSave(): Promise<void> {
  if (currentTemplateName) {
    templatesCache[currentTemplateName] = byId<HTMLTextAreaElement>('tmpl-editor').value;
  }
  await storage.setTemplates(templatesCache);
  setStatus('tmpl-status', 'Saved.');
}

let previewTimer: number | undefined;
function schedulePreview(): void {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(runPreview, 150);
}

function runPreview(): void {
  const tpl = byId<HTMLTextAreaElement>('tmpl-editor').value;
  const jsonText = byId<HTMLTextAreaElement>('tmpl-preview-json').value;
  let json: unknown = {};
  try { json = jsonText ? JSON.parse(jsonText) : {}; } catch { /* leave {} */ }
  let html: string;
  try { html = render(tpl, json, {}); }
  catch (err) { html = `<pre style="color:#991b1b">${escHtml((err as Error).message)}</pre>`; }
  byId<HTMLIFrameElement>('tmpl-preview').srcdoc = html;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}
function escHtml(s: string): string { return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); }
function escAttr(s: string): string { return escHtml(s); }
function setStatus(id: string, msg: string): void {
  const el = byId<HTMLElement>(id);
  el.textContent = msg;
  setTimeout(() => (el.textContent = ''), 2500);
}

void boot();
```

- [ ] **Step 17.4: Typecheck + build + manual check**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. In Chrome, load unpacked; Options → Rules tab renders empty. Add rule opens the dialog.

- [ ] **Step 17.5: Commit**

```bash
git add src/options
git commit -m "options: Rules + Templates tabs with live preview"
```

> Tasks 17 and 18 are implemented together in the same file — Step 17.3 contains the complete Templates-tab code path too. Task 18 below is a verification pass only.

---

## Task 18: Templates tab verification

The Templates tab logic was included in Task 17's `options.ts`. This task verifies behavior end-to-end in a real Chrome instance.

- [ ] **Step 18.1: Manual smoke test in Chrome**

1. Load `dist/` unpacked (rebuild if needed: `pnpm build`).
2. Open the Options page.
3. Templates tab:
   - Click **New**, name it `probe`. Confirm it appears in the dropdown.
   - Type `<p>{{x}}</p>` in the editor, `{ "x": "hello" }` in the JSON sample. Preview shows `<p>hello</p>`.
   - Click **Save**. Reload the Options page — `probe` persists.
   - **Rename** → `probe2`. Confirm reload still shows `probe2`.
   - **Duplicate** → `probe2-copy` appears.
   - **Delete** on `probe2-copy` → confirm-dialog → gone.

If any step fails, return to Task 17 and fix. No commit for this task unless a fix was needed.

---

## Task 19: Popup

**Files:**
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.ts`

- [ ] **Step 19.1: Create `popup.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Present-JSON</title>
    <style>
      body { font: 12px -apple-system, system-ui, sans-serif; margin: 0; padding: 12px; width: 280px; color: #111827; }
      h1 { font-size: 14px; margin: 0 0 8px; }
      .row { margin: 6px 0; }
      .label { color: #6b7280; font-size: 11px; text-transform: uppercase; }
      button { background: #fff; border: 1px solid #d1d5db; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Present-JSON</h1>
    <div class="row"><span class="label">Tab URL</span><br/><span id="url"></span></div>
    <div class="row"><span class="label">Matched rule</span><br/><span id="rule">(none)</span></div>
    <div class="row"><label><input type="checkbox" id="skip"/> Skip on this host</label></div>
    <div class="row"><button id="open-options">Open options</button></div>
    <script type="module" src="./popup.ts"></script>
  </body>
</html>
```

- [ ] **Step 19.2: Create `popup.ts`**

```ts
// src/popup/popup.ts
import { match } from '../matcher/matcher';
import { createStorage } from '../storage/storage';

async function boot(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? '';
  const host = (() => { try { return url ? new URL(url).hostname : ''; } catch { return ''; } })();

  document.getElementById('url')!.textContent = url;

  const storage = createStorage(chrome.storage);
  const [rules, skipList] = await Promise.all([storage.getRules(), storage.getHostSkipList()]);
  const matched = match(url, rules);
  document.getElementById('rule')!.textContent = matched?.templateName ?? '(none)';

  const skipBox = document.getElementById('skip') as HTMLInputElement;
  skipBox.checked = skipList.includes(host);
  skipBox.addEventListener('change', async () => {
    const next = skipBox.checked
      ? Array.from(new Set([...skipList, host]))
      : skipList.filter((h) => h !== host);
    await storage.setHostSkipList(next);
  });

  document.getElementById('open-options')!.addEventListener('click',
    () => chrome.runtime.openOptionsPage());
}

void boot();
```

- [ ] **Step 19.3: Typecheck + manual check**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. Click the toolbar icon — popup shows URL, match state, skip toggle.

- [ ] **Step 19.4: Commit**

```bash
git add src/popup
git commit -m "popup: match indicator + skip-on-host toggle"
```

---

## Task 20: Starter template bundling

**Files:**
- Create: `src/starter/internal-user.html`
- Modify: `src/background/background.ts`

- [ ] **Step 20.1: Create the starter template**

```html
<!-- src/starter/internal-user.html -->
<div class="pj-row">
  <span class="pj-label">ID</span>
  <a href="https://{{@adminHost}}/user/{{id}}">{{id}}</a>
</div>
<div class="pj-row">
  <span class="pj-label">Insert Date</span>
  <span>{{date insertDate}}</span>
</div>
<div class="pj-row">
  <span class="pj-label">Status</span>
  {{#when status "UP"}}<span class="pj-up">UP</span>{{/when}}
  {{#when status "DOWN"}}<span class="pj-down">DOWN</span>{{/when}}
</div>
<style>
  .pj-row { display:flex; gap:12px; padding:6px 12px; border-bottom:1px solid #f3f4f6; }
  .pj-label { color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:.5px; min-width:120px; }
  .pj-up   { background:#10b981; color:#fff; padding:2px 8px; border-radius:3px; }
  .pj-down { background:#ef4444; color:#fff; padding:2px 8px; border-radius:3px; }
</style>
```

- [ ] **Step 20.2: Seed on first run**

Modify `src/background/background.ts`. Add at top:

```ts
import starterInternalUser from '../starter/internal-user.html?raw';
```

Add function:

```ts
async function seedStartersIfEmpty(): Promise<void> {
  const storage = createStorage(chrome.storage);
  const templates = await storage.getTemplates();
  if (Object.keys(templates).length > 0) return;
  await storage.setTemplates({ 'internal-user': starterInternalUser });
}
```

Call it inside `main()`:

```ts
async function main(): Promise<void> {
  await maybeMigrate();
  await seedStartersIfEmpty();
  await registerContentScript();
}
```

> Vite's `?raw` suffix inlines the file as a string at build time.

- [ ] **Step 20.3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. On a clean Chrome profile, after install, Options → Templates shows `internal-user` preloaded.

- [ ] **Step 20.4: Commit**

```bash
git add src/starter src/background/background.ts
git commit -m "starter: seed internal-user template on first install"
```

---

## Task 21: Playwright E2E smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `test/fixtures-server/server.ts`
- Create: `test/e2e/render.spec.ts`

- [ ] **Step 21.1: Install Playwright browsers**

Run: `pnpm exec playwright install chromium`
Expected: Chromium downloaded.

- [ ] **Step 21.2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
  use: { headless: false },
});
```

- [ ] **Step 21.3: Create the fixture server**

```ts
// test/fixtures-server/server.ts
import http from 'node:http';

const JSON_BODY = {
  id: 1234,
  insertDate: '2026-04-17T23:09:30Z',
  status: 'DOWN',
  internalId1: 7777,
  internalId2: 8888,
  theValueICareAbout: 9999,
};

export function startServer(port: number): Promise<() => Promise<void>> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/internal/user/1234') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(JSON_BODY));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(port, '127.0.0.1', () =>
      resolve(() => new Promise<void>((res) => server.close(() => res()))),
    );
  });
}
```

- [ ] **Step 21.4: Write the E2E spec**

```ts
// test/e2e/render.spec.ts
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { startServer } from '../fixtures-server/server';

const PORT = 4391;
const DIST = path.resolve(__dirname, '../../dist');

let context: BrowserContext;
let stopServer: () => Promise<void>;

test.beforeAll(async () => {
  stopServer = await startServer(PORT);
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
});

test.afterAll(async () => {
  await context.close();
  await stopServer();
});

test('renders JSON via the bundled starter template', async () => {
  const page = await context.newPage();

  const [serviceWorker] = context.serviceWorkers();
  await serviceWorker!.evaluate(async (vars) => {
    await chrome.storage.sync.set({
      rules: [
        {
          id: 'r1',
          hostPattern: '127.0.0.1',
          pathPattern: '/internal/user/*',
          templateName: 'internal-user',
          variables: vars,
          enabled: true,
        },
      ],
    });
  }, { adminHost: 'qa-admin.server.com', env: 'qa' });

  await page.waitForTimeout(500);
  await page.goto(`http://127.0.0.1:${PORT}/internal/user/1234`);

  await expect(page.locator('#pj-root')).toBeVisible();
  await expect(page.locator('#pj-root')).toContainText('1234');
  await expect(page.locator('#pj-root .pj-down')).toHaveText('DOWN');

  await page.click('#pj-topbar >> text=Show raw JSON');
  await expect(page.locator('#pj-root pre')).toContainText('"id": 1234');
});
```

- [ ] **Step 21.5: Run it**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS. One test green.

- [ ] **Step 21.6: Commit**

```bash
git add playwright.config.ts test/e2e test/fixtures-server
git commit -m "e2e: playwright smoke test for starter-template render"
```

---

## Task 22: Code review pass

Matt requires a fresh reviewer (no implementation bias) as the second-to-last phase.

- [ ] **Step 22.1: Dispatch the reviewer**

Use the `Agent` tool, `subagent_type: feature-dev:code-reviewer` (or `superpowers:code-reviewer` if present). Prompt:

```
Review the Phase 1 implementation of present-json against the spec at
docs/superpowers/specs/2026-04-17-present-json-design.md and the plan at
docs/superpowers/plans/2026-04-17-present-json-phase1.md.

Focus on:
- Spec coverage: is every Phase 1 feature implemented?
- Security: does the sanitizer cover the realistic attack surface for
  user-shared templates?
- Pure-core discipline: do engine/ and matcher/ contain zero chrome.* calls?
- Test quality: do unit tests assert real behavior vs. testing the mock?
- Type safety: any `any` leaks or suppressed errors?
- UX holes: does the options page persist all edits? Does the popup reflect reality?

Report high-confidence issues only. For each, give file:line, a concrete fix,
and severity (blocker / fix-before-ship / followup).
```

- [ ] **Step 22.2: Triage findings**

For each finding:
- **Bug / security / spec miss** → write a failing test reproducing the issue, fix, test passes, commit with a message mentioning the finding.
- **Nit / style** → batch into one small commit, or defer with a `// TODO(phase2)` note.

- [ ] **Step 22.3: Archive the review**

Save the reviewer's report to `docs/superpowers/reviews/2026-04-17-phase1-review.md`. Commit:

```bash
git add docs/superpowers/reviews
git commit -m "review: phase 1 reviewer notes archived"
```

---

## Task 23: Final verification & ship

- [ ] **Step 23.1: Fresh build + full test run**

Run: `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`
Expected: all green.

- [ ] **Step 23.2: Manual Chrome smoke test**

1. `chrome://extensions` → Developer mode → Load unpacked `dist/`.
2. Options → Rules → Add: host `127.0.0.1`, path `/internal/user/*`, template `internal-user`, vars `adminHost=qa-admin.server.com env=qa`, enabled ✓. Save.
3. In a terminal: `pnpm exec tsx test/fixtures-server/server.ts` (or equivalent) to serve the fixture on port 4391.
4. Navigate to `http://127.0.0.1:4391/internal/user/1234`. Confirm: QA badge, rendered rows, Show raw JSON toggles, Copy URL works, console clean.
5. Navigate to a non-matching URL → raw JSON unchanged.
6. Navigate to a non-JSON URL → page unchanged.

- [ ] **Step 23.3: Update ROADMAP.md**

Mark Phase 1 done with date:

```markdown
1. **Phase 1: Core render loop** — done 2026-04-17
```

Prune completed todos block.

- [ ] **Step 23.4: Confirm docs are in sync**

- README: install + dev commands accurate.
- Spec: any divergence vs what shipped is amended in a "Changes during implementation" section at the bottom of the spec.
- Commit:

```bash
git add README.md ROADMAP.md docs/
git commit -m "ship: phase 1 complete"
```

- [ ] **Step 23.5: Hand off to Matt**

Per Matt's workflow: before FF-merging `feature/phase1-impl` into `main`, surface what was built, point to what to inspect, and request explicit approval.

Example message:

> Phase 1 is on `feature/phase1-impl`. Build + unit + E2E all green.
> Please load `dist/` unpacked, add a rule pointing at the fixture server,
> and confirm the render. Once you approve, I'll fast-forward-merge to main.

Do not FF-merge until Matt explicitly approves.

---

## Spec coverage audit (self-check)

| Spec section | Covered by |
|---|---|
| Summary / problem / non-goals | N/A (design prose) |
| Core concepts: template, rule, variables, portability | Task 2 (types), Tasks 5–12 (engine), Task 13 (storage), Tasks 17–19 (UI) |
| Architecture: pure cores | Tasks 3–12 (all pure; tested in Node) |
| Data model: rules, templates, hostSkipList | Task 2 (types), Task 13 (storage) |
| Template engine: value, variable, when/else, each, date, link, raw | Tasks 5–12 |
| Safety rules: script/handler/iframe stripping | Task 11 |
| Missing values → empty string | Task 5 tests, Task 6 tests |
| Hand-rolled parser (no Handlebars) | Tasks 5–12 |
| Matching: glob + regex escape hatch + query strip + JSON-parse gate | Tasks 3–4 + Task 15 |
| Rendering lifecycle | Task 15 |
| Options UI: Rules tab, Templates tab, live preview | Tasks 17–18 |
| Popup: match indicator + skip toggle | Task 19 |
| Import / export + scrub-before-share | Phase 2 — NOT in this plan |
| Error handling: soft fail | Task 15 (`renderError`) |
| Testing: unit + E2E + fixtures | Tasks 3–14 (unit), Task 21 (E2E), Task 12 (fixture) |
| Tech stack: TS strict, Vite + @crxjs, Vitest, Playwright, pnpm | Task 1 |
| Phase 1 bundle | Tasks 1–21 |
| Open items | Touched in Tasks 3, 14; export deferred to Phase 2 |

No spec gaps remain for Phase 1.
