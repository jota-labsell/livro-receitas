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
  const sql = await readFile("migrations/0001_commerce.sql", "utf8");
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
