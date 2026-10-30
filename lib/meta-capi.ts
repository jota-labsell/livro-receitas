import type { CommerceEnv } from "./commerce";

const PIXEL_ID = "1150409944170993";
const GRAPH_VERSION = "v26.0";
const PRODUCT_ID = "150-doces-comer-vender";
const MAX_ATTEMPTS = 12;
const RETRY_WINDOW_MS = 48 * 60 * 60 * 1000;
const STALE_CLAIM_MS = 2 * 60 * 1000;
const SEND_TIMEOUT_MS = 5000;
const DISPATCH_CONCURRENCY = 4;

type MetaEnv = CommerceEnv & {
  DB?: D1Database;
  META_CAPI_ENABLED?: string;
  META_CAPI_ACCESS_TOKEN?: string;
};
type ApprovedPurchase = {
  created_at: number;
  visit_hash: string;
  amount_cents: number;
  currency: string;
  user_agent: string | null;
  fbp: string | null;
  event_source_url: string | null;
};
type Delivery = { attempts: number };
type Context = { userAgent?: string | null; fbp?: string | null; sourceUrl?: string | null };

const encoder = new TextEncoder();
const validUserAgent = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 512;
const validFbp = (value: unknown): value is string =>
  typeof value === "string" && /^fb\.1\.\d{10,13}\.\d{1,30}$/.test(value);
const validSourceUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
};
const database = (env: MetaEnv) => env.ORDERS || env.DB;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Must stay identical to the eventId returned to the browser for Pixel deduplication. */
export const metaPurchaseEventId = (orderId: string) =>
  sha256Hex(`meta-purchase:${orderId}`);

function enabled(env: MetaEnv) {
  return env.META_CAPI_ENABLED === "true" && Boolean(env.META_CAPI_ACCESS_TOKEN);
}

async function markDead(db: D1Database, orderId: string) {
  try {
    await db
      .prepare(
        "UPDATE meta_purchase_delivery SET state='pending',attempts=?,locked_at=? WHERE order_id=?",
      )
      .bind(MAX_ATTEMPTS, Date.now() + RETRY_WINDOW_MS, orderId)
      .run();
  } catch {
    // Delivery bookkeeping must never affect commerce.
  }
}

async function approvedPurchase(env: MetaEnv, orderId: string) {
  const db = database(env);
  if (!db) return null;
  return db
    .prepare(
      `SELECT f.created_at,o.visit_hash,o.amount_cents,o.currency,
              x.user_agent,x.fbp,x.event_source_url
         FROM orders o
         JOIN funnel_events f ON f.order_id=o.id AND f.name='purchase_approved'
         JOIN meta_order_consent c ON c.order_id=o.id AND c.consent=1
         LEFT JOIN meta_purchase_context x ON x.order_id=o.id
        WHERE o.id=? AND o.status='approved' AND o.environment='production'
          AND o.product_id=? AND o.amount_cents=1000 AND o.currency='BRL'
          AND EXISTS(SELECT 1 FROM payment_attempts a
                      WHERE a.order_id=o.id AND a.status='approved')
          AND NOT EXISTS(SELECT 1 FROM payment_attempts a
                          WHERE a.order_id=o.id AND a.status IN ('refunded','charged_back'))`,
    )
    .bind(orderId, PRODUCT_ID)
    .first<ApprovedPurchase>();
}

/**
 * Queue an event only after an authoritative Mercado Pago reconciliation has
 * stored an approved production order with explicit measurement consent.
 */
