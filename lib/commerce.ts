import {
  createHash,
  randomBytes,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { PRODUCT_CONFIG as PRODUCT } from "./product.config";
export class CommerceError extends Error {
  constructor(
    public status: number,
    message: string,
    public providerStatus?: number,
  ) {
    super(message);
  }
}
export type CommerceEnv = Pick<
  CloudflareEnv,
  | "ORDERS"
  | "EBOOKS"
  | "SITE_URL"
  | "MERCADOPAGO_ACCESS_TOKEN"
  | "MERCADOPAGO_PUBLIC_KEY"
  | "MERCADOPAGO_WEBHOOK_SECRET"
  | "MERCADOPAGO_COLLECTOR_ID"
  | "MERCADOPAGO_MODE"
  | "CHECKOUT_ENABLED"
  | "LIVE_PAYMENTS_ENABLED"
  | "META_CAPI_ENABLED"
  | "META_CAPI_ACCESS_TOKEN"
>;
type Order = {
  id: string;
  environment: "sandbox" | "production";
  access_hash: string;
  visit_hash: string;
  product_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  active_attempt: string | null;
};
type Attempt = {
  id: string;
  order_id: string;
  request_hash: string;
  status: string;
  payment_id: string | null;
  provider_updated_at: number;
};
export type Payment = {
  id: string | number;
  external_reference: string;
  transaction_amount: number;
  currency_id: string;
  collector_id: number | string;
  live_mode: boolean;
  status: string;
  date_last_updated: string;
  metadata?: Record<string, unknown>;
};
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const newAccess = () => randomBytes(32).toString("hex");
export const validVisit = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const db = (env: CommerceEnv) => {
  if (!env.ORDERS)
    throw new CommerceError(
      503,
      "O pagamento está temporariamente indisponível.",
    );
  return env.ORDERS;
};
export function paymentReady(env: CommerceEnv) {
  return Boolean(
    env.ORDERS &&
      env.EBOOKS &&
      env.SITE_URL?.startsWith("https://") &&
      env.CHECKOUT_ENABLED === "true" &&
      env.MERCADOPAGO_ACCESS_TOKEN &&
      env.MERCADOPAGO_PUBLIC_KEY &&
      env.MERCADOPAGO_WEBHOOK_SECRET &&
      env.MERCADOPAGO_COLLECTOR_ID &&
      (env.MERCADOPAGO_MODE === "sandbox" ||
        (env.MERCADOPAGO_MODE === "production" &&
          env.LIVE_PAYMENTS_ENABLED === "true")),
  );
}
export function requireReady(env: CommerceEnv) {
  if (!paymentReady(env))
    throw new CommerceError(
      503,
      "O pagamento está temporariamente indisponível. Tente novamente em instantes.",
    );
}
export async function mp<T>(
  env: CommerceEnv,
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  if (!env.MERCADOPAGO_ACCESS_TOKEN)
    throw new CommerceError(503, "Pagamento indisponível.");
  let response: Response;
  try {
    response = await fetcher(`https://api.mercadopago.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new CommerceError(
      502,
      "Não foi possível confirmar a resposta. Consulte o status antes de tentar novamente.",
    );
  }
  if (!response.ok) {
    // Only bounded codes are logged: never payer data, tokens or raw provider bodies.
    const diagnostic = await response.json().catch(() => null) as { errors?: { code?: unknown }[]; error?: unknown } | null;
    const safeCode = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? value : undefined;
    console.warn(JSON.stringify({ event: "payment_provider_error", status: response.status,
      code: safeCode(diagnostic?.error), codes: Array.isArray(diagnostic?.errors) ? diagnostic.errors.slice(0, 5).map(e => safeCode(e?.code)).filter(Boolean) : undefined }));
    throw new CommerceError(
      response.status >= 500 ||
      response.status === 409 ||
      response.status === 429
        ? 502
        : 422,
      "Não foi possível concluir o pagamento. Confira os dados ou consulte o status.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export type Method = { id: string; payment_type_id: string; status: string };
export async function availableMethods(
  env: CommerceEnv,
  fetcher: typeof fetch = fetch,
) {
  const methods = await mp<Method[]>(env, "/v1/payment_methods", {}, fetcher);
  return methods.filter(
    (m) =>
      m.status === "active" &&
      (m.payment_type_id === "credit_card" ||
        m.id === "pix"),
  );
}
export const orderEnvironment = (env: CommerceEnv) => env.MERCADOPAGO_MODE === "production" ? "production" : "sandbox";
const accessHash = (env: CommerceEnv, access: string) =>
  hash(orderEnvironment(env) === "production" ? `production:${access}` : access);
export async function findOrder(env: CommerceEnv, access: string | undefined) {
  if (!access || !/^[a-f0-9]{64}$/.test(access)) return null;
  return db(env)
    .prepare("SELECT * FROM orders WHERE access_hash = ? AND environment = ?")
    .bind(accessHash(env, access), orderEnvironment(env))
    .first<Order>();
}
export async function ensureOrder(
  env: CommerceEnv,
  access: string,
  visit: string,
) {
  const existing = await findOrder(env, access);
  if (existing) return existing;
  const now = Date.now();
  await db(env)
    .prepare(
      "INSERT OR IGNORE INTO orders (id,access_hash,visit_hash,product_id,amount_cents,currency,status,created_at,updated_at,environment) VALUES (?,?,?,?,?,?,'created',?,?,?)",
    )
    .bind(
      randomUUID(),
      accessHash(env, access),
      hash(visit),
      PRODUCT.id,
      PRODUCT.amountCents,
      PRODUCT.currency,
      now,
      now,
      orderEnvironment(env),
    )
    .run();
  return (await findOrder(env, access))!;
}
export async function startAttempt(
  env: CommerceEnv,
  order: Order,
  requestHash: string,
): Promise<Attempt> {
  const id = randomUUID(),
    now = Date.now();
  await db(env).batch([
    db(env)
      .prepare(
        "UPDATE orders SET active_attempt=?,status='processing',updated_at=? WHERE id=? AND status IN ('created','rejected','cancelled')",
      )
      .bind(id, now, order.id),
    db(env)
      .prepare(
        "INSERT INTO payment_attempts (id,order_id,request_hash,status,created_at,updated_at) SELECT ?,id,?,'processing',?,? FROM orders WHERE id=? AND active_attempt=?",
      )
      .bind(id, requestHash, now, now, order.id, id),
  ]);
  const fresh = await db(env)
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(order.id)
    .first<Order>();
  if (fresh?.status === "approved")
    throw new CommerceError(
      409,
      "Este pedido já foi aprovado. Consulte o status para baixar o PDF.",
    );
  const attempt = await db(env)
    .prepare("SELECT * FROM payment_attempts WHERE id=?")
    .bind(fresh?.active_attempt)
    .first<Attempt>();
  if (!attempt) throw new CommerceError(409, "Consulte o status do pedido.");
  if (attempt.request_hash !== requestHash)
    throw new CommerceError(
      409,
      "Existe uma tentativa em andamento. Consulte o status antes de tentar novamente.",
    );
  return attempt;
}
export function safePaymentData(input: unknown, allowed: Method[]) {
  if (!input || typeof input !== "object")
    throw new CommerceError(400, "Confira os dados de pagamento.");
  const f = input as Record<string, unknown>;
  if (
    typeof f.payment_method_id !== "string" ||
    !allowed.some((m) => m.id === f.payment_method_id)
  )
    throw new CommerceError(400, "Selecione um meio de pagamento disponível.");
  const payer = f.payer as
    | {
        email?: unknown;
        first_name?: unknown;
        last_name?: unknown;
        identification?: { type?: unknown; number?: unknown };
      }
    | undefined;
  if (
    !payer ||
    typeof payer.email !== "string" ||
    payer.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)
  )
    throw new CommerceError(400, "Confira o e-mail informado no pagamento.");
  const result: Record<string, unknown> = {
    payment_method_id: f.payment_method_id,
    payer: { email: payer.email.trim() },
  };
  const p = result.payer as Record<string, unknown>;
  for (const key of ["first_name", "last_name"] as const)
    if (typeof payer[key] === "string" && payer[key].length <= 100)
      p[key] = payer[key];
  if (
    payer.identification &&
    typeof payer.identification.type === "string" &&
    typeof payer.identification.number === "string" &&
    payer.identification.type.length <= 20 &&
    payer.identification.number.length <= 30
  )
    p.identification = {
      type: payer.identification.type,
      number: payer.identification.number,
    };
  if (f.payment_method_id !== "pix") {
    if (typeof f.token !== "string" || !/^[a-zA-Z0-9_-]{8,256}$/.test(f.token))
      throw new CommerceError(400, "Confira os dados do cartão.");
    if (f.installments !== 1)
      throw new CommerceError(400, "Esta compra tem pagamento único.");
    result.token = f.token;
    result.installments = 1;
    if (typeof f.issuer_id === "string" || typeof f.issuer_id === "number")
      result.issuer_id = String(f.issuer_id).slice(0, 30);
  }
  return result;
}
export function validatePayment(
  env: CommerceEnv,
  p: Payment,
  a: Attempt,
  o: Order,
) {
  if (
    String(p.external_reference) !== a.id ||
    p.metadata?.order_id !== o.id ||
    p.metadata?.product_id !== PRODUCT.id ||
    o.product_id !== PRODUCT.id ||
    o.amount_cents !== PRODUCT.amountCents ||
    o.currency !== PRODUCT.currency ||
    p.transaction_amount !== PRODUCT.price ||
    p.currency_id !== PRODUCT.currency ||
    String(p.collector_id) !== env.MERCADOPAGO_COLLECTOR_ID ||
    p.live_mode !== (env.MERCADOPAGO_MODE === "production") ||
    !/^\d+$/.test(String(p.id)) ||
    !Number.isFinite(Date.parse(p.date_last_updated)) ||
    (a.payment_id && a.payment_id !== String(p.id))
  )
    throw new CommerceError(
      409,
      "Não foi possível validar este pagamento. Entre em contato.",
    );
}
function normalizedStatus(status: string) {
  return [
    "approved",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
  ].includes(status)
    ? status
    : "pending";
}
export async function reconcile(env: CommerceEnv, p: Payment) {
  const a = await db(env)
    .prepare("SELECT * FROM payment_attempts WHERE id=?")
    .bind(p.external_reference)
    .first<Attempt>();
  if (!a) throw new CommerceError(404, "Pedido não encontrado.");
  const o = await db(env)
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(a.order_id)
    .first<Order>();
  if (!o) throw new CommerceError(404, "Pedido não encontrado.");
  validatePayment(env, p, a, o);
  const now = Date.now(),
    status = normalizedStatus(p.status),
    updated = Date.parse(p.date_last_updated);
  await db(env).batch([
    db(env)
      .prepare(
        "UPDATE payment_attempts SET status=?,payment_id=?,provider_updated_at=?,updated_at=? WHERE id=? AND provider_updated_at<=?",
      )
      .bind(status, String(p.id), updated, now, a.id, updated),
    db(env)
      .prepare(
        "UPDATE orders SET status=CASE WHEN EXISTS(SELECT 1 FROM payment_attempts WHERE order_id=orders.id AND status='approved') THEN 'approved' ELSE COALESCE((SELECT status FROM payment_attempts WHERE id=orders.active_attempt),'created') END,updated_at=? WHERE id=?",
      )
      .bind(now, o.id),
    db(env)
      .prepare(
        "INSERT OR IGNORE INTO funnel_events(event_key,name,visit_hash,order_id,amount_cents,currency,created_at) SELECT 'purchase:'||id,'purchase_approved',visit_hash,id,amount_cents,currency,? FROM orders WHERE id=? AND status='approved'",
      )
      .bind(now, o.id),
  ]);
  return db(env)
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(o.id)
    .first<Order>();
}
export async function refreshOrder(
  env: CommerceEnv,
  order: Order,
  fetcher: typeof fetch = fetch,
) {
  if (!order.active_attempt) return { status: order.status, paymentId: null };
  // Recheck all granted attempts too, so a refund of an older attempt cannot leave access open.
  const all = await db(env)
    .prepare(
      "SELECT * FROM payment_attempts WHERE order_id=? AND (id=? OR status='approved')",
    )
    .bind(order.id, order.active_attempt)
    .all<Attempt>();
  let currentId: string | null = null;
  for (const a of all.results) {
    let payment: Payment | undefined;
    if (a.payment_id)
      payment = await mp<Payment>(
        env,
        `/v1/payments/${a.payment_id}`,
        {},
        fetcher,
      );
    else {
      const search = await mp<{ results: Payment[] }>(
        env,
        `/v1/payments/search?external_reference=${encodeURIComponent(a.id)}`,
        {},
        fetcher,
      );
      if (search.results.length > 1)
        throw new CommerceError(
          409,
          "Pagamento em conferência. Entre em contato.",
        );
      if (search.results[0])
        payment = await mp<Payment>(
          env,
          `/v1/payments/${search.results[0].id}`,
          {},
          fetcher,
        );
    }
    if (payment) {
      await reconcile(env, payment);
      if (a.id === order.active_attempt) currentId = String(payment.id);
    }
  }
  const updated = await db(env)
    .prepare("SELECT * FROM orders WHERE id=?")
    .bind(order.id)
    .first<Order>();
  return { status: updated!.status, paymentId: currentId };
}
export async function charge(
  env: CommerceEnv,
  order: Order,
  form: unknown,
  fetcher: typeof fetch = fetch,
) {
  requireReady(env);
  const data = safePaymentData(form, await availableMethods(env, fetcher));
  const a = await startAttempt(env, order, hash(JSON.stringify(data)));
  if (a.payment_id) return refreshOrder(env, order, fetcher);
  let created: { id: number | string };
  try {
    created = await mp<{ id: number | string }>(
      env,
      "/v1/payments",
      {
        method: "POST",
        headers: { "X-Idempotency-Key": a.id },
        body: JSON.stringify({
          ...data,
          transaction_amount: PRODUCT.price,
          description: PRODUCT.name,
          external_reference: a.id,
          metadata: { order_id: order.id, product_id: PRODUCT.id },
          notification_url: `${env.SITE_URL}/api/webhooks/mercadopago`,
        }),
      },
      fetcher,
    );
  } catch (error) {
    if (error instanceof CommerceError && error.status === 422) {
      await db(env).batch([
        db(env)
          .prepare(
            "UPDATE payment_attempts SET status='rejected',updated_at=? WHERE id=? AND payment_id IS NULL AND status='processing'",
          )
          .bind(Date.now(), a.id),
        db(env)
          .prepare(
            "UPDATE orders SET status='rejected',updated_at=? WHERE id=? AND active_attempt=? AND status='processing' AND EXISTS(SELECT 1 FROM payment_attempts WHERE id=? AND status='rejected')",
          )
          .bind(Date.now(), order.id, a.id, a.id),
      ]);
      return { status: "rejected", paymentId: null };
    }
    throw error;
  }
  if (!/^\d+$/.test(String(created.id)))
    throw new CommerceError(502, "Consulte o status do pagamento.");
  // Always fetch authoritative state. Browser/POST return values never grant delivery.
  const confirmed = await mp<Payment>(
    env,
    `/v1/payments/${created.id}`,
    {},
    fetcher,
  );
  const updated = await reconcile(env, confirmed);
  return { status: updated!.status, paymentId: String(confirmed.id) };
}
export function validateWebhook(
  req: Request,
  env: CommerceEnv,
  now = Date.now(),
  orders = false,
) {
  const url = new URL(req.url),
    id = url.searchParams.get("data.id"),
    requestId = req.headers.get("x-request-id");
  const signature = req.headers.get("x-signature") || "";
  const parts = Object.fromEntries(
    signature.split(",").map((p) => p.trim().split("=")),
  );
  if (
    !env.MERCADOPAGO_WEBHOOK_SECRET ||
    !id ||
    !(orders ? /^[a-zA-Z0-9_-]{1,100}$/.test(id) : /^\d+$/.test(id)) ||
    !requestId ||
    !/^[a-zA-Z0-9-]{1,200}$/.test(requestId) ||
    !/^\d{10,13}$/.test(parts.ts || "") ||
    !/^[a-f0-9]{64}$/i.test(parts.v1 || "")
  )
    throw new CommerceError(401, "Assinatura inválida.");
  const timestamp = Number(parts.ts) * (parts.ts.length === 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 600000)
    throw new CommerceError(401, "Assinatura expirada.");
  const expected = createHmac("sha256", env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(`id:${orders ? id.toLowerCase() : id};request-id:${requestId};ts:${parts.ts};`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(parts.v1, "hex")))
    throw new CommerceError(401, "Assinatura inválida.");
  return { id, receipt: hash(`${id}:${requestId}:${parts.ts}:${parts.v1}`) };
}
export async function recordEvent(
  env: CommerceEnv,
  name: string,
  visit: string,
  event: string,
) {
  if (
    !validVisit(visit) ||
    !validVisit(event) ||
    !["offer_view", "cta_click", "checkout_start"].includes(name)
  )
    throw new CommerceError(400, "Evento inválido.");
  const visitHash = hash(visit),
    key = name === "cta_click" ? `cta:${event}` : `${name}:${visitHash}`;
  await db(env)
    .prepare(
      "INSERT OR IGNORE INTO funnel_events(event_key,name,visit_hash,created_at) VALUES (?,?,?,?)",
    )
    .bind(key, name, visitHash, Date.now())
    .run();
}
