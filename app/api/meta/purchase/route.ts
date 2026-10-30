import { NextRequest } from "next/server";
import { env, json, failure, sameOrigin, ORDER_COOKIE } from "@/lib/http";
import { CommerceError, findOrder } from "@/lib/commerce";
import { refreshProviderOrder } from "@/lib/mercadopago-orders";
import { sendMetaPurchase } from "@/lib/meta-capi";

/**
 * Optional server retry/diagnostic endpoint. The normal conversion is emitted
 * by Mercado Pago reconciliation (webhook or status refresh), not by the
 * browser. Consent and approval are always re-read from D1.
 */
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env();
    // Feature is off unless explicitly enabled with a Worker secret.
    if (runtime.META_CAPI_ENABLED !== "true" || !runtime.META_CAPI_ACCESS_TOKEN)
      return json({ enabled: false });
    const order = await findOrder(runtime, req.cookies.get(ORDER_COOKIE)?.value);
    if (!order) throw new CommerceError(404, "Pedido nÃ£o encontrado.");
    const current = await refreshProviderOrder(runtime, order);
    if (current.status !== "approved" || !current.purchase)
      return json({ sent: false });
    const sent = await sendMetaPurchase(
      runtime,
      order.id,
      current.purchase.eventId,
      req.headers.get("user-agent"),
      req.cookies.get("_fbp")?.value,
    );
    return json({ sent });
  } catch (error) {
    return failure(error);
  }
}

