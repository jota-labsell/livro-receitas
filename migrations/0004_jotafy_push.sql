CREATE TABLE IF NOT EXISTS jotafy_devices (
 id TEXT PRIMARY KEY, auth_hash TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 token_cipher TEXT NOT NULL, preferences TEXT NOT NULL,
 registered_after INTEGER NOT NULL, enqueued_through INTEGER NOT NULL,
 registered_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS jotafy_devices_active ON jotafy_devices(active, updated_at);
CREATE TABLE IF NOT EXISTS jotafy_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 device_id TEXT NOT NULL REFERENCES jotafy_devices(id) ON DELETE CASCADE,
 event_seq INTEGER NOT NULL REFERENCES jotafy_events(seq),
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 available_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0,
 claim TEXT, last_error TEXT, created_at INTEGER NOT NULL,
 UNIQUE(device_id,event_seq)
);
CREATE INDEX IF NOT EXISTS jotafy_outbox_ready ON jotafy_outbox(status,available_at,lease_until);
