import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { ensureOrder, findOrder, hash, newAccess, startAttempt, validateWebhook, type CommerceEnv } from "../lib/commerce";
import { reconcileProviderOrder, type ProviderOrder } from "../lib/mercadopago-orders";
import { ACCESS_LIFETIME, issueProductAccess, lookupProductGrant, redeemProductAccess, resolveProductAccess, revokeProductAccess, limitedProductAction, purgeExpiredProductAccess, ProductAccessError } from "../lib/product-access";
import { deliverProduct } from "../lib/product-delivery";
import { loginAccessAdmin, verifyAccessAdmin } from "../lib/access-admin";
import { EBOOK_PREVIEW } from "../lib/ebook-preview";
import { NextRequest } from "next/server";
import { POST as checkoutPost } from "../app/api/checkout/route";
import { GET as downloadGet } from "../app/api/download/route";
import { GET as accessGet, POST as accessPost } from "../app/api/product-access/route";
import { POST as adminPost, GET as adminGet } from "../app/api/admin/ebook/route";
import { POST as adminLogin } from "../app/api/admin/ebook/login/route";
import { ADMIN_COOKIE } from "../lib/access-admin";
import { PRODUCT_ACCESS_COOKIE } from "../lib/product-access";

declare global {
  var __accessTestEnv: CommerceEnv;
  var __accessTestStorage: { manifest: () => Promise<typeof EBOOK_PREVIEW | null>; body: () => Promise<Uint8Array | null> };
}

let mf: Miniflare, db: D1Database;
const env: CommerceEnv = {
  SITE_URL: "https://store.example", MERCADOPAGO_ACCESS_TOKEN: "fixture-not-a-real-token",
  MERCADOPAGO_PUBLIC_KEY: "fixture", MERCADOPAGO_WEBHOOK_SECRET: "fixture-webhook",
  MERCADOPAGO_COLLECTOR_ID: "123", MERCADOPAGO_MODE: "production", CHECKOUT_ENABLED: "true", LIVE_PAYMENTS_ENABLED: "true", EBOOKS: {} as R2Bucket,
  EBOOK_ADMIN_KEY: "e".repeat(64),
};
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', d1Databases: ["ORDERS"], compatibilityDate: "2026-10-27" }));
  db = await mf.getD1Database("ORDERS") as unknown as D1Database; env.ORDERS = db;
  globalThis.__accessTestEnv = env;
  globalThis.__accessTestStorage = { manifest: async () => EBOOK_PREVIEW, body: async () => null };
  for (const name of ["0001_commerce.sql", "0002_order_environment.sql", "0003_jotafy.sql", "0008_product_access.sql"]) {
    const sql = await readFile(`migrations/${name}`, "utf8");
    for (const statement of sql.split(";").filter(s => s.trim())) await db.prepare(statement).run();
  }
});
after(async () => { await mf?.dispose(); });
async function fixture(initial = "approved") {
  const cookie = newAccess(), order = await ensureOrder(env, cookie, randomUUID());
  const attempt = await startAttempt(env, order, hash("fixture"));
  const provider: ProviderOrder = {
    id: `ORD${randomUUID().replaceAll("-", "")}`, type: "online", external_reference: attempt.id, user_id: "123",
    currency: "BRL", total_amount: "10.00", total_paid_amount: "10.00", status: "processed", status_detail: "accredited", last_updated_date: new Date().toISOString(),
    transactions: { payments: [{ id: `PAY${randomUUID()}`, amount: "10.00", paid_amount: "10.00", status: "processed" }] },
  };
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    assert.notEqual(init?.method, "POST", "Recovery must never create a charge");
    assert.equal(new URL(String(url)).pathname, `/v1/orders/${provider.id}`);
    calls++; return Response.json(provider);
  };
  function status(value: string) {
    provider.last_updated_date = new Date(Date.now() + 1000 + calls).toISOString();
    provider.status = value === "approved" ? "processed" : value === "rejected" ? "failed" : value === "pending" ? "action_required" : value;
    provider.status_detail = value === "approved" ? "accredited" : "waiting_transfer";
    provider.transactions!.payments![0].status = value === "approved" ? "processed" : value;
  }
  status(initial);
  await db.prepare("UPDATE payment_attempts SET payment_id=? WHERE id=?").bind(provider.id, attempt.id).run();
  await reconcileProviderOrder(env, provider);
  return { cookie, order, attempt, provider, fetcher, status, calls: () => calls };
}
const reason = (value: string) => (error: unknown) => error instanceof ProductAccessError && error.reason === value;

