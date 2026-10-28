import { NextRequest } from "next/server";
import { cloudflareEnv } from "@/lib/runtime";
import { json, body, failure, sameOrigin, ORDER_COOKIE } from "@/lib/http";
import { findOrder } from "@/lib/commerce";
export async function GET() {
  const env = cloudflareEnv();
  return json({ enabled: Boolean(env?.MERCADOPAGO_MODE === "production" && env.LIVE_PAYMENTS_ENABLED === "true" && env.CHECKOUT_ENABLED === "true") });
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const input = await body(req);
    if (typeof input.consent !== "boolean") return json({ updated: false }, 400);
    const runtime = cloudflareEnv();
    if (!runtime?.ORDERS) return json({ updated: false });
    const order = await findOrder(runtime, req.cookies.get(ORDER_COOKIE)?.value);
    if (!order) return json({ updated: false });
    // Consent can be withdrawn before approval; never backfill old purchases.
    await runtime.ORDERS.prepare("UPDATE orders SET meta_consent=? WHERE id=? AND status NOT IN ('approved','refunded','charged_back')")
      .bind(input.consent ? 1 : 0, order.id).run();
    return json({ updated: true });
  } catch (error) {
    return failure(error);
  }
}
