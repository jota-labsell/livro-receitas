import { NextRequest } from "next/server";
import { body, env, failure, json, sameOrigin } from "@/lib/http";
import { ADMIN_COOKIE, loginAccessAdmin } from "@/lib/access-admin";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const input = await body(req);
    const session = await loginAccessAdmin(env(), input.key, req.headers.get("cf-connecting-ip") || "unknown");
    const response = json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, session, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 3600 });
    return response;
  } catch (error) { return failure(error); }
}
export async function DELETE(req: NextRequest) {
  try {
    sameOrigin(req);
    const response = json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return failure(error); }
}
