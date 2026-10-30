-- Additive matching and delivery diagnostics. Existing purchases are not backfilled.
CREATE TABLE IF NOT EXISTS meta_purchase_match (
 order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 fbc TEXT,
 client_ip TEXT,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_delivery_results (
 order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 http_status INTEGER,
 error_code INTEGER,
 trace_id TEXT,
 checked_at INTEGER NOT NULL
);
