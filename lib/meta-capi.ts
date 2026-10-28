import { createHash } from "node:crypto";
import type { CommerceEnv } from "./commerce";

const PIXEL_ID = "1150409944170993";
const GRAPH_VERSION = "v26.0";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type MetaEnv = CommerceEnv & Pick<CloudflareEnv, "META_CAPI_ENABLED" | "META_CAPI_ACCESS_TOKEN">;
type ApprovedEvent = { created_at: number; visit_hash: string; amount_cents: number; currency: string };

/** Best-effort opt-in CAPI transport; payment authorization never depends on Meta. */
export async function sendMetaPurchase(
  env: MetaEnv,
  orderId: string,
  eventId: string,
  userAgent: string | null,
  fbp: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (env.META_CAPI_ENABLED !== "true" || !env.META_CAPI_ACCESS_TOKEN ||
      env.MERCADOPAGO_MODE !== "production" || env.LIVE_PAYMENTS_ENABLED !== "true" ||
      !env.ORDERS || !env.SITE_URL?.startsWith("https://")) return false;
  const db = env.ORDERS;
  const approved = await db.prepare(
    "SELECT f.created_at, o.visit_hash, o.amount_cents, o.currency FROM orders o JOIN funnel_events f ON f.order_id=o.id AND f.name='purchase_approved' WHERE o.id=? AND o.status='approved' AND o.environment='production' AND o.meta_consent=1 AND o.amount_cents=1000 AND o.currency='BRL'"
  ).bind(orderId).first<ApprovedEvent>();
  if (!approved || eventId !== sha256(`meta-purchase:${orderId}`)) return false;
  const now = Date.now();
  // Never backfill old purchases: delayed events can escape Pixel/CAPI deduplication.
  if (approved.created_at > now + 60000 || now - approved.created_at > 48 * 3600 * 1000) return false;
  await db.prepare("INSERT OR IGNORE INTO meta_purchase_delivery(order_id) VALUES (?)").bind(orderId).run();
  const claim = await db.prepare(
    "UPDATE meta_purchase_delivery SET state='sending', attempts=attempts+1, locked_at=? WHERE order_id=? AND (state='pending' OR (state='sending' AND locked_at<?))"
  ).bind(now, orderId, now - 120000).run();
  if (!claim.meta.changes) return false;
  const userData: Record<string, unknown> = { external_id: [sha256(approved.visit_hash)] };
  if (userAgent && userAgent.length <= 512) userData.client_user_agent = userAgent;
  if (fbp && /^fb\.1\.\d{10,13}\.\d{1,30}$/.test(fbp)) userData.fbp = fbp;
  try {
    const response = await fetcher(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.META_CAPI_ACCESS_TOKEN}` },
      body: JSON.stringify({ data: [{
        event_name: "Purchase", event_time: Math.floor(approved.created_at / 1000),
        event_id: eventId, action_source: "website", event_source_url: env.SITE_URL,
        user_data: userData,
        custom_data: { value: approved.amount_cents / 100, currency: approved.currency,
          content_ids: ["150-doces-comer-vender"], content_type: "product" },
      }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Meta returned non-success HTTP status");
    const data = await response.json() as { events_received?: number };
    if (!Number.isInteger(data.events_received) || (data.events_received ?? 0) < 1)
      throw new Error("Meta did not acknowledge an event");
    await db.prepare("UPDATE meta_purchase_delivery SET state='sent',sent_at=? WHERE order_id=? AND state='sending' AND locked_at=?")
      .bind(Date.now(), orderId, now).run();
    return true;
  } catch {
    // A failed/uncertain send is retried with the same event_id, never a new conversion.
    await db.prepare("UPDATE meta_purchase_delivery SET state='pending' WHERE order_id=? AND state='sending' AND locked_at=?")
      .bind(orderId, now).run();
    console.warn(JSON.stringify({ event: "meta_capi_delivery_unconfirmed" }));
    return false;
  }
}
