# Freshet — Roadmap

## Shipped — v1.0.0 live on the Chrome Web Store

v1.0.0 submitted 2026-04-19 → approved and published **2026-04-21**.
Live at <https://chromewebstore.google.com/detail/freshet/mpclplhdencffbilobpcapccnihpelcg>.

---

## Now — v1.1.0 release-cutting

Accumulated on main since v1.0.0: top-strip redesign (right-cluster flat-action buttons, theme dropdown, rule/template kind prefixes), a11y fixes on rule cards, live `<html data-theme>` updates on rendered pages, E2E green baseline restored (44/44). Follow the checklist in the `feedback_release_process` memory.

Active punch list:
1. Update **Official URL** in the CWS listing to `https://mattaltermatt.github.io/freshet/` — the domain is already GSC-verified via `docs/googleb699e27e48b22e41.html`.
2. Add a "Get it on Chrome Web Store" CTA to the `docs/try/` marketing page.
3. Regenerate `docs/assets/cws-screenshots/*.png` — all 5 shots drifted against the post-submission UI changes. Rerun `node scripts/cws-screenshots.mjs` before uploading.
4. Upload refreshed screenshots to CWS dashboard.
5. **Small promo tile (440×280).** Only CWS listing asset Google uses on homepage / category / search tiles.
6. **Marquee promo image (1400×560).** Optional — only surfaces if Google picks Freshet for the homepage carousel. Skippable.
7. Refine listing description copy (now unfrozen).
8. Cut v1.1.0 release per `feedback_release_process` memory: bump `package.json` + `vite.config.ts`, `pnpm build`, zip from inside `dist/`, tag + GH release + CWS upload.

Freeze note: uploading a new v1.1.0 zip re-engages the CWS review freeze — batch listing edits with the submission instead of spreading them across review windows.

---

## Future work

Everything else (feature requests, polish, edge-case handling) is tracked in [**GitHub Issues**](https://github.com/MattAltermatt/freshet/issues). File new issues there; add milestones as they take shape.