test("approved same-session access persists over repeated calls; missing session is distinct from payment", async () => {
  const f = await fixture();
  assert.equal((await resolveProductAccess(env, f.cookie, undefined, f.fetcher)).id, f.order.id);
  assert.equal((await resolveProductAccess(env, f.cookie, undefined, f.fetcher)).id, f.order.id);
  await assert.rejects(resolveProductAccess(env), reason("session"));
  assert.equal((await findOrder(env, f.cookie))!.status, "approved");
});
test("pending order becomes eligible after signed asynchronous webhook reconciliation; duplicates stay unique", async () => {
  const f = await fixture("pending");
  await assert.rejects(resolveProductAccess(env, f.cookie, undefined, f.fetcher), reason("pending"));
  f.status("approved");
  const ts = String(Math.floor(Date.now() / 1000)), requestId = "fixture-request";
  const signedId = f.provider.id.toLowerCase();
  const signature = createHmac("sha256", env.MERCADOPAGO_WEBHOOK_SECRET!).update(`id:${signedId};request-id:${requestId};ts:${ts};`).digest("hex");
  validateWebhook(new Request(`${env.SITE_URL}/api/webhooks/mercadopago?data.id=${f.provider.id}`, { method: "POST", headers: { "x-signature": `ts=${ts},v1=${signature}`, "x-request-id": requestId } }), env, Date.now(), true);
  await reconcileProviderOrder(env, f.provider); await reconcileProviderOrder(env, f.provider);
  assert.equal((await resolveProductAccess(env, f.cookie, undefined, f.fetcher)).status, "approved");
  const purchases = await db.prepare("SELECT COUNT(*) AS n FROM funnel_events WHERE order_id=? AND name='purchase_approved'").bind(f.order.id).first<{n:number}>();
  assert.equal(purchases!.n, 1);
  const grants = await db.prepare("SELECT COUNT(*) AS n FROM product_access_grants WHERE order_id=?").bind(f.order.id).first<{n:number}>();
  assert.equal(grants!.n, 0, "Webhook creates no recovery bearer or extra order");
});
test("preview GET-equivalent lookups do not consume link; redemption opens separate browsers and keeps only hashes", async () => {
  const f = await fixture(), issued = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  assert.match(issued.token, /^[a-f0-9]{64}$/);
  const before = Date.now();
  assert.ok(issued.expiresAt <= before + ACCESS_LIFETIME * 1000);
  await lookupProductGrant(env, issued.token); await lookupProductGrant(env, issued.token);
  const rows = await db.prepare("SELECT * FROM product_access_grants WHERE id=?").bind(issued.id).first<Record<string, unknown>>();
  assert.equal(rows!.token_hash, hash(issued.token)); assert.ok(!JSON.stringify(rows).includes(issued.token));
  const first = await redeemProductAccess(env, issued.token, f.fetcher);
  const second = await redeemProductAccess(env, issued.token, f.fetcher);
  assert.notEqual(first.session, second.session);
  assert.equal((await resolveProductAccess(env, undefined, first.session, f.fetcher)).id, f.order.id);
  assert.equal((await resolveProductAccess(env, undefined, second.session, f.fetcher)).id, f.order.id);
  const unrelated = await fixture("pending");
  assert.equal((await resolveProductAccess(env, unrelated.cookie, first.session, f.fetcher)).id, f.order.id);
});
test("invalid, expired and revoked links fail; revocation invalidates already redeemed sessions", async () => {
  const f = await fixture();
  for (const token of [undefined, "", f.order.id, f.provider.id, "a".repeat(64)]) await assert.rejects(lookupProductGrant(env, token), reason("invalid"));
  const expired = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  await db.prepare("UPDATE product_access_grants SET expires_at=? WHERE id=?").bind(Date.now()-1, expired.id).run();
  await assert.rejects(redeemProductAccess(env, expired.token, f.fetcher), reason("expired"));
  const active = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  const session = await redeemProductAccess(env, active.token, f.fetcher);
  await revokeProductAccess(env, active.id, "fixture-admin");
  await assert.rejects(redeemProductAccess(env, active.token, f.fetcher), reason("revoked"));
  await assert.rejects(resolveProductAccess(env, undefined, session.session, f.fetcher));
});
for (const status of ["pending", "rejected", "cancelled", "refunded", "charged_back"]) {
  test(`no recovery grant or download for ${status}`, async () => {
    const f = await fixture(status);
    await assert.rejects(issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher), reason(status));
    let storageReads = 0;
    const response = await deliverProduct(env, `${env.SITE_URL}/api/download`, f.cookie, undefined, { manifest: async () => { storageReads++; return EBOOK_PREVIEW; }, body: async () => { storageReads++; return new Uint8Array(); } }, f.fetcher);
    assert.equal(response.status, 303); assert.match(response.headers.get("Location")!, new RegExp(`estado=${status}`)); assert.equal(storageReads, 0);
  });
}
test("refund after issuing a link blocks redemption and every previously authorized session", async () => {
  const f = await fixture(), issued = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  const session = await redeemProductAccess(env, issued.token, f.fetcher);
  f.status("refunded");
  await assert.rejects(resolveProductAccess(env, undefined, session.session, f.fetcher), reason("refunded"));
  await assert.rejects(redeemProductAccess(env, issued.token, f.fetcher), reason("refunded"));
});
test("expired, unknown or revoked recovery cookies do not disable a valid original purchase session", async () => {
  const f = await fixture(), grant = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  const recovered = await redeemProductAccess(env, grant.token, f.fetcher);
  await db.prepare("UPDATE product_access_grants SET expires_at=0 WHERE id=?").bind(grant.id).run();
  assert.equal((await resolveProductAccess(env, f.cookie, recovered.session, f.fetcher)).id, f.order.id);
  await assert.rejects(resolveProductAccess(env, undefined, recovered.session, f.fetcher), reason("expired"));
  await revokeProductAccess(env, grant.id, "fixture-admin");
  assert.equal((await resolveProductAccess(env, f.cookie, recovered.session, f.fetcher)).id, f.order.id);
  assert.equal((await resolveProductAccess(env, f.cookie, "a".repeat(64), f.fetcher)).id, f.order.id);
  f.status("refunded");
  await assert.rejects(resolveProductAccess(env, f.cookie, recovered.session, f.fetcher), reason("refunded"));
});
test("provider and storage failures redirect to helpful HTML access flow without JSON or bypass", async () => {
  const f = await fixture();
  const unavailable = { manifest: async () => null, body: async () => null };
  const noSession = await deliverProduct(env, `${env.SITE_URL}/api/download`, undefined, undefined, unavailable, f.fetcher);
  assert.match(noSession.headers.get("Location")!, /estado=session/); assert.equal(await noSession.text(), "");
  const badStorage = await deliverProduct(env, `${env.SITE_URL}/api/download`, f.cookie, undefined, unavailable, f.fetcher);
  assert.match(badStorage.headers.get("Location")!, /estado=storage/);
  const missingBody = await deliverProduct(env, `${env.SITE_URL}/api/download`, f.cookie, undefined, { manifest: async () => EBOOK_PREVIEW, body: async () => { throw Error("fixture R2 failure"); } }, f.fetcher);
  assert.match(missingBody.headers.get("Location")!, /estado=storage/);
  const badProvider = await deliverProduct(env, `${env.SITE_URL}/api/download`, f.cookie, undefined, unavailable, async () => { throw Error("fixture timeout"); });
  assert.match(badProvider.headers.get("Location")!, /estado=verification/);
});
test("real ebook bytes are delivered intact through both authorization paths, verified by SHA-256", async t => {
  const file = process.env.EBOOK_TEST_PDF || path.join(os.tmpdir(), "livro-receitas-release-20261028-ebook.pdf");
  let pdf: Buffer;
  try { pdf = await readFile(file); } catch { t.skip("Provide EBOOK_TEST_PDF with the private edition to verify actual PDF bytes"); return; }
  assert.equal(pdf.length, EBOOK_PREVIEW.bytes);
  assert.equal(createHash("sha256").update(pdf).digest("hex"), EBOOK_PREVIEW.sha256);
  assert.equal(pdf.subarray(0,5).toString(), "%PDF-");
  const f = await fixture();
  const grant = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  const session = await redeemProductAccess(env, grant.token, f.fetcher);
  for (const credentials of [[f.cookie, undefined], [undefined, session.session]]) {
    const response = await deliverProduct(env, `${env.SITE_URL}/api/download`, credentials[0], credentials[1], { manifest: async () => EBOOK_PREVIEW, body: async () => new Uint8Array(pdf) }, f.fetcher);
    assert.equal(response.status, 200); assert.equal(response.headers.get("Content-Type"), "application/pdf");
    const bytes = await response.arrayBuffer();
    assert.equal(bytes.byteLength, EBOOK_PREVIEW.bytes);
    assert.equal(createHash("sha256").update(Buffer.from(bytes)).digest("hex"), EBOOK_PREVIEW.sha256);
  }
});
test("administrative auth fails closed, rejects tampering and missing setup, rate limits abuse", async () => {
  assert.throws(() => verifyAccessAdmin(env));
  await assert.rejects(loginAccessAdmin({ ...env, EBOOK_ADMIN_KEY: undefined }, "anything", "fixture"));
  await assert.rejects(loginAccessAdmin(env, "incorrect", "fixture-wrong"));
  const cookie = await loginAccessAdmin(env, env.EBOOK_ADMIN_KEY, "fixture-good");
  assert.match(verifyAccessAdmin(env, cookie), /^support:/);
  assert.throws(() => verifyAccessAdmin(env, cookie.slice(0,-1) + (cookie.endsWith("a") ? "b" : "a")));
  const [nonce, expiry, signature] = cookie.split(".");
  assert.throws(() => verifyAccessAdmin(env, `${nonce}.${Number(expiry)+1000}.${signature}`));
  assert.throws(() => verifyAccessAdmin({ ...env, EBOOK_ADMIN_KEY: "f".repeat(64) }, cookie));
  await limitedProductAction(env, "fixture-rate", 1);
  await assert.rejects(limitedProductAction(env, "fixture-rate", 1), (e: unknown) => (e as { status: number }).status === 429);
});
test("issuing and revoking produce an atomic audit with no token or personal information", async () => {
  const f = await fixture(), grant = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  await revokeProductAccess(env, grant.id, "fixture-admin");
  const rows = await db.prepare("SELECT action,actor,previous_status FROM product_access_audit WHERE order_id=? ORDER BY created_at").bind(f.order.id).all();
  assert.deepEqual(rows.results.map(r => r.action), ["issue", "revoke"]);
  assert.equal(rows.results[0].previous_status, "approved");
  assert.ok(!JSON.stringify(rows.results).includes(grant.token));
});

