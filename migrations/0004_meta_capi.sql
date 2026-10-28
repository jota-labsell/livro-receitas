-- Additive consent and delivery state for opt-in Meta Purchase events. No historical backfill.
ALTER TABLE orders ADD COLUMN meta_consent INTEGER NOT NULL DEFAULT 0 CHECK(meta_consent IN (0,1));
CREATE TABLE IF NOT EXISTS meta_purchase_delivery (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_at INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER
);
