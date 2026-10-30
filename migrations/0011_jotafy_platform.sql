-- Additive migration. Legacy orders and every existing FK/cookie remain authoritative.
ALTER TABLE payment_attempts ADD COLUMN external_reference TEXT;
CREATE UNIQUE INDEX legacy_external_reference ON payment_attempts(external_reference) WHERE external_reference IS NOT NULL;
CREATE TABLE platform_products (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', sales_url TEXT NOT NULL DEFAULT '',
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0 AND amount_cents<=100000000),
 currency TEXT NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
 status TEXT NOT NULL CHECK(status IN ('draft','active','paused','archived')),
 delivery_type TEXT NOT NULL CHECK(delivery_type IN ('file','external','manual')),
 file_key TEXT, external_url TEXT, instructions TEXT NOT NULL DEFAULT '',
 mp_public_key TEXT, mp_collector_id TEXT, mp_token TEXT, mp_webhook_secret TEXT,
 pixel_id TEXT, capi_token TEXT, capi_enabled INTEGER NOT NULL DEFAULT 0,
 meta_integration_id TEXT, cost_cents INTEGER CHECK(cost_cents>=0), fee_bps INTEGER CHECK(fee_bps BETWEEN 0 AND 10000), expense_cents INTEGER CHECK(expense_cents>=0),
 version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
INSERT INTO platform_products(id,slug,name,description,sales_url,amount_cents,currency,status,delivery_type,instructions,pixel_id,capi_enabled,created_at,updated_at)
 VALUES('150-doces-comer-vender','150-doces-comer-vender','150 Doces para Comer e Vender','150 receitas em PDF','https://livro-receitas.joaolucasqtb.workers.dev/',1000,'BRL','active','file','Baixe seu e-book após a confirmação do pagamento.','1150409944170993',1,CAST(strftime('%s','now') AS INTEGER)*1000,CAST(strftime('%s','now') AS INTEGER)*1000);
