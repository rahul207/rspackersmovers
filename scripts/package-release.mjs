// Assembles a self-contained upload bundle in ./release (run `npm run build` first).
// The host only needs Node 22+: `npm install --omit=dev` then `npm start`.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'release');
const need = ['apps/api/dist/main.js', 'apps/web/dist/index.html'];
for (const f of need) {
  if (!existsSync(join(root, f))) {
    console.error(`Missing ${f}. Run "npm run build" first.`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'apps/api'), { recursive: true });
mkdirSync(join(out, 'storage'), { recursive: true });
cpSync(join(root, 'apps/api/dist'), join(out, 'apps/api/dist'), { recursive: true });
cpSync(join(root, 'apps/web/dist'), join(out, 'apps/web/dist'), { recursive: true });
cpSync(join(root, '.env.example'), join(out, '.env.example'));
writeFileSync(join(out, 'storage/.gitkeep'), '');

// Ready-made production .env: business details from the local .env, fresh random secrets.
const local = existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '';
const pick = (key) => new RegExp(`^${key}=(.*)$`, 'm').exec(local)?.[1]?.trim() ?? '';
const secret = () => randomBytes(48).toString('hex');
writeFileSync(
  join(out, '.env'),
  [
    'NODE_ENV=production',
    'SERVE_WEB=true',
    'HOST=0.0.0.0',
    'PORT=3000',
    '# Set to your real https address before starting',
    'PUBLIC_SITE_URL=https://www.example.com',
    ...[
      'BUSINESS_NAME',
      'BUSINESS_PHONE',
      'BUSINESS_EMAIL',
      'BUSINESS_ADDRESS',
      'WHATSAPP_NUMBER',
    ].map((k) => `${k}=${pick(k)}`),
    'LOCATION_LOOKUP=live',
    `SESSION_SECRET=${secret()}`,
    `COOKIE_SIGNING_SECRET=${secret()}`,
    '',
  ].join('\n'),
);

const api = JSON.parse(readFileSync(join(root, 'apps/api/package.json'), 'utf8'));
const dependencies = Object.fromEntries(
  Object.entries(api.dependencies).filter(([name]) => !name.startsWith('@rs/')),
);
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify(
    {
      name: 'rs-packers-movers',
      version: api.version,
      private: true,
      type: 'module',
      engines: { node: '>=22.12.0' },
      scripts: { start: 'node --env-file-if-exists=.env apps/api/dist/main.js' },
      dependencies,
    },
    null,
    2,
  ) + '\n',
);

writeFileSync(
  join(out, 'DEPLOY.txt'),
  `RS Packers & Movers - upload bundle
====================================
Needs Node.js 22.12 or newer.

1. Upload this whole folder to the host.
2. A ready-made .env is included (business details filled, random secrets generated).
   Open it and set PUBLIC_SITE_URL to your real https address, e.g. https://www.yourdomain.com
   (If your host has an "environment variables" panel, set the same values there instead.)
3. Run:  npm install --omit=dev
4. Start: npm start    (listens on PORT, default 3000; serves the website and the API together)
5. Point your domain / reverse proxy to that port. Health check: /api/v1/health

Quote and contact requests are saved as Excel files in ./storage - keep that folder
writable and persistent, and do not keep those .xlsx files open in Excel while the site runs.
`,
);
console.log('Release bundle ready: ' + out);
