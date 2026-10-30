import { NextRequest } from "next/server";
import { body, env, failure, json, sameOrigin } from "@/lib/http";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { CommerceError } from "@/lib/commerce";
import { issueProductAccess, limitedProductAction, ProductAccessError, revokeProductAccess } from "@/lib/product-access";
export async function GET(req: NextRequest) {
  try {
    const runtime = env();
    await verifyAccessAdmin(runtime, req.cookies.get(ADMIN_COOKIE)?.value);
    if (!runtime.ORDERS) throw new CommerceError(503, "Banco indisponível.");
    const page = Math.max(1, Math.min(10000, Number(req.nextUrl.searchParams.get("page")) || 1));
    const orderId = req.nextUrl.searchParams.get("order");
    if (orderId) {
      const order = await runtime.ORDERS.prepare(`SELECT o.id,o.status,o.environment,o.amount_cents,o.created_at FROM orders o WHERE o.id=?
        OR EXISTS(SELECT 1 FROM payment_attempts a WHERE a.order_id=o.id AND a.payment_id=?) LIMIT 1`).bind(orderId, orderId).first<{ id: string }>();
      if (!order) throw new CommerceError(404, "Pedido não encontrado.");
      const grants = await runtime.ORDERS.prepare("SELECT id,created_at,expires_at,revoked_at FROM product_access_grants WHERE order_id=? ORDER BY created_at DESC LIMIT 50").bind(order.id).all();
      const audit = await runtime.ORDERS.prepare("SELECT action,actor,previous_status,created_at FROM product_access_audit WHERE order_id=? ORDER BY created_at DESC LIMIT 50").bind(order.id).all();
      const attempts = await runtime.ORDERS.prepare("SELECT id,payment_id AS provider_order_id,status,created_at FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 50").bind(order.id).all();
      return json({ order, grants: grants.results, audit: audit.results, attempts: attempts.results });
    }
    const orders = await runtime.ORDERS.prepare("SELECT id,status,amount_cents,created_at FROM orders WHERE environment='production' ORDER BY created_at DESC,id LIMIT 21 OFFSET ?").bind((page - 1) * 20).all();
    return json({ orders: orders.results.slice(0, 20), hasMore: orders.results.length > 20, page });
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env(), actor = await verifyAccessAdmin(runtime, req.cookies.get(ADMIN_COOKIE)?.value);
    await limitedProductAction(runtime, `admin-action:${actor}`, 10);
    const input = await body(req);
    if (input.action === "revoke" && typeof input.grantId === "string") {
      await revokeProductAccess(runtime, input.grantId, actor);
      return json({ revoked: true });
    }
    if (input.action !== "issue" || typeof input.orderId !== "string" || input.confirmed !== true)
      throw new CommerceError(400, "Confira o pedido e confirme a geração do link.");
    const origin = runtime.SITE_URL;
    if (!origin || new URL(origin).protocol !== "https:") throw new CommerceError(503, "Configure SITE_URL com o domínio HTTPS canônico.");
    const grant = await issueProductAccess(runtime, input.orderId, actor);
    // Fragment is never sent in HTTP requests, referrers or access logs.
    const link = new URL("/acesso", origin);
    link.hash = `token=${grant.token}`;
    return json({ id: grant.id, link: link.toString(), expiresAt: grant.expiresAt });
  } catch (error) {
    if (error instanceof ProductAccessError) return json({ error: `Não foi possível gerar acesso: ${error.reason}. O pagamento precisa estar aprovado e validado.` }, error.status);
    return failure(error);
  }
}
