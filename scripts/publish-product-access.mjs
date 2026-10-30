import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runLocalCli } from './local-cli.mjs';
import { projectRoot, hasSupportCredential, loadSupportCredential, saveSupportCredential, readHiddenCredential, readProtectionPassword } from './support-credential.mjs';

process.chdir(projectRoot);
const args = process.argv.slice(2);
if (args.some(arg => !['--check', '--plan'].includes(arg))) throw new ReleaseError('Opções permitidas: --check ou --plan.');
const origin = 'https://livro-receitas.joaolucasqtb.workers.dev';
const worker = 'livro-receitas';
const database = 'receitas-premium-150-orders';
const expectedDatabase = 'e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a';
const baselineVersion = '149c030a-c970-453d-9878-93e071b19813';
const stateFile = path.join(projectRoot, 'work', 'product-access-release.json');
class ReleaseError extends Error {}
process.env.WRANGLER_LOG_PATH ||= path.join(tmpdir(), 'livro-receitas-wrangler-logs');
process.env.WRANGLER_CACHE_DIR ||= path.join(tmpdir(), 'livro-receitas-wrangler-cache');
process.env.WRANGLER_SEND_METRICS = 'false';
function cli(parameters, input) {
  try {
    return runLocalCli('wrangler', 'wrangler', parameters, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], env: process.env, maxBuffer: 12 * 1024 * 1024 });
  } catch {
    // Do not forward arbitrary provider output, bindings, HTTP bodies, cookies or submitted secrets.
    throw new ReleaseError(`Cloudflare indisponível na etapa ${parameters[0]} ${parameters[1] || ''}. Confira login, rede e permissões; nenhuma credencial foi exibida.`);
  }
}
const remoteJson = parameters => JSON.parse(cli(parameters));
function currentVersion(deployments) {
  if (!Array.isArray(deployments) || !deployments.length) throw new ReleaseError('Nenhuma publicação identificada.');
  const latest = [...deployments].sort((a,b) => a.created_on.localeCompare(b.created_on)).at(-1);
  if (latest.versions?.length !== 1 || latest.versions[0].percentage !== 100) throw new ReleaseError('Tráfego dividido: revise a publicação antes de continuar.');
  return latest.versions[0].version_id;
}
const activeVersion = () => currentVersion(remoteJson(['deployments', 'list', '--name', worker, '--json']));
const sql = command => remoteJson(['d1', 'execute', database, '--remote', '--command', command, '--json']);
async function saveState(state) { await mkdir(path.dirname(stateFile), { recursive: true }); await writeFile(stateFile, JSON.stringify(state, null, 2) + '\n'); }
async function request(route, { method = 'GET', input, cookie, redirect = 'manual' } = {}) {
  try {
    return await fetch(new URL(route, origin), { method, redirect, headers: { Origin: origin, ...(input ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: input ? JSON.stringify(input) : undefined, signal: AbortSignal.timeout(60000) });
  } catch { throw new ReleaseError(`A aplicação publicada não respondeu à validação de ${route.split('?')[0]}. Não foi comprovada a entrega.`); }
}
async function verifyPublished(key) {
  const anonymous = await request('/api/download');
  if (anonymous.status !== 303 || new URL(anonymous.headers.get('location'), origin).pathname !== '/acesso') throw new ReleaseError('O acesso sem sessão não apresentou a recuperação esperada.');
  const login = await request('/api/admin/ebook/login', { method: 'POST', input: { key } });
  if (!login.ok) throw new ReleaseError('A credencial administrativa não foi aceita. Nenhum link de cliente foi emitido.');
  const admin = login.headers.get('set-cookie')?.split(';')[0];
  if (!admin) throw new ReleaseError('Sessão administrativa não foi estabelecida.');
  let grantId, recoveryCookie;
  try {
    const rows = sql("SELECT o.id FROM orders o WHERE o.environment='production' AND o.status='approved' AND EXISTS(SELECT 1 FROM payment_attempts a WHERE a.order_id=o.id AND a.status='approved' AND a.payment_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM payment_attempts a WHERE a.order_id=o.id AND a.status IN ('refunded','charged_back')) ORDER BY o.created_at DESC LIMIT 1");
    const orderId = rows[0]?.results?.[0]?.id;
    if (!orderId) return { approvedDownloadVerified: false, reason: 'Nenhum pedido de produção elegível foi encontrado para comprovar o PDF.' };
    // Operational verification of an existing purchase, never a fabricated order or charge.
    const issued = await request('/api/admin/ebook', { method: 'POST', cookie: admin, input: { action: 'issue', orderId, confirmed: true } });
    if (!issued.ok) throw new ReleaseError('O provedor não autorizou a emissão para o pedido existente.');
    const grant = await issued.json(); grantId = grant.id;
    const token = new URLSearchParams(new URL(grant.link).hash.slice(1)).get('token');
    const preview = await request('/acesso');
    if (!preview.ok) throw new ReleaseError('Página de acesso indisponível.');
    const redeemed = await request('/api/product-access', { method: 'POST', input: { token } });
    if (!redeemed.ok) throw new ReleaseError('A recuperação do pedido aprovado não foi autorizada.');
    recoveryCookie = redeemed.headers.get('set-cookie')?.split(';')[0];
    if (!recoveryCookie) throw new ReleaseError('Cookie de recuperação não recebido.');
    const download = await request('/api/download', { cookie: recoveryCookie });
    if (!download.ok || !download.headers.get('content-type')?.startsWith('application/pdf')) throw new ReleaseError('O download do pedido aprovado não retornou PDF.');
    const manifest = JSON.parse(await readFile('public/ebook/manifest.json', 'utf8'));
    const bytes = Buffer.from(await download.arrayBuffer());
    if (bytes.length !== manifest.bytes || createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) throw new ReleaseError('O PDF remoto não corresponde à edição correta.');
    return { approvedDownloadVerified: true, bytes: bytes.length, sha256: manifest.sha256 };
  } finally {
    if (grantId) {
      const revoked = await request('/api/admin/ebook', { method: 'POST', cookie: admin, input: { action: 'revoke', grantId } });
      if (!revoked.ok) throw new ReleaseError('Verificação interrompida: revogue no painel o vínculo técnico recém-emitido.');
      if (recoveryCookie) {
        const blocked = await request('/api/download', { cookie: recoveryCookie });
        if (blocked.status !== 303) throw new ReleaseError('O bloqueio da sessão técnica revogada não foi comprovado.');
      }
    }
    await request('/api/admin/ebook/login', { method: 'DELETE', cookie: admin }).catch(() => {});
  }
}
async function main() {
  if (args.includes('--plan')) {
    console.log('Plano: conferir login, versão e bindings; testar/buildar; aplicar somente 0008; provisionar credencial protegida; publicar; verificar pedido aprovado e SHA-256 do PDF; revogar vínculo técnico. Nenhuma cobrança ou mensagem.'); return;
  }
  console.log('Conferindo acesso à Cloudflare e versão em tráfego…');
  let version;
  try { version = activeVersion(); }
  catch (error) {
    if (args.includes('--check') || !process.stdin.isTTY) throw error;
    console.log('É necessário renovar a sessão Cloudflare. Conclua o login no navegador aberto pelo Wrangler.');
    runLocalCli('wrangler', 'wrangler', ['login'], { stdio: 'inherit', env: process.env });
    version = activeVersion();
  }
  let previous = {};
  try { previous = JSON.parse(await readFile(stateFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (![baselineVersion, previous.version, previous.preparedVersion].filter(Boolean).includes(version)) throw new ReleaseError(`A produção mudou para ${version}. Não foi sobrescrita: compare essa fonte com o workspace antes de publicar.`);
  const details = remoteJson(['versions', 'view', version, '--name', worker, '--json']);
  const bindings = details.resources?.bindings;
  if (!Array.isArray(bindings)) throw new ReleaseError('Não foi possível conferir os bindings existentes.');
  const binding = name => bindings.find(item => item.name === name);
  if (binding('ORDERS')?.id !== expectedDatabase || binding('EBOOKS')?.bucket_name !== 'receitas-premium-150-ebooks') throw new ReleaseError('D1 ou R2 divergentes: publicação bloqueada.');
  for (const [name, expected] of Object.entries({ SITE_URL: origin, MERCADOPAGO_MODE: 'production', CHECKOUT_ENABLED: 'true', LIVE_PAYMENTS_ENABLED: 'true' })) {
    if (binding(name)?.text !== expected) throw new ReleaseError(`Configuração remota divergente em ${name}. Não foi alterada.`);
  }
  sql('SELECT environment FROM orders LIMIT 0; SELECT id,payment_id,status FROM payment_attempts LIMIT 0; SELECT event_key FROM jotafy_events LIMIT 0; SELECT name FROM d1_migrations LIMIT 0');
  console.log('Versão, produção, D1 e R2 conferidos.');
  if (args.includes('--check')) { console.log('Pré-verificação concluída. Nenhuma alteração remota.'); return; }
  // Complete the concrete artifact before any remote mutation.
  for (const parameters of [['scripts/test-commerce.mjs'], ['scripts/test-product-access.mjs'], ['--test', 'tests/support-credential.test.mjs'], ['scripts/cloudflare-build.mjs']])
    execFileSync(process.execPath, parameters, { stdio: 'inherit', env: process.env });
  if (activeVersion() !== version) throw new ReleaseError('A produção mudou durante o build. Nenhuma alteração remota foi feita.');
  let key;
  const hasKey = binding('EBOOK_ADMIN_KEY')?.type === 'secret_text';
  if (binding('EBOOK_ADMIN_KEY') && !hasKey) throw new ReleaseError('EBOOK_ADMIN_KEY precisa ser Secret, não variável de texto.');
  if (hasKey && await hasSupportCredential()) {
    const password = await readProtectionPassword();
    try { key = await loadSupportCredential(password); }
    catch { throw new ReleaseError('Não foi possível abrir a credencial protegida. Confira sua senha local; a credencial do servidor não foi alterada.'); }
  }
  else {
    key = hasKey ? await readHiddenCredential() : randomBytes(32).toString('hex');
    console.log('Escolha uma senha para proteger a credencial local e guarde-a no seu gerenciador de senhas.');
    await saveSupportCredential(key, await readProtectionPassword());
  }
  console.log('Aplicando apenas a migration aditiva de recuperação…');
  // Wrangler can prefix --file JSON output with progress text when stdout is piped.
  // Only the exit status is needed here; other calls still require valid JSON.
  cli(['d1', 'execute', database, '--remote', '--file', 'migrations/0008_product_access.sql', '--json']);
  sql("INSERT OR IGNORE INTO d1_migrations(name) VALUES('0008_product_access.sql')");
  if (!hasKey) {
    cli(['secret', 'put', 'EBOOK_ADMIN_KEY', '--name', worker], `${key}\n`);
    version = activeVersion();
    await saveState({ ...previous, preparedVersion: version, migration: '0008_product_access.sql', preparedAt: new Date().toISOString() });
  }
  if (activeVersion() !== version) throw new ReleaseError('A produção mudou antes do deploy. A publicação foi interrompida.');
  console.log('Publicando a correção sem trocar credenciais de pagamento…');
  execFileSync(process.execPath, ['scripts/deploy-production.mjs'], { stdio: 'inherit', env: process.env });
  version = activeVersion();
  await saveState({ version, publishedAt: new Date().toISOString(), approvedDownloadVerified: false });
  console.log('Publicação concluída; conferindo acesso e PDF de uma compra existente…');
  const verification = await verifyPublished(key);
  await saveState({ version, publishedAt: new Date().toISOString(), ...verification });
  if (!verification.approvedDownloadVerified) throw new ReleaseError(`Publicado, mas entrega ainda não comprovada: ${verification.reason}`);
  console.log(`Entrega remota comprovada: ${verification.bytes} bytes; SHA-256 igual ao manifesto. Vínculo técnico revogado. Nenhuma cobrança criada.`);
  console.log('Para atender o comprador: execute npm.cmd run acesso:painel, confira o pedido e gere o link privado para envio manual.');
}
main().catch(error => {
  console.error('Não foi possível concluir a publicação/validação. Nenhum segredo ou link privado foi exibido.');
  if (error instanceof ReleaseError) console.error(error.message);
  console.error('Se a etapa falhou por autenticação/rede, renove a sessão no PowerShell normal com: node node_modules/wrangler/bin/wrangler.js login');
  console.error('Depois execute novamente: npm.cmd run publicar:acesso. O arquivo work/product-access-release.json, quando existir, registra somente a etapa efetivamente concluída, sem credenciais.');
  process.exitCode = 1;
});
