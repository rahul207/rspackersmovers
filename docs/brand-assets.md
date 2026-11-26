# Brand assets and logo pipeline

The supplied logo is the authoritative brand asset. **No logo file was supplied with this
repository**, so none has been processed. Until one is present the site shows an accessible text
wordmark (an "RS" monogram plus the business name). No logo is invented.

## Usage

1. Put the original in `assets/original/` (for example `assets/original/logo.png`; PNG, JPEG or
   WebP). The script only reads it and records its SHA-256 - the original is never modified
   (`node scripts/process-logo.mjs --check` verifies this).
2. `npm run assets:logo` writes the variants to `apps/web/public/brand/` and a report to
   `apps/web/public/brand/brand-assets.json`.
3. Restart `npm run dev` / rebuild so Vite detects `logo-1x.webp` and switches from the text
   wordmark to the image logo.

## What the pipeline does

- Validates the file by **magic bytes** (SVG and everything else is rejected), size (<= 20 MB)
  and pixel count.
- If the logo is on a **uniform background**, removes it by flood-filling from the border, so
  enclosed light shapes (for example white letters) stay opaque; a one-pixel anti-aliased edge
  is feathered. For JPEG input the mask is computed on a lightly denoised copy; logo colours
  are never repainted. If the background is not uniform the logo is **left as is** and a warning
  is printed.
- Resamples with Lanczos and a light sharpen. No text is added or changed, proportions are
  preserved.
- Flags any variant that had to be **upscaled** beyond the source resolution
  (`upscaled: true`, plus a warning). Upscaling does not add detail.

## Output variants and where they are used

| File                                              | Use                                                            |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `logo-1x/2x/4x.webp` + `.png` (48/96/192 px high) | Header and footer logo (`<picture>` with `srcset`, WebP first) |
| `favicon.ico`, `favicon-16/32/48.png`             | Browser tab icons                                              |
| `apple-touch-icon.png` (180, opaque)              | iOS home screen                                                |
| `icon-192.png`, `icon-512.png`                    | Web app manifest icons                                         |
| `icon-maskable-512.png`                           | Maskable manifest icon (logo within the safe zone)             |
| `og-image.png` (1200x630)                         | Open Graph / Twitter share image                               |
| `site.webmanifest`                                | Manifest (theme colour, icons)                                 |
| `brand-assets.json`                               | Machine-readable report: hashes, sizes, warnings               |

## Founder photo

`node scripts/process-founder-photo.mjs` reads `assets/original/founder.png` (read-only) and
writes a resized, lightly sharpened `founder.jpg` / `founder.webp` to `apps/web/public/brand/`
for the About section's founder profile. If no photo is present, the section shows a plain
initials placeholder instead.

## Limitations - read before launch

- The output is a **raster**. It is **not** a vector, and this pipeline cannot make it one.
  If the source is small, noisy or has a gradient/textured background, automatic clean-up
  cannot reach print-grade quality without changing the logo. In that case keep the original
  and commission a **vector redraw (SVG/PDF)** from a designer, then swap the files in.
- Background removal is a colour-distance heuristic. Check `logo-4x.png` on both light and dark
  backgrounds before shipping; fringes on very soft edges are possible.
