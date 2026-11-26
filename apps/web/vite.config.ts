import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const publicDir = fileURLToPath(new URL('./public', import.meta.url));
const hasLogo = existsSync(`${publicDir}/brand/logo-1x.webp`);
const hasFounderPhoto = existsSync(`${publicDir}/brand/founder.webp`);

/** Reads the intrinsic size of the 1x PNG (IHDR chunk) so <img> gets explicit dimensions. */
function readLogoSize(): { width: number; height: number } {
  const fallback = { width: 160, height: 48 };
  const file = `${publicDir}/brand/logo-1x.png`;
  if (!hasLogo || !existsSync(file)) return fallback;
  try {
    const buf = readFileSync(file);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : fallback;
  } catch {
    return fallback;
  }
}

const logoSize = readLogoSize();

/** In dev there is no API to fill the placeholders, so resolve them locally. */
function devHtmlPlaceholders(): Plugin {
  return {
    name: 'rs-dev-html-placeholders',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replaceAll('__SITE_URL__', 'http://localhost:5173')
        .replace('<!--__JSON_LD__-->', '');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devHtmlPlaceholders()],
  define: {
    'import.meta.env.VITE_HAS_LOGO': JSON.stringify(hasLogo ? 'true' : 'false'),
    'import.meta.env.VITE_LOGO_WIDTH': JSON.stringify(String(logoSize.width)),
    'import.meta.env.VITE_LOGO_HEIGHT': JSON.stringify(String(logoSize.height)),
    'import.meta.env.VITE_HAS_FOUNDER_PHOTO': JSON.stringify(hasFounderPhoto ? 'true' : 'false'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-react';
          }
          // three.js is intentionally left to Rollup so it only lands in the lazily imported animation chunk.
          return undefined;
        },
      },
    },
  },
});
