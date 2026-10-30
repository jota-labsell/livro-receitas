import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { NextRequest } from 'next/server';
import { ensureOrder, newAccess, hash, startAttempt, type CommerceEnv } from '../lib/commerce';
import { reconcileProviderOrder, type ProviderOrder } from '../lib/mercadopago-orders';
import { captureMetaContext } from '../lib/meta-context';
import { dispatchMetaPurchases, recordMetaConsent, sendMetaPurchase, metaPurchaseEventId } from '../lib/meta-capi';
import { metaDiagnosticStatus } from '../lib/meta-diagnostics';
import { POST as webhook } from '../app/api/webhooks/mercadopago/route';

declare global { var __metaDiagnosticEnv: CommerceEnv; }
const runtime: CommerceEnv = {
  SITE_URL: 'https://store.example', MERCADOPAGO_MODE: 'production', CHECKOUT_ENABLED: 'true', LIVE_PAYMENTS_ENABLED: 'true',
  MERCADOPAGO_ACCESS_TOKEN: 'fixture-provider', MERCADOPAGO_PUBLIC_KEY: 'fixture-public', MERCADOPAGO_COLLECTOR_ID: '123',
  MERCADOPAGO_WEBHOOK_SECRET: 'fixture-webhook', EBOOKS: {} as R2Bucket,
  META_CAPI_ENABLED: 'true', META_CAPI_ACCESS_TOKEN: 'fixture-meta-not-a-real-token',
};
type Payload = { test_event_code?: string; data: { event_id: string; event_name: string; custom_data: { value: number; currency: string }; user_data: Record<string, unknown>; event_source_url: string }[] };
const delivered: Payload[] = [];
let mode: 'success' | 'transient' | 'rate' | 'unauthorized' = 'success', mf: Miniflare, db: D1Database;
async function graph(request: { url: string; json(): Promise<unknown>; headers: { get(name: string): string | null } }) {
  assert.equal(new URL(request.url).hostname, 'graph.facebook.com');
  assert.equal(request.headers.get('authorization'), `Bearer ${runtime.META_CAPI_ACCESS_TOKEN}`);
  const payload = await request.json() as Payload;
  assert.equal('test_event_code' in payload, false, 'Real purchases never carry a test code');
  delivered.push(payload);
  if (mode === 'transient') return Response.json({ error: { code: 2 } }, { status: 503 });
  if (mode === 'rate') return Response.json({ error: { code: 4, is_transient: true } }, { status: 400 });
  if (mode === 'unauthorized') return Response.json({ error: { code: 190, message: runtime.META_CAPI_ACCESS_TOKEN, fbtrace_id: 'fixture_rejected' } }, { status: 400 });
  return Response.json({ events_received: 1, fbtrace_id: 'fixture_confirmed' });
}
const graphFetch: typeof fetch = (url, init) => graph(new Request(String(url), init));
before(async () => {
  const compiled = await build({ stdin: { contents: `import worker from './worker';
    export default {async fetch(req,env){const tasks=[];const ctx={waitUntil(p){tasks.push(p)}};
      if(new URL(req.url).pathname==='/_scheduled'){await worker.scheduled({},env,ctx);await Promise.all(tasks);return new Response('scheduled');}
      const response=await worker.fetch(req,env,ctx);await Promise.all(tasks);return response;}};`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'neutral', format: 'esm', write: false, external: ['node:*'],
    plugins: [{ name: 'isolated-next-http', setup(builder) {
      builder.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({ path: 'next-fixture', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default {fetch(){return new Response("ok")}};export class DOQueueHandler{};export class DOShardedTagCache{};export class BucketCachePurge{};', loader: 'js' }));
    } }],
  });
  const { EBOOKS: _ebooks, ORDERS: _orders, ...bindings } = runtime;
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: compiled.outputFiles[0].text,
    compatibilityDate: '2026-10-27', compatibilityFlags: ['nodejs_compat'], d1Databases: ['ORDERS'], bindings,
    outboundService: graph,
  }));
  db = await mf.getD1Database('ORDERS') as unknown as D1Database;
  runtime.ORDERS = db; globalThis.__metaDiagnosticEnv = runtime;
  for (const file of ['0001_commerce.sql', '0002_order_environment.sql', '0003_jotafy.sql', '0007_meta_capi.sql', '0009_meta_automatic.sql', '0010_operations.sql'])
    for (const statement of (await readFile(`migrations/${file}`, 'utf8')).split(';').filter(value => value.trim())) await db.prepare(statement).run();
});
after(async () => { await mf?.dispose(); });
async function fixture(status = 'approved', allowed: boolean | null = true) {
  const order = await ensureOrder(runtime, newAccess(), randomUUID());
  if (allowed !== null) await captureMetaContext(runtime, order.id, new NextRequest('https://store.example/api/checkout', {
    headers: { 'user-agent': 'Fixture Browser', 'cf-connecting-ip': '203.0.113.9' },
  }), { allowed, fbp: 'fb.1.1761700000000.123456789', fbc: 'fb.1.1761700000000.fixture_click_123', sourceUrl: 'https://store.example/?discard=this' });
  const attempt = await startAttempt(runtime, order, hash('fixture-request'));
  const provider: ProviderOrder = {
    id: `ORD${randomUUID().replaceAll('-', '')}`, type: 'online', external_reference: attempt.id, user_id: '123', currency: 'BRL', total_amount: '10.00',
    total_paid_amount: '10.00', status: status === 'approved' ? 'processed' : 'action_required', status_detail: status === 'approved' ? 'accredited' : 'waiting_transfer', last_updated_date: new Date().toISOString(),
    transactions: { payments: [{ id: `PAY${randomUUID()}`, amount: '10.00', paid_amount: '10.00', status: status === 'approved' ? 'processed' : 'pending' }] },
  };
  await reconcileProviderOrder(runtime, provider);
  return { order, attempt, provider };
}
const tick = () => mf.dispatchFetch('https://worker.example/_scheduled');

