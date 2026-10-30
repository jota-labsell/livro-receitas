import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
await build({stdin:{contents:`import {accountLogin} from './lib/operator-login';import {verifyAccessAdmin,revokeAdminSession} from './lib/access-admin';
export default {async fetch(req,env){const input=await req.json();const result=await accountLogin(env,input,'workerd-fixture');await verifyAccessAdmin(env,result.session);await revokeAdminSession(env,result.session);let revoked=false;try{await verifyAccessAdmin(env,result.session)}catch{revoked=true};return Response.json({lifetime:result.lifetime,revoked})}};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'neutral',format:'esm',external:['node:*'],outfile:'work/operations-auth-worker.mjs'});
for (const name of ['operations', 'marketing-config']) await build({ entryPoints: [`tests/${name}.test.ts`], outfile: `work/${name}.test.mjs`, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'isolated-meta-bindings', setup(builder) {
    builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: 'next/server.js', external: true }));
    builder.onLoad({ filter: /lib[\\/]runtime\.ts$/ }, () => ({ contents: 'export function cloudflareEnv(){return globalThis.__metaDiagnosticEnv}; export function siteUrl(){return globalThis.__metaDiagnosticEnv?.SITE_URL}', loader: 'js' }));
  } }],
});
execFileSync(process.execPath, ['--test', 'work/operations.test.mjs', 'work/marketing-config.test.mjs'], { stdio: 'inherit' });
