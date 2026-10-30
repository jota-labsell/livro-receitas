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
    META_PIXEL_ENABLED?: string;
    META_CAPI_ENABLED?: string;
    META_CAPI_ACCESS_TOKEN?: string;
    EBOOK_ADMIN_KEY?: string;
    META_ADS_APP_ID?: string;
    META_ADS_APP_SECRET?: string;
    META_ADS_ENCRYPTION_KEY?: string;
  }
}
export {};
