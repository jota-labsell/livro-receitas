import type { CommerceEnv } from "./commerce";
import { EBOOK_PREVIEW } from "./ebook-preview";
import { ProductAccessError, resolveProductAccess } from "./product-access";

type Storage = {
  manifest: () => Promise<{ sha256: string; bytes?: number } | null>;
  body: () => Promise<ReadableStream | Uint8Array | null>;
};
/** Shared real download path; injected provider/storage keep tests off live payments. */
export async function deliverProduct(env: CommerceEnv, requestUrl: string, orderCookie: string | undefined,
  recoveryCookie: string | undefined, storage: Storage, fetcher: typeof fetch = fetch) {
  try {
    await resolveProductAccess(env, orderCookie, recoveryCookie, fetcher);
    const manifest = await storage.manifest();
    if (!manifest || manifest.sha256 !== EBOOK_PREVIEW.sha256 || manifest.bytes !== EBOOK_PREVIEW.bytes)
      throw new ProductAccessError("storage", 503);
    const file = await storage.body().catch(() => null);
    if (!file) throw new ProductAccessError("storage", 503);
    return new Response(file as BodyInit, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="150-doces-para-comer-e-vender.pdf"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    const target = new URL("/acesso", requestUrl);
    target.searchParams.set("estado", error instanceof ProductAccessError ? error.reason : "verification");
    return new Response(null, { status: 303, headers: { Location: target.toString(), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }
}
