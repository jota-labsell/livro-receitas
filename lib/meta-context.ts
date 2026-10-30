import {operationSettings} from './operations-settings';
import { isIP } from 'node:net';
import type { NextRequest } from 'next/server';
import type { CommerceEnv } from './commerce';
import { recordMetaConsent } from './meta-capi';
import { recordVisit } from './operations';
import {hash,validVisit} from './commerce';

/** Attribution never changes payment authorization and never logs buyer context. */
export async function captureMetaContext(runtime: CommerceEnv, orderId: string, request: NextRequest, input?: unknown) {
  if (runtime.MERCADOPAGO_MODE !== 'production' || !runtime.ORDERS) return;
  try {
    const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const settings=await operationSettings(runtime);
    if (!settings.available) return;
    await runtime.ORDERS.prepare('INSERT OR IGNORE INTO operation_order_pixel(order_id,pixel_id) VALUES(?,?)').bind(orderId,settings.pixelId).run();
    const previous = await runtime.ORDERS.prepare('SELECT consent FROM meta_order_consent WHERE order_id=?').bind(orderId).first<{ consent: number }>();
    const allowed = request.headers.get('sec-gpc') === '1' ? false : typeof data.allowed === 'boolean' ? data.allowed : previous?.consent !== 0;
    if (allowed && data.operation && typeof data.operation === 'object') {
      const operation = data.operation as Record<string,unknown>;
      if (validVisit(operation.visitId)) {
        const order = await runtime.ORDERS.prepare('SELECT visit_hash FROM orders WHERE id=?').bind(orderId).first<{visit_hash:string}>();
        if (order?.visit_hash === hash(operation.visitId as string)) await recordVisit(runtime,operation.visitId as string,operation.attribution);
      }
    }
    if (runtime.META_CAPI_ENABLED !== 'true') return;
    const canonical = new URL(runtime.SITE_URL!);
    let sourceUrl = canonical.origin + '/';
    try { const source = new URL(String(data.sourceUrl)); if (source.origin === canonical.origin) sourceUrl = source.origin + source.pathname; } catch {}
    const ip = request.headers.get('cf-connecting-ip') || '';
    await recordMetaConsent(runtime, orderId, allowed, {
      userAgent: request.headers.get('user-agent'),
      fbp: request.cookies.get('_fbp')?.value || data.fbp,
      fbc: data.fbc || request.cookies.get('_fbc')?.value,
      clientIp: isIP(ip) ? ip : null, sourceUrl,
    });
  } catch { console.warn(JSON.stringify({ event: 'meta_context_unavailable' })); }
}
