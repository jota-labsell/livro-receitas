CREATE TABLE IF NOT EXISTS operation_sessions (
 visit_hash TEXT PRIMARY KEY, source TEXT NOT NULL, medium TEXT NOT NULL, campaign TEXT NOT NULL,
 content TEXT NOT NULL, term TEXT NOT NULL, landing TEXT NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS operation_session_time ON operation_sessions(first_seen);
CREATE TABLE IF NOT EXISTS operation_settings (id INTEGER PRIMARY KEY CHECK(id=1),pixel_id TEXT NOT NULL,capi_paused INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS operation_audit (id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS operation_health (name TEXT PRIMARY KEY,last_run INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS operation_order_pixel (order_id TEXT PRIMARY KEY REFERENCES orders(id),pixel_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS operation_account (id INTEGER PRIMARY KEY CHECK(id=1),email TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS operation_admin_sessions (
 nonce_hash TEXT PRIMARY KEY,actor TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('key','password')),
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS operation_admin_session_expiry ON operation_admin_sessions(expires_at);
INSERT OR IGNORE INTO operation_order_pixel(order_id,pixel_id)
 SELECT id,'1150409944170993' FROM orders;
