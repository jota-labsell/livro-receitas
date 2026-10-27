import { NextRequest } from "next/server";
import { env, json, failure, body } from "@/lib/http";
import {
  validateWebhook,
  mp,
  reconcile,
  CommerceError,
  type Payment,
} from "@/lib/commerce";
export async function POST(req: NextRequest) {
  try {
    const runtime = env();
    const signed = validateWebhook(req, runtime);
    const notification = await body(req);
    if (
      notification.type !== "payment" ||
      String((notification.data as { id?: unknown })?.id) !== signed.id
    )
      throw new CommerceError(400, "Notificação inválida.");
    const payment = await mp<Payment>(runtime, `/v1/payments/${signed.id}`);
    await reconcile(runtime, payment);
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
