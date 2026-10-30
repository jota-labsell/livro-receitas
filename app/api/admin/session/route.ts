import { NextRequest } from "next/server";
import { env, json, failure, body, sameOrigin } from "@/lib/http";
import { ADMIN_COOKIE } from "@/lib/access-admin";
import { accountLogin } from "@/lib/operator-login";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const input = await body(req);
    const result = await accountLogin(
      env(),
      input,
      req.headers.get("cf-connecting-ip") || "unknown",
    );
    const response = json({ authenticated: true });
    response.cookies.set(ADMIN_COOKIE, result.session, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: result.lifetime,
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
