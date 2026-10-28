import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac, randomUUID } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import {
  ensureOrder,
  newAccess,
  charge,
  findOrder,
  reconcile,
  refreshOrder,
  validateWebhook,
  hash,
  recordEvent,
  paymentReady,
  safePaymentData,
} from "../lib/commerce";
let mf: Miniflare, db: D1Database;
const env: any = {
  SITE_URL: "https://example.com",
  MERCADOPAGO_ACCESS_TOKEN: "TEST-only-unit-fixture",
  MERCADOPAGO_PUBLIC_KEY: "TEST-fixture",
  MERCADOPAGO_WEBHOOK_SECRET: "unit-fixture-secret",
  MERCADOPAGO_COLLECTOR_ID: "123",
  MERCADOPAGO_MODE: "sandbox",
  CHECKOUT_ENABLED: "true",
  EBOOKS: {},
};
before(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      d1Databases: ["ORDERS"],
      compatibilityDate: "2026-10-27",
    }),
  );
  db = (await mf.getD1Database("ORDERS")) as any;
  env.ORDERS = db;
  const sql = (await readFile("migrations/0001_commerce.sql", "utf8")) + (await readFile("migrations/0002_order_environment.sql", "utf8"));
  for (const statement of sql.split(";").filter((s) => s.trim()))
    await db.prepare(statement).run();
});
after(async () => {
  await mf?.dispose();
});
const form = {
  payment_method_id: "visa",
  token: "test-token-only",
  installments: 1,
  payer: { email: "fixture@example.com" },
};
let paymentSequence = 1000;
function provider(status = "approved") {
  const payments = new Map<string, any>();
  let creates = 0;
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url));
    if (path.pathname === "/v1/payment_methods")
      return Response.json([
        { id: "visa", payment_type_id: "credit_card", status: "active" },
        { id: "pix", payment_type_id: "bank_transfer", status: "active" },
      ]);
    if (init?.method === "POST") {
      const key = (init.headers as Record<string, string>)["X-Idempotency-Key"];
      if (!payments.has(key)) {
        creates++;
        const data = JSON.parse(init.body as string);
        assert.equal(data.transaction_amount, 10);
        assert.equal(data.currency_id, undefined);
        assert.equal(data.installments, 1);
        payments.set(key, {
          ...data,
          id: String(++paymentSequence),
          currency_id: "BRL",
          collector_id: 123,
          live_mode: false,
          status,
          date_last_updated: new Date().toISOString(),
        });
      }
      return Response.json({ id: payments.get(key).id });
    }
    if (path.pathname.endsWith("/search"))
      return Response.json({
        results: [...payments.values()].filter(
          (p) =>
            p.external_reference ===
            path.searchParams.get("external_reference"),
        ),
      });
    return Response.json(
      [...payments.values()].find((p) => path.pathname.endsWith("/" + p.id)),
    );
  };
  return {
    fetcher: fetcher as typeof fetch,
    payments,
    get creates() {
      return creates;
    },
  };
}
test("requires all configuration and explicit production activation", () => {
  assert.equal(paymentReady(env), true);
  assert.equal(paymentReady({ ...env, MERCADOPAGO_MODE: "production" }), false);
  assert.equal(
    paymentReady({ ...env, MERCADOPAGO_WEBHOOK_SECRET: undefined }),
    false,
  );
});
test("concurrent submissions use one provider key and one approved purchase event", async () => {
  const access = newAccess(),
    visit = randomUUID(),
    o = await ensureOrder(env, access, visit),
    p = provider();
  await Promise.all([
    charge(env, o, { ...form, transaction_amount: 0 }, p.fetcher),
    charge(env, o, { ...form, transaction_amount: 999 }, p.fetcher),
  ]);
  assert.equal(p.creates, 1);
  assert.equal((await findOrder(env, access))!.status, "approved");
  const payment = [...p.payments.values()][0];
  await Promise.all([reconcile(env, payment), reconcile(env, payment)]);
  const rows = await db
    .prepare("SELECT * FROM funnel_events WHERE order_id=?")
    .bind(o.id)
    .all();
  assert.equal(rows.results.length, 1);
  assert.equal(rows.results[0].amount_cents, 1000);
  assert.equal(await findOrder(env, newAccess()), null);
});
test("wrong amount, currency, account, order, mode, product and payment ID cannot authorize", async () => {
  const o = await ensureOrder(env, newAccess(), randomUUID()),
    p = provider("pending");
  await charge(env, o, form, p.fetcher);
  const original = [...p.payments.values()][0];
  for (const change of [
    { transaction_amount: 0 },
    { currency_id: "USD" },
    { collector_id: 999 },
    { external_reference: randomUUID() },
    { live_mode: true },
    { metadata: { order_id: o.id, product_id: "other" } },
    { metadata: { order_id: "other", product_id: "150-doces-comer-vender" } },
    { id: "999999" },
  ])
    await assert.rejects(
      reconcile(env, { ...original, status: "approved", ...change }),
    );
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM orders WHERE id=?")
        .bind(o.id)
        .first<any>()
    ).status,
    "pending",
  );
});
test("pending only grants after backend lookup; refund revokes and old events cannot overwrite it", async () => {
  const access = newAccess(),
    o = await ensureOrder(env, access, randomUUID()),
    p = provider("pending");
  assert.equal((await charge(env, o, form, p.fetcher)).status, "pending");
  const payment = [...p.payments.values()][0];
  payment.status = "approved";
  payment.date_last_updated = new Date(Date.now() + 1000).toISOString();
  const current = (await findOrder(env, access))!;
  assert.equal(
    (await refreshOrder(env, current, p.fetcher)).status,
    "approved",
  );
  const old = { ...payment };
  payment.status = "refunded";
  payment.date_last_updated = new Date(Date.now() + 2000).toISOString();
  assert.equal(
    (await refreshOrder(env, current, p.fetcher)).status,
    "refunded",
  );
  await reconcile(env, old);
  assert.equal((await findOrder(env, access))!.status, "refunded");
});
test("rejected payment permits a fresh idempotency key on retry", async () => {
  const access = newAccess(),
    o = await ensureOrder(env, access, randomUUID()),
    p = provider("rejected");
  assert.equal((await charge(env, o, form, p.fetcher)).status, "rejected");
  await charge(
    env,
    (await findOrder(env, access))!,
    { ...form, token: "new-test-token" },
    p.fetcher,
  );
  assert.equal(p.creates, 2);
});
test("lost POST response is reconciled by external reference without another charge", async () => {
  const access = newAccess(),
    o = await ensureOrder(env, access, randomUUID()),
    p = provider();
  const unreliable = async (url: any, init?: RequestInit) => {
    const response = await p.fetcher(url, init);
    if (init?.method === "POST")
      throw new Error("timeout after provider accepted");
    return response;
  };
  await assert.rejects(charge(env, o, form, unreliable));
  assert.equal((await findOrder(env, access))!.status, "processing");
  assert.equal(
    (await refreshOrder(env, (await findOrder(env, access))!, p.fetcher))
      .status,
    "approved",
  );
  assert.equal(p.creates, 1);
});
test("webhook authenticates query ID, request ID, timestamp and HMAC", () => {
  const now = Date.now(),
    ts = String(Math.floor(now / 1000)),
    requestId = randomUUID(),
    id = "12345";
  const sig = createHmac("sha256", env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  const req = new Request(
    `https://example.com/api/webhooks/mercadopago?data.id=${id}`,
    {
      headers: {
        "x-request-id": requestId,
        "x-signature": `ts=${ts},v1=${sig}`,
      },
    },
  );
  assert.equal(validateWebhook(req, env, now).id, id);
  assert.throws(() =>
    validateWebhook(req, { ...env, MERCADOPAGO_WEBHOOK_SECRET: "wrong" }, now),
  );
  assert.throws(() => validateWebhook(req, env, now + 700000));
  assert.throws(() =>
    validateWebhook(new Request("https://example.com"), env, now),
  );
});
test("public analytics reject forged purchases and deduplicate offer/checkout without PII", async () => {
  const visit = randomUUID();
  await Promise.all([
    recordEvent(env, "offer_view", visit, randomUUID()),
    recordEvent(env, "offer_view", visit, randomUUID()),
  ]);
  const rows = await db
    .prepare("SELECT * FROM funnel_events WHERE visit_hash=?")
    .bind(hash(visit))
    .all();
  assert.equal(rows.results.length, 1);
  assert.equal(rows.results[0].name, "offer_view");
  await assert.rejects(
    recordEvent(env, "purchase_approved", visit, randomUUID()),
  );
  assert.throws(() =>
    safePaymentData({ ...form, installments: 2 }, [
      { id: "visa", payment_type_id: "credit_card", status: "active" },
    ]),
  );
});
test("provider validation refusal permits a new attempt, while ambiguous failures keep the original", async () => {
  const access = newAccess(),
    o = await ensureOrder(env, access, randomUUID()),
    p = provider();
  const refused = async (url: any, init?: RequestInit) =>
    init?.method === "POST"
      ? Response.json({ error: "invalid data" }, { status: 400 })
      : p.fetcher(url, init);
  assert.equal((await charge(env, o, form, refused)).status, "rejected");
  assert.equal(
    (
      await charge(
        env,
        (await findOrder(env, access))!,
        { ...form, token: "new-token-for-retry" },
        p.fetcher,
      )
    ).status,
    "approved",
  );
  const access2 = newAccess(),
    order2 = await ensureOrder(env, access2, randomUUID());
  const uncertain = async (url: any, init?: RequestInit) =>
    init?.method === "POST"
      ? Response.json({ error: "in progress" }, { status: 409 })
      : p.fetcher(url, init);
  await assert.rejects(charge(env, order2, form, uncertain));
  assert.equal((await findOrder(env, access2))!.status, "processing");
  await assert.rejects(
    charge(
      env,
      (await findOrder(env, access2))!,
      { ...form, token: "different-token" },
      p.fetcher,
    ),
  );
});

// Orders fixtures verify backend logic only, not the official sandbox.
import { chargeProviderOrder, refreshProviderOrder, reconcileProviderOrder, validateProviderOrder } from '../lib/mercadopago-orders';
function ordersProvider(initial = 'approved', mode = 'sandbox') {
  const rows = new Map<string, any>(); let creates = 0; let lost = false;
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    if (u.pathname === '/v1/payment_methods') return Response.json([{id:'visa',payment_type_id:'credit_card',status:'active'},{id:'pix',payment_type_id:'bank_transfer',status:'active'}]);
    assert.equal((init?.headers as any)['X-Test-Scope'],mode === 'sandbox' ? 'sandbox' : undefined);
    if (init?.method === 'POST') {
      assert.equal(u.pathname,'/v1/orders');
      const b = JSON.parse(String(init.body)); const key = (init.headers as any)['X-Idempotency-Key'];
      assert.equal(b.total_amount,'10.00'); assert.equal(b.currency,'BRL'); assert.equal(b.transactions.payments.length,1);
      if (!rows.has(key)) { creates++; rows.set(key,{
        id:'ORD'+randomUUID().replaceAll('-',''),type:'online',external_reference:key,user_id:'123',currency:'BRL',total_amount:'10.00',total_paid_amount:initial==='approved'?'10.00':'0.00',
        status:initial==='approved'?'processed':initial==='rejected'?'failed':'action_required',status_detail:initial==='approved'?'accredited':'waiting_payment',last_updated_date:new Date().toISOString(),
        transactions:{payments:[{id:'PAYfixture',amount:'10.00',status:initial==='approved'?'processed':initial,payment_method:{qr_code:'test-pix-code'}}]},
      }); }
      if (lost) {lost=false;throw new Error('lost response');}
      return Response.json(rows.get(key));
    }
    if (u.pathname === '/v1/orders') return Response.json({data:[...rows.values()].filter(r=>r.external_reference===u.searchParams.get('external_reference'))});
    const found = [...rows.values()].find(r=>u.pathname===`/v1/orders/${r.id}`);
    assert.ok(found); return Response.json(found);
  };
  return {fetcher:fetcher as typeof fetch,rows,get creates(){return creates;},lose(){lost=true;}};
}
test('Orders: concurrent submissions persist one provider order and one purchase event',async()=>{
  const local = await ensureOrder(env,newAccess(),randomUUID()), p=ordersProvider();
  const r=await Promise.all([chargeProviderOrder(env,local,form,p.fetcher),chargeProviderOrder(env,local,form,p.fetcher)]);
  assert.ok(r.every(x=>x.status==='approved'));assert.equal(p.creates,1);
  const events=await db.prepare("SELECT COUNT(*) AS count FROM funnel_events WHERE order_id=? AND name='purchase_approved'").bind(local.id).first<any>();assert.equal(events.count,1);
  const refreshed=await refreshProviderOrder(env,(await db.prepare('SELECT * FROM orders WHERE id=?').bind(local.id).first<any>())!,p.fetcher);assert.equal(refreshed.status,'approved');
});
test('Orders: validates account, currency, amount, product, reference and provider ID',()=>{
  const a={id:'attempt',order_id:'local',payment_id:null,created_at:Date.now()};
  const o={environment:'sandbox',id:'local',product_id:'150-doces-comer-vender',amount_cents:1000,currency:'BRL',active_attempt:a.id,status:'processing'};
  const p:any={id:'ORD123',type:'online',external_reference:a.id,user_id:'123',currency:'BRL',total_amount:'10.00',total_paid_amount:'10.00',status:'processed',status_detail:'accredited',last_updated_date:new Date().toISOString(),transactions:{payments:[{id:'PAY123',amount:'10.00',status:'processed'}]}};
  assert.equal(validateProviderOrder(p,a,o,env),'approved');
  for(const bad of [{currency:'USD'},{user_id:'456'},{total_amount:'1.00'},{external_reference:'other'},{type:'point'},{last_updated_date:'invalid'},{transactions:{payments:[]}}]) assert.throws(()=>validateProviderOrder({...p,...bad},a,o,env));
  assert.throws(()=>validateProviderOrder(p,{...a,payment_id:'ORDother'},o,env));
  assert.equal(validateProviderOrder({...p,total_paid_amount:'0.00'},a,o,env),'pending');
  assert.equal(validateProviderOrder({...p,status:'unknown'},a,o,env),'pending');
});
test('Orders: pending, reconciliation, refund and stale events',async()=>{
  const local=await ensureOrder(env,newAccess(),randomUUID()),p=ordersProvider('pending');
  const pending=await chargeProviderOrder(env,local,{payment_method_id:'pix',payer:form.payer},p.fetcher);assert.equal(pending.status,'pending');assert.equal(pending.pix?.code,'test-pix-code');
  const row=[...p.rows.values()][0], old=structuredClone(row);
  row.status='processed';row.status_detail='accredited';row.total_paid_amount='10.00';row.transactions.payments[0].status='processed';row.last_updated_date=new Date(Date.now()+1000).toISOString();
  assert.equal((await reconcileProviderOrder(env,row)).status,'approved');
  await reconcileProviderOrder(env,row);
  row.transactions.payments[0].refunded_amount='10.00';row.last_updated_date=new Date(Date.now()+2000).toISOString();
  assert.equal((await reconcileProviderOrder(env,row)).status,'refunded');assert.equal((await reconcileProviderOrder(env,old)).status,'refunded');
});
test('Orders: lost create response is recovered by reference without another charge',async()=>{
  const local=await ensureOrder(env,newAccess(),randomUUID()),p=ordersProvider();p.lose();
  await assert.rejects(chargeProviderOrder(env,local,form,p.fetcher));
  const stored=await db.prepare('SELECT * FROM orders WHERE id=?').bind(local.id).first<any>();
  assert.equal((await refreshProviderOrder(env,stored,p.fetcher)).status,'approved');assert.equal(p.creates,1);
});
test('Orders: alphanumeric webhook IDs authenticate using lowercase ID in manifest',()=>{
  const id='ORD123ABC',ts=String(Date.now()),rid='request-orders';
  const sign=createHmac('sha256',env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${id.toLowerCase()};request-id:${rid};ts:${ts};`).digest('hex');
  const req=new Request(`https://example.com/api/webhooks/mercadopago?data.id=${id}`,{headers:{'x-request-id':rid,'x-signature':`ts=${ts},v1=${sign}`}});
  assert.equal(validateWebhook(req,env,Date.now(),true).id,id);
  assert.throws(()=>validateWebhook(new Request(`https://example.com/?data.id=ORDaltered`,{headers:req.headers}),env,Date.now(),true));
});

 test('Orders: rejected attempts allow retry and reject cross-environment orders', async()=>{
   const local=await ensureOrder(env,newAccess(),randomUUID()),p=ordersProvider('rejected');
   assert.equal((await chargeProviderOrder(env,local,form,p.fetcher)).status,'rejected');
   const stored=await db.prepare('SELECT * FROM orders WHERE id=?').bind(local.id).first<any>();
   assert.equal((await chargeProviderOrder(env,stored,form,p.fetcher)).status,'rejected');assert.equal(p.creates,2);
   await assert.rejects(chargeProviderOrder({...env,MERCADOPAGO_MODE:'production',LIVE_PAYMENTS_ENABLED:'true'},stored,form,p.fetcher));
 });

test('Orders: production requires explicit flags and creates isolated orders without test scope',async()=>{
  const access=newAccess(), visit=randomUUID();
  const sandbox=await ensureOrder(env,access,visit);
  const production={...env,MERCADOPAGO_MODE:'production',LIVE_PAYMENTS_ENABLED:'true'};
  assert.equal(await findOrder(production,access),null);
  const real=await ensureOrder(production,access,visit);
  assert.notEqual(real.id,sandbox.id);assert.equal(real.environment,'production');
  assert.equal((await findOrder(env,access))?.id,sandbox.id);
  const p=ordersProvider('approved','production');
  await assert.rejects(chargeProviderOrder({...production,LIVE_PAYMENTS_ENABLED:'false'},real,form,p.fetcher));
  assert.equal(p.creates,0);
  const result=await chargeProviderOrder(production,real,form,p.fetcher);
  assert.equal(result.status,'approved');assert.equal(p.creates,1);
  const provider=[...p.rows.values()][0];
  await assert.rejects(reconcileProviderOrder(env,provider));
});
