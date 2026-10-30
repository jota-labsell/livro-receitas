import { randomBytes, randomUUID } from "node:crypto";
import { CommerceError, findOrder, hash, type CommerceEnv } from "./commerce";
import { refreshProviderOrder } from "./mercadopago-orders";
import { PRODUCT_CONFIG } from "./product.config";

export const PRODUCT_ACCESS_COOKIE = "recipe-product-access";
export const ACCESS_LIFETIME = 7 * 86400;
const validToken = (token: unknown): token is string => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
export type AccessOrder = NonNullable<Awaited<ReturnType<typeof findOrder>>>;
type Grant = { id: string; order_id: string; expires_at: number; revoked_at: number | null };
export class ProductAccessError extends Error {
  constructor(public reason: "session" | "invalid" | "expired" | "revoked" | "pending" | "rejected" | "refunded" | "charged_back" | "cancelled" | "storage" | "verification", public status = 403) { super(reason); }
}
function database(env: CommerceEnv) {
  if (!env.ORDERS) throw new ProductAccessError("verification", 503);
  return env.ORDERS;
}
export async function accessOrderById(env: CommerceEnv, id: string) {
  return database(env).prepare("SELECT * FROM orders WHERE id=? AND environment=?")
    .bind(id, env.MERCADOPAGO_MODE === "production" ? "production" : "sandbox").first<AccessOrder>();
}
/** Reconcile with the provider, then re-read eligibility; browser claims never authorize. */
export async function requireApprovedAccess(env: CommerceEnv, order: AccessOrder, fetcher: typeof fetch = fetch) {
  try { await refreshProviderOrder(env, order, fetcher); }
  catch { throw new ProductAccessError("verification", 503); }
  const fresh = await accessOrderById(env, order.id);
  if (!fresh) throw new ProductAccessError("invalid");
  if (fresh.status !== "approved") {
    const reason = ["rejected", "refunded", "charged_back", "cancelled"].includes(fresh.status)
      ? fresh.status as "rejected" | "refunded" | "charged_back" | "cancelled" : "pending";
    throw new ProductAccessError(reason);
  }
  const evidence = await database(env).prepare(`SELECT COUNT(*) AS n FROM payment_attempts
    WHERE order_id=? AND status='approved' AND payment_id IS NOT NULL`).bind(order.id).first<{ n: number }>();
  const reversed = await database(env).prepare("SELECT COUNT(*) AS n FROM payment_attempts WHERE order_id=? AND status IN ('refunded','charged_back')")
    .bind(order.id).first<{ n: number }>();
  if (!evidence?.n || reversed?.n || fresh.product_id !== PRODUCT_CONFIG.id || fresh.amount_cents !== PRODUCT_CONFIG.amountCents || fresh.currency !== "BRL")
    throw new ProductAccessError("verification", 503);
  return fresh;
}
export async function issueProductAccess(env: CommerceEnv, orderId: string, actor: string, fetcher: typeof fetch = fetch) {
  const order = await accessOrderById(env, orderId);
  if (!order) throw new ProductAccessError("invalid", 404);
  await requireApprovedAccess(env, order, fetcher);
  const db = database(env), token = randomBytes(32).toString("hex"), id = randomUUID(), now = Date.now();
  const expiresAt = now + ACCESS_LIFETIME * 1000;
  // Keep creation and its administrative audit atomic. No tokens in the audit.
  await db.batch([
    db.prepare("INSERT INTO product_access_grants(id,order_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)").bind(id, order.id, hash(token), now, expiresAt),
    db.prepare("INSERT INTO product_access_audit(id,order_id,grant_id,action,actor,previous_status,created_at) VALUES(?,?,?,'issue',?,?,?)").bind(randomUUID(), order.id, id, actor, order.status, now),
  ]);
  return { id, token, expiresAt };
}
function checkGrant(grant: Grant | null, now = Date.now()): asserts grant is Grant {
  if (!grant) throw new ProductAccessError("invalid");
  if (grant.revoked_at !== null) throw new ProductAccessError("revoked");
  if (grant.expires_at <= now) throw new ProductAccessError("expired");
}
/** Read-only: GETs, link preview crawlers and email scanners cannot consume a grant. */
export async function lookupProductGrant(env: CommerceEnv, token: unknown) {
  if (!validToken(token)) throw new ProductAccessError("invalid");
  const grant = await database(env).prepare("SELECT id,order_id,expires_at,revoked_at FROM product_access_grants WHERE token_hash=?").bind(hash(token)).first<Grant>();
  checkGrant(grant);
  return grant;
}
export async function redeemProductAccess(env: CommerceEnv, token: unknown, fetcher: typeof fetch = fetch) {
  const grant = await lookupProductGrant(env, token);
  const order = await accessOrderById(env, grant.order_id);
  if (!order) throw new ProductAccessError("invalid");
  await requireApprovedAccess(env, order, fetcher);
  const session = randomBytes(32).toString("hex"), now = Date.now();
  // Conditional insert closes expiry/revocation races during provider reconciliation.
  const result = await database(env).prepare(`INSERT INTO product_access_sessions(token_hash,grant_id,created_at,expires_at)
    SELECT ?,id,?,expires_at FROM product_access_grants WHERE id=? AND revoked_at IS NULL AND expires_at>?`)
    .bind(hash(session), now, grant.id, now).run();
  if (!result.meta.changes) throw new ProductAccessError("revoked");
  return { session, expiresAt: grant.expires_at };
}
export async function resolveProductAccess(env: CommerceEnv, orderCookie?: string, recoveryCookie?: string, fetcher: typeof fetch = fetch) {
  let order: AccessOrder | null = null;
  if (validToken(recoveryCookie)) {
    try {
      const grant = await database(env).prepare(`SELECT g.id,g.order_id,g.expires_at,g.revoked_at,s.expires_at AS session_expires_at
        FROM product_access_sessions s JOIN product_access_grants g ON g.id=s.grant_id WHERE s.token_hash=?`)
        .bind(hash(recoveryCookie)).first<Grant & { session_expires_at: number }>();
      checkGrant(grant);
      if (grant.session_expires_at <= Date.now()) throw new ProductAccessError("expired");
      order = await accessOrderById(env, grant.order_id);
    } catch (error) {
      // Expiring a recovery link must not disable an independently valid purchase session.
      if (!(error instanceof ProductAccessError) || !["invalid", "expired", "revoked"].includes(error.reason)) throw error;
      order = await findOrder(env, orderCookie);
      if (!order) throw error;
    }
  }
  if (!order) order = await findOrder(env, orderCookie);
  if (!order) throw new ProductAccessError("session", 401);
  return requireApprovedAccess(env, order, fetcher);
}
export async function revokeProductAccess(env: CommerceEnv, id: string, actor: string) {
  const db = database(env), now = Date.now();
  const grant = await db.prepare("SELECT id,order_id FROM product_access_grants WHERE id=?").bind(id).first<{ id: string; order_id: string }>();
  if (!grant) throw new ProductAccessError("invalid", 404);
  await db.batch([
    db.prepare("UPDATE product_access_grants SET revoked_at=COALESCE(revoked_at,?) WHERE id=?").bind(now, id),
    db.prepare("DELETE FROM product_access_sessions WHERE grant_id=?").bind(id),
    db.prepare("INSERT INTO product_access_audit(id,order_id,grant_id,action,actor,created_at) VALUES(?,?,?,'revoke',?,?)").bind(randomUUID(), grant.order_id, id, actor, now),
  ]);
}
export async function limitedProductAction(env: CommerceEnv, bucket: string, max: number, windowMs = 60000) {
  const db = database(env), now = Date.now();
  const result = await db.prepare(`INSERT INTO product_access_limits(bucket,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`)
    .bind(bucket, now + windowMs, now, now).first<{ count: number }>();
  if (!result || result.count > max) throw new CommerceError(429, "Muitas tentativas. Aguarde alguns minutos.");
  await purgeExpiredProductAccess(env).catch(() => {
    console.warn(JSON.stringify({ event: "product_access_retention_unavailable" }));
  });
}
/** Daily, request-driven retention; never delete an order or a payment. Also callable by maintenance. */
export async function purgeExpiredProductAccess(env: CommerceEnv) {
  const db = database(env), now = Date.now();
  const claimed = await db.prepare(`INSERT INTO product_access_limits(bucket,count,expires_at) VALUES('retention',1,?)
    ON CONFLICT(bucket) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<=?`)
    .bind(now + 86400000, now).run();
  if (!claimed.meta.changes) return;
  await db.batch([
    db.prepare("DELETE FROM product_access_sessions WHERE expires_at<=?").bind(now),
    db.prepare("DELETE FROM product_access_grants WHERE expires_at<? AND NOT EXISTS(SELECT 1 FROM product_access_sessions WHERE grant_id=product_access_grants.id)").bind(now - 30 * 86400000),
    db.prepare("DELETE FROM product_access_audit WHERE created_at<?").bind(now - 180 * 86400000),
    db.prepare("DELETE FROM product_access_limits WHERE expires_at<=? AND bucket!='retention'").bind(now),
  ]);
}
