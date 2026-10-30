import {operationSettings} from '@/lib/operations-settings';
import { cloudflareEnv } from "@/lib/runtime";
import { json } from "@/lib/http";
export async function GET() {
  const env = cloudflareEnv();
  const settings=await operationSettings(env||{});
  return json({ pixelId:settings.pixelId, enabled: Boolean(env?.MERCADOPAGO_MODE === "production" && env.LIVE_PAYMENTS_ENABLED === "true" && env.CHECKOUT_ENABLED === "true") });
}
