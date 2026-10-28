import { runLocalCli } from './local-cli.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// A storefront can be published before D1/payment configuration is available.
// This command always disables checkout and real charges; it cannot enable sales.
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run')) {
  throw new Error('Use somente --dry-run para simular a publicação da vitrine.');
}
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
if (config.name === 'livro-receitas') throw new Error('Vitrine bloqueada: este nome pertence ao Worker de producao. Use um Worker separado.');
execFileSync(process.execPath, ['scripts/check-worker-build.mjs'], { stdio: 'inherit' });
delete config.$schema;
delete config.d1_databases;
config.main = path.resolve(config.main);
config.assets.directory = path.resolve(config.assets.directory);
config.vars = {
  ...config.vars,
  CHECKOUT_ENABLED: 'false',
  LIVE_PAYMENTS_ENABLED: 'false',
  MERCADOPAGO_MODE: 'sandbox',
};
await mkdir('.wrangler', { recursive: true });
const target = path.resolve('.wrangler/storefront.deploy.json');
await writeFile(target, JSON.stringify(config, null, 2) + '\n');
console.log('Publicando somente a vitrine: checkout, cobranças e D1 desativados.');
runLocalCli('wrangler', 'wrangler', ['deploy', '--config', target, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    WRANGLER_SEND_METRICS: 'false',
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.resolve('work/cloudflare-config'),
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || path.resolve('work/wrangler-logs'),
  },
});
