import { receiveProviderOrder } from "@/lib/mercadopago-orders";
import { NextRequest } from "next/server";
import {platformWebhook,receivePlatformProductWebhook} from '@/lib/platform-payments';
import { env, json, failure, body } from "@/lib/http";
import {
  validateWebhook,
  CommerceError,
} from "@/lib/commerce";
export async function POST(req: NextRequest) {
  try {
    const runtime = env();
    const platformCopy:Request|null=runtime.JOTAFY_PLATFORM_ENABLED==='true'?req.clone() as unknown as Request:null;
    if(platformCopy){const id=req.nextUrl.searchParams.get('data.id')||'';if(/^[A-Za-z0-9_-]{1,100}$/.test(id)){const known=await runtime.ORDERS!.prepare('SELECT order_id FROM platform_attempts WHERE provider_id=?').bind(id).first<{order_id:string}>();if(known)return json(await platformWebhook(runtime,known.order_id,platformCopy));}}
    const signed = validateWebhook(req, runtime, Date.now(), true);
    const notification = await body(req);
    if (
      notification.type !== "order" ||
      String((notification.data as { id?: unknown })?.id) !== signed.id
    )
      throw new CommerceError(400, "Notificação inválida.");
    try{await receiveProviderOrder(runtime, signed.id);}catch(error){
      if(!platformCopy||!(error instanceof CommerceError)||error.status!==404)throw error;
      // A webhook may race the create response. Default-account products can still
      // be found by their authoritative external_reference, never the browser body.
      const {mp}=await import('@/lib/commerce');
      const remote=await mp<{external_reference:string}>(runtime,'/v1/orders/'+encodeURIComponent(signed.id));
      const product=remote.external_reference?.split('_')[0];if(!product)throw error;
      return json(await receivePlatformProductWebhook(runtime,product,platformCopy));
    }
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