CREATE TABLE platform_legacy_products(order_id TEXT PRIMARY KEY REFERENCES orders(id),product_id TEXT NOT NULL REFERENCES platform_products(id));
INSERT INTO platform_legacy_products SELECT id,'150-doces-comer-vender' FROM orders WHERE product_id='150-doces-comer-vender';
CREATE TABLE platform_customers(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
CREATE TABLE platform_sessions(
 id TEXT NOT NULL,product_id TEXT NOT NULL REFERENCES platform_products(id),first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL,
 source TEXT NOT NULL,utm_source TEXT,utm_medium TEXT,utm_campaign TEXT,utm_content TEXT,utm_term TEXT,
 campaign_id TEXT,adset_id TEXT,ad_id TEXT,fbclid TEXT,fbc TEXT,fbp TEXT,user_agent TEXT,client_ip TEXT,consent INTEGER NOT NULL,pixel_id TEXT,source_url TEXT,
 PRIMARY KEY(id,product_id)
);
CREATE INDEX platform_session_time ON platform_sessions(product_id,first_seen,source,campaign_id,adset_id,ad_id);
CREATE TABLE platform_orders(
 id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES platform_products(id),customer_id TEXT REFERENCES platform_customers(id),
 access_hash TEXT NOT NULL UNIQUE,session_id TEXT,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),currency TEXT NOT NULL CHECK(currency='BRL'),
 status TEXT NOT NULL DEFAULT 'created',active_attempt TEXT,method TEXT,
 product_name TEXT NOT NULL,pixel_id TEXT,capi_enabled INTEGER NOT NULL,capi_token TEXT,
 mp_token TEXT,mp_collector_id TEXT,mp_webhook_secret TEXT,
 delivery_type TEXT NOT NULL,file_key TEXT,external_url TEXT,instructions TEXT NOT NULL,
 cost_cents INTEGER,fee_bps INTEGER,expense_cents INTEGER,
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
 FOREIGN KEY(session_id,product_id) REFERENCES platform_sessions(id,product_id)
);
CREATE INDEX platform_orders_filter ON platform_orders(product_id,created_at,status,method,pixel_id);
CREATE TABLE platform_attempts(
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES platform_orders(id),external_reference TEXT NOT NULL UNIQUE,
 request_hash TEXT NOT NULL,provider_id TEXT UNIQUE,status TEXT NOT NULL,provider_updated_at INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE INDEX platform_attempt_order ON platform_attempts(order_id,status);
CREATE TABLE platform_events(
 event_id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES platform_products(id),session_id TEXT,order_id TEXT REFERENCES platform_orders(id),
 name TEXT NOT NULL CHECK(name IN ('visit','ViewContent','InitiateCheckout','payment_created','approved','rejected','refunded','charged_back','delivery','download','download_blocked','site_click','webhook')),
 created_at INTEGER NOT NULL,detail TEXT,
 FOREIGN KEY(session_id,product_id) REFERENCES platform_sessions(id,product_id)
);
CREATE INDEX platform_events_funnel ON platform_events(product_id,name,created_at,session_id);
CREATE INDEX platform_events_order ON platform_events(order_id,created_at);
CREATE TABLE platform_meta_events(
 event_id TEXT PRIMARY KEY,name TEXT NOT NULL,product_id TEXT NOT NULL REFERENCES platform_products(id),
 order_id TEXT REFERENCES platform_orders(id),session_id TEXT,pixel_id TEXT NOT NULL,token TEXT,
 state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,
 http_status INTEGER,error_code INTEGER,created_at INTEGER NOT NULL,sent_at INTEGER,
 FOREIGN KEY(session_id,product_id) REFERENCES platform_sessions(id,product_id)
);
CREATE INDEX platform_meta_queue ON platform_meta_events(state,available_at,lease_until);
CREATE TABLE platform_grants(
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES platform_orders(id),token_hash TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER
);
CREATE TABLE platform_access_sessions(token_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES platform_grants(id),expires_at INTEGER NOT NULL);
CREATE TABLE platform_downloads(id TEXT PRIMARY KEY,order_id TEXT REFERENCES platform_orders(id),product_id TEXT REFERENCES platform_products(id),result TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX platform_download_time ON platform_downloads(created_at,result);
CREATE TABLE platform_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE platform_health(name TEXT PRIMARY KEY,last_success INTEGER,last_attempt INTEGER,error_code TEXT);
CREATE TABLE platform_meta_integrations(
 id TEXT PRIMARY KEY,name TEXT NOT NULL,account_id TEXT NOT NULL UNIQUE,token TEXT NOT NULL,pixel_id TEXT,
 attribution TEXT NOT NULL DEFAULT '7d_click,1d_view',enabled INTEGER NOT NULL DEFAULT 0,
 last_sync INTEGER,last_attempt INTEGER,error_code TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
 currency TEXT,timezone TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE TABLE platform_ads_entities(
 integration_id TEXT NOT NULL REFERENCES platform_meta_integrations(id),id TEXT NOT NULL,kind TEXT NOT NULL,
 parent_id TEXT,name TEXT NOT NULL,status TEXT,product_id TEXT REFERENCES platform_products(id),
 updated_at INTEGER NOT NULL,PRIMARY KEY(integration_id,id,kind)
);
CREATE INDEX platform_ads_product ON platform_ads_entities(product_id,integration_id);
CREATE TABLE platform_ads_daily(
 integration_id TEXT NOT NULL REFERENCES platform_meta_integrations(id),day TEXT NOT NULL,level TEXT NOT NULL,
 entity_id TEXT NOT NULL,account_id TEXT NOT NULL,campaign_id TEXT NOT NULL DEFAULT '',adset_id TEXT NOT NULL DEFAULT '',ad_id TEXT NOT NULL DEFAULT '',
 spend_cents INTEGER NOT NULL,impressions INTEGER,reach INTEGER,frequency REAL,link_clicks INTEGER,ctr REAL,cpc REAL,cpm REAL,
 attribution TEXT NOT NULL,synced_at INTEGER NOT NULL,
 PRIMARY KEY(integration_id,day,level,entity_id,attribution)
);
CREATE INDEX platform_ads_date ON platform_ads_daily(day,integration_id,campaign_id,adset_id,ad_id);
CREATE TABLE platform_ads_coverage(integration_id TEXT NOT NULL REFERENCES platform_meta_integrations(id),day TEXT NOT NULL,attribution TEXT NOT NULL,synced_at INTEGER NOT NULL,PRIMARY KEY(integration_id,day,attribution));
CREATE VIEW platform_all_orders AS
 SELECT o.id,o.product_id,NULL AS customer_id,NULL AS customer_email,NULL AS customer_name,o.amount_cents,o.currency,o.status,
 COALESCE((SELECT e.method FROM jotafy_events e WHERE e.order_id=o.id ORDER BY seq DESC LIMIT 1),'unknown') method,
 o.visit_hash session_id,o.created_at,o.updated_at,'legacy' ledger,
 COALESCE((SELECT p.pixel_id FROM operation_order_pixel p WHERE p.order_id=o.id),'1150409944170993') pixel_id,'production' environment,(SELECT MIN(f.created_at) FROM funnel_events f WHERE f.order_id=o.id AND f.name='purchase_approved') approved_at
 FROM orders o WHERE o.environment='production'
 UNION ALL
 SELECT o.id,o.product_id,o.customer_id,c.email,c.name,o.amount_cents,o.currency,o.status,o.method,o.session_id,o.created_at,o.updated_at,'platform',o.pixel_id,'production',(SELECT MIN(e.created_at) FROM platform_events e WHERE e.order_id=o.id AND e.name='approved')
 FROM platform_orders o LEFT JOIN platform_customers c ON c.id=o.customer_id;
CREATE VIEW platform_all_sessions AS
 SELECT id,product_id,first_seen,last_seen,source,utm_source,utm_medium,utm_campaign,campaign_id,adset_id,ad_id,pixel_id FROM platform_sessions
 UNION ALL
 SELECT visit_hash,'150-doces-comer-vender',first_seen,last_seen,source,source,medium,campaign,NULL,NULL,NULL,NULL
 FROM operation_sessions l WHERE NOT EXISTS(SELECT 1 FROM platform_sessions s WHERE s.id=l.visit_hash AND s.product_id='150-doces-comer-vender');
UPDATE platform_products SET pixel_id=COALESCE((SELECT pixel_id FROM operation_settings WHERE id=1),pixel_id),capi_enabled=CASE WHEN COALESCE((SELECT capi_paused FROM operation_settings WHERE id=1),0)=1 THEN 0 ELSE 1 END WHERE id='150-doces-comer-vender';
CREATE TABLE platform_roles(account_id INTEGER PRIMARY KEY REFERENCES operation_account(id),role TEXT NOT NULL CHECK(role IN ('administrator','operator')));
INSERT INTO platform_roles SELECT id,'administrator' FROM operation_account;
