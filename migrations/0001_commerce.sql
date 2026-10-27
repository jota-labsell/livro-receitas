PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, access_hash TEXT NOT NULL UNIQUE, visit_hash TEXT NOT NULL,
 product_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents = 1000),
 currency TEXT NOT NULL CHECK(currency = 'BRL'), status TEXT NOT NULL DEFAULT 'created',
 active_attempt TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_attempts (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
 request_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'processing',
 payment_id TEXT UNIQUE, provider_updated_at INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_order ON payment_attempts(order_id);
CREATE TABLE IF NOT EXISTS webhook_receipts (
 id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, processed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS funnel_events (
 event_key TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(name IN ('offer_view','cta_click','checkout_start','purchase_approved')),
 visit_hash TEXT NOT NULL, order_id TEXT, amount_cents INTEGER, currency TEXT,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS funnel_name_time ON funnel_events(name, created_at);