test('signed approval webhook queues a real Purchase; Worker sends it after response without the buyer page', async () => {
  const start = delivered.length, f = await fixture('pending');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).first<{ n: number }>())?.n, 0);
  f.provider.status = 'processed'; f.provider.status_detail = 'accredited'; f.provider.transactions!.payments![0].status = 'processed'; f.provider.last_updated_date = new Date(Date.now() + 1000).toISOString();
  const requestId = randomUUID(), ts = String(Date.now());
  const signature = createHmac('sha256', runtime.MERCADOPAGO_WEBHOOK_SECRET!).update(`id:${f.provider.id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => { assert.equal(new URL(String(url)).pathname, `/v1/orders/${f.provider.id}`); return Response.json(f.provider); };
    for (let i = 0; i < 2; i++) assert.equal((await webhook(new NextRequest(`https://store.example/api/webhooks/mercadopago?data.id=${f.provider.id}`, {
      method: 'POST', headers: { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${signature}` }, body: JSON.stringify({ type: 'order', data: { id: f.provider.id } }),
    }))).status, 200);
  } finally { globalThis.fetch = original; }
  assert.equal(delivered.length, start);
  await mf.dispatchFetch('https://worker.example/api/webhooks/mercadopago', { method: 'POST' });
  assert.equal(delivered.length, start + 1);
  const event = delivered.at(-1)!.data[0];
  assert.equal(event.event_id, hash(`meta-purchase:${f.order.id}`)); assert.equal(event.event_name, 'Purchase');
  assert.deepEqual(event.custom_data, { value: 10, currency: 'BRL', content_ids: ['150-doces-comer-vender'], content_type: 'product' });
  assert.equal(event.user_data.fbc, 'fb.1.1761700000000.fixture_click_123'); assert.equal(event.user_data.fbp, 'fb.1.1761700000000.123456789');
  assert.equal(event.user_data.client_ip_address, '203.0.113.9'); assert.equal(event.user_data.client_user_agent, 'Fixture Browser');
  assert.equal(event.event_source_url, 'https://store.example/');
  await tick(); assert.equal(delivered.length, start + 1, 'Duplicate webhook and cron must not resend an acknowledged purchase');
});

test('concurrent dispatchers claim a purchase once and diagnostics show confirmed delivery', async () => {
  const start = delivered.length, f = await fixture();
  await Promise.all([dispatchMetaPurchases(runtime, graphFetch), dispatchMetaPurchases(runtime, graphFetch)]);
  assert.equal(delivered.length, start + 1);
  const status = await metaDiagnosticStatus(runtime);
  assert.equal(status.automaticFlowConnected, true);
  const purchase = status.purchases.find((row: Record<string, unknown>) => row.id === f.order.id);
  assert.equal(purchase?.state, 'sent'); assert.equal(purchase?.http_status, 200); assert.equal(purchase?.trace_id, 'fixture_confirmed');
  assert.equal(JSON.stringify(status).includes('203.0.113.9'), false);
});

test('server cron retries transient failure using the original event ID', async () => {
  const start = delivered.length, f = await fixture(); mode = 'transient';
  await tick();
  assert.equal(delivered.length, start + 1);
  assert.equal((await db.prepare('SELECT state FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).first<{ state: string }>())?.state, 'pending');
  await db.prepare('UPDATE meta_purchase_delivery SET locked_at=0 WHERE order_id=?').bind(f.order.id).run();
  mode = 'success'; await tick();
  assert.equal(delivered.length, start + 2);
  assert.equal(delivered[start].data[0].event_id, delivered[start + 1].data[0].event_id);
  assert.equal((await db.prepare('SELECT state FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).first<{ state: string }>())?.state, 'sent');
});

test('opt-out, pending, refund and historical approval without context never produce a conversion', async () => {
  const start = delivered.length;
  await fixture('approved', false); await fixture('pending');
  const historical = await fixture('approved', null);
  assert.equal(await recordMetaConsent(runtime, historical.order.id, true), false);
  const refunded = await fixture();
  refunded.provider.status = 'refunded'; refunded.provider.transactions!.payments![0].status = 'refunded'; refunded.provider.last_updated_date = new Date(Date.now() + 2000).toISOString();
  await reconcileProviderOrder(runtime, refunded.provider);
  await tick(); assert.equal(delivered.length, start);
  assert.equal(await dispatchMetaPurchases({ ...runtime, MERCADOPAGO_MODE: 'sandbox' }, graphFetch), 0);
  assert.equal(await dispatchMetaPurchases({ ...runtime, META_CAPI_ENABLED: 'false' }, graphFetch), 0);
});

test('permanent token rejection stops retries and saves bounded error diagnostics without secrets', async () => {
  const start = delivered.length, f = await fixture(); mode = 'unauthorized';
  await tick(); mode = 'success'; await tick();
  assert.equal(delivered.length, start + 1);
  const result = await db.prepare('SELECT * FROM meta_delivery_results WHERE order_id=?').bind(f.order.id).first();
  assert.equal(result?.http_status, 400); assert.equal(result?.error_code, 190);
  assert.equal(JSON.stringify(result).includes(runtime.META_CAPI_ACCESS_TOKEN!), false);
  assert.equal((await db.prepare('SELECT attempts FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).first<{ attempts: number }>())?.attempts, 12);
});

test('cron recovers a missing enqueue and purges old matching data without deleting purchases', async () => {
  const f = await fixture();
  await db.prepare('DELETE FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).run();
  const start = delivered.length; await tick(); assert.equal(delivered.length, start + 1);
  await db.prepare('UPDATE meta_purchase_context SET updated_at=0 WHERE order_id=?').bind(f.order.id).run();
  await db.prepare('UPDATE meta_purchase_match SET updated_at=0 WHERE order_id=?').bind(f.order.id).run();
  await tick();
  assert.equal(await db.prepare('SELECT order_id FROM meta_purchase_match WHERE order_id=?').bind(f.order.id).first(), null);
  assert.equal(await db.prepare('SELECT order_id FROM meta_purchase_context WHERE order_id=?').bind(f.order.id).first(), null);
  assert.ok(await db.prepare('SELECT id FROM orders WHERE id=?').bind(f.order.id).first());
});

test('browser privacy signal overrides enabled measurement and discards matching context', async () => {
  const f = await fixture('pending');
  await captureMetaContext(runtime, f.order.id, new NextRequest('https://store.example/api/checkout', { headers: { 'sec-gpc': '1' } }), { allowed: true });
  assert.equal((await db.prepare('SELECT consent FROM meta_order_consent WHERE order_id=?').bind(f.order.id).first<{ consent: number }>())?.consent, 0);
  assert.equal(await db.prepare('SELECT order_id FROM meta_purchase_match WHERE order_id=?').bind(f.order.id).first(), null);
});

test('transient Graph rate limit with HTTP 400 remains eligible for automatic retry', async () => {
  const f = await fixture(); mode = 'rate'; await tick(); mode = 'success';
  assert.equal((await db.prepare('SELECT attempts FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).first<{ attempts: number }>())?.attempts, 1);
  await db.prepare('UPDATE meta_purchase_delivery SET locked_at=0 WHERE order_id=?').bind(f.order.id).run();
  await tick();
  assert.equal((await db.prepare('SELECT state FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).first<{ state: string }>())?.state, 'sent');
});

test('live transport normalizes token whitespace in the same way as the successful diagnostic test', async () => {
  const f = await fixture();
  assert.equal(await sendMetaPurchase({ ...runtime, META_CAPI_ACCESS_TOKEN: ` ${runtime.META_CAPI_ACCESS_TOKEN}\n` }, f.order.id, await metaPurchaseEventId(f.order.id), undefined, undefined, graphFetch), true);
});
test('pausing CAPI retains the purchase and its original Pixel for a later send',async()=>{
  const f=await fixture();const count=delivered.length;
  await db.prepare("INSERT INTO operation_settings(id,pixel_id,capi_paused,updated_at) VALUES(1,'123456789',1,?)").bind(Date.now()).run();
  assert.equal(await sendMetaPurchase(runtime,f.order.id,await metaPurchaseEventId(f.order.id),undefined,undefined,graphFetch),false);
  assert.equal(delivered.length,count);assert.equal((await db.prepare('SELECT state FROM meta_purchase_delivery WHERE order_id=?').bind(f.order.id).first<any>())?.state,'pending');
  assert.equal((await db.prepare('SELECT status FROM orders WHERE id=?').bind(f.order.id).first<any>())?.status,'approved');
  assert.equal((await metaDiagnosticStatus(runtime)).automaticFlowConnected,false);
  await db.prepare('UPDATE operation_settings SET capi_paused=0 WHERE id=1').run();
  assert.equal(await sendMetaPurchase(runtime,f.order.id,await metaPurchaseEventId(f.order.id),undefined,undefined,graphFetch),true);
});