export async function enqueueMetaPurchase(env: MetaEnv, orderId: string) {
  if (!enabled(env)) return false;
  const db = database(env);
  if (!db) return false;
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO meta_purchase_delivery(order_id)
       SELECT o.id FROM orders o
         JOIN meta_order_consent c ON c.order_id=o.id AND c.consent=1
        WHERE o.id=? AND o.status='approved' AND o.environment='production'
          AND o.product_id=? AND o.amount_cents=1000 AND o.currency='BRL'
          AND EXISTS(SELECT 1 FROM payment_attempts a
                      WHERE a.order_id=o.id AND a.status='approved')
          AND NOT EXISTS(SELECT 1 FROM payment_attempts a
                          WHERE a.order_id=o.id AND a.status IN ('refunded','charged_back'))`,
    )
    .bind(orderId, PRODUCT_ID)
    .run();
  return Boolean(result.meta.changes);
}

/**
 * Persist consent and only the minimum matching context needed by CAPI.
 * A grant after approval is refused to avoid backfilling old purchases;
 * a revocation is always accepted.
 */
export async function recordMetaConsent(
  env: MetaEnv,
  orderId: string,
  allowed: boolean,
  context: Context = {},
) {
  const db = database(env);
  if (!db) return false;
  const now = Date.now();
  if (!allowed) {
    await db.batch([
      db
        .prepare(
          `INSERT INTO meta_order_consent(order_id,consent,updated_at) VALUES(?,0,?)
           ON CONFLICT(order_id) DO UPDATE SET consent=0,updated_at=excluded.updated_at`,
        )
        .bind(orderId, now),
      db.prepare("DELETE FROM meta_purchase_context WHERE order_id=?").bind(orderId),
    ]);
    return true;
  }
  const granted = await db
    .prepare(
      `INSERT INTO meta_order_consent(order_id,consent,updated_at)
       SELECT id,1,? FROM orders
        WHERE id=? AND status NOT IN ('approved','refunded','charged_back')
       ON CONFLICT(order_id) DO UPDATE SET consent=1,updated_at=excluded.updated_at`,
    )
    .bind(now, orderId)
    .run();
  if (!granted.meta.changes) return false;
  const userAgent = validUserAgent(context.userAgent) ? context.userAgent : null;
  const fbp = validFbp(context.fbp) ? context.fbp : null;
  const sourceUrl = validSourceUrl(context.sourceUrl) ? context.sourceUrl : null;
  if (userAgent || fbp || sourceUrl) {
    await db
      .prepare(
        `INSERT INTO meta_purchase_context(order_id,user_agent,fbp,event_source_url,updated_at)
         VALUES(?,?,?,?,?)
         ON CONFLICT(order_id) DO UPDATE SET
           user_agent=COALESCE(excluded.user_agent,meta_purchase_context.user_agent),
           fbp=COALESCE(excluded.fbp,meta_purchase_context.fbp),
           event_source_url=COALESCE(excluded.event_source_url,meta_purchase_context.event_source_url),
           updated_at=excluded.updated_at`,
      )
      .bind(orderId, userAgent, fbp, sourceUrl, now)
      .run();
  }
  return true;
}

function retryDelay(attempts: number) {
  return Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(attempts - 1, 6));
}

/**
 * Best-effort opt-in CAPI transport. Payment authorization never depends on
 * Meta, and every retry keeps the original event_id.
 */
export async function sendMetaPurchase(
  env: MetaEnv,
  orderId: string,
  eventId: string,
  userAgent?: string | null,
  fbp?: string | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!enabled(env)) return false;
  const db = database(env);
  if (!db) return false;
  try {
    await enqueueMetaPurchase(env, orderId);
    const approved = await approvedPurchase(env, orderId);
    if (!approved) return false;
    if (eventId !== (await metaPurchaseEventId(orderId))) return false;
    const now = Date.now();
    if (approved.created_at > now + 60000 || now - approved.created_at > RETRY_WINDOW_MS) {
      await markDead(db, orderId);
      return false;
    }
    const claim = await db
      .prepare(
        `UPDATE meta_purchase_delivery
            SET state='sending',attempts=attempts+1,locked_at=?
          WHERE order_id=? AND attempts<?
            AND ((state='pending' AND locked_at<=?)
              OR (state='sending' AND locked_at<?))`,
      )
      .bind(now, orderId, MAX_ATTEMPTS, now, now - STALE_CLAIM_MS)
      .run();
    if (!claim.meta.changes) return false;
    const delivery = await db
      .prepare("SELECT attempts FROM meta_purchase_delivery WHERE order_id=?")
      .bind(orderId)
      .first<Delivery>();
    const attempts = delivery?.attempts ?? 1;
    const userData: Record<string, unknown> = {
      external_id: [await sha256Hex(approved.visit_hash)],
    };
    const agent = validUserAgent(userAgent) ? userAgent : approved.user_agent;
    const browserId = validFbp(fbp) ? fbp : approved.fbp;
    if (validUserAgent(agent)) userData.client_user_agent = agent;
    if (validFbp(browserId)) userData.fbp = browserId;
    const sourceUrl = validSourceUrl(approved.event_source_url)
      ? approved.event_source_url
      : validSourceUrl(env.SITE_URL)
        ? env.SITE_URL
        : null;
    const event: Record<string, unknown> = {
      event_name: "Purchase",
      event_time: Math.floor(approved.created_at / 1000),
      event_id: eventId,
      action_source: "website",
      user_data: userData,
      custom_data: {
        value: approved.amount_cents / 100,
        currency: approved.currency,
        content_ids: [PRODUCT_ID],
        content_type: "product",
      },
    };
    if (sourceUrl) event.event_source_url = sourceUrl;
    let retryable = true;
    try {
      const response = await fetcher(
        `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.META_CAPI_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({ data: [event] }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        retryable = response.status === 429 || response.status >= 500;
        throw new Error("Meta returned non-success HTTP status");
      }
      const data = (await response.json().catch(() => ({}))) as {
        events_received?: number;
      };
      if (!Number.isInteger(data.events_received) || (data.events_received ?? 0) < 1)
        throw new Error("Meta did not acknowledge an event");
      await db
        .prepare(
          "UPDATE meta_purchase_delivery SET state='sent',sent_at=? WHERE order_id=? AND state='sending' AND locked_at=?",
        )
        .bind(Date.now(), orderId, now)
        .run();
      return true;
    } catch {
      const next = now + (retryable ? retryDelay(attempts) : RETRY_WINDOW_MS);
      await db
        .prepare(
          `UPDATE meta_purchase_delivery
              SET state='pending',attempts=?,locked_at=?
            WHERE order_id=? AND state='sending' AND locked_at=?`,
        )
        .bind(retryable ? attempts : MAX_ATTEMPTS, next, orderId, now)
        .run()
        .catch(() => {});
      console.warn(
        JSON.stringify({ event: "meta_capi_delivery_unconfirmed", retry: retryable }),
      );
      return false;
    }
  } catch {
    // Missing optional migration, invalid state or storage errors never affect payment.
    console.warn(JSON.stringify({ event: "meta_capi_unavailable" }));
    return false;
  }
}

