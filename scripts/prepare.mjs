// Installs git hooks when husky and a git repository are available; never fails the install.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.git')) {
  try {
    execSync('npx --no-install husky', { stdio: 'ignore' });
  } catch {
    console.warn('husky not installed; skipping git hooks');
  }
}
