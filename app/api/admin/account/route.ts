import { NextRequest } from "next/server";
import { env, json, failure, body, sameOrigin } from "@/lib/http";
import { ADMIN_COOKIE, verifyAccessAdmin } from "@/lib/access-admin";
import { saveAccount } from "@/lib/operator-login";
import { limitedProductAction } from "@/lib/product-access";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const runtime = env(),
      actor = verifyAccessAdmin(runtime, req.cookies.get(ADMIN_COOKIE)?.value);
    await limitedProductAction(runtime, "account:" + actor, 5, 15 * 60000);
    await saveAccount(runtime, actor, await body(req));
    return json({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
