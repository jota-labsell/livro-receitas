-- Additive migrations only. Existing orders, payment constraints and Meta purchase state are untouched.
CREATE TABLE IF NOT EXISTS jotafy_products (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 100000000),
 currency TEXT NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
 status TEXT NOT NULL CHECK(status IN ('live','draft','archived')),
 delivery_kind TEXT NOT NULL DEFAULT 'digital' CHECK(delivery_kind='digital'),
 image_url TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1
);
INSERT OR IGNORE INTO jotafy_products(id,name,description,price_cents,currency,status,delivery_kind,image_url,created_at,updated_at)
 VALUES('150-doces-comer-vender','150 Doces para Comer e Vender','E-book digital com 150 receitas.',1000,'BRL','live','digital','/ebook/page-0.webp',0,0);
CREATE INDEX IF NOT EXISTS jotafy_products_status ON jotafy_products(status,updated_at);
CREATE TABLE IF NOT EXISTS meta_ads_connection (
 id INTEGER PRIMARY KEY CHECK(id=1),
 token_enc TEXT NOT NULL,
 iv TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 user_id TEXT NOT NULL,
 ad_account_id TEXT NOT NULL DEFAULT '',
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_ads_oauth_states (
 state_hash TEXT PRIMARY KEY,
 actor TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS meta_ads_oauth_expiry ON meta_ads_oauth_states(expires_at);
