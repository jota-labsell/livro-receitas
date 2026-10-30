import { NextRequest, NextResponse } from "next/server";
import { CommerceError, type CommerceEnv } from "./commerce";
import { cloudflareEnv, siteUrl } from "./runtime";
export const env = (): CommerceEnv => cloudflareEnv() || {};
export function sameOrigin(req: NextRequest) {
  const origin =
    siteUrl() || `${req.nextUrl.protocol}//${req.headers.get("host")}`;
  if (req.headers.get("origin") !== origin)
    throw new CommerceError(403, "Origem não permitida.");
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  return error instanceof CommerceError
    ? json({ error: error.message }, error.status)
    : json(
        {
          error:
            "Não foi possível concluir. Tente consultar o status ou entre em contato.",
        },
        503,
      );
}
export async function body(req: NextRequest) {
  const text = await req.text();
  if (text.length > 16000)
    throw new CommerceError(413, "Solicitação muito grande.");
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
    return value as Record<string, unknown>;
  } catch {
    throw new CommerceError(400, "Solicitação inválida.");
  }
}
export const ORDER_COOKIE = "recipe-order";
