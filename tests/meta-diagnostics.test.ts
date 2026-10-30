import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { NextRequest } from 'next/server';
import { CommerceError, ensureOrder, type CommerceEnv } from '../lib/commerce';
import { ADMIN_COOKIE, loginAccessAdmin } from '../lib/access-admin';
import { metaDiagnosticStatus, sendMetaDiagnostic } from '../lib/meta-diagnostics';
import { GET, POST } from '../app/api/admin/meta/route';

declare global { var __metaDiagnosticEnv: CommerceEnv; }
const runtime: CommerceEnv = { EBOOK_ADMIN_KEY: 'a'.repeat(64), SITE_URL: 'https://store.example', MERCADOPAGO_MODE: 'production', META_CAPI_ACCESS_TOKEN: 'fixture-secret-never-return', META_CAPI_ENABLED: 'false' };
let mf: Miniflare, db: D1Database, session: string;
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', d1Databases: ['ORDERS'], compatibilityDate: '2026-10-27' }));
  db = await mf.getD1Database('ORDERS') as unknown as D1Database;
  runtime.ORDERS = db; globalThis.__metaDiagnosticEnv = runtime;
  for (const name of ['0001_commerce.sql', '0002_order_environment.sql', '0008_product_access.sql']) {
    for (const statement of (await readFile(`migrations/${name}`, 'utf8')).split(';').filter(value => value.trim())) await db.prepare(statement).run();
  }
  session = await loginAccessAdmin(runtime, runtime.EBOOK_ADMIN_KEY, 'fixture-ip');
});
after(async () => { await mf?.dispose(); });
const req = (method = 'GET', input?: unknown, authenticated = true, origin = runtime.SITE_URL) => new NextRequest('https://store.example/api/admin/meta', {
  method, headers: { ...(authenticated ? { Cookie: `${ADMIN_COOKIE}=${session}` } : {}), ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' },
  body: method === 'POST' ? JSON.stringify(input) : undefined,
});

test('real routes reject unauthenticated access and foreign origin before sending events', async () => {
  assert.equal((await GET(req('GET', undefined, false))).status, 401);
  assert.equal((await POST(req('POST', { action: 'test', testEventCode: 'TEST123' }, false))).status, 401);
  assert.equal((await POST(req('POST', { action: 'test', testEventCode: 'TEST123' }, true, 'https://foreign.example'))).status, 403);
  assert.equal((await POST(req('POST', null))).status, 400);
});

test('status lists production approvals without requiring marketing migrations or exposing token', async () => {
  const order = await ensureOrder(runtime, 'b'.repeat(64), randomUUID());
  await db.prepare("UPDATE orders SET status='approved' WHERE id=?").bind(order.id).run();
  await db.prepare("INSERT INTO funnel_events(event_key,name,visit_hash,order_id,amount_cents,currency,created_at) VALUES(?,'purchase_approved','fixture',?,1000,'BRL',?)").bind(`purchase:${order.id}`, order.id, Date.now()).run();
  const response = await GET(req());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json() as Awaited<ReturnType<typeof metaDiagnosticStatus>>;
  assert.equal(data.tablesAvailable, false); assert.equal(data.tokenConfigured, true);
  assert.equal(data.automaticEnabled, false); assert.equal(data.automaticFlowConnected, false);
  assert.equal(data.purchases.length, 1); assert.equal(data.purchases[0].state, null);
  assert.equal(JSON.stringify(data).includes(runtime.META_CAPI_ACCESS_TOKEN!), false);
  for (const statement of (await readFile('migrations/0007_meta_capi.sql', 'utf8')).split(';').filter(value => value.trim())) await db.prepare(statement).run();
  assert.equal((await metaDiagnosticStatus(runtime)).tablesAvailable, false);
  for (const statement of (await readFile('migrations/0009_meta_automatic.sql', 'utf8')).split(';').filter(value => value.trim())) await db.prepare(statement).run();
  assert.equal((await metaDiagnosticStatus(runtime)).tablesAvailable, true);
});

test('missing or malformed test code and missing token never call Meta', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json({}); };
  for (const code of [undefined, '', 'abc', 'https://invalid.example', 'x'.repeat(81)]) await assert.rejects(sendMetaDiagnostic(runtime, code, fetcher), CommerceError);
  await assert.rejects(sendMetaDiagnostic({ ...runtime, META_CAPI_ACCESS_TOKEN: '' }, 'TEST123', fetcher), CommerceError);
  assert.equal(calls, 0);
});

