import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Execute installed JS entry points directly. Windows .cmd shims cannot be
// launched by execFileSync without a shell; direct Node also preserves spaces.
export function runLocalCli(packageName, command, args, options = {}) {
  const directory = fileURLToPath(new URL(`../node_modules/${packageName}/`, import.meta.url));
  const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const entry = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[command];
  if (!entry) throw new Error(`CLI ${command} indisponível. Execute npm ci antes de continuar.`);
  return execFileSync(process.execPath, [path.resolve(directory, entry), ...args], options);
}
