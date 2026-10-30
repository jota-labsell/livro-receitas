import { runLocalCli } from './local-cli.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run')) throw new Error('Use somente --dry-run para simular.');
execFileSync(process.execPath, ['scripts/check-worker-build.mjs'], { stdio: 'inherit' });
const config = JSON.parse(await readFile('wrangler.jsonc','utf8'));
const database = config.d1_databases?.find(item=>item.binding === 'ORDERS');
if (!database || database.database_id === '00000000-0000-0000-0000-000000000000') throw new Error('Configure o ID real do D1 antes de publicar.');
if (!config.r2_buckets?.some(item=>item.binding === 'EBOOKS')) throw new Error('Configure o binding privado EBOOKS.');
delete config.$schema;
config.main = path.resolve(config.main);
config.assets.directory = path.resolve(config.assets.directory);
for (const db of config.d1_databases) db.migrations_dir = path.resolve(db.migrations_dir);
config.vars = {...config.vars, SITE_URL:'https://livro-receitas.joaolucasqtb.workers.dev', CHECKOUT_ENABLED:'true',MERCADOPAGO_MODE:'production',LIVE_PAYMENTS_ENABLED:'true'};
await mkdir('.wrangler',{recursive:true});
const target = path.resolve('.wrangler/production.deploy.json');
await writeFile(target,JSON.stringify(config,null,2)+'\n');
console.log('Publicação de PRODUÇÃO: cobranças reais habilitadas. Use somente após configurar credenciais, vendedor e webhook de produção no Worker.');
if (!args.includes('--dry-run')) {
  runLocalCli('wrangler','wrangler',['d1','execute',database.database_name,'--remote','--command',"SELECT environment FROM orders LIMIT 0"],{stdio:'inherit'});
  runLocalCli('wrangler','wrangler',['d1','execute',database.database_name,'--remote','--command',"SELECT visit_hash FROM operation_sessions LIMIT 0; SELECT pixel_id FROM operation_settings LIMIT 0; SELECT actor FROM operation_audit LIMIT 0; SELECT name FROM operation_health LIMIT 0; SELECT pixel_id FROM operation_order_pixel LIMIT 0; SELECT id FROM operation_account LIMIT 0; SELECT nonce_hash,kind,expires_at FROM operation_admin_sessions LIMIT 0"],{stdio:'inherit'});
  // Do not publish recovery routes without their additive migration on the existing database.
  runLocalCli('wrangler','wrangler',['d1','execute',database.database_name,'--remote','--command',"SELECT id,order_id,token_hash,expires_at,revoked_at FROM product_access_grants LIMIT 0; SELECT token_hash,grant_id,expires_at FROM product_access_sessions LIMIT 0; SELECT id,action,actor,previous_status FROM product_access_audit LIMIT 0; SELECT bucket,count,expires_at FROM product_access_limits LIMIT 0"],{stdio:'inherit'});
  runLocalCli('wrangler','wrangler',['d1','execute',database.database_name,'--remote','--command',"SELECT order_id,consent FROM meta_order_consent LIMIT 0; SELECT order_id,fbp FROM meta_purchase_context LIMIT 0; SELECT order_id,state FROM meta_purchase_delivery LIMIT 0; SELECT order_id,fbc,client_ip FROM meta_purchase_match LIMIT 0; SELECT order_id,http_status,error_code FROM meta_delivery_results LIMIT 0"],{stdio:'inherit'});
}
const deployEnv = {
  ...process.env,
  WRANGLER_SEND_METRICS:'false',
  WRANGLER_LOG_PATH:process.env.WRANGLER_LOG_PATH || path.join(tmpdir(), 'livro-receitas-wrangler-logs'),
  WRANGLER_CACHE_DIR:process.env.WRANGLER_CACHE_DIR || path.join(tmpdir(), 'livro-receitas-wrangler-cache'),
  ...(process.env.XDG_CONFIG_HOME ? {XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME} : {}),
};
// Keep the uploaded version traceable to the reviewed Git source.
const revision = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
runLocalCli('wrangler','wrangler',['deploy','--keep-vars','--config',target,'--tag',revision.slice(0,12),'--message',`livro-receitas ${revision}`,...args],{stdio:'inherit',env:deployEnv});