test('test route sends exactly one isolated test event even when automatic mode is disabled', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const before = await db.prepare('SELECT COUNT(*) AS n FROM funnel_events').first<{ n: number }>();
  try {
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url), 'https://graph.facebook.com/v26.0/1150409944170993/events');
      assert.equal(init?.redirect, 'manual');
      assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${runtime.META_CAPI_ACCESS_TOKEN}`);
      const payload = JSON.parse(init!.body as string);
      assert.equal(payload.test_event_code, 'TEST123'); assert.equal(payload.data.length, 1);
      assert.equal(payload.data[0].event_name, 'Purchase'); assert.match(payload.data[0].event_id, /^diagnostic:/);
      assert.equal(payload.data[0].custom_data.value, 10); assert.equal(payload.data[0].custom_data.currency, 'BRL');
      assert.deepEqual(Object.keys(payload.data[0].user_data), ['external_id']);
      return Response.json({ events_received: 1, fbtrace_id: 'fixture_trace' });
    };
    const response = await POST(req('POST', { action: 'test', testEventCode: 'TEST123' }));
    assert.equal(response.status, 200);
    const data = await response.json() as Awaited<ReturnType<typeof sendMetaDiagnostic>>; assert.equal(data.accepted, true); assert.equal(data.traceId, 'fixture_trace');
    assert.equal(JSON.stringify(data).includes(runtime.META_CAPI_ACCESS_TOKEN!), false);
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(calls, 1);
  assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n FROM funnel_events').first(), before);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM meta_purchase_delivery').first<{ n: number }>())?.n, 0);
});

test('errors, invalid JSON and transport failures do not leak provider bodies or claim success', async () => {
  const rejected = await sendMetaDiagnostic(runtime, 'TEST123', async () => Response.json({ error: { code: 190, error_subcode: 463, message: runtime.META_CAPI_ACCESS_TOKEN, fbtrace_id: 'trace_error' } }, { status: 400 }));
  assert.equal(rejected.accepted, false); assert.equal(rejected.errorCode, 190); assert.equal(rejected.errorSubcode, 463);
  assert.equal(JSON.stringify(rejected).includes(runtime.META_CAPI_ACCESS_TOKEN!), false);
  const invalid = await sendMetaDiagnostic(runtime, 'TEST123', async () => new Response('not-json'));
  assert.equal(invalid.accepted, false);
  const zero = await sendMetaDiagnostic(runtime, 'TEST123', async () => Response.json({ events_received: 0 }));
  assert.equal(zero.accepted, false);
  const offline = await sendMetaDiagnostic(runtime, 'TEST123', async () => { throw new Error('fixture network failure'); });
  assert.equal(offline.httpStatus, null); assert.equal(offline.accepted, false);
  const timeout = await sendMetaDiagnostic(runtime, 'TEST123', async () => { throw new DOMException('fixture timeout', 'TimeoutError'); });
  assert.match(timeout.message, /15 segundos/);
  const unsupported = await sendMetaDiagnostic(runtime, 'TEST123', async () => { throw new TypeError('Unsupported redirect mode'); });
  assert.match(unsupported.message, /antes do envio/);
  assert.notEqual(timeout.message, unsupported.message);
});

test('test endpoint enforces the administrative send quota', async () => {
  for (let i = 0; i < 6; i++) {
    const response = await POST(req('POST', { action: 'test', testEventCode: '' }));
    if (i === 5) assert.equal(response.status, 429);
  }
});

test('actual Workers runtime reaches the mocked Graph endpoint and never follows redirects', async () => {
  const bundled = await build({ stdin: { contents: `import {sendMetaDiagnostic} from './lib/meta-diagnostics';
    export default {async fetch(){return Response.json(await sendMetaDiagnostic({SITE_URL:'https://store.example',META_CAPI_ACCESS_TOKEN:'fixture-runtime-token'},'TEST123'));}};`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'neutral', format: 'esm', external: ['node:*'], write: false });
  let calls = 0, redirect = false;
  const worker = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-10-27', compatibilityFlags: ['nodejs_compat'],
    outboundService: async request => {
      calls++;
      assert.equal(new URL(request.url).hostname, 'graph.facebook.com');
      const payload = await request.json() as { test_event_code: string };
      assert.equal(payload.test_event_code, 'TEST123');
      return redirect ? Response.redirect('https://unexpected.example/', 302) : Response.json({ events_received: 1, fbtrace_id: 'runtime_fixture' });
    },
  }));
  try {
    const result = await (await worker.dispatchFetch('https://worker.example/')).json() as Awaited<ReturnType<typeof sendMetaDiagnostic>>;
    assert.equal(result.accepted, true); assert.equal(calls, 1);
    redirect = true;
    const blocked = await (await worker.dispatchFetch('https://worker.example/')).json() as Awaited<ReturnType<typeof sendMetaDiagnostic>>;
    assert.equal(blocked.accepted, false); assert.equal(blocked.httpStatus, 302);
    assert.equal(calls, 2, 'A redirect must not resend the authorization header to another host');
  } finally { await worker.dispose(); }
});
