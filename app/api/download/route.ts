import { NextRequest } from "next/server";
import { env, json, failure, ORDER_COOKIE } from "@/lib/http";
import { findOrder, refreshOrder, CommerceError } from "@/lib/commerce";
import { getEbook, getEbookBody } from "@/lib/ebook";
export async function GET(req: NextRequest) {
  try {
    const runtime = env();
    const order = await findOrder(
      runtime,
      req.cookies.get(ORDER_COOKIE)?.value,
    );
    if (!order)
      throw new CommerceError(401, "Faça a compra para baixar o PDF.");
    const confirmed = await refreshOrder(runtime, order);
    if (confirmed.status !== "approved")
      throw new CommerceError(
        403,
        "O download fica disponível após a aprovação do pagamento.",
      );
    if (!(await getEbook()))
      throw new CommerceError(
        503,
        "Arquivo temporariamente indisponível. Entre em contato.",
      );
    const file = await getEbookBody();
    if (!file) throw new CommerceError(503, "Arquivo indisponível.");
    return new Response(file as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="150-doces-para-comer-e-vender.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
