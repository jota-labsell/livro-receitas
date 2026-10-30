// Run from the operator's active checkout to copy this reviewed panel only.
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(process.cwd());
const manifestPath = path.join(target, 'package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.name !== 'livro-receitas') throw new Error('Execute dentro da pasta livro-receitas em Projetos.');
const files = ['lib/meta-diagnostics.ts', 'app/api/admin/meta/route.ts', 'app/admin/meta/page.tsx',
  'components/meta-diagnostics-screen.tsx', 'components/meta-diagnostics.module.css', 'components/access-admin-screen.tsx',
  'scripts/test-meta-diagnostics.mjs', 'scripts/test-meta-panel-ui.mjs', 'tests/meta-diagnostics.test.ts', 'PAINEL-META.md',
  '.github/workflows/deploy-production.yml', 'GITHUB-CLOUDFLARE.md'];
if (source.toLowerCase() === target.toLowerCase()) throw new Error('Execute na cópia em Projetos, não em System32.');
const backup = path.join(target, 'work', 'meta-panel-backup', new Date().toISOString().replace(/[:.]/g, '-'));
for (const file of [...files, 'package.json']) {
  const destination = path.join(target, file);
  try { await access(destination); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const saved = path.join(backup, file);
  await mkdir(path.dirname(saved), { recursive: true });
  await copyFile(destination, saved);
}
for (const file of files) {
  const destination = path.join(target, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(source, file), destination);
}
manifest.scripts['test:meta'] = 'node scripts/test-meta-diagnostics.mjs';
manifest.scripts['test:meta:ui'] = 'node scripts/test-meta-panel-ui.mjs';
if (!manifest.scripts.test.includes('scripts/test-meta-diagnostics.mjs'))
  manifest.scripts.test = `node scripts/test-meta-diagnostics.mjs && ${manifest.scripts.test}`;
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Painel copiado para ${target}. Cópias anteriores preservadas em ${backup}.`);
console.log('Execute npm.cmd run test:meta e depois npm.cmd run publicar:acesso. Nenhuma credencial foi copiada ou alterada.');
