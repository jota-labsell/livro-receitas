// @ts-ignore OpenNext generates this module during cloudflare:build.
import nextHandler from './.open-next/worker.js';
import { dispatchMetaPurchases } from './lib/meta-capi';
// @ts-ignore Generated OpenNext Durable Object exports must remain available.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';
const paymentRoutes = new Set(['/api/payments', '/api/orders/status', '/api/webhooks/mercadopago']);
const drain = async (env: CloudflareEnv) => {
  try { await dispatchMetaPurchases(env); }
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
