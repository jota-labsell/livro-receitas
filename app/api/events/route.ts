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
    return json({ received: true });
  } catch (e) {
    return failure(e);
  }
}
