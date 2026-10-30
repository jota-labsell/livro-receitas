import { NextRequest } from "next/server";
import { env, json, failure, body, sameOrigin } from "@/lib/http";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { CommerceError } from "@/lib/commerce";
import { reportFilter, saveOperationSettings } from "@/lib/operations";
import { operationSettings } from "@/lib/operations-settings";
import { limitedProductAction } from "@/lib/product-access";
import { EBOOK_PREVIEW } from "@/lib/ebook-preview";
import { PRODUCT_CONFIG } from "@/lib/product.config";
export async function GET(req: NextRequest) {
  try {
    const runtime = env();
    verifyAccessAdmin(runtime, req.cookies.get(ADMIN_COOKIE)?.value);
    if (!runtime.ORDERS) throw new CommerceError(503, "Banco indisponível.");
    const db = runtime.ORDERS,
      f = reportFilter(req.nextUrl.searchParams);
    const base = `environment='production' AND created_at>=? AND created_at<?`;
    const summary = await db
      .prepare(
        `SELECT COUNT(*) orders,COALESCE(SUM(CASE WHEN status='approved' THEN amount_cents ELSE 0 END),0) revenue,
 SUM(status='approved') approved,SUM(status IN ('pending','processing')) pending,SUM(status IN ('refunded','charged_back')) reversed FROM orders WHERE ${base}`,
      )
      .bind(f.start, f.end)
      .first();
    const days = await db
      .prepare(
        `SELECT strftime('%Y-%m-%d',created_at/1000-10800,'unixepoch') day,COUNT(*) orders,SUM(CASE WHEN status='approved' THEN amount_cents ELSE 0 END) revenue FROM orders WHERE ${base} GROUP BY day ORDER BY day`,
      )
      .bind(f.start, f.end)
      .all();
    const where =
      base +
      ` AND (?='' OR status=?) AND (?='' OR id=? OR EXISTS(SELECT 1 FROM payment_attempts a WHERE a.order_id=orders.id AND a.payment_id=?))`;
    const args = [f.start, f.end, f.status, f.status, f.q, f.q, f.q];
    const orders = await db
      .prepare(
        `SELECT id,status,amount_cents,created_at,updated_at FROM orders WHERE ${where} ORDER BY created_at DESC,id LIMIT 26 OFFSET ?`,
      )
      .bind(...args, (f.page - 1) * 25)
      .all();
    const tables = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all<{ name: string }>();
    const names = new Set(tables.results.map((x) => x.name));
    let campaigns: unknown[] = [],
      funnel: unknown = null;
    if (names.has("operation_sessions")) {
      campaigns = (
        await db
          .prepare(
            `SELECT s.source,s.medium,s.campaign,COUNT(DISTINCT s.visit_hash) sessions,COUNT(o.id) orders,SUM(CASE WHEN o.status='approved' THEN 1 ELSE 0 END) approved,COALESCE(SUM(CASE WHEN o.status='approved' THEN o.amount_cents ELSE 0 END),0) revenue FROM operation_sessions s LEFT JOIN orders o ON o.visit_hash=s.visit_hash AND o.environment='production' WHERE s.first_seen>=? AND s.first_seen<? GROUP BY s.source,s.medium,s.campaign ORDER BY sessions DESC LIMIT 100`,
          )
          .bind(f.start, f.end)
          .all()
      ).results;
      funnel = await db
        .prepare(
          `SELECT COUNT(*) sessions,
 SUM(EXISTS(SELECT 1 FROM funnel_events f WHERE f.visit_hash=s.visit_hash AND f.name='offer_view')) views,
 SUM(EXISTS(SELECT 1 FROM funnel_events f WHERE f.visit_hash=s.visit_hash AND f.name='cta_click')) clicks,
 SUM(EXISTS(SELECT 1 FROM funnel_events f WHERE f.visit_hash=s.visit_hash AND f.name='checkout_start')) checkouts,
 SUM(EXISTS(SELECT 1 FROM orders o WHERE o.visit_hash=s.visit_hash AND o.environment='production')) orders,
 SUM(EXISTS(SELECT 1 FROM orders o WHERE o.visit_hash=s.visit_hash AND o.environment='production' AND o.status='approved')) approved
 FROM operation_sessions s WHERE s.first_seen>=? AND s.first_seen<?`,
        )
        .bind(f.start, f.end)
        .first();
    }
    let meta: unknown = null;
    if (names.has("meta_purchase_delivery"))
      meta = (
        await db
          .prepare(
            "SELECT state,COUNT(*) total,MAX(attempts) max_attempts FROM meta_purchase_delivery GROUP BY state",
          )
          .all()
      ).results;
    let push: unknown = null;
    if (names.has("jotafy_outbox"))
      push = (
        await db
          .prepare(
            "SELECT status,COUNT(*) total FROM jotafy_outbox GROUP BY status",
          )
          .all()
      ).results;
    const health = names.has("operation_health")
      ? (await db.prepare("SELECT name,last_run FROM operation_health").all())
          .results
      : [];
    const file = await runtime.EBOOKS?.head(
      `sha256/${EBOOK_PREVIEW.sha256}.pdf`,
    )
      .then((x) => Boolean(x))
      .catch(() => null);
    return json({
      summary,
      days: days.results,
      orders: orders.results.slice(0, 25),
      hasMore: orders.results.length > 25,
      page: f.page,
      campaigns,
      funnel,
      meta,
      push,
      health,
      trackingAvailable: names.has("operation_sessions"),
      settings: await operationSettings(runtime),
      product: PRODUCT_CONFIG,
      services: {
        database: true,
        ebook: file ?? null,
        paymentsConfigured:
          runtime.CHECKOUT_ENABLED === "true" &&
          Boolean(runtime.MERCADOPAGO_ACCESS_TOKEN),
        metaConfigured:
          runtime.META_CAPI_ENABLED === "true" &&
          Boolean(runtime.META_CAPI_ACCESS_TOKEN),
      },
      checkedAt: Date.now(),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env(),
      actor = verifyAccessAdmin(runtime, req.cookies.get(ADMIN_COOKIE)?.value);
    await limitedProductAction(runtime, "operations:" + actor, 10);
    await saveOperationSettings(runtime, actor, await body(req));
    return json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
