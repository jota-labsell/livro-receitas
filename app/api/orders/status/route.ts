import { refreshProviderOrder as refreshOrder } from "@/lib/mercadopago-orders";
import { NextRequest } from "next/server";
import { env, json, failure, ORDER_COOKIE, sameOrigin } from "@/lib/http";
import { captureMetaContext } from "@/lib/meta-context";
import {
  findOrder,
  requireReady,
  CommerceError,
} from "@/lib/commerce";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env();
    requireReady(runtime);
    const order = await findOrder(
      runtime,
      req.cookies.get(ORDER_COOKIE)?.value,
    );
    if (!order)
      throw new CommerceError(404, "Nenhum pedido encontrado neste navegador.");
    await captureMetaContext(runtime, order.id, req);
    return json(await refreshOrder(runtime, order));
  } catch (e) {
    return failure(e);
  }
}