/**
 * Drain the durable queue. The JotaFy cron calls this so a purchase is still
 * sent when the buyer closes the browser before the webhook/status response.
 */
export async function dispatchMetaPurchases(
  env: MetaEnv,
  fetcher: typeof fetch = fetch,
  limit = 20,
) {
  if (!enabled(env)) return 0;
  const db = database(env);
  if (!db) return 0;
  let rows: { results: { order_id: string }[] };
  try {
    const now = Date.now();
    rows = await db
      .prepare(
        `SELECT d.order_id FROM meta_purchase_delivery d
           JOIN orders o ON o.id=d.order_id
           JOIN meta_order_consent c ON c.order_id=o.id AND c.consent=1
          WHERE d.state IN ('pending','sending') AND d.attempts<?
            AND ((d.state='pending' AND d.locked_at<=?)
              OR (d.state='sending' AND d.locked_at<?))
            AND o.status='approved' AND o.environment='production'
            AND o.product_id=? AND o.amount_cents=1000 AND o.currency='BRL'
            AND EXISTS(SELECT 1 FROM payment_attempts a
                        WHERE a.order_id=o.id AND a.status='approved')
            AND NOT EXISTS(SELECT 1 FROM payment_attempts a
                            WHERE a.order_id=o.id AND a.status IN ('refunded','charged_back'))
          ORDER BY d.locked_at LIMIT ?`,
      )
      .bind(MAX_ATTEMPTS, now, now - STALE_CLAIM_MS, PRODUCT_ID, limit)
      .all<{ order_id: string }>();
  } catch {
    return 0;
  }
  let sent = 0;
  let cursor = 0;
  // A single cron tick drains the queue with bounded concurrency: sequential
  // sends could exceed the tick budget when several deliveries are pending.
  await Promise.all(
    Array.from({ length: Math.min(DISPATCH_CONCURRENCY, rows.results.length) }, async () => {
      while (cursor < rows.results.length) {
        const row = rows.results[cursor++];
        if (
          await sendMetaPurchase(
            env,
            row.order_id,
            await metaPurchaseEventId(row.order_id),
            undefined,
            undefined,
            fetcher,
          )
        )
          sent++;
      }
    }),
  );
  return sent;
}
