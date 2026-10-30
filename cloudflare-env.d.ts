/// <reference types="@cloudflare/workers-types" />
declare global {
  interface CloudflareEnv {
    EBOOKS?: R2Bucket;
    ORDERS?: D1Database;
    SITE_URL?: string;
    MERCADOPAGO_ACCESS_TOKEN?: string;
    MERCADOPAGO_PUBLIC_KEY?: string;
    MERCADOPAGO_WEBHOOK_SECRET?: string;
    MERCADOPAGO_COLLECTOR_ID?: string;
    MERCADOPAGO_MODE?: string;
    CHECKOUT_ENABLED?: string;
    LIVE_PAYMENTS_ENABLED?: string;
    META_CAPI_ENABLED?: string;
    META_CAPI_ACCESS_TOKEN?: string;
    EBOOK_ADMIN_KEY?: string;
    PLATFORM_ENCRYPTION_KEY?: string;
    JOTAFY_PLATFORM_ENABLED?: string;
    META_GRAPH_VERSION?: string;
  }
}
export {};
