import {captureLegacyEvent} from "@/lib/platform-legacy";
import { NextRequest } from "next/server";
import { env, json, failure, body, sameOrigin } from "@/lib/http";
import { recordEvent, CommerceError } from "@/lib/commerce";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const input = await body(req);
    if (
      typeof input.name !== "string" ||
      typeof input.visitId !== "string" ||
      typeof input.eventId !== "string"
    )
      throw new CommerceError(400, "Evento inválido.");
    await recordEvent(env(), input.name, input.visitId, input.eventId);
    const mapped={offer_view:"ViewContent",checkout_start:"InitiateCheckout",cta_click:"site_click"} as const;
    if(input.name in mapped)await captureLegacyEvent(env(),req,input,mapped[input.name as keyof typeof mapped]);
    return json({ received: true });
  } catch (e) {
    return failure(e);
  }
}
