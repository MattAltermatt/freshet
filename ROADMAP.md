# Freshet — Roadmap

**Live in the Chrome Web Store:** <https://chromewebstore.google.com/detail/freshet/mpclplhdencffbilobpcapccnihpelcg>

## 🚀 Shipped

- **v1.2.0** — drag-to-reorder rule cards (left-side ⋮⋮ grip; insertion slot + lifted card; live target numbering; auto-scroll near edges; Escape-cancel; `prefers-reduced-motion` aware; polite `aria-live` on drop), template debugging starter (`__root` engine handle, `tree` filter, `json-debug` starter, debug docs at `/debug/`), CodeMirror caret + selection contrast fix in dark mode. Hand-rolled Pointer Events (no new deps).
- **v1.1.0** — top-strip polish (right-cluster layout, theme dropdown, `rule` / `template` kind prefixes, live `<html data-theme>` updates), rule-card a11y (WCAG AA contrast, nested-interactive resolved), refreshed CWS screenshots, 440×280 promo tile.
- **v1.0.0** — initial CWS launch.

## 🔮 Future work

Tracked in [**GitHub Issues**](https://github.com/MattAltermatt/freshet/issues). File new issues there; add milestones as they take shape.

## 🛠 Cutting the next release

When a feature lands and is ready to ship:

1. Bump `package.json` + `vite.config.ts` `version` to the new SemVer.
2. `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` — all green.
3. Re-shoot CWS screenshots if any UI surface changed (`node scripts/cws-screenshots.mjs`).
4. Update `docs/try/` if any starter changed (template, sample JSON, rule, pill text).
5. Manual Chrome eyeball pass — verify on a real install of the unpacked `dist/`.
6. Tag + GitHub Release: `git tag vX.Y.Z && gh release create vX.Y.Z`. Notes span the full `git log v<prev>..HEAD`.
7. Build the zip (`zip -r freshet-vX.Y.Z.zip dist`) and upload to the CWS dashboard.
8. While the review is in-flight, the listing fields + listing screenshots are frozen — the `cws-listing-freeze-check` skill audits this.
9. Once approved, update this roadmap with the new version under **Shipped** and lift the freeze.
