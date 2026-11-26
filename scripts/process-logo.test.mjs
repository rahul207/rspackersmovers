import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildIco, computeBackgroundAlpha, detectFormat, processLogo } from './process-logo.mjs';

let dir;
let logoPath;
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// 400x200 white background, navy rounded block, with an enclosed WHITE circle that must stay opaque.
async function syntheticLogo(format) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
    <rect width="400" height="200" fill="#ffffff"/>
    <rect x="40" y="30" width="320" height="140" rx="20" fill="#0B1F3A"/>
    <circle cx="120" cy="100" r="40" fill="#ffffff"/>
    <rect x="190" y="85" width="140" height="30" fill="#F59E0B"/></svg>`;
  const img = sharp(Buffer.from(svg));
  return format === 'jpeg' ? img.jpeg({ quality: 70 }).toBuffer() : img.png().toBuffer();
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'rspm-logo-'));
  logoPath = join(dir, 'logo.png');
  writeFileSync(logoPath, await syntheticLogo('png'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('logo pipeline', () => {
  it('detects formats by magic bytes and rejects SVG/other files', async () => {
    expect(detectFormat(await syntheticLogo('png'))).toBe('png');
    expect(detectFormat(await syntheticLogo('jpeg'))).toBe('jpeg');
    expect(detectFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    const svgPath = join(dir, 'bad.png');
    writeFileSync(
      svgPath,
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(processLogo({ input: svgPath, outDir: join(dir, 'x'), log() {} })).rejects.toThrow(
      /Unsupported/,
    );
  });

  it('removes only the border-connected background and keeps enclosed white artwork', async () => {
    const { data, info } = await sharp(await syntheticLogo('png'))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const mask = computeBackgroundAlpha(data, info.width, info.height);
    expect(mask).not.toBeNull();
    const at = (x, y) => mask.alpha[y * info.width + x];
    expect(at(2, 2)).toBe(0); // outside
    expect(at(120, 100)).toBe(255); // white circle inside the navy block
    expect(at(60, 100)).toBe(255); // navy
  });

  it('declines to cut out a non-uniform background', async () => {
    const noisy = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#ffffff' },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 50, height: 100, channels: 3, background: '#000000' },
          })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
      ])
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rgba = Buffer.alloc(100 * 100 * 4);
    for (let i = 0; i < 100 * 100; i++) {
      rgba[i * 4] = noisy.data[i * 3];
      rgba[i * 4 + 1] = noisy.data[i * 3 + 1];
      rgba[i * 4 + 2] = noisy.data[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    expect(computeBackgroundAlpha(rgba, 100, 100)).toBeNull();
  });

  it('writes every variant, never touches the original and flags upscaling honestly', async () => {
    const before = hash(logoPath);
    const outDir = join(dir, 'brand');
    const report = await processLogo({ input: logoPath, outDir, log() {} });
    expect(hash(logoPath)).toBe(before);

    for (const f of [
      'logo-1x.webp',
      'logo-2x.webp',
      'logo-4x.webp',
      'logo-1x.png',
      'logo-2x.png',
      'logo-4x.png',
      'favicon.ico',
      'favicon-32.png',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
      'og-image.png',
      'site.webmanifest',
      'brand-assets.json',
    ]) {
      expect(existsSync(join(outDir, f)), f).toBe(true);
    }
    const m1 = await sharp(join(outDir, 'logo-1x.png')).metadata();
    const m2 = await sharp(join(outDir, 'logo-2x.png')).metadata();
    expect([m1.height, m2.height]).toEqual([48, 96]);
    expect(Math.abs(m1.width / m1.height - 2)).toBeLessThan(0.05); // proportions preserved (400x200)
    expect(m1.hasAlpha).toBe(true);
    expect(report.isVector).toBe(false);
    expect(report.background).toMatch(/removed/);
    expect(report.outputs.find((o) => o.file === 'logo-4x.png').upscaled).toBe(false); // 192px <= 200px source

    const smallPath = join(dir, 'small', 'logo.png');
    await import('node:fs').then((fs) => fs.mkdirSync(join(dir, 'small')));
    writeFileSync(
      smallPath,
      await sharp(await syntheticLogo('png'))
        .resize({ width: 200 })
        .png()
        .toBuffer(),
    );
    const small = await processLogo({ input: smallPath, outDir: join(dir, 'small-out'), log() {} });
    expect(small.outputs.find((o) => o.file === 'logo-4x.png').upscaled).toBe(true);
    expect(small.warnings.join(' ')).toMatch(/upscaled/);
    const og = await sharp(join(outDir, 'og-image.png')).metadata();
    expect([og.width, og.height]).toEqual([1200, 630]);
  });

  it('builds a valid ICO container', async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 4, background: '#0B1F3A' },
    })
      .png()
      .toBuffer();
    const ico = buildIco([{ size: 16, data: png }]);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(1);
    expect(ico.subarray(ico.readUInt32LE(18)).subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
