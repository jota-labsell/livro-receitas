import { NextRequest } from "next/server";
import { env, json, failure, body, sameOrigin, ORDER_COOKIE } from "@/lib/http";
import { CommerceError, findOrder, hash } from "@/lib/commerce";
import { refreshProviderOrder } from "@/lib/mercadopago-orders";
import { sendMetaPurchase } from "@/lib/meta-capi";

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env();
    // Feature is off unless explicitly enabled with a Worker secret.
    if (runtime.META_CAPI_ENABLED !== "true" || !runtime.META_CAPI_ACCESS_TOKEN)
      return json({ enabled: false });
    const input = await body(req);
    // The browser only calls after the visitor explicitly allowed ad measurement.
    if (input.consent !== true) return json({ sent: false });
    const order = await findOrder(runtime, req.cookies.get(ORDER_COOKIE)?.value);
    if (!order) throw new CommerceError(404, "Pedido não encontrado.");
    const current = await refreshProviderOrder(runtime, order);
    if (current.status !== "approved" || !current.purchase ||
        input.eventId !== hash(`meta-purchase:${order.id}`)) return json({ sent: false });
    const sent = await sendMetaPurchase(runtime, order.id, current.purchase.eventId,
      req.headers.get("user-agent"), req.cookies.get("_fbp")?.value);
    return json({ sent });
  } catch (error) {
    return failure(error);
  }
}
