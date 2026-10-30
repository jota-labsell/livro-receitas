import { NextRequest } from "next/server";
import { env, body, json, failure, sameOrigin } from "@/lib/http";
import { validVisit, CommerceError, hash } from "@/lib/commerce";
import { recordVisit } from "@/lib/operations";
import { limitedProductAction } from "@/lib/product-access";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env(),
      input = await body(req);
    if (!validVisit(input?.visitId))
      throw new CommerceError(400, "Visita inválida.");
    await limitedProductAction(
      runtime,
      "visit:" +
        hash(
          (runtime.MERCADOPAGO_WEBHOOK_SECRET || "") +
            new Date().toISOString().slice(0, 10) +
            (req.headers.get("cf-connecting-ip") || "unknown"),
        ),
      60,
    );
    await recordVisit(runtime, input.visitId, input.attribution);
    return json({ received: true });
  } catch (e) {
    return failure(e);
  }
}