const request = (path: string, method = "GET", body?: unknown, cookie?: string, origin = env.SITE_URL!) => new NextRequest(`${env.SITE_URL}${path}`, {
  method, headers: { origin, ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined,
});
test("real checkout route persists host-only secure HttpOnly /api session for 30 days, SameSite=Lax", async () => {
  const response = await checkoutPost(request("/api/checkout", "POST", { visitId: randomUUID() }));
  assert.equal(response.status, 200);
  const header = response.headers.get("Set-Cookie")!;
  for (const pattern of [/recipe-order=[a-f0-9]{64}/, /Path=\/api/i, /HttpOnly/i, /Secure/i, /SameSite=lax/i, /Max-Age=2592000/i]) assert.match(header, pattern);
  assert.doesNotMatch(header, /Domain=/i);
  const token = /recipe-order=([a-f0-9]{64})/.exec(header)![1];
  assert.ok(await findOrder(env, token));
  const csrf = await checkoutPost(request("/api/checkout", "POST", { visitId: randomUUID() }, undefined, "https://attacker.example"));
  assert.equal(csrf.status, 403);
});
test("real admin routes require server auth and origin; real recovery and download routes deliver verified PDF", async () => {
  const f = await fixture();
  const unauthed = await adminGet(request("/api/admin/ebook")); assert.equal(unauthed.status, 401);
  const anonymousIssue = await adminPost(request("/api/admin/ebook", "POST", { action: "issue", orderId: f.order.id, confirmed: true })); assert.equal(anonymousIssue.status, 401);
  const login = await adminLogin(request("/api/admin/ebook/login", "POST", { key: env.EBOOK_ADMIN_KEY })); assert.equal(login.status, 200);
  const adminCookie = login.headers.get("Set-Cookie")!.split(";")[0];
  assert.match(adminCookie, new RegExp(`^${ADMIN_COOKIE}=`));
  assert.match(login.headers.get("Set-Cookie")!, /HttpOnly/i);
  const csrf = await adminPost(request("/api/admin/ebook", "POST", { action: "issue", orderId: f.order.id, confirmed: true }, adminCookie, "https://attacker.example")); assert.equal(csrf.status, 403);
  const realFetch = globalThis.fetch; globalThis.fetch = f.fetcher;
  try {
    const issued = await adminPost(request("/api/admin/ebook", "POST", { action: "issue", orderId: f.order.id, confirmed: true }, adminCookie));
    assert.equal(issued.status, 200);
    const result = await issued.json() as { link: string; id: string };
    const link = new URL(result.link); assert.equal(link.pathname, "/acesso"); assert.equal(link.search, "");
    const token = new URLSearchParams(link.hash.slice(1)).get("token")!;
    const detail = await adminGet(request(`/api/admin/ebook?order=${f.order.id}`, "GET", undefined, adminCookie));
    assert.ok(!(await detail.text()).includes(token), "Private bearer is never returned again in order listing");
    const byProvider = await adminGet(request(`/api/admin/ebook?order=${f.provider.id}`, "GET", undefined, adminCookie));
    assert.equal(byProvider.status, 200);
    assert.equal((await byProvider.json() as { order: { id: string } }).order.id, f.order.id);
    const missing = await downloadGet(request("/api/download")); assert.equal(missing.status, 303); assert.match(missing.headers.get("Location")!, /acesso\?estado=session/);
    const badToken = await accessPost(request("/api/product-access", "POST", { token: f.order.id })); assert.equal(badToken.status, 403);
    const csrfRedeem = await accessPost(request("/api/product-access", "POST", { token }, undefined, "https://attacker.example")); assert.equal(csrfRedeem.status, 403);
    const redeemed = await accessPost(request("/api/product-access", "POST", { token })); assert.equal(redeemed.status, 200);
    const recoveryCookie = redeemed.headers.get("Set-Cookie")!.split(";")[0];
    assert.match(recoveryCookie, new RegExp(`^${PRODUCT_ACCESS_COOKIE}=`));
    for (const p of [/HttpOnly/i, /Secure/i, /SameSite=lax/i, /Path=\/api/i]) assert.match(redeemed.headers.get("Set-Cookie")!, p);
    const state = await accessGet(request("/api/product-access", "GET", undefined, recoveryCookie)); assert.equal(state.status, 200);
    let pdf: Buffer;
    try { pdf = await readFile(process.env.EBOOK_TEST_PDF || path.join(os.tmpdir(), "livro-receitas-release-20261028-ebook.pdf")); }
    catch { return; }
    globalThis.__accessTestStorage = { manifest: async () => EBOOK_PREVIEW, body: async () => new Uint8Array(pdf) };
    for (const cookie of [recoveryCookie, `recipe-order=${f.cookie}`]) {
      const download = await downloadGet(request("/api/download", "GET", undefined, cookie));
      assert.equal(download.status, 200); assert.equal(download.headers.get("Content-Type"), "application/pdf");
      assert.equal(createHash("sha256").update(Buffer.from(await download.arrayBuffer())).digest("hex"), EBOOK_PREVIEW.sha256);
    }
    const revoke = await adminPost(request("/api/admin/ebook", "POST", { action: "revoke", grantId: result.id }, adminCookie)); assert.equal(revoke.status, 200);
    const blocked = await downloadGet(request("/api/download", "GET", undefined, recoveryCookie)); assert.equal(blocked.status, 303);
  } finally { globalThis.fetch = realFetch; globalThis.__accessTestStorage = { manifest: async () => EBOOK_PREVIEW, body: async () => null }; }
});
test("retention purges expired credentials and old audit without deleting any order or payment", async () => {
  const f = await fixture(), grant = await issueProductAccess(env, f.order.id, "fixture-admin", f.fetcher);
  await redeemProductAccess(env, grant.token, f.fetcher);
  await db.batch([
    db.prepare("UPDATE product_access_sessions SET expires_at=0 WHERE grant_id=?").bind(grant.id),
    db.prepare("UPDATE product_access_grants SET expires_at=? WHERE id=?").bind(Date.now() - 31 * 86400000, grant.id),
    db.prepare("UPDATE product_access_audit SET created_at=? WHERE grant_id=?").bind(Date.now() - 181 * 86400000, grant.id),
    db.prepare("DELETE FROM product_access_limits WHERE bucket='retention'"),
  ]);
  await purgeExpiredProductAccess(env);
  assert.equal(await db.prepare("SELECT id FROM product_access_grants WHERE id=?").bind(grant.id).first(), null);
  assert.equal(await db.prepare("SELECT id FROM product_access_audit WHERE grant_id=?").bind(grant.id).first(), null);
  assert.ok(await findOrder(env, f.cookie));
  assert.ok(await db.prepare("SELECT id FROM payment_attempts WHERE id=?").bind(f.attempt.id).first());
});
