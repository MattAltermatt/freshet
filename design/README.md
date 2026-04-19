# Freshet brand mark

## Concept

The icon is a `{>` ligature. Read left to right:

- **`{`** — the *opening* brace of an untransformed JSON document (the input).
- **`>`** — the *closing* angle bracket of an HTML tag (the output).

Together they express the extension's single purpose: a JSON response opens, renders through a user-defined template, and closes as an HTML block. The mark is directional — left-to-right visually encodes the transform.

## Palette

- Brace (JSON): `#111827` — near-black, reads as "source / raw".
- Bracket (HTML): `#ea580c` — orange accent, reads as "rendered / output".

The two-tone split is load-bearing: the orange draws the eye to the point of transformation. Monochrome variants tested in early mocks felt inert by comparison.

## Files

| File | Target size | Notes |
|---|---|---|
| `icon-16.svg` | Chrome toolbar | Stroke-width tuned thicker (~14% of width) for pixel-level legibility |
| `icon-48.svg` | Extensions management page | Mid-weight stroke |
| `icon-128.svg` | Store listing + details page | Canonical design reference |

Stroke widths and geometry are tuned per size (optical sizing), so each SVG is an authored source file — not a uniform mathematical scale of one master.

## Regenerating the PNGs

The SVGs in this folder are the source of truth. Rasterize to `public/icon-*.png` with:

```bash
pnpm icons
```

The script (`scripts/rasterize-icons.mjs`) uses Playwright's headless Chromium. No external image libraries required.
