import { NextRequest } from "next/server";
import { env, json, failure, sameOrigin, body, ORDER_COOKIE } from "@/lib/http";
import {
  availableMethods,
  paymentReady,
  requireReady,
  ensureOrder,
  newAccess,
  validVisit,
  CommerceError,
} from "@/lib/commerce";
import { getEbook } from "@/lib/ebook";
import { assertProviderAccount } from "@/lib/mercadopago-account";
export async function GET() {
  let stage = "configuration";
  const unavailable = (reason: string) => {
    console.warn(JSON.stringify({ event: "checkout_unavailable", reason }));
    return json({ available: false });
  };
  try {
    const runtime = env();
    if (!paymentReady(runtime))
      return unavailable("configuration");
    stage = "provider_account";
    await assertProviderAccount(runtime);
    stage = "ebook";
    if (!(await getEbook())) return unavailable("ebook");
    stage = "payment_methods";
    const methods = await availableMethods(runtime);
    if (!methods.length) return unavailable("no_active_payment_methods");
    return json({
      available: methods.length > 0,
      publicKey: runtime.MERCADOPAGO_PUBLIC_KEY,
      amount: 10,
      paymentMethods: {
        ...(methods.some((m) => m.payment_type_id === "credit_card")
          ? { creditCard: "all" }
          : {}),
        ...(methods.some((m) => m.id === "pix") ? { bankTransfer: "all" } : {}),
        maxInstallments: 1,
      },
      mode: runtime.MERCADOPAGO_MODE,
    });
  } catch (error) {
    // Log only bounded diagnostic fields. No keys, payer data or provider body.
    console.warn(JSON.stringify({
      event: "checkout_unavailable", reason: stage,
      status: error instanceof CommerceError ? error.status : null,
      providerStatus: error instanceof CommerceError ? error.providerStatus ?? null : null,
    }));
    return json({ available: false });
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env();
    requireReady(runtime);
    const input = await body(req);
    if (!validVisit(input.visitId))
      throw new CommerceError(400, "Recarregue a página.");
    const access = req.cookies.get(ORDER_COOKIE)?.value;
    const token =
      access && /^[a-f0-9]{64}$/.test(access) ? access : newAccess();
    await ensureOrder(runtime, token, input.visitId);
    const response = json({ ready: true });
    response.cookies.set(ORDER_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
