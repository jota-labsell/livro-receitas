CREATE TABLE IF NOT EXISTS jotafy_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT NOT NULL UNIQUE,
 order_id TEXT NOT NULL, kind TEXT NOT NULL, method TEXT NOT NULL,
 amount_cents INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jotafy_events_time ON jotafy_events(created_at);
