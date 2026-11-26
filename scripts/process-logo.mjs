/**
 * Logo asset pipeline.
 *
 *   npm run assets:logo                     # processes assets/original/logo.(png|jpg|jpeg|webp)
 *   node scripts/process-logo.mjs --input path/to/logo.png --out apps/web/public/brand
 *
 * What it does (and does NOT do):
 *  - The original file is only ever READ. Its SHA-256 is recorded and verified (--check).
 *  - If the logo sits on a uniform background it is removed by flood-filling from the image
 *    border, so enclosed light areas of the artwork (e.g. white letters) are preserved.
 *    If the background is not uniform the logo is left untouched and a warning is printed.
 *  - JPEG compression noise is suppressed only inside the mask computation; the colour data of
 *    the logo is never repainted, redrawn or re-typeset. No text or shapes are invented.
 *  - Output variants are resampled with Lanczos. Upscaling a raster does not add detail; any
 *    variant produced above the source resolution is flagged in brand-assets.json.
 *  - The result is still a RASTER. A true vector logo requires a redraw by a designer.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MAX_BYTES = 20 * 1024 * 1024;
const NAVY = '#0B1F3A';
const NEUTRAL = '#F8FAFC';
const DISPLAY_HEIGHT = 48;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function detectFormat(buf) {
  if (
    buf.length > 12 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

const dist = (data, i, bg) =>
  Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));

/**
 * Returns an alpha array (0-255) where the uniform border-connected background is transparent,
 * or null when the background is not uniform / already transparent.
 */
export function computeBackgroundAlpha(rgba, width, height, { tolerance = 36, feather = 80 } = {}) {
  const px = (x, y) => (y * width + x) * 4;
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  if (corners.some((i) => rgba[i + 3] < 250)) return null; // already has transparency
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, i) => s + rgba[i + c], 0) / 4));
  if (corners.some((i) => dist(rgba, i, bg) > 24)) return null; // corners disagree: not a plain background

  const removed = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const push = (x, y) => {
    const k = y * width + x;
    if (removed[k] || dist(rgba, k * 4, bg) > tolerance) return;
    removed[k] = 1;
    queue[tail++] = k;
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (head < tail) {
    const k = queue[head++];
    const x = k % width;
    const y = (k - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }

  const ratio = tail / (width * height);
  if (ratio < 0.02 || ratio > 0.97) return null;

  const alpha = new Uint8Array(width * height).fill(255);
  for (let k = 0; k < removed.length; k++) if (removed[k]) alpha[k] = 0;
  // One-pixel anti-aliasing ring: partially transparent according to how close it is to the background.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = y * width + x;
      if (removed[k]) continue;
      const touches =
        (x > 0 && removed[k - 1]) ||
        (x < width - 1 && removed[k + 1]) ||
        (y > 0 && removed[k - width]) ||
        (y < height - 1 && removed[k + width]);
      if (!touches) continue;
      const d = dist(rgba, k * 4, bg);
      if (d < tolerance + feather)
        alpha[k] = Math.round(255 * Math.min(1, Math.max(0, (d - tolerance) / feather)));
    }
  }
  return { alpha, removedRatio: ratio };
}

