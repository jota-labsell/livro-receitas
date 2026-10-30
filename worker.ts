// @ts-ignore OpenNext generates this module during cloudflare:build.
import nextHandler from './.open-next/worker.js';
import { dispatchMetaPurchases } from './lib/meta-capi';
// @ts-ignore Generated OpenNext Durable Object exports must remain available.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
const paymentRoutes = new Set(['/api/payments', '/api/orders/status', '/api/webhooks/mercadopago']);
const drain = async (env: CloudflareEnv) => {
  try { await dispatchMetaPurchases(env); await env.ORDERS?.prepare('DELETE FROM operation_sessions WHERE last_seen<?').bind(Date.now()-90*86400000).run().catch(()=>{}); await env.ORDERS?.prepare("INSERT INTO operation_health(name,last_run) VALUES('meta_dispatch',?) ON CONFLICT(name) DO UPDATE SET last_run=excluded.last_run").bind(Date.now()).run().catch(()=>{}); }
  catch { console.warn(JSON.stringify({ event: 'meta_dispatch_unavailable' })); }
};
export default {
  async fetch(request, env, ctx) {
    const response = await nextHandler.fetch(request, env, ctx);
    if (request.method === 'POST' && response.ok && paymentRoutes.has(new URL(request.url).pathname)) ctx.waitUntil(drain(env));
    return response;
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(drain(env)); },
} satisfies ExportedHandler<CloudflareEnv>;
