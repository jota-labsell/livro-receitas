import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const mode of ['sandbox', 'storefront']) {
  test(`${mode} refuses the production Worker before any build or deployment`, () => {
    const run = spawnSync(process.execPath, [`scripts/deploy-${mode}.mjs`, '--dry-run'], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /este nome pertence ao Worker de producao/);
    assert.doesNotMatch(run.stdout, /Artefato validado|wrangler|Executing on remote/);
  });
}

test('default deployment uses the explicit production procedure', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['cloudflare:deploy'], pkg.scripts['cloudflare:deploy:production']);
});

test('the production-named Wrangler configuration cannot publish sandbox flags', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.name, 'livro-receitas');
  assert.deepEqual(config.vars, { CHECKOUT_ENABLED: 'true', MERCADOPAGO_MODE: 'production', LIVE_PAYMENTS_ENABLED: 'true' });
});
