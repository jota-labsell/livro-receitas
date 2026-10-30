import { chargeProviderOrder as charge } from "@/lib/mercadopago-orders";
import { NextRequest } from "next/server";
import { env, body, sameOrigin, json, failure, ORDER_COOKIE } from "@/lib/http";
import {
  ensureOrder,
  findOrder,
  newAccess,
  requireReady,
  validVisit,
  CommerceError,
} from "@/lib/commerce";
import { getEbook } from "@/lib/ebook";
import { captureMetaContext } from "@/lib/meta-context";
import {requireLegacyOffer} from '@/lib/platform-legacy';
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env();
    requireReady(runtime);
    await requireLegacyOffer(runtime);
    if (!(await getEbook()))
      throw new CommerceError(
        503,
        "O arquivo está temporariamente indisponível. Nenhuma cobrança foi iniciada.",
      );
    const input = await body(req);
    if (!validVisit(input.visitId))
      throw new CommerceError(400, "Recarregue a página antes de continuar.");
    const existing = req.cookies.get(ORDER_COOKIE)?.value;
    if (!existing || !(await findOrder(runtime, existing)))
      throw new CommerceError(409, "Inicie o checkout novamente.");
    const order = await ensureOrder(runtime, existing, input.visitId);
    await captureMetaContext(runtime, order.id, req, input.meta);
    return json(await charge(runtime, order, input.formData));
  } catch (e) {
    return failure(e);
  }
}
