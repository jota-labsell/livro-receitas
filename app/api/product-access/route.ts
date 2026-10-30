import { NextRequest } from "next/server";
import { body, env, failure, json, ORDER_COOKIE, sameOrigin } from "@/lib/http";
import { ACCESS_LIFETIME, limitedProductAction, PRODUCT_ACCESS_COOKIE, ProductAccessError, redeemProductAccess, resolveProductAccess } from "@/lib/product-access";
import { createHmac } from "node:crypto";
import { getEbook } from "@/lib/ebook";
const accessFailure = (error: unknown) => error instanceof ProductAccessError
  ? json({ state: error.reason }, error.status) : failure(error);
export async function GET(req: NextRequest) {
  try {
    await resolveProductAccess(env(), req.cookies.get(ORDER_COOKIE)?.value, req.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
    if (!(await getEbook())) throw new ProductAccessError("storage", 503);
    return json({ state: "approved" });
  } catch (error) { return accessFailure(error); }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env();
    const ip = runtime.EBOOK_ADMIN_KEY
      ? createHmac("sha256", runtime.EBOOK_ADMIN_KEY).update(`access:${new Date().toISOString().slice(0,10)}:${req.headers.get("cf-connecting-ip") || "unknown"}`).digest("hex")
      : "access-unconfigured";
    await limitedProductAction(runtime, ip, 10);
    const input = await body(req);
    const result = await redeemProductAccess(runtime, input.token);
    const response = json({ state: "approved" });
    response.cookies.set(PRODUCT_ACCESS_COOKIE, result.session, { httpOnly: true, secure: true, sameSite: "lax", path: "/api", maxAge: Math.max(1, Math.min(ACCESS_LIFETIME, Math.floor((result.expiresAt - Date.now()) / 1000))) });
    return response;
  } catch (error) { return accessFailure(error); }
}
