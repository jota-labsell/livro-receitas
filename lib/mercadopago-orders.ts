import {internalEvent} from './platform-events';
import {orderPixel} from './operations-settings';
import { availableMethods, CommerceError, hash, mp, requireReady, safePaymentData, startAttempt, orderEnvironment, type CommerceEnv } from './commerce';
import { PRODUCT_CONFIG as PRODUCT } from './product.config';
import { assertProviderAccount } from './mercadopago-account';
import { enqueueMetaPurchase } from './meta-capi';

type LocalOrder = { environment: string; id: string; product_id: string; amount_cents: number; currency: string; active_attempt: string | null; status: string };
type Attempt = { id: string; order_id: string; payment_id: string | null; external_reference?:string|null; created_at: number };
export type ProviderOrder = {
  id: string; type: string; external_reference: string; user_id: string;
  currency: string; total_amount: string; total_paid_amount?: string;
  status: string; status_detail?: string; last_updated_date: string;
  transactions?: { payments?: { id: string; amount: string; paid_amount?: string; refunded_amount?: string; status: string; status_detail?: string; payment_method?: { id?: string; type?: string; qr_code?: string; qr_code_base64?: string } }[]; refunds?: unknown[]; chargebacks?: unknown[] };
};
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(id);
function scope(env: CommerceEnv): Record<string, string> {
  requireReady(env);
  // Test requests carry the test header; explicitly enabled production must not.
  return env.MERCADOPAGO_MODE === 'sandbox' ? { 'X-Test-Scope': 'sandbox' } : {};
}
async function get(env: CommerceEnv, id: string, fetcher: typeof fetch) {
  if (!validId(id)) throw new CommerceError(400, 'Pedido inválido.');
  const order = await mp<ProviderOrder>(env, `/v1/orders/${encodeURIComponent(id)}`, { headers: scope(env) }, fetcher);
  if (order.id !== id) throw new CommerceError(409, 'Pedido divergente.');
  return order;
}
export function validateProviderOrder(p: ProviderOrder, a: Attempt, o: LocalOrder, env: CommerceEnv) {
  const payments = p.transactions?.payments;
  if (o.environment !== orderEnvironment(env) || !validId(p.id) || p.type !== 'online' || p.external_reference !== (a.external_reference||a.id) ||
      String(p.user_id) !== env.MERCADOPAGO_COLLECTOR_ID || p.currency !== 'BRL' ||
      !/^10(?:\.0{1,2})?$/.test(p.total_amount) || o.amount_cents !== 1000 || o.currency !== 'BRL' ||
      o.product_id !== PRODUCT.id || a.order_id !== o.id || (a.payment_id && a.payment_id !== p.id) ||
      !Number.isFinite(Date.parse(p.last_updated_date)) || !payments || payments.length !== 1 ||
      !/^10(?:\.0{1,2})?$/.test(payments[0].amount)) {
    throw new CommerceError(409, 'Não foi possível validar este pedido. Entre em contato.');
  }
  // Unknown, partial, refunded, or contested transactions never authorize delivery.
  if (p.transactions?.chargebacks?.length || p.status === 'charged_back' || payments[0].status === 'charged_back') return 'charged_back';
  if (p.transactions?.refunds?.length || Number(payments[0].refunded_amount || 0) > 0 || p.status === 'refunded' || payments[0].status === 'refunded') return 'refunded';
  if (p.status === 'processed' && p.status_detail === 'accredited' && ['approved','processed'].includes(payments[0].status) &&
      /^10(?:\.0{1,2})?$/.test(p.total_paid_amount || payments[0].paid_amount || '')) return 'approved';
  if (p.status === 'expired' || p.status_detail === 'expired' || payments[0].status_detail === 'expired') return 'cancelled';
  if (p.status === 'failed' || payments[0].status === 'rejected') return 'rejected';
  if (p.status === 'cancelled' || p.status === 'canceled') return 'cancelled';
  return 'pending';
}
export async function reconcileProviderOrder(env: CommerceEnv, p: ProviderOrder) {
  const db = env.ORDERS!;
  const a = env.JOTAFY_PLATFORM_ENABLED==='true' ? await db.prepare('SELECT * FROM payment_attempts WHERE id=? OR external_reference=?').bind(p.external_reference,p.external_reference).first<Attempt>() : await db.prepare('SELECT * FROM payment_attempts WHERE id=?').bind(p.external_reference).first<Attempt>();
  if (!a) throw new CommerceError(404, 'Pedido não encontrado.');
  const o = await db.prepare('SELECT * FROM orders WHERE id=?').bind(a.order_id).first<LocalOrder>();
  if (!o) throw new CommerceError(404, 'Pedido não encontrado.');
  const status = validateProviderOrder(p, a, o, env), now = Date.now(), updated = Date.parse(p.last_updated_date);
  await db.batch([
    db.prepare('UPDATE payment_attempts SET status=?,payment_id=?,provider_updated_at=?,updated_at=? WHERE id=? AND provider_updated_at<=?').bind(status,p.id,updated,now,a.id,updated),
    db.prepare("UPDATE orders SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_attempts WHERE order_id=orders.id AND status='approved') THEN 'approved' ELSE COALESCE((SELECT status FROM payment_attempts WHERE id=orders.active_attempt),'created') END,updated_at=? WHERE id=?").bind(now,o.id),
    db.prepare("INSERT OR IGNORE INTO funnel_events(event_key,name,visit_hash,order_id,amount_cents,currency,created_at) SELECT 'purchase:'||id,'purchase_approved',visit_hash,id,amount_cents,currency,? FROM orders WHERE id=? AND status='approved'").bind(now,o.id),
  ]);
  // Monitoring is separate from payment authorization; a missing monitor migration must not block delivery.
  if (o.environment === 'production') {
    const method = p.transactions?.payments?.[0]?.payment_method;
    const kind = status === 'pending' && method?.id === 'pix' && method.qr_code ? 'pix_generated' : status;
    if (['pix_generated','approved','rejected','refunded','charged_back','cancelled'].includes(kind)) {
      try {
        await db.prepare('INSERT OR IGNORE INTO jotafy_events(event_key,order_id,kind,method,amount_cents,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM payment_attempts WHERE id=? AND status=? AND provider_updated_at=?)')
          .bind(`${a.id}:${kind}`,o.id,kind,method?.id === 'pix' ? 'pix' : method?.type || 'unknown',o.amount_cents,now,a.id,status,updated).run();
      } catch { console.warn(JSON.stringify({event:'jotafy_event_unavailable'})); }
    }
  }
  const fresh = (await db.prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first<LocalOrder>())!;
  if (fresh.status === 'approved' && fresh.environment === 'production') {
    try { await enqueueMetaPurchase(env, fresh.id); }
    catch { console.warn(JSON.stringify({ event: 'meta_enqueue_unavailable' })); }
  }
  return fresh;
}
async function result(o: LocalOrder, p: ProviderOrder | undefined, env: CommerceEnv) {
  const method = p?.transactions?.payments?.[0]?.payment_method;
  let purchase;
  if (o.environment === 'production' && o.status === 'approved' && p) {
    try { purchase = { pixelId: await orderPixel(env,o.id), eventId: hash(`meta-purchase:${o.id}`), value: 10, currency: 'BRL' }; }
    catch { console.warn(JSON.stringify({event:'purchase_pixel_unavailable'})); }
  }
  return { status: o.status, paymentId: null, expired: p?.status === "expired" || p?.status_detail === "expired" || p?.transactions?.payments?.[0]?.status_detail === "expired", providerOrderId: p?.id || null,
    ...(purchase ? {purchase} : {}),
    ...(o.status === 'pending' && method?.qr_code ? { pix: { code: method.qr_code, qrCodeBase64: method.qr_code_base64 } } : {}) };
}
export async function refreshProviderOrder(env: CommerceEnv, order: LocalOrder, fetcher: typeof fetch = fetch) {
  scope(env);
  const stored = await env.ORDERS!.prepare('SELECT * FROM orders WHERE id=?').bind(order.id).first<LocalOrder>();
  if (!stored) throw new CommerceError(404, 'Pedido não encontrado.');
  order = stored;
  if (!order.active_attempt) return result(order,undefined,env);
  const attempts = await env.ORDERS!.prepare("SELECT * FROM payment_attempts WHERE order_id=? AND (id=? OR status='approved')").bind(order.id,order.active_attempt).all<Attempt>();
  let active: ProviderOrder | undefined;
  for (const a of attempts.results) {
    let p: ProviderOrder | undefined;
    if (a.payment_id) p = await get(env,a.payment_id,fetcher);
    else {
      const query = new URLSearchParams({ external_reference:a.external_reference||a.id, begin_date:new Date(a.created_at - 60000).toISOString(), end_date:new Date().toISOString(), page_size:'2' });
      const found = await mp<{data?: ProviderOrder[]; paging?: {total?: string}}>(env,`/v1/orders?${query}`,{headers:scope(env)},fetcher);
      if (!Array.isArray(found.data) || Number(found.paging?.total || found.data.length) > 1) throw new CommerceError(409,'Pedido em conferência. Entre em contato.');
      if (found.data[0]) p = await get(env,found.data[0].id,fetcher);
    }
    if (p) { order = await reconcileProviderOrder(env,p); if (a.id === order.active_attempt) active = p; }
  }
  return result(order,active,env);
}
export async function chargeProviderOrder(env: CommerceEnv, order: LocalOrder, form: unknown, fetcher: typeof fetch = fetch) {
  const headers = scope(env);
  if (order.environment !== orderEnvironment(env)) throw new CommerceError(409, 'Inicie uma nova compra neste ambiente.');
  const methods = await availableMethods(env,fetcher);
  const data = safePaymentData(form,methods);
  const method = methods.find(m=>m.id === data.payment_method_id)!;
  await assertProviderAccount(env, fetcher);
  const a = await startAttempt(env,order as Parameters<typeof startAttempt>[1],hash(JSON.stringify(data)));
  if (a.payment_id) return refreshProviderOrder(env,order,fetcher);
  let created: ProviderOrder;
  try {
    created = await mp<ProviderOrder>(env,'/v1/orders', {method:'POST', headers:{...headers,'X-Idempotency-Key':a.id},body:JSON.stringify({
      type:'online',processing_mode:'automatic',total_amount:'10.00',currency:'BRL',external_reference:a.external_reference||a.id,description:PRODUCT.name,payer:data.payer,
      transactions:{payments:[{amount:'10.00',payment_method:{id:method.id,type:method.payment_type_id,...(data.token ? {token:data.token,installments:1}: {})}}]},
    })},fetcher);
  } catch(error) {
    // An ambiguous response remains processing. Never create another attempt automatically.
    if (error instanceof CommerceError && error.status === 422) {
      await env.ORDERS!.batch([
        env.ORDERS!.prepare("UPDATE payment_attempts SET status='rejected',updated_at=? WHERE id=? AND payment_id IS NULL AND status='processing'").bind(Date.now(),a.id),
        env.ORDERS!.prepare("UPDATE orders SET status='rejected',updated_at=? WHERE id=? AND active_attempt=? AND status='processing' AND EXISTS(SELECT 1 FROM payment_attempts WHERE id=? AND status='rejected')").bind(Date.now(),order.id,a.id,a.id),
      ]);
      return result({...order,status:'rejected'},undefined,env);
    }
    throw error;
  }
  if (!created.id || !validId(created.id)) throw new CommerceError(502,'Consulte o status do pagamento.');
  // Persist provider ID even if the following authoritative GET times out.
  await env.ORDERS!.prepare('UPDATE payment_attempts SET payment_id=? WHERE id=? AND (payment_id IS NULL OR payment_id=?)').bind(created.id,a.id,created.id).run();
  if(env.JOTAFY_PLATFORM_ENABLED==='true'){const row=await env.ORDERS!.prepare('SELECT visit_hash FROM orders WHERE id=?').bind(order.id).first<{visit_hash:string}>();if(row&&await env.ORDERS!.prepare('SELECT id FROM platform_sessions WHERE id=? AND product_id=?').bind(row.visit_hash,order.product_id).first())await internalEvent(env,hash('legacy-payment:'+a.id),'payment_created',order.product_id,row.visit_hash,null,order.id);}
  const confirmed = await get(env,created.id,fetcher);
  return result(await reconcileProviderOrder(env,confirmed),confirmed,env);
}
export async function receiveProviderOrder(env: CommerceEnv, id: string) {
  return reconcileProviderOrder(env,await get(env,id,fetch));
}
