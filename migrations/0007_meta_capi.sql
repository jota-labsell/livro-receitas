-- Additive Meta measurement state. No historical backfill.
-- Numbered after the JotaFy migrations to avoid the former 0004 collision.
-- These tables are independent from the previous opt-in column, so this file
-- can be applied even if an earlier 0004_meta_capi.sql was ever recorded.
CREATE TABLE IF NOT EXISTS meta_order_consent (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  consent INTEGER NOT NULL DEFAULT 0 CHECK(consent IN (0,1)),
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_purchase_context (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  user_agent TEXT,
  fbp TEXT,
  event_source_url TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_purchase_delivery (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_at INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS meta_purchase_delivery_ready
  ON meta_purchase_delivery(state, locked_at);

