# Freshet — Roadmap

## Now — Awaiting Chrome Web Store review

v1.0.0 submitted on 2026-04-19. CWS flagged `<all_urls>` for in-depth review; realistic turnaround 1–4 weeks.

- **Don't upload another zip until v1.0.0 is resolved** — a new upload restarts the clock.
- **Don't edit listing fields during review** (description, screenshots, promo tiles, permission justifications). All listing changes wait until the version is live.
- If bounced: read the reviewer note, fix surgically, bump to v1.0.1 in `vite.config.ts` + `package.json`, rebuild + re-zip, resubmit.

Artifacts: `freshet-v1.0.0.zip` (gitignored; rebuild with `pnpm build && zip -r freshet-v1.0.0.zip dist`) · `docs/assets/cws-screenshots/*.png` · `docs/superpowers/cws-listing.md`.

---

## Post-launch — once v1.0.0 goes live

1. **README.** Replace the *"Submission in progress"* line in `README.md` with the live CWS listing URL and announce.
2. **Official URL in the CWS listing.** Paste `https://mattaltermatt.github.io/freshet/` into the listing's **Official URL** field — the domain is already GSC-verified (file at `docs/googleb699e27e48b22e41.html`, stays in-repo indefinitely; removing it un-verifies).
3. **Small promo tile (440×280).** The only CWS listing asset Google uses on homepage / category / search tiles. Regenerate via the existing `scripts/cws-screenshots.mjs` Chromium-composite approach.
4. **Marquee promo image (1400×560).** Optional — only surfaces if Google picks Freshet for the homepage carousel. Skippable.

---

## Future work

Everything else (feature requests, polish, edge-case handling) is tracked in [**GitHub Issues**](https://github.com/MattAltermatt/freshet/issues). File new issues there; add milestones as they take shape.
