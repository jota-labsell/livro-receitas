import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {runLocalCli} from './local-cli.mjs';
const args=process.argv.slice(2);if(args.some(a=>a!=='--dry-run'))throw Error('Use somente --dry-run.');
const account='48a86816b0ea33a5e9da7eb156dd98b1',database='e5ba3e0b-eff5-4bfd-8461-fe09c1eceb7a';
if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==account)throw Error('Conta de ambiente divergente.');
const identity=runLocalCli('wrangler','wrangler',['whoami'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});if(!identity.includes(account))throw Error('Identidade não confirmou a conta esperada.');
const credentials=process.env.CLOUDFLARE_API_TOKEN?'':await readFile(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8');
const token=process.env.CLOUDFLARE_API_TOKEN||credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];if(!token)throw Error('Identidade indisponível.');
async function api(endpoint){const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/'+endpoint,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok||!data.success)throw Error(`Cloudflare HTTP ${response.status}: códigos ${(data.errors||[]).map(e=>e.code).join(',')}`);return data.result;}
const settings=await api('workers/scripts/jotafy/settings'),deployments=await api('workers/scripts/jotafy/deployments'),schedules=await api('workers/scripts/jotafy/schedules');
const active=deployments.deployments[0];if(active.versions.length!==1||active.versions[0].percentage!==100)throw Error('Tráfego parcial: revisar antes de substituir.');
if(active.versions[0].version_id!=='a6d58cd6-d8fd-486e-b745-a247a67c209a')throw Error('O monitor recebeu outra versão. Releia e integre o código ativo antes de publicar.');
if(!settings.bindings.some(b=>b.type==='d1'&&b.name==='DB'&&(b.id||b.database_id)===database)||!settings.bindings.some(b=>b.type==='assets'&&b.name==='RELEASES'))throw Error('Bindings do monitor divergentes.');
const source=await readFile('jotafy/platform-server/worker.js','utf8');
if(!source.includes('d.application_id')||!source.includes('platform_all_orders')||!source.includes('FCM_SERVICE_ACCOUNT'))throw Error('Módulo incompleto.');
if(!args.includes('--dry-run'))runLocalCli('wrangler','wrangler',['d1','execute','receitas-premium-150-orders','--remote','--command','SELECT id,environment,approved_at FROM platform_all_orders LIMIT 0; SELECT application_id FROM jotafy_devices LIMIT 0; SELECT event_seq,status,claim FROM jotafy_outbox LIMIT 0; SELECT seq,order_id FROM jotafy_events LIMIT 0; SELECT device_id FROM jotafy_technical_tests LIMIT 0;'],{stdio:'inherit'});
const config={name:'jotafy',account_id:account,main:path.resolve('jotafy/platform-server/worker.js'),compatibility_date:settings.compatibility_date,compatibility_flags:settings.compatibility_flags||[],workers_dev:true,preview_urls:false,keep_vars:true,d1_databases:[{binding:'DB',database_name:'receitas-premium-150-orders',database_id:database}],triggers:{crons:schedules.schedules.map(s=>s.cron)},unsafe:{metadata:{keep_assets:true,keep_bindings:['plain_text','json','secret_text','secret_key','assets']}}};
await mkdir('.wrangler',{recursive:true});await writeFile('.wrangler/jotafy-platform.deploy.json',JSON.stringify(config,null,2));
const paths=['/downloads/JotaFy-2.0-preview.apk','/downloads/JotaFy-2.0.1-preview-no-firebase.apk','/downloads/JotaFy-2.0.2-preview-firebase.apk'];
async function assets(){return Promise.all(paths.map(async p=>{const r=await fetch('https://jotafy.joaolucasqtb.workers.dev'+p,{headers:{Range:'bytes=0-0'},signal:AbortSignal.timeout(30000)});const result={path:p,status:r.status,etag:r.headers.get('etag'),type:r.headers.get('content-type')};await r.body?.cancel();return result;}));}
const before=args.includes('--dry-run')?[]:await assets();
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
runLocalCli('wrangler','wrangler',['deploy','--keep-vars','--config','.wrangler/jotafy-platform.deploy.json','--tag',revision.slice(0,12),'--message','Jotafy unified ledger '+revision,...args],{stdio:'inherit'});
if(!args.includes('--dry-run')){
 const after=await api('workers/scripts/jotafy/settings');for(const binding of settings.bindings){if(!after.bindings.some(b=>b.name===binding.name&&b.type===binding.type))throw Error('Binding perdido: '+binding.name);}
 const downloads=await assets();if(JSON.stringify(before)!==JSON.stringify(downloads))throw Error('Assets do aplicativo divergiram após o deploy. Revisar e restaurar a versão anterior.');
 const deployment=(await api('workers/scripts/jotafy/deployments')).deployments[0];await mkdir('work',{recursive:true});await writeFile('work/jotafy-platform-deployment.json',JSON.stringify({revision,deployment,previous:active,source_sha256:createHash('sha256').update(source).digest('hex'),assets:downloads,checkedAt:new Date().toISOString()},null,2));console.log('Monitor publicado; bindings, secrets por nome, cron e downloads preservados. Não é prova de exibição de push no aparelho.');
}
