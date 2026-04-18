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
