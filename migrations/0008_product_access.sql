-- Independent from marketing. Only hashes of bearer credentials are stored.
CREATE TABLE IF NOT EXISTS product_access_grants (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES orders(id),
 token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS product_access_order ON product_access_grants(order_id,created_at);
CREATE TABLE IF NOT EXISTS product_access_sessions (
 token_hash TEXT PRIMARY KEY,
 grant_id TEXT NOT NULL REFERENCES product_access_grants(id),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS product_access_audit (
 id TEXT PRIMARY KEY,
 order_id TEXT,
 grant_id TEXT,
 action TEXT NOT NULL,
 actor TEXT NOT NULL,
 previous_status TEXT,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS product_access_audit_time ON product_access_audit(created_at);
CREATE TABLE IF NOT EXISTS product_access_limits (
 bucket TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS product_access_grants_expiry ON product_access_grants(expires_at);
CREATE INDEX IF NOT EXISTS product_access_sessions_expiry ON product_access_sessions(expires_at);
CREATE INDEX IF NOT EXISTS product_access_limits_expiry ON product_access_limits(expires_at);
