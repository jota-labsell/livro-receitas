import { execFileSync } from 'node:child_process';
import { loadSupportCredential, copySupportCredential, readProtectionPassword } from './support-credential.mjs';
try {
  if (process.argv.slice(2).some(value => value !== '--meta')) throw new Error('Use somente --meta para abrir o diagnóstico.');
  const adminPath = process.argv.includes('--meta') ? '/admin/meta' : '/admin/acesso';
  const key = await loadSupportCredential(await readProtectionPassword());
  if (!key) throw new Error('Credencial ainda não provisionada. Execute npm.cmd run publicar:acesso primeiro.');
  copySupportCredential(key);
  // This command is explicitly invoked to open an interactive administrative browser.
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath 'https://livro-receitas.joaolucasqtb.workers.dev${adminPath}'`], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  console.log('Painel aberto. A credencial foi copiada para a área de transferência; cole no login. Seu valor não foi exibido.');
} catch {
  console.error('Não foi possível abrir o painel. Confira a senha de proteção local; execute publicar:acesso se a credencial ainda não foi configurada.');
  process.exitCode = 1;
}
