import { execFileSync } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const credentialFile = path.join(projectRoot, 'work', 'support-access.key.enc');
function powershell(code, input) {
  if (process.platform !== 'win32') throw new Error('Este assistente de credencial requer Windows. Configure EBOOK_ADMIN_KEY pelo gerenciador de segredos no seu ambiente.');
  // The credential travels over stdin/stdout pipes only; never shell arguments or terminal output.
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference='Stop'; ${code}`], {
    input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  }).trim();
}
export async function hasSupportCredential(file = credentialFile) {
  try { await readFile(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
export async function saveSupportCredential(key, passphrase, file = credentialFile) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Formato de credencial administrativa inválido.');
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Use uma senha de proteção com pelo menos 12 caracteres.');
  const salt = randomBytes(32), nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(passphrase, salt, 32), nonce);
  const encrypted = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ version: 1, salt: salt.toString('base64'), nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }), { mode: 0o600 });
}
export async function loadSupportCredential(passphrase, file = credentialFile) {
  let encrypted;
  try { encrypted = await readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const payload = JSON.parse(encrypted);
  if (payload.version !== 1 || typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Credencial protegida ou senha inválida.');
  const salt = Buffer.from(payload.salt, 'base64'), nonce = Buffer.from(payload.nonce, 'base64'), tag = Buffer.from(payload.tag, 'base64'), data = Buffer.from(payload.data, 'base64');
  if (salt.length !== 32 || nonce.length !== 12 || tag.length !== 16 || data.length !== 64) throw new Error('Arquivo de credencial protegida inválido.');
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(passphrase, salt, 32), nonce);
  decipher.setAuthTag(tag);
  const key = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Não foi possível abrir a credencial protegida.');
  return key;
}
export function copySupportCredential(key) { powershell('Set-Clipboard -Value ([Console]::In.ReadToEnd())', key); }
export const readHiddenCredential = () => readHiddenSecret('Credencial EBOOK_ADMIN_KEY existente (entrada oculta): ', value => /^[a-f0-9]{64}$/.test(value));
export const readProtectionPassword = () => readHiddenSecret('Senha de proteção local (12+ caracteres, entrada oculta): ', value => value.length >= 12);
async function readHiddenSecret(prompt, validate) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Execute em um terminal interativo para informar a credencial existente sem expô-la.');
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setRawMode(true); process.stdin.resume();
    const done = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    function onData(chunk) {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') { done(); reject(new Error('Operação cancelada.')); return; }
        if (character === '\r' || character === '\n') { done(); validate(value) ? resolve(value) : reject(new Error('Formato de entrada inválido.')); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (!/\p{C}/u.test(character) && value.length < 256) value += character;
      }
    }
    process.stdin.on('data', onData);
  });
}
