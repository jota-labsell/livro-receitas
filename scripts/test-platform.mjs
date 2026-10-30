import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
await mkdir('work',{recursive:true});
await build({entryPoints:['tests/platform.test.ts'],outfile:'work/platform.test.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'runtime-fixture',setup(b){b.onResolve({filter:/^next\/(server|headers|navigation)$/},a=>({path:a.path+'.js',external:true}));b.onLoad({filter:/lib[\\/]runtime\.ts$/},()=>({contents:'export function cloudflareEnv(){return globalThis.__platformEnv} export function siteUrl(){return globalThis.__platformEnv?.SITE_URL}',loader:'js'}));}}]});
execFileSync(process.execPath,['--test',...process.argv.slice(2),'work/platform.test.mjs'],{stdio:'inherit'});
