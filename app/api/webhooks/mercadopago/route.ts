import { receiveProviderOrder } from "@/lib/mercadopago-orders";
import { NextRequest } from "next/server";
import { env, json, failure, body } from "@/lib/http";
import {
  validateWebhook,
  CommerceError,
} from "@/lib/commerce";
export async function POST(req: NextRequest) {
  try {
    const runtime = env();
    const signed = validateWebhook(req, runtime, Date.now(), true);
    const notification = await body(req);
    if (
      notification.type !== "order" ||
      String((notification.data as { id?: unknown })?.id) !== signed.id
    )
      throw new CommerceError(400, "Notificação inválida.");
    await receiveProviderOrder(runtime, signed.id);
    await runtime
      .ORDERS!.prepare(
        "INSERT OR IGNORE INTO webhook_receipts(id,payment_id,processed_at) VALUES (?,?,?)",
      )
      .bind(signed.receipt, signed.id, Date.now())
      .run();
    return json({ received: true });
  } catch (e) {
    return failure(e);
  }
}
