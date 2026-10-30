-- Schema-only snapshot of existing Jotafy tables, no rows or secrets. For local tests, not a new remote migration.
CREATE TABLE IF NOT EXISTS jotafy_devices (
 id TEXT PRIMARY KEY, auth_hash TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 token_cipher TEXT NOT NULL, preferences TEXT NOT NULL,
 registered_after INTEGER NOT NULL, enqueued_through INTEGER NOT NULL,
 registered_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
, application_id TEXT NOT NULL DEFAULT 'com.jotafy.app'
 CHECK(application_id IN ('com.jotafy.app','com.jotafy.app.preview')));
CREATE TABLE IF NOT EXISTS jotafy_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT NOT NULL UNIQUE,
 order_id TEXT NOT NULL, kind TEXT NOT NULL, method TEXT NOT NULL,
 amount_cents INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS jotafy_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 device_id TEXT NOT NULL REFERENCES jotafy_devices(id) ON DELETE CASCADE,
 event_seq INTEGER NOT NULL REFERENCES jotafy_events(seq),
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 available_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0,
 claim TEXT, last_error TEXT, created_at INTEGER NOT NULL,
 UNIQUE(device_id,event_seq)
);
CREATE TABLE IF NOT EXISTS jotafy_push_tests (
 id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES jotafy_devices(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, available_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0, claim TEXT, last_error TEXT,
 received_at INTEGER, posted_at INTEGER, blocked_at INTEGER
);