/** Builds an .ico container whose entries are PNG images. */
export function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    dir.writeUInt8(size >= 256 ? 0 : size, i * 16);
    dir.writeUInt8(size >= 256 ? 0 : size, i * 16 + 1);
    dir.writeUInt16LE(1, i * 16 + 4);
    dir.writeUInt16LE(32, i * 16 + 6);
    dir.writeUInt32LE(data.length, i * 16 + 8);
    dir.writeUInt32LE(offset, i * 16 + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

export function findInput(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  return files.includes('logo.png')
    ? join(dir, 'logo.png')
    : files.length
      ? join(dir, files.sort()[0])
      : null;
}

async function squareIcon(logoPng, size, { background, padding }) {
  const inner = Math.round(size * (1 - padding * 2));
  const resized = await sharp(logoPng)
    .resize(inner, inner, {
      fit: 'inside',
      kernel: 'lanczos3',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function processLogo({ input, outDir, log = console.log }) {
  const original = readFileSync(input);
  if (original.length > MAX_BYTES)
    throw new Error(`Logo is larger than ${MAX_BYTES / 1024 / 1024} MB`);
  const format = detectFormat(original);
  if (!format)
    throw new Error(
      'Unsupported logo file: only PNG, JPEG and WebP rasters are accepted (SVG is rejected on purpose).',
    );

  const meta = await sharp(original, { limitInputPixels: 100_000_000 }).metadata();
  const warnings = [];
  if ((meta.width ?? 0) < 400)
    warnings.push(
      `Source is only ${meta.width}px wide; large variants are upscaled and will look soft.`,
    );

  const { data, info } = await sharp(original)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);

  // Mask computation uses a denoised copy for JPEG sources; colours are taken from the original.
  let maskSource = rgba;
  if (format === 'jpeg') {
    maskSource = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .median(3)
      .raw()
      .toBuffer();
  }
  const mask = computeBackgroundAlpha(maskSource, info.width, info.height);
  let background = 'kept (already transparent or not a uniform background)';
  if (mask) {
    for (let k = 0; k < mask.alpha.length; k++)
      rgba[k * 4 + 3] = Math.min(rgba[k * 4 + 3], mask.alpha[k]);
    background = `removed (${(mask.removedRatio * 100).toFixed(1)}% of pixels, border flood-fill)`;
  } else {
    warnings.push(
      'Background was not removed automatically. If a transparent logo is required, supply one or have a designer export it.',
    );
  }

  const base = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  mkdirSync(outDir, { recursive: true });
  const outputs = [];
  const save = (name, buf, usage, extra = {}) => {
    writeFileSync(join(outDir, name), buf);
    outputs.push({ file: name, bytes: buf.length, usage, ...extra });
  };

  for (const scale of [1, 2, 4]) {
    const height = DISPLAY_HEIGHT * scale;
    const upscaled = height > info.height;
    const resized = sharp(base)
      .resize({ height, kernel: 'lanczos3' })
      .sharpen({ sigma: 0.6, m1: 0.5, m2: 1 });
    const w = Math.round((info.width / info.height) * height);
    const png = await resized.clone().png({ compressionLevel: 9 }).toBuffer();
    const webp = await resized.clone().webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    const usage = `Header/footer logo at ${scale}x (display height ${DISPLAY_HEIGHT}px)`;
    save(`logo-${scale}x.png`, png, usage, { width: w, height, upscaled });
    save(`logo-${scale}x.webp`, webp, usage, { width: w, height, upscaled });
    if (upscaled && scale > 1)
      warnings.push(`logo-${scale}x is upscaled from a ${info.height}px-high source.`);
  }

  const transparentIcon = (size) => squareIcon(base, size, { padding: 0.08 });
  const fav = await Promise.all(
    [16, 32, 48].map(async (s) => ({ size: s, data: await transparentIcon(s) })),
  );
  for (const f of fav) save(`favicon-${f.size}.png`, f.data, `Browser favicon ${f.size}x${f.size}`);
  save('favicon.ico', buildIco(fav), 'Legacy favicon (16/32/48, PNG-compressed)');

  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  save(
    'apple-touch-icon.png',
    await squareIcon(base, 180, { background: white, padding: 0.12 }),
    'iOS home-screen icon (opaque)',
  );
  save(
    'icon-192.png',
    await squareIcon(base, 192, { background: white, padding: 0.1 }),
    'PWA / Android icon 192',
  );
  save(
    'icon-512.png',
    await squareIcon(base, 512, { background: white, padding: 0.1 }),
    'PWA / Android icon 512',
  );
  save(
    'icon-maskable-512.png',
    await squareIcon(base, 512, { background: white, padding: 0.22 }),
    'PWA maskable icon (logo inside the safe zone)',
  );

  const ogLogo = await sharp(base)
    .resize({ width: 760, height: 360, fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const og = await sharp({ create: { width: 1200, height: 630, channels: 4, background: NEUTRAL } })
    .composite([
      { input: ogLogo, gravity: 'centre' },
      {
        input: await sharp({ create: { width: 1200, height: 14, channels: 4, background: NAVY } })
          .png()
          .toBuffer(),
        gravity: 'south',
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  save(
    'og-image.png',
    og,
    'Open Graph / Twitter share image 1200x630 (logo centred on a light neutral card)',
  );

  const manifest = {
    name: 'RS Packers & Movers',
    short_name: 'RS Packers',
    start_url: '/',
    display: 'browser',
    theme_color: NAVY,
    background_color: '#FFFFFF',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
  writeFileSync(join(outDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2));

  const report = {
    generatedBy: 'scripts/process-logo.mjs',
    source: {
      file: basename(input),
      sha256: sha256(original),
      format,
      width: info.width,
      height: info.height,
    },
    background,
    isVector: false,
    note: 'Raster output only. For a true vector logo, ask a designer to redraw/export SVG from the original artwork.',
    warnings,
    outputs,
  };
  writeFileSync(join(outDir, 'brand-assets.json'), JSON.stringify(report, null, 2));
  log(`Processed ${basename(input)} -> ${outputs.length} files in ${outDir}`);
  for (const w of warnings) log(`WARNING: ${w}`);
  return report;
}

function verifyOriginal(input, outDir) {
  const reportPath = join(outDir, 'brand-assets.json');
  if (!existsSync(reportPath)) return 'no report to compare';
  const recorded = JSON.parse(readFileSync(reportPath, 'utf8')).source?.sha256;
  return recorded === sha256(readFileSync(input)) ? 'unchanged' : 'CHANGED since last run';
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const input = arg('--input')
    ? resolve(arg('--input'))
    : findInput(join(root, 'assets', 'original'));
  const outDir = arg('--out')
    ? resolve(arg('--out'))
    : join(root, 'apps', 'web', 'public', 'brand');

  if (!input || !existsSync(input) || !statSync(input).isFile()) {
    console.log(
      'No logo found. Place the supplied logo in assets/original/ (e.g. assets/original/logo.png) and run `npm run assets:logo`.',
    );
    console.log('The website falls back to a text wordmark until then; no logo is invented.');
    process.exit(args.includes('--require') ? 2 : 0);
  }
  if (args.includes('--check')) {
    console.log(`Original ${basename(input)}: ${verifyOriginal(input, outDir)}`);
    return;
  }
  await processLogo({ input, outDir });
  console.log(`Original file: ${verifyOriginal(input, outDir)} (never modified by this script).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Logo processing failed: ${error.message}`);
    process.exit(1);
  });
}
