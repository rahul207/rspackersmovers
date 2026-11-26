/**
 * One-off processing for the founder's photo (see docs/brand-assets.md).
 *
 *   node scripts/process-founder-photo.mjs
 *
 * Reads assets/original/founder.png only (never modified) and produces a crisp, lightly
 * sharpened version for the About section's "Founder" profile.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(resolve(fileURLToPath(import.meta.url), '..'), '..');
const INPUT = join(ROOT, 'assets', 'original', 'founder.png');
const OUT_DIR = join(ROOT, 'apps', 'web', 'public', 'brand');

async function main() {
  if (!existsSync(INPUT)) {
    console.log('No founder photo found at assets/original/founder.png; skipping.');
    return;
  }
  const original = readFileSync(INPUT);
  const meta = await sharp(original).metadata();

  mkdirSync(OUT_DIR, { recursive: true });
  const targetWidth = Math.max(960, meta.width ?? 960);
  const processed = sharp(original)
    .resize({ width: targetWidth, kernel: 'lanczos3' })
    .modulate({ brightness: 1.02, saturation: 1.03 })
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 1 });

  await processed
    .clone()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(join(OUT_DIR, 'founder.jpg'));
  await processed.clone().webp({ quality: 92 }).toFile(join(OUT_DIR, 'founder.webp'));
  console.log(`Founder photo processed -> ${OUT_DIR}`);
  console.log('Original file: unchanged (never modified by this script).');
}

main().catch((error) => {
  console.error(`Founder photo processing failed: ${error.message}`);
  process.exit(1);
});
