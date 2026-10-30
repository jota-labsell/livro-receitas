// @ts-ignore OpenNext generates this module during cloudflare:build.
import nextHandler from './.open-next/worker.js';
import { dispatchMetaPurchases } from './lib/meta-capi';
import {dispatchPlatformMeta} from './lib/platform-meta';
import {syncDueIntegrations} from './lib/platform-ads';
import {health} from './lib/platform-core';
// @ts-ignore Generated OpenNext Durable Object exports must remain available.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
const paymentRoutes = new Set(['/api/payments', '/api/orders/status', '/api/webhooks/mercadopago']);
const drain = async (env: CloudflareEnv) => {
  try { await dispatchMetaPurchases(env); await env.ORDERS?.prepare('DELETE FROM operation_sessions WHERE last_seen<?').bind(Date.now()-90*86400000).run().catch(()=>{}); await env.ORDERS?.prepare("INSERT INTO operation_health(name,last_run) VALUES('meta_dispatch',?) ON CONFLICT(name) DO UPDATE SET last_run=excluded.last_run").bind(Date.now()).run().catch(()=>{}); }
  catch { console.warn(JSON.stringify({ event: 'meta_dispatch_unavailable' })); }
};
const platformDrain=async(env:CloudflareEnv,sync=false)=>{
  if(env.JOTAFY_PLATFORM_ENABLED!=='true')return;
  try{await dispatchPlatformMeta(env);await health(env,sync?'platform_cron':'platform_dispatch');}catch{await health(env,sync?'platform_cron':'platform_dispatch','platform_dispatch_failed').catch(()=>{});}
  if(sync)try{await syncDueIntegrations(env);}catch{console.warn(JSON.stringify({event:'platform_ads_sync_failed'}));}
  await env.ORDERS?.prepare('UPDATE platform_sessions SET fbclid=NULL,fbc=NULL,fbp=NULL,client_ip=NULL,user_agent=NULL WHERE last_seen<?').bind(Date.now()-7*86400000).run().catch(()=>{});
};
export default {
  async fetch(request, env, ctx) {
    let response = await nextHandler.fetch(request, env, ctx);
    const url=new URL(request.url);
    if(response.headers.get('content-type')?.includes('text/html')&&url.pathname.startsWith('/checkout/')){
      const headers=new Headers(response.headers);let ancestor="'self'";
      try{const product=await env.ORDERS?.prepare('SELECT sales_url FROM platform_products WHERE slug=?').bind(decodeURIComponent(url.pathname.slice('/checkout/'.length))).first<{sales_url:string}>();if(product?.sales_url){const sales=new URL(product.sales_url);if(sales.protocol==='https:')ancestor+=' '+sales.origin;}}catch{}
      headers.set('Content-Security-Policy',"frame-ancestors "+ancestor);response=new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if (request.method === 'POST' && response.ok && paymentRoutes.has(new URL(request.url).pathname)) ctx.waitUntil(drain(env));
    if(request.method==='POST'&&response.ok&&/^\/api\/(store\/|platform\/webhook\/)/.test(new URL(request.url).pathname))ctx.waitUntil(platformDrain(env));
    return response;
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(drain(env));ctx.waitUntil(platformDrain(env,true)); },
} satisfies ExportedHandler<CloudflareEnv>;
