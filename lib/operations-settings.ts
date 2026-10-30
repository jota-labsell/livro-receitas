import type { CommerceEnv } from "./commerce";
export const DEFAULT_PIXEL = "1150409944170993";
export async function operationSettings(env: CommerceEnv) {
  try {
    const row = await env.ORDERS?.prepare(
      "SELECT pixel_id,capi_paused FROM operation_settings WHERE id=1",
    ).first<{ pixel_id: string; capi_paused: number }>();
    return {
      pixelId: row?.pixel_id || DEFAULT_PIXEL,
      capiPaused: row?.capi_paused === 1,
      available: true,
    };
  } catch {
    return { pixelId: DEFAULT_PIXEL, capiPaused: false, available: false };
  }
}
export async function orderPixel(env: CommerceEnv, orderId: string) {
  try {
    const row = await env.ORDERS?.prepare(
      "SELECT pixel_id FROM operation_order_pixel WHERE order_id=?",
    )
      .bind(orderId)
      .first<{ pixel_id: string }>();
    return row?.pixel_id || DEFAULT_PIXEL;
  } catch {
    return DEFAULT_PIXEL;
  }
}
