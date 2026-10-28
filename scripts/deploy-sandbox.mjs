import { runLocalCli } from './local-cli.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run')) throw new Error('Use somente --dry-run para simular.');
const config = JSON.parse(await readFile('wrangler.jsonc','utf8'));
if (config.name === 'livro-receitas') throw new Error('Sandbox bloqueado: este nome pertence ao Worker de producao. Use um Worker separado.');
execFileSync(process.execPath, ['scripts/check-worker-build.mjs'], { stdio: 'inherit' });
const database = config.d1_databases?.find(item=>item.binding === 'ORDERS');
if (!database || database.database_id === '00000000-0000-0000-0000-000000000000') throw new Error('Configure o ID real do D1 antes do sandbox.');
if (!config.r2_buckets?.some(item=>item.binding === 'EBOOKS')) throw new Error('Configure o binding privado EBOOKS.');
delete config.$schema;
config.main = path.resolve(config.main);
config.assets.directory = path.resolve(config.assets.directory);
for (const db of config.d1_databases) db.migrations_dir = path.resolve(db.migrations_dir);
config.vars = {...config.vars, SITE_URL:'https://livro-receitas.joaolucasqtb.workers.dev', CHECKOUT_ENABLED:'true',MERCADOPAGO_MODE:'sandbox',LIVE_PAYMENTS_ENABLED:'false'};
await mkdir('.wrangler',{recursive:true});
const target = path.resolve('.wrangler/sandbox.deploy.json');
await writeFile(target,JSON.stringify(config,null,2)+'\n');
console.log('Publicação de sandbox: Orders em modo de teste. Cobranças de produção bloqueadas. Os secrets devem estar no Worker.');
if (!args.includes('--dry-run')) {
  runLocalCli('wrangler','wrangler',['d1','execute',database.database_name,'--remote','--command',"SELECT environment FROM orders LIMIT 0"],{stdio:'inherit'});
}
runLocalCli('wrangler','wrangler',['deploy','--config',target,...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME || path.resolve('work/cloudflare-config'),WRANGLER_LOG_PATH:process.env.WRANGLER_LOG_PATH || path.resolve('work/wrangler-logs')}});
