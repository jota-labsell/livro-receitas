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
export async function GET() {
  try {
    const runtime = env();
    if (!paymentReady(runtime) || !(await getEbook()))
      return json({ available: false });
    const methods = await availableMethods(runtime);
    return json({
      available: methods.length > 0,
      publicKey: runtime.MERCADOPAGO_PUBLIC_KEY,
      amount: 10,
      paymentMethods: {
        ...(methods.some((m) => m.payment_type_id === "credit_card")
          ? { creditCard: "all" }
          : {}),
        ...(methods.some((m) => m.payment_type_id === "debit_card")
          ? { debitCard: "all" }
          : {}),
        ...(methods.some((m) => m.id === "pix") ? { bankTransfer: "all" } : {}),
        maxInstallments: 1,
      },
      mode: runtime.MERCADOPAGO_MODE,
    });
  } catch {
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
