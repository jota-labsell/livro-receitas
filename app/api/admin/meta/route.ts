import { NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { body, env, failure, json, sameOrigin } from "@/lib/http";
import { CommerceError } from "@/lib/commerce";
import { limitedProductAction } from "@/lib/product-access";
import { metaDiagnosticStatus, sendMetaDiagnostic } from "@/lib/meta-diagnostics";

export async function GET(req: NextRequest) {
  try {
    const runtime = env();
    verifyAccessAdmin(runtime, req.cookies.get(ADMIN_COOKIE)?.value);
    return json(await metaDiagnosticStatus(runtime));
  } catch (error) { return failure(error); }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env();
    const actor = verifyAccessAdmin(runtime, req.cookies.get(ADMIN_COOKIE)?.value);
    const input = await body(req);
    if (!input || Array.isArray(input) || input.action !== "test")
      throw new CommerceError(400, "Escolha o envio de evento de teste.");
    await limitedProductAction(runtime, `meta-diagnostic:${actor}`, 5);
    await limitedProductAction(runtime, "meta-diagnostic-global", 20);
    return json(await sendMetaDiagnostic(runtime, input.testEventCode));
  } catch (error) { return failure(error); }
}
