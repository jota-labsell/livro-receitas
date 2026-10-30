import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
for (const name of ['operations']) await build({ entryPoints: [`tests/${name}.test.ts`], outfile: `work/${name}.test.mjs`, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'isolated-meta-bindings', setup(builder) {
    builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: 'next/server.js', external: true }));
    builder.onLoad({ filter: /lib[\\/]runtime\.ts$/ }, () => ({ contents: 'export function cloudflareEnv(){return globalThis.__metaDiagnosticEnv}; export function siteUrl(){return globalThis.__metaDiagnosticEnv?.SITE_URL}', loader: 'js' }));
  } }],
});
execFileSync(process.execPath, ['--test', 'work/operations.test.mjs'], { stdio: 'inherit' });
